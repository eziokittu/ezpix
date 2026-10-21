import { mountConverter } from '../packages/core/dist/converter.js';
import { encodeProject } from '../packages/core/dist/index.js';
import { readImage } from '../packages/core/dist/browser.js';
import { state, purgeExpired } from './db.js';
import { mountTheme } from './theme.js';
import { WEBSITE_ORIGIN } from './config.js';
mountTheme();
const status=document.querySelector('[data-handoff-status]'), host=document.querySelector('[data-converter]');
status.textContent=`Website destination: ${WEBSITE_ORIGIN}. Imports require confirmation in the website.`;
let ui, handingOff=false;
function mount(){
  ui=mountConverter(host,{createWorker:()=>new Worker(new URL('worker.js',location.href),{type:'module'}),applyLabel:'Open in EzPix website',onApply:async doc=>{
    if(handingOff)return;handingOff=true;document.querySelector('[data-clear]').disabled=true;
    const button=host.querySelector('[data-apply]');button.disabled=true;
    try{status.textContent='Preparing a local handoff…';const project=encodeProject(doc,host.querySelector('[data-retain]').checked);const result=await chrome.runtime.sendMessage({type:'HANDOFF',project});if(result?.error)throw new Error(result.error);status.textContent='Website opened. Choose Receive extension artwork, then Import received artwork. Project download is always available as a fallback.';}
    catch(error){status.textContent=error.message??'Could not transfer. Download a project and open it in the website.';}
    finally{button.disabled=false;handingOff=false;document.querySelector('[data-clear]').disabled=false;}
  }});
}
mount();
try{await purgeExpired();const captured=await state('capture');if(captured?.error)status.textContent=captured.error;else if(captured?.blob)ui.load(await readImage(captured.blob));else status.textContent='No retained capture. Capture a webpage or choose a local PNG/JPEG below.';}catch{status.textContent='Could not reopen the capture. Choose an image or capture again.';}
document.querySelector('[data-clear]').onclick=async()=>{if(handingOff)return;try{ui.dispose();await Promise.all(['capture','transfer','selection'].map(key=>state(key,null)));mount();status.textContent='Captured data and pending handoff cleared.';}catch{mount();status.textContent='Could not clear extension storage. Try removing the extension data through Chrome settings.';}};
