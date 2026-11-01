import { mountFocusStudio } from '../packages/core/dist/focus-ui.js';
import { encodeProject } from '../packages/core/dist/index.js';
import { readImage } from '../packages/core/dist/browser.js';
import { state, purgeExpired } from './db.js';
import { mountTheme } from './theme.js';
import { mountFloatingLayout } from './floating-layout.js';
import {showNotice,watchNotice} from './notice.js';
import {mountColourPicker} from './colour-picker.js';
mountTheme();
// Leave room for Chrome's toolbar on short displays; Chrome may clamp further.
document.documentElement.style.setProperty('--popup-max-height',Math.max(280,Math.min(580,screen.availHeight-110))+'px');
document.documentElement.style.setProperty('--popup-max-width',Math.max(420,Math.min(780,screen.availWidth-24))+'px');
const status = document.querySelector('[data-handoff-status]'), host = document.querySelector('[data-converter]');
const setStatus=(text,error=false)=>showNotice(status,text,error);
let handingOff = false, captureJob = 0, layout;
let restoring = false, pendingFile, initializing=true, pageCaptureAllowed=false;
// Retain the chosen media locally because a toolbar popup closes on outside clicks.
async function retainSource(source) {
 if(restoring)return;
 const job=++captureJob;
 const file=pendingFile;pendingFile=undefined;
 try {
  let blob=file;
  if(!blob){const canvas=new OffscreenCanvas(source.width,source.height);canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(source.pixels),source.width,source.height),0,0);blob=await canvas.convertToBlob({type:'image/png'});}
  if(job===captureJob)await state('capture',{blob,mediaFile:file?{name:file.name,type:file.type}:undefined,expires:Date.now()+10*60*1000});
 }catch{setStatus('Local recovery is unavailable. Download your work before closing this popup.',true);}
}
const ui = mountFocusStudio(host, {
 createWorker: () => new Worker(new URL('worker.js', location.href), { type: 'module' }),
 applyLabel: 'Open in Pixel studio',
 sourceLoaded: source => {layout?.loaded();setStatus('Full image selected. Adjust, download or open in Pixel studio.');void retainSource(source);},
 onApply: async doc => {
  if (handingOff) return;
  handingOff = true;
  host.querySelector('[data-focus-clear]').disabled = true;
  try {
   setStatus('Preparing artwork for the web editor...');
   const response = await chrome.runtime.sendMessage({type:'HANDOFF', project:encodeProject(doc,false)});
   if(response?.error) throw Error(response.error);
   if(response?.status!=='opened') throw Error('The editor did not open. Download an editable project as a fallback.');
   setStatus('Pixel studio opened. Your preview imports automatically; confirm only if replacing unsaved artwork.');
  } catch(error) { setStatus(error.message??'Transfer failed. Download an editable project as a fallback.',true); }
  finally {handingOff=false;host.querySelector('[data-focus-clear]').disabled=false;}
 }
});
// Extension captures preserve source colours unless the user chooses a palette.
const palette=host.querySelector('[data-focus-palette]');palette.value='original';
for(const option of palette.options)option.defaultSelected=option.value==='original';
layout=mountFloatingLayout(host,()=>{});
const colourPicker=mountColourPicker(host);
const fileInput=host.querySelector('[data-focus-file]'),openFile=fileInput.onchange;
fileInput.onchange=async()=>{const file=fileInput.files?.[0];pendingFile=file;try{await openFile();}finally{if(pendingFile===file)pendingFile=undefined;}};
const resetButton=host.querySelector('[data-focus-clear]'),clearMedia=resetButton.onclick,resetDialog=document.querySelector('[data-reset-dialog]');
const defaults=[...host.querySelectorAll('.sf-settings input:not([data-sf-colour-control]),.sf-settings select,[data-focus-format]')].map(el=>({el,value:el.value,checked:el.checked}));
resetButton.textContent='RESET';resetButton.classList.add('sf-reset');
resetButton.onclick=()=>{if(!handingOff)resetDialog.showModal();};
document.querySelector('[data-reset-cancel]').onclick=()=>resetDialog.close();
document.querySelector('[data-reset-confirm]').onclick=async()=>{
 resetDialog.close();captureJob++;resetButton.disabled=true;
 try{const reply=await chrome.runtime.sendMessage({type:'RESET_STUDIO'});if(reply?.error)throw Error(reply.error);if(reply?.status!=='reset')throw Error('Reset did not complete.');ui.suspend();clearMedia();for(const {el,value,checked} of defaults){el.value=value;if(el.type==='checkbox')el.checked=checked;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}colourPicker.close();layout.cleared();setStatus('Studio reset. Open media or capture a page.');}
 catch{setStatus('Could not reset local storage. Try again.',true);}
 finally{resetButton.disabled=false;}
};
const stopNotice=watchNotice(host.querySelector('[data-focus-status]'));
const apply=host.querySelector('[data-focus-apply]');
apply.title='Open GlitchBong Pixel studio in a new tab';apply.setAttribute('aria-label','Open in Pixel studio (opens in a new tab)');
const link=document.createElementNS('http://www.w3.org/2000/svg','svg');link.classList.add('sf-external-icon');link.setAttribute('viewBox','0 0 24 24');link.setAttribute('aria-hidden','true');
const path=document.createElementNS(link.namespaceURI,'path');path.setAttribute('d','M14 3h7v7M21 3 10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5');path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','1.8');path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');link.append(path);apply.append(link);
for(const mode of ['camera','screen']){const button=host.querySelector('[data-focus-'+mode+']');button.title='Open the '+(mode==='camera'?'camera':'screen sharing')+' capture tab';button.onclick=async()=>{
 try{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});const response=await chrome.runtime.sendMessage({type:'MEDIA_OPEN',mode,source:{tabId:tab?.id,windowId:tab?.windowId}});if(response?.error)throw Error(response.error);}
 catch(error){setStatus(error.message??'Could not open capture. Try again.',true);}
};}
async function loadCapture(){
 const job=++captureJob;
 try {
  await purgeExpired(); const captured=await state('capture'); if(job!==captureJob)return;
  if(captured?.error)setStatus(captured.error,true);
  else if(captured?.blob){
   restoring=true;
   try {
    ui.suspend();
    if(captured.mediaFile){const input=host.querySelector('[data-focus-file]'),files=new DataTransfer();files.items.add(new File([captured.blob],captured.mediaFile.name,{type:captured.mediaFile.type}));input.files=files.files;await input.onchange();pendingFile=undefined;}
    else{const raster=await readImage(captured.blob);if(job!==captureJob)return;ui.load(raster);}
    setStatus('Full image selected. Adjust, download or open in Pixel studio.');
   }finally{restoring=false;}
  }
 } catch {if(job===captureJob)setStatus('Could not reopen the capture. Open an image or capture again.',true);}
}
chrome.runtime.onMessage.addListener(message=>{if(message?.type==='CAPTURE_READY'&&!initializing)void loadCapture();else if(message?.type==='CAPTURE_CANCELLED')setStatus('Capture cancelled. Your previous media is kept.');});
document.querySelectorAll('[data-mode]').forEach(button=>button.onclick=async()=>{
 setStatus('Preparing page capture...');
 try{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});const response=await chrome.runtime.sendMessage({type:'START',mode:button.dataset.mode,source:{tabId:tab?.id,windowId:tab?.windowId}});if(response?.error)throw Error(response.error);if(response?.status==='selecting')window.close();else setStatus('Capture ready.');}
 catch(error){setStatus(error.message??'Click the toolbar icon on the webpage and try again.',true);}
});
window.addEventListener('pagehide',()=>{stopNotice();layout.dispose();ui.dispose();},{once:true});
const startupControls=[...host.querySelectorAll('.sf-top button,.sf-top input')];
startupControls.forEach(el=>el.disabled=true);setStatus('Capturing the visible page...');
try{
 const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
 pageCaptureAllowed=/^https?:/.test(tab?.url??'');
 const response=await chrome.runtime.sendMessage({type:'POPUP_OPEN',source:{tabId:tab?.id,windowId:tab?.windowId}});
 if(response?.error)throw Error(response.error);
 if(response?.status==='choose')setStatus(response.message);
 else{
  if(!['restore','captured'].includes(response?.status))throw Error('Capture did not finish. Try capturing again.');
  await loadCapture();
 }
}catch(error){setStatus(error.message??'Could not capture this page. Open media or choose another page.',true);}
finally{initializing=false;startupControls.forEach(el=>{el.disabled=el.matches('[data-mode]')&&!pageCaptureAllowed;if(el.disabled)el.title='Click the pinned EzPIX Insta toolbar icon to allow page capture.';});}
