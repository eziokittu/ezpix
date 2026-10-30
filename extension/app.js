import { mountFocusStudio } from '../packages/core/dist/focus-ui.js';
import { encodeProject } from '../packages/core/dist/index.js';
import { readImage } from '../packages/core/dist/browser.js';
import { state, purgeExpired } from './db.js';
import { mountTheme } from './theme.js';
mountTheme();
const status = document.querySelector('[data-handoff-status]'), host = document.querySelector('[data-converter]');
let handingOff = false, captureJob = 0;
const ui = mountFocusStudio(host, {
 createWorker: () => new Worker(new URL('worker.js', location.href), { type: 'module' }),
 applyLabel: 'Open in Pixel studio',
 onApply: async doc => {
  if (handingOff) return;
  handingOff = true;
  document.querySelector('[data-clear]').disabled = true;
  try {
   status.textContent = 'Preparing artwork for the web editor...';
   const response = await chrome.runtime.sendMessage({type:'HANDOFF', project:encodeProject(doc,false)});
   if(response?.error) throw Error(response.error);
   if(response?.status!=='opened') throw Error('The editor did not open. Download an editable project as a fallback.');
   status.textContent = 'Pixel studio opened. Choose Receive extension artwork, then Import received artwork.';
  } catch(error) { status.textContent=error.message??'Transfer failed. Download an editable project as a fallback.'; }
  finally {handingOff=false;document.querySelector('[data-clear]').disabled=false;}
 }
});
async function loadCapture(){
 const job=++captureJob;
 try {
  await purgeExpired(); const captured=await state('capture'); if(job!==captureJob)return;
  if(captured?.error)status.textContent=captured.error;
  else if(captured?.blob){const raster=await readImage(captured.blob);if(job!==captureJob)return;ui.suspend();ui.load(raster);status.textContent='Full capture selected. Adjust, download or open in Pixel studio.';}
 } catch {if(job===captureJob)status.textContent='Could not reopen the capture. Open an image or capture again.';}
}
chrome.runtime.onMessage.addListener(message=>{if(message?.type==='CAPTURE_READY')void loadCapture();});
document.querySelectorAll('[data-mode]').forEach(button=>button.onclick=async()=>{
 status.textContent='Preparing page capture...';
 try{const response=await chrome.runtime.sendMessage({type:'START',mode:button.dataset.mode});if(response?.error)throw Error(response.error);status.textContent=response?.status==='selecting'?'Select on the page. Esc cancels.':'Capture ready.';}
 catch(error){status.textContent=error.message??'Click the toolbar icon on the webpage and try again.';}
});
document.querySelector('[data-clear]').onclick=async()=>{
 if(handingOff)return;
 captureJob++;
 try{await Promise.all(['capture','transfer','selection'].map(key=>state(key,null)));host.querySelector('[data-focus-clear]').click();status.textContent='Capture and pending handoff cleared.';}
 catch{status.textContent='Could not clear extension storage. Try again.';}
};
window.addEventListener('pagehide',()=>ui.dispose(),{once:true});
await loadCapture();
