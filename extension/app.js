import { mountConverter } from '../packages/core/dist/converter.js';
import { encodeProject } from '../packages/core/dist/index.js';
import { readImage } from '../packages/core/dist/browser.js';
import { state, purgeExpired } from './db.js';
import { mountTheme } from './theme.js';

mountTheme();
const status=document.querySelector('[data-handoff-status]'), host=document.querySelector('[data-converter]');
status.textContent='Standalone asset studio. Download here; sending to EzPix is optional.';
let ui, handingOff=false;
function mount(){
  ui=mountConverter(host,{createWorker:()=>new Worker(new URL('worker.js',location.href),{type:'module'}),applyLabel:'Open in EzPix website',onApply:async doc=>{
    if(handingOff)return;handingOff=true;document.querySelector('[data-clear]').disabled=true;
    const buttons=[...host.querySelectorAll('[data-apply],[data-focus-apply]')];buttons.forEach(b=>b.disabled=true);
    try{status.textContent='Preparing a local handoff…';const project=encodeProject(doc,host.querySelector('[data-retain]').checked);const result=await chrome.runtime.sendMessage({type:'HANDOFF',project});if(result?.error)throw new Error(result.error);status.textContent='Website opened. Choose Receive extension artwork, then Import received artwork. Project download is always available as a fallback.';}
    catch(error){status.textContent=error.message??'Could not transfer. Download a project and open it in the website.';}
    finally{buttons.forEach(b=>b.disabled=false);handingOff=false;document.querySelector('[data-clear]').disabled=false;}
  }});
}
mount();
try{await purgeExpired();const captured=await state('capture');if(captured?.error)status.textContent=captured.error;else if(captured?.blob)ui.load(await readImage(captured.blob));else status.textContent='Open an image, use Camera or Live screen, or capture a page from the toolbar.';}catch{status.textContent='Could not reopen the capture. Choose an image or capture again.';}
document.querySelector('[data-clear]').onclick=async()=>{if(handingOff)return;try{ui.dispose();await Promise.all(['capture','transfer','selection'].map(key=>state(key,null)));mount();status.textContent='Captured data and pending handoff cleared.';}catch{mount();status.textContent='Could not clear extension storage. Try removing the extension data through Chrome settings.';}};
