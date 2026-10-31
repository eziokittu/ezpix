import {database,state,updateState} from './db.js';
import {waitForTabReady} from './navigation.js';
import {presentPopup} from './toolbar-popup.js';
import {imageDimensions} from '../packages/core/dist/browser.js';

const PAGE='media.html',EXPIRY=10*60*1000;
let opening=false;
export function authorizeMedia(record,sender,contexts,id,url,nonce,now=Date.now()){
 if(!record||!Number.isSafeInteger(record.expires)||record.expires<=now||sender.id!==id||sender.url!==url||sender.frameId!==0||typeof sender.documentId!=='string'||!sender.documentId||!contexts.some(c=>c.tabId===record.tabId&&c.frameId===0&&c.documentId===sender.documentId)||typeof nonce!=='string'||nonce!==record.nonce)throw Error('Capture tab expired or changed. Start Camera or Live screen again from EzPIX.');
 return record;
}
export async function openMediaCapture(mode,source){
 if(!['camera','screen'].includes(mode)||!Number.isInteger(source?.tabId)||!Number.isInteger(source?.windowId))throw Error('Open the EzPIX toolbar popup on the tab you want to return to.');
 if(opening)throw Error('A capture tab is already opening.');opening=true;
 let created;
 try{
  const previous=await state('mediaSession');
  if(previous&&previous.expires>Date.now()&&(await chrome.runtime.getContexts({tabIds:[previous.tabId],documentUrls:[chrome.runtime.getURL(PAGE)]})).length){
   if(previous.mode!==mode)throw Error('Finish or cancel the open capture tab first.');
   await chrome.tabs.update(previous.tabId,{active:true});return {status:'opened'};
  }
  const [active]=await chrome.tabs.query({active:true,windowId:source.windowId});
  if(active?.id!==source.tabId)throw Error('The active tab changed. Open the EzPIX popup again.');
  created=await chrome.tabs.create({url:'about:blank',active:true,windowId:source.windowId});await waitForTabReady(created.id);
  const nonce=[...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');
  await state('mediaSession',{tabId:created.id,sourceTabId:source.tabId,windowId:source.windowId,mode,nonce,expires:Date.now()+EXPIRY});
  await chrome.tabs.update(created.id,{url:chrome.runtime.getURL(PAGE)});return {status:'opened'};
 }catch(error){if(created){await updateState('mediaSession',record=>record?.tabId===created.id?null:record);await chrome.tabs.remove(created.id).catch(()=>{});}throw error;}
 finally{opening=false;}
}
async function returnToPopup(record,documentId){
 const contexts=await chrome.runtime.getContexts({tabIds:[record.tabId],documentUrls:[chrome.runtime.getURL(PAGE)]});
 if(!contexts.some(c=>c.documentId===documentId))return;
 const source=await chrome.tabs.get(record.sourceTabId).catch(()=>null);
 if(!source||source.windowId!==record.windowId)return;
 const [active]=await chrome.tabs.query({active:true,windowId:record.windowId});
 if(active?.id===record.tabId)await chrome.tabs.update(record.sourceTabId,{active:true});
 await chrome.tabs.remove(record.tabId);
 if(active?.id===record.tabId)await presentPopup(record.windowId,record.sourceTabId);
}
// One transaction prevents a late photo from resurrecting media after RESET/expiry.
async function commitCapture(record,blob){
 const db=await database();
 try{await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite'),store=tx.objectStore('state'),request=store.get('mediaSession');let error;
  request.onsuccess=()=>{const current=request.result;if(current?.nonce!==record.nonce||current.expires<=Date.now()){error=Error('Capture expired or was reset. Start again.');tx.abort();return;}store.put({blob,expires:Date.now()+EXPIRY},'capture');store.delete('mediaSession');};
  tx.oncomplete=resolve;tx.onerror=()=>reject(error??Error('Could not save the capture locally.'));tx.onabort=tx.onerror;
 });}finally{db.close();}
}
export async function handleMediaRequest(message,sender){
 const record=await state('mediaSession'),url=chrome.runtime.getURL(PAGE);
 const contexts=record?await chrome.runtime.getContexts({tabIds:[record.tabId],documentUrls:[url]}):[];
 authorizeMedia(record,sender,contexts,chrome.runtime.id,url,message.type==='MEDIA_INIT'?record?.nonce:message.nonce);
 if(message.type==='MEDIA_INIT')return {mode:record.mode,nonce:record.nonce,expires:record.expires};
 if(message.type==='MEDIA_CANCEL'){
  await updateState('mediaSession',current=>{if(current?.nonce!==record.nonce)throw Error('Capture expired.');return null;});
  await returnToPopup(record,sender.documentId);return {status:'cancelled'};
 }
 if(message.type!=='MEDIA_COMPLETE')throw Error('Unsupported capture request.');
 if(typeof message.image!=='string'||message.image.length>24*1024*1024||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(message.image))throw Error('Invalid or oversized capture.');
 const blob=await(await fetch(message.image)).blob(),bytes=new Uint8Array(await blob.arrayBuffer());
 if(![137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value))throw Error('Invalid PNG capture.');
 const size=imageDimensions(bytes);
 if(size.width<1||size.height<1||size.width*size.height>4*1024*1024)throw Error('Capture exceeds four megapixels.');
 const bitmap=await createImageBitmap(blob);bitmap.close();
 await commitCapture(record,blob);await returnToPopup(record,sender.documentId);return {status:'saved'};
}
