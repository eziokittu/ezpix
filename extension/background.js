import {captureSource,presentPopup,consumePopupReturn,consumeWebsitePopup} from './toolbar-popup.js';
import {openMediaCapture,handleMediaRequest} from './media-capture.js';
import {waitForTabReady} from './navigation.js';
import { state, purgeExpired, updateState } from './db.js';
import { selectOnPage } from './selector.js';
import { authorize, authorizeDiscovery, authorizePopup, responseFor, TRANSFER_LIMIT } from './protocol.js';
import { decodeProject, ENGINE_VERSION } from '../packages/core/dist/index.js';
import { imageDimensions } from '../packages/core/dist/browser.js';
import { WEBSITE_ORIGIN, WEBSITE_HANDOFF_ENABLED } from './config.js';
const EXPIRY=10*60*1000;
const token=()=>[...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');
const arm=async()=>{const items=await Promise.all(['capture','transfer','selection','mediaSession','popupReturn','websitePopup'].map(key=>state(key)));const times=items.filter(Boolean).map(item=>item.expires);if(times.length)await chrome.alarms.create('ezpix-expiry',{when:Math.max(Date.now()+100,Math.min(...times))});};
chrome.alarms.onAlarm.addListener(()=>{void purgeExpired().then(arm);});
chrome.tabs.onRemoved.addListener(id=>{void updateState('transfer',record=>record?.tabId===id?null:record);void updateState('mediaSession',record=>record?.tabId===id?null:record);});
let busy=false;
async function notifyCapture(windowId,tabId,type='CAPTURE_READY'){try{await chrome.runtime.sendMessage({type});}catch{/* Reopening reads the retained capture. */}await presentPopup(windowId,tabId);}
function internal(sender,page) { if(sender.id!==chrome.runtime.id || sender.url!==chrome.runtime.getURL(page))throw new Error('Request denied.'); }
async function start(message,sender) {
  internal(sender,'app.html');
  if(!['region','element','visible'].includes(message.mode))throw new Error('Invalid capture mode.');
  const tab=await captureSource(message.source);
  if(!tab?.id || !/^https?:/.test(tab.url??''))throw new Error('Open a normal HTTP or HTTPS webpage first. Browser and extension pages cannot be selected.');
  const nonce=token(); await state('selection',{tabId:tab.id,windowId:tab.windowId,nonce,expires:Date.now()+EXPIRY});await arm();
  if(message.mode==='visible') {
    const [info]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>({viewportWidth:innerWidth,viewportHeight:innerHeight,scrollX,scrollY,dpr:devicePixelRatio})});
    const record=await state('selection');record.documentId=info.documentId;await state('selection',record);
    return await capture({nonce,rect:{x:0,y:0,width:info.result.viewportWidth,height:info.result.viewportHeight},...info.result},{tab,documentId:info.documentId,frameId:0});
  }
  const [injection]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:selectOnPage,args:[message.mode,nonce]});
  const pending=await state('selection'); if(pending?.nonce===nonce){pending.documentId=injection.documentId;await state('selection',pending);}
  return {status:'selecting'};
}
async function capture(message,sender) {
  const pending=await state('selection');
  if(!pending || pending.nonce!==message.nonce || sender.tab?.id!==pending.tabId || sender.frameId!==0 || sender.documentId!==pending.documentId || pending.expires<=Date.now())throw new Error('Selection expired or page changed. Start again.');
  if(busy)throw new Error('A capture is already running.');busy=true;
  try {
    await state('selection',null);
    const [active]=await chrome.tabs.query({active:true,windowId:pending.windowId});if(active?.id!==pending.tabId)throw new Error('The active tab changed. Capture cancelled.');
    const r=message.rect;
    if(!r || ![r.x,r.y,r.width,r.height,message.viewportWidth,message.viewportHeight].every(Number.isFinite) || r.x<0 || r.y<0 || r.width<2 || r.height<2 || r.x+r.width>message.viewportWidth+1 || r.y+r.height>message.viewportHeight+1)throw new Error('Invalid visible crop.');
    async function verify() {
      const [current]=await chrome.scripting.executeScript({target:{tabId:pending.tabId},func:()=>({viewportWidth:innerWidth,viewportHeight:innerHeight,scrollX,scrollY,dpr:devicePixelRatio})});
      const [tab]=await chrome.tabs.query({active:true,windowId:pending.windowId});
      if(tab?.id!==pending.tabId || current.documentId!==pending.documentId || ['viewportWidth','viewportHeight','scrollX','scrollY','dpr'].some(k=>current.result[k]!==message[k]))throw new Error('Page moved or changed during capture. Start again.');
    }
    await verify(); const dataUrl=await chrome.tabs.captureVisibleTab(pending.windowId,{format:'png'}); await verify();
    const blob=await (await fetch(dataUrl)).blob();
    const dimensions=imageDimensions(new Uint8Array(await blob.arrayBuffer()));
    if(dimensions.width*dimensions.height>16*1024*1024)throw new Error('Visible screenshot exceeds 16 megapixels. Use a smaller browser window.');
    const bitmap=await createImageBitmap(blob);
    let crop;
    try {
      const sx=bitmap.width/message.viewportWidth, sy=bitmap.height/message.viewportHeight;
      const x=Math.floor(r.x*sx),y=Math.floor(r.y*sy),w=Math.min(bitmap.width-x,Math.ceil((r.x+r.width)*sx)-x),h=Math.min(bitmap.height-y,Math.ceil((r.y+r.height)*sy)-y);
      if(w*h>4*1024*1024)throw new Error('Crop exceeds 4 megapixels. Select a smaller region.');
      const canvas=new OffscreenCanvas(w,h);canvas.getContext('2d').drawImage(bitmap,x,y,w,h,0,0,w,h);crop=await canvas.convertToBlob({type:'image/png'});
    } finally {bitmap.close();}
    await state('capture',{blob:crop,expires:Date.now()+EXPIRY});await arm();
    await notifyCapture(pending.windowId,pending.tabId);return {status:'captured'};
  } finally {busy=false;}
}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  (async()=>{
    await purgeExpired();
    if(message?.type==='RESET_STUDIO'){
      internal(sender,'app.html');
      const captures=await chrome.runtime.getContexts({contextTypes:['TAB'],documentUrls:[chrome.runtime.getURL('media.html')]});
      await Promise.all(['capture','transfer','selection','mediaSession','popupReturn','websitePopup'].map(key=>state(key,null)));
      await Promise.all([...new Set(captures.filter(c=>c.frameId===0&&c.tabId>=0).map(c=>c.tabId))].map(id=>chrome.tabs.remove(id).catch(()=>{})));
      return {status:'reset'};
    }
    if(message?.type==='MEDIA_OPEN'){internal(sender,'app.html');const result=await openMediaCapture(message.mode,message.source);await arm();return result;}
    if(['MEDIA_INIT','MEDIA_COMPLETE','MEDIA_CANCEL'].includes(message?.type)){const result=await handleMediaRequest(message,sender);await arm();return result;}
    if(message?.type==='POPUP_OPEN'){
      internal(sender,'app.html');
      if(await consumeWebsitePopup(message.source)){
        // Opening a popup from a webpage does not grant activeTab. Keep local
        // media usable without a capture error or requesting broad host access.
        const [tab]=await chrome.tabs.query({active:true,windowId:message.source.windowId});
        await state('popupReturn',null);
        if(tab?.id!==message.source.tabId||!/^https?:/.test(tab.url??''))return {status:'choose',message:'Open media, camera or screen sharing. To capture this page, click the pinned EzPIX Insta toolbar icon.'};
      }
      if(await consumePopupReturn(message.source))return {status:'restore'};
      return await start({...message,mode:'visible'},sender);
    }
    if(message?.type==='START')return await start(message,sender);
    if(message?.type==='SELECTED')return await capture(message,sender);
    if(message?.type==='CANCEL'){const pending=await state('selection');if(pending?.nonce===message.nonce&&sender.tab?.id===pending.tabId&&sender.frameId===0&&sender.documentId===pending.documentId){await state('selection',null);await notifyCapture(pending.windowId,pending.tabId,'CAPTURE_CANCELLED');}return {status:'cancelled'};}
    if(message?.type==='HANDOFF') {
      if(!WEBSITE_HANDOFF_ENABLED)throw Error('Website transfer is unavailable in this standalone release. Download your project instead.');
      internal(sender,'app.html');
      if(typeof message.project!=='string' || new TextEncoder().encode(message.project).length>TRANSFER_LIMIT)throw new Error('Transfer exceeds 16 MiB. Download the project, then open it in EzPix.');
      decodeProject(message.project);
      const bytes=new TextEncoder().encode(message.project),sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join(''),secret=token();
      // Initialize an active extension page before persisting and navigating this bound tab.
      const tab=await chrome.tabs.create({url:chrome.runtime.getURL('handoff.html'),active:true});
      await waitForTabReady(tab.id);
      await state('transfer',{token:secret,tabId:tab.id,origin:WEBSITE_ORIGIN,engine:ENGINE_VERSION,sha256,bytes,expires:Date.now()+EXPIRY,acked:false});await arm();
      try {await chrome.tabs.update(tab.id,{url:`${WEBSITE_ORIGIN}/tools/ezpix#ezpix=${chrome.runtime.id}.${secret}`,active:true});}catch(error){await state('transfer',null);throw error;}
      return {status:'opened'};
    }
    throw new Error('Unsupported request.');
  })().then(reply,async error=>{if(message?.type==='SELECTED'){await state('capture',{error:error.message??'Capture failed.',expires:Date.now()+EXPIRY});await arm();await notifyCapture(sender.tab?.windowId,sender.tab?.id);}reply({error:error.message??'Capture failed. Try a different page.'});});return true;
});
let openingWebsitePopup=false;
chrome.runtime.onMessageExternal.addListener((message,sender,reply)=>{
  (async()=>{
    if(!WEBSITE_HANDOFF_ENABLED)throw Error('Website integration is unavailable in this release.');
    if(message?.op==='discover'){authorizeDiscovery(message,sender,WEBSITE_ORIGIN);return {protocol:1,engine:ENGINE_VERSION,status:'available',openPopup:true,version:chrome.runtime.getManifest().version};}
    if(message?.op==='open-popup'){
      // Validate the caller before asking Chrome to show any extension UI.
      authorizeDiscovery({...message,op:'discover'},sender,WEBSITE_ORIGIN);
      if(openingWebsitePopup)throw Error('Popup opening is already in progress.');
      openingWebsitePopup=true;
      try{
        const window=await chrome.windows.getLastFocused({windowTypes:['normal']});
        const [tab]=await chrome.tabs.query({active:true,windowId:window.id});
        authorizePopup(message,sender,WEBSITE_ORIGIN,window,tab);
        if(!(await chrome.runtime.getContexts({contextTypes:['POPUP']})).length){
          const launch={tabId:tab.id,windowId:window.id,expires:Date.now()+10000};
          await state('websitePopup',launch);await arm();
          try{await chrome.action.openPopup({windowId:window.id});}
          catch(error){await updateState('websitePopup',record=>record?.expires===launch.expires?null:record);throw error;}
        }
        return {protocol:1,status:'opened'};
      }finally{openingWebsitePopup=false;}
    }
    await purgeExpired();const record=await state('transfer');authorize(record,message,sender,WEBSITE_ORIGIN);
    const response=responseFor(record,message);
    if(message.op==='ack')await updateState('transfer',current=>{authorize(current,message,sender,WEBSITE_ORIGIN);responseFor(current,message);const receipt={...current,acked:true};delete receipt.bytes;return receipt;});
    return response;
  })().then(reply,()=>reply({error:message?.op==='open-popup'?'Chrome could not open EzPIX Insta. Click its pinned toolbar icon.':'Transfer denied or expired.'}));return true;
});
