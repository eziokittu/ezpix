import {mountTheme} from './theme.js';
import {showNotice} from './notice.js';
import {mediaError} from './media-errors.js';
mountTheme();
const q=key=>document.querySelector('[data-'+key+']'),video=q('video');
let mode,nonce,stream,attempt=0,disposed=false,returning=false,expiryTimer;
function notice(text,error=false){showNotice(q('status'),text,error);}
function stop(){attempt++;stream?.getTracks().forEach(track=>track.stop());stream=null;video.pause();video.srcObject=null;video.hidden=true;q('empty').hidden=false;q('photo').hidden=true;q('stop').hidden=true;q('device').hidden=true;}
async function request(type,extra={}){const reply=await chrome.runtime.sendMessage({type,nonce,...extra});if(reply?.error)throw Error(reply.error);return reply;}
async function start(){
 stop();const id=attempt;q('start').disabled=true;notice(mode==='camera'?'Allow camera access in the Chrome prompt...':'Choose a screen, window or tab, then select Share...');
 try{
  const device=q('device').value;
  const active=mode==='camera'?await navigator.mediaDevices.getUserMedia({audio:false,video:device?{deviceId:{exact:device}}:{width:{ideal:1280},height:{ideal:720}}}):await navigator.mediaDevices.getDisplayMedia({audio:false,video:true});
  if(disposed||id!==attempt){active.getTracks().forEach(track=>track.stop());return;}stream=active;video.srcObject=active;await video.play();
  if(disposed||id!==attempt){active.getTracks().forEach(track=>track.stop());return;}
  video.hidden=false;q('empty').hidden=true;q('photo').hidden=false;q('stop').hidden=false;
  active.getVideoTracks()[0].onended=()=>{if(id===attempt){stop();notice('Capture ended. Start again when ready.');}};
  if(mode==='camera'){const devices=await navigator.mediaDevices.enumerateDevices();if(disposed||id!==attempt)return;const picker=q('device');picker.replaceChildren(...devices.filter(item=>item.kind==='videoinput').map(item=>new Option(item.label||'Camera',item.deviceId)));picker.value=active.getVideoTracks()[0].getSettings().deviceId??'';picker.hidden=picker.options.length<2;}
  q('help').open=false;notice(mode==='camera'?'Camera is live. Choose Take photo when ready.':'Sharing is live. Choose Use this frame when ready.');
 }catch(error){if(disposed||id!==attempt)return;stop();notice(mediaError(error,mode),true);if(mode==='camera')q('help').open=true;}
 finally{if(!disposed)q('start').disabled=false;}
 q('start').textContent=mode==='camera'?(stream?'Restart camera':'Try camera again'):'Choose screen';
}
q('start').onclick=start;q('device').onchange=start;q('stop').onclick=()=>{stop();notice('Capture stopped.');};
q('photo').onclick=async()=>{
 if(!stream||!video.videoWidth||returning)return;returning=true;q('photo').disabled=true;
 try{
  const limit=mode==='camera'?1280:1536,scale=Math.min(1,limit/Math.max(video.videoWidth,video.videoHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(video.videoWidth*scale));canvas.height=Math.max(1,Math.round(video.videoHeight*scale));canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
  const image=canvas.toDataURL('image/png');stop();q('start').disabled=true;notice('Returning your capture to EzPIX...');await request('MEDIA_COMPLETE',{image});notice('Capture saved. Click the EzPIX toolbar icon to open it.');
 }catch(error){if(!disposed){notice(error.message,true);q('start').disabled=false;}}
 finally{returning=false;q('photo').disabled=false;}
};
q('cancel').onclick=async()=>{if(returning)return;stop();try{await request('MEDIA_CANCEL');notice('Capture cancelled. You can close this tab.');}catch(error){if(!disposed)notice(error.message,true);}};
window.addEventListener('pagehide',()=>{disposed=true;clearTimeout(expiryTimer);stop();},{once:true});
try{const session=await request('MEDIA_INIT');mode=session.mode;nonce=session.nonce;q('title').textContent=mode==='camera'?'Take a photo':'Capture a screen frame';q('start').textContent=mode==='camera'?'Enable camera':'Choose screen';q('photo').textContent=mode==='camera'?'Take photo':'Use this frame';q('help').hidden=mode!=='camera';q('start').disabled=false;expiryTimer=setTimeout(()=>{stop();q('start').disabled=true;notice('Capture session expired. Close this tab and start Camera or Live screen again from EzPIX.',true);},Math.max(0,session.expires-Date.now()));notice('Choose '+(mode==='camera'?'Enable camera and allow access in Chrome.':'Choose screen to open the browser chooser.'));}catch(error){notice(error.message,true);}
