import { mountTheme } from './theme.js';
mountTheme();
const status=document.querySelector('[role=status]');
document.querySelectorAll('[data-mode]').forEach(button=>button.onclick=async()=>{
  document.querySelectorAll('button').forEach(b=>b.disabled=true);status.textContent='Preparing capture…';
  try{const response=await chrome.runtime.sendMessage({type:'START',mode:button.dataset.mode});if(response?.error)throw new Error(response.error);window.close();}
  catch(error){status.textContent=error.message??'Capture failed. Open a regular webpage and try again.';document.querySelectorAll('button').forEach(b=>b.disabled=false);}
});
document.querySelector('[data-resume]').onclick=()=>{void chrome.tabs.create({url:chrome.runtime.getURL('app.html')});window.close();};

document.querySelector('[data-studio]').onclick=()=>{void chrome.tabs.create({url:chrome.runtime.getURL('app.html#studio')});window.close();};
