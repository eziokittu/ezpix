import {desktopNearby,type NearbyAdapter,type NearbySignal} from './nearby.js';
import { LocalSharePeer } from './local-share.js';
import { readImage, readArtworkImage, paintRaster } from './browser.js';
import qrcode from 'qrcode-generator';
import type {Raster} from './conversion.js';
import {SHARE_NOTICES} from './share-notices.js';

export async function decodeShareQr(blob: Blob): Promise<string> {
  const raster=await readImage(blob);
  return decodeShareQrPixels(raster);
}
export async function decodeShareQrPixels(raster:Raster):Promise<string>{
  // jsQR is a CommonJS callable; NodeNext reads its legacy default declaration as a namespace.
  const jsQR=(await import('jsqr')).default as unknown as (pixels:Uint8ClampedArray,width:number,height:number,options:{inversionAttempts:'dontInvert'})=>{data:string}|null;
  const result=jsQR(raster.pixels,raster.width,raster.height,{inversionAttempts:'dontInvert'});
  if(!result)throw Error('No QR found. Keep the whole code in view and try again.');
  if(!result.data.startsWith('EZPX1.'))throw Error('That QR code is not an EzPix connection.');return result.data;
}
export interface LocalShareOptions {
  nearby?: NearbyAdapter;
  open: (file: File, signal: AbortSignal) => Promise<boolean>;
  save: (file: File) => Promise<boolean>;
  current?: () => Promise<File>;
  source?: () => Promise<File>;
  pickCodeImage?: () => Promise<Blob|undefined>;
}
/** Identical pairing UI on Android, the website and the persistent extension tab. */
export function mountLocalShare(host: HTMLElement, options: LocalShareOptions) {
  host.classList.add('ez-local-share');
  host.innerHTML=`<header class="els-header"><span class="els-symbol" aria-hidden="true">↗</span><div><span class="els-eyebrow">EZPIX · LOCAL SHARE</span><h2>From here. To there.</h2></div></header><p class="els-intro">Your devices. Your images. No account.<br>Connect both devices to the same Wi-Fi and keep EzPix open.</p>
  <section class="els-nearby"><h3>Nearby devices</h3><p data-nearby-status role="status">Looking for EzPix on your Wi-Fi...</p><div data-nearby-devices></div><div data-nearby-request hidden><p data-nearby-request-name></p><button data-nearby-accept>Connect</button><button data-nearby-decline>Decline</button></div></section><div class="els-start"><button data-share-create>Create connection</button><button data-share-join>Join a connection</button></div>
  <section class="els-pair" hidden><h3 data-pair-heading>Pair your devices</h3><p data-pair-instruction></p><div class="els-qr" data-share-qr hidden></div><details data-share-details hidden><summary>Copy pairing code instead</summary><textarea data-share-code readonly aria-label="Your pairing code" spellcheck="false"></textarea><button data-copy-code>Copy code</button></details><label class="els-paste">Code from the other device<textarea data-share-input aria-label="Pairing code from other device" rows="2" placeholder="Scan its QR or paste EZPX1.…" spellcheck="false"></textarea></label><div class="els-pair-actions"><button data-scan-code>Scan QR</button><label class="els-file-button">QR image<input data-qr-file type="file" accept="image/png,image/jpeg,image/webp"></label><button data-apply-code>Use code</button></div><div class="els-scanner" hidden><video muted playsinline></video><button data-stop-scan>Stop camera</button></div></section>
  <section class="els-security" hidden><h3>Check both screens.</h3><p>The security code must match on both devices.</p><strong data-security-code></strong><button data-confirm-peer>The codes match</button><p class="els-small">Different codes? Disconnect and pair again. Files stay locked until both devices confirm.</p></section>
  <section class="els-transfer" hidden><h3>What’s going across?</h3><div class="els-send-actions"><button data-send-current ${options.current?'':'hidden'}>Send edited image / project</button><button data-send-source ${options.source?'':'hidden'}>Send source image</button><label class="els-file-button">Choose an image or editable project<input data-share-file type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif,image/bmp,image/qoi,.ezpix,.ezphoto"></label></div><p class="els-small">Up to 24 MiB. Receive on this screen too. The other device must accept each file.</p></section>
  <section class="els-incoming" hidden aria-label="Incoming file"><h3 data-incoming-title>Incoming file</h3><p data-file-name></p><p data-file-size class="els-small"></p><canvas data-file-preview hidden aria-label="Received image preview"></canvas><div class="els-offer-actions"><button data-accept-file>Accept file</button><button data-decline-file>Decline</button></div><div class="els-received-actions" hidden><button data-open-file>Open for editing</button><button data-save-file>Save original file</button><button data-discard-file>Discard</button></div></section>
  <progress data-share-progress hidden max="1" value="0" aria-label="Transfer progress"></progress><p class="els-status" data-share-status role="status" aria-live="polite">No connection is running.</p><button class="els-disconnect" data-share-disconnect hidden>Disconnect &amp; clear pairing</button><p class="els-footnote">Encrypted, direct WebRTC transfer. No image server, relay or public STUN service. Guest Wi-Fi isolation, VPNs and emulator networking can prevent a connection.</p>`;
  const q=<T extends HTMLElement=HTMLElement>(selector:string)=>host.querySelector<T>(selector)!;
  const notices=document.createElement('details'),noticeTitle=document.createElement('summary'),noticeText=document.createElement('pre');noticeTitle.textContent='Open-source notices';noticeText.textContent=SHARE_NOTICES;notices.className='els-notices';notices.append(noticeTitle,noticeText);host.append(notices);
  const abort=new AbortController();let disposed=false,peer:LocalSharePeer|undefined,role:'creator'|'joiner'|undefined,busy=false,epoch=0,stream:MediaStream|undefined,scanTimer:ReturnType<typeof setTimeout>|undefined;
  const status=(text:string)=>{q('[data-share-status]').textContent=text;};
  const sendControls=()=>[...q('.els-transfer').querySelectorAll<HTMLButtonElement|HTMLInputElement>('button,input')];
  const setBusy=(value:boolean)=>{busy=value;sendControls().forEach(button=>button.disabled=value);};
  const showCode=(code:string)=>{const qr=q('[data-share-qr]');qr.hidden=false;try{const image=qrcode(0,'L');image.addData(code);image.make();qr.innerHTML=image.createSvgTag({cellSize:4,margin:16,scalable:true});}catch{qr.hidden=true;status('Use Copy pairing code; this device produced a code too large for one QR.');}q<HTMLTextAreaElement>('[data-share-code]').value=code;q('[data-share-details]').hidden=false;};
  function stopScan(){clearTimeout(scanTimer);stream?.getTracks().forEach(track=>track.stop());stream=undefined;q<HTMLVideoElement>('.els-scanner video').srcObject=null;q('.els-scanner').hidden=true;}
  function reset(message='No connection is running.') {
    epoch++;stopScan();peer?.close();peer=undefined;role=undefined;setBusy(false);
    for(const selector of ['[data-accept-file]','[data-decline-file]','[data-open-file]','[data-save-file]','[data-discard-file]'])q<HTMLButtonElement>(selector).onclick=null;
    const preview=q<HTMLCanvasElement>('[data-file-preview]');preview.width=preview.height=1;preview.hidden=true;
    for(const selector of ['.els-pair','.els-security','.els-transfer','.els-incoming','[data-share-progress]','[data-share-disconnect]'])q(selector).hidden=true;
    q('.els-start').hidden=false;q<HTMLTextAreaElement>('[data-share-code]').value='';q<HTMLTextAreaElement>('[data-share-input]').value='';q('[data-share-qr]').replaceChildren();q('[data-share-qr]').hidden=true;q('[data-share-details]').hidden=true;q('[data-confirm-peer]').removeAttribute('disabled');status(message);
  }
  function createPeer() {
    return new LocalSharePeer({
      status,
      connected(code){q('.els-pair').hidden=true;stopScan();q('.els-security').hidden=false;q('[data-security-code]').textContent=code;status('Connected. Compare the security codes on both devices.');},
      ready(){q('.els-security').hidden=true;q('.els-transfer').hidden=false;q<HTMLTextAreaElement>('[data-share-code]').value='';q<HTMLTextAreaElement>('[data-share-input]').value='';q('[data-share-qr]').replaceChildren();status('Connected securely. Ready to send and receive.');},
      offer(file,accept,decline){setBusy(true);q('.els-incoming').hidden=false;q('[data-incoming-title]').textContent='A file is waiting.';q('[data-file-name]').textContent=file.name;q('[data-file-size]').textContent=`${(file.size/1024/1024).toFixed(2)} MiB · ${file.type}`;q('[data-file-preview]').hidden=true;q('.els-offer-actions').hidden=false;q('.els-received-actions').hidden=true;
        q<HTMLButtonElement>('[data-accept-file]').onclick=()=>{q('.els-offer-actions').hidden=true;accept();status('Receiving file…');};
        q<HTMLButtonElement>('[data-decline-file]').onclick=()=>{decline();q('.els-incoming').hidden=true;setBusy(false);status('File declined. Your artwork is unchanged.');};},
      received(file,finish){q('[data-incoming-title]').textContent='Arrived. Verified.';q('.els-received-actions').hidden=false;const job=epoch;
        if(['image/png','image/jpeg','image/webp','image/svg+xml'].includes(file.type))void readArtworkImage(file).then(image=>{if(disposed||job!==epoch)return;const canvas=q<HTMLCanvasElement>('[data-file-preview]');paintRaster(canvas,image);canvas.hidden=false;}).catch(()=>{});
        let applying=false;
        const act=async(action:()=>Promise<boolean>)=>{if(applying)return;applying=true;q('.els-received-actions').querySelectorAll<HTMLButtonElement>('button').forEach(button=>button.disabled=true);try{if(await action()){if(disposed||job!==epoch)return;finish(true);q('.els-incoming').hidden=true;setBusy(false);status('File opened or saved successfully.');}else status('Cancelled. The received file is still here.');}catch(error){status((error as Error).message);}finally{applying=false;q('.els-received-actions').querySelectorAll<HTMLButtonElement>('button').forEach(button=>button.disabled=false);}};
        q<HTMLButtonElement>('[data-open-file]').onclick=()=>void act(()=>options.open(file,abort.signal));q<HTMLButtonElement>('[data-save-file]').onclick=()=>void act(()=>options.save(file));q<HTMLButtonElement>('[data-discard-file]').onclick=()=>{if(applying)return;finish(false);q('.els-incoming').hidden=true;setBusy(false);status('Received file discarded.');};},
      progress(bytes,total){const bar=q<HTMLProgressElement>('[data-share-progress]');bar.hidden=false;bar.max=total;bar.value=bytes;},
      closed(){q('.els-transfer').hidden=true;q('.els-security').hidden=true;setBusy(false);},
    });
  }
  const perform=async(action:()=>Promise<void>)=>{try{await action();}catch(error){status((error as Error).message);}};
  q<HTMLButtonElement>('[data-share-create]').onclick=()=>void perform(async()=>{reset();role='creator';q('.els-start').hidden=true;q('.els-pair').hidden=false;q('[data-share-disconnect]').hidden=false;q('[data-pair-heading]').textContent='1. Scan this on the other device';q('[data-pair-instruction]').textContent='On the other device, open Local share → Join a connection. Then scan its reply QR here.';status('Preparing a local connection…');const job=epoch;peer=createPeer();const code=await peer.createOffer();if(!disposed&&job===epoch){showCode(code);status('Pairing code expires in five minutes.');}});
  q<HTMLButtonElement>('[data-share-join]').onclick=()=>{reset();role='joiner';q('.els-start').hidden=true;q('.els-pair').hidden=false;q('[data-share-disconnect]').hidden=false;q('[data-pair-heading]').textContent='1. Scan the connection QR';q('[data-pair-instruction]').textContent='Scan or paste the code shown by the device that created the connection.';};
  async function applyCode(){const input=q<HTMLTextAreaElement>('[data-share-input]'),code=input.value.trim();if(!code)throw Error('Scan or paste the other device’s code first.');const job=epoch;if(role==='creator'){if(!peer)throw Error('Create a fresh connection.');await peer.acceptAnswer(code);status('Connecting directly…');}else if(role==='joiner'){if(peer)throw Error('Your reply is already shown. Scan it on the first device.');peer=createPeer();const answer=await peer.acceptOffer(code);if(disposed||job!==epoch)return;showCode(answer);q('[data-pair-heading]').textContent='2. Scan this reply on the first device';q('[data-pair-instruction]').textContent='Return to the first device and scan this QR with its Scan QR button. Keep this screen open.';input.value='';status('Waiting for the first device to scan your reply…');}else throw Error('Choose Create or Join first.');}
  q<HTMLButtonElement>('[data-apply-code]').onclick=()=>void perform(applyCode);
  q<HTMLButtonElement>('[data-copy-code]').onclick=()=>void perform(async()=>{try{await navigator.clipboard.writeText(q<HTMLTextAreaElement>('[data-share-code]').value);status('Pairing code copied.');}catch{q<HTMLTextAreaElement>('[data-share-code]').select();status('Select and copy this code using your device’s copy command.');}});
  const useImage=async(blob:Blob)=>{const job=epoch;status('Reading EzPix QR…');const code=await decodeShareQr(blob);if(disposed||job!==epoch)return;q<HTMLTextAreaElement>('[data-share-input]').value=code;stopScan();await applyCode();};
  q<HTMLInputElement>('[data-qr-file]').onchange=event=>{const input=event.target as HTMLInputElement,file=input.files?.[0];input.value='';if(file)void perform(()=>useImage(file));};
  q<HTMLButtonElement>('[data-scan-code]').onclick=()=>void perform(async()=>{
    if(options.pickCodeImage){const file=await options.pickCodeImage();if(file)await useImage(file);return;}
    stopScan();const job=epoch;const active=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment',width:{ideal:1280},height:{ideal:720}},audio:false});if(disposed||job!==epoch){active.getTracks().forEach(track=>track.stop());return;}stream=active;q('.els-scanner').hidden=false;const video=q<HTMLVideoElement>('.els-scanner video');video.srcObject=active;await video.play();const canvas=document.createElement('canvas');
    const scan=async()=>{if(!stream||disposed||job!==epoch)return;let code:string|undefined;try{if(video.videoWidth){const scale=Math.min(1,1280/Math.max(video.videoWidth,video.videoHeight));canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);const context=canvas.getContext('2d',{willReadFrequently:true})!;context.drawImage(video,0,0,canvas.width,canvas.height);code=await decodeShareQrPixels({width:canvas.width,height:canvas.height,pixels:context.getImageData(0,0,canvas.width,canvas.height).data});}}catch{/* Keep looking while the camera is explicitly open. */}if(code&&!disposed&&job===epoch&&stream){q<HTMLTextAreaElement>('[data-share-input]').value=code;stopScan();await perform(applyCode);return;}scanTimer=setTimeout(()=>void scan(),350);};void scan();
  });
  q<HTMLButtonElement>('[data-stop-scan]').onclick=stopScan;
  q<HTMLButtonElement>('[data-confirm-peer]').onclick=()=>{try{status('Waiting for confirmation on the other device…');peer?.confirm();q<HTMLButtonElement>('[data-confirm-peer]').disabled=true;}catch(error){status((error as Error).message);}};
  async function send(file:File){if(busy)throw Error('Finish the current transfer first.');setBusy(true);try{await peer!.sendFile(file);status('The other device confirmed opening or saving your file.');}finally{setBusy(false);}}
  q<HTMLInputElement>('[data-share-file]').onchange=event=>{const input=event.target as HTMLInputElement,file=input.files?.[0];input.value='';if(file)void perform(()=>send(file));};
  q<HTMLButtonElement>('[data-send-current]').onclick=()=>void perform(async()=>{if(options.current)await send(await options.current());});
  q<HTMLButtonElement>('[data-send-source]').onclick=()=>void perform(async()=>{if(options.source)await send(await options.source());});
  const nearby=options.nearby??desktopNearby();let nearbyTimer:ReturnType<typeof setTimeout>|undefined,nearbyId='',nearbyPeer='',request:NearbySignal|undefined,connecting=false;
  const nearbyStatus=(message:string)=>q('[data-nearby-status]').textContent=message;
  const clearNearby=()=>{nearbyPeer='';request=undefined;connecting=false;q('[data-nearby-request]').hidden=true;};
  const connectNearby=async(id:string)=>{if(peer||connecting)throw Error('Disconnect the current pairing before choosing another device.');connecting=true;reset();nearbyPeer=id;role='creator';q('[data-share-disconnect]').hidden=false;peer=createPeer();status('Preparing secure nearby pairing...');try{const code=await peer.createOffer();if(disposed)return;await nearby.send(id,'offer',code);status('Waiting for the other device to accept.');}catch(error){reset();clearNearby();throw error;}};
  q<HTMLButtonElement>('[data-nearby-accept]').onclick=()=>void perform(async()=>{const incoming=request;if(!incoming||peer)return;request=undefined;connecting=true;q('[data-nearby-request]').hidden=true;reset();nearbyPeer=incoming.from;role='joiner';q('[data-share-disconnect]').hidden=false;peer=createPeer();try{const answer=await peer.acceptOffer(incoming.code);if(!disposed)await nearby.send(incoming.from,'answer',answer);}catch(error){reset();clearNearby();throw error;}});
  q<HTMLButtonElement>('[data-nearby-decline]').onclick=()=>{request=undefined;q('[data-nearby-request]').hidden=true;};
  const pollNearby=async()=>{try{const result=await nearby.poll();if(disposed)return;const list=q('[data-nearby-devices]');list.replaceChildren();for(const device of result.devices){if(device.id===nearbyId)continue;const button=document.createElement('button');button.textContent=device.name;button.disabled=!!peer||connecting;button.onclick=()=>void perform(()=>connectNearby(device.id));list.append(button);}for(const signal of result.signals){if(!signal.code.startsWith('EZPX1.')||signal.code.length>60000)continue;if(signal.kind==='offer'&&!peer&&!request&&!connecting){request=signal;q('[data-nearby-request-name]').textContent=signal.name+' wants to connect.';q('[data-nearby-request]').hidden=false;}else if(signal.kind==='answer'&&peer&&role==='creator'&&signal.from===nearbyPeer){await peer.acceptAnswer(signal.code);}}nearbyTimer=setTimeout(()=>void pollNearby(),1200);}catch{if(disposed)return;nearbyStatus('Nearby discovery paused. Close and reopen Local share to retry. QR pairing is still available.');}};
  void nearby.start().then(device=>{if(disposed){void nearby.stop();return;}nearbyId=device.id;nearbyStatus('This device: '+device.name+'. Keep Local share open on both devices.');void pollNearby();}).catch(()=>{if(!disposed)nearbyStatus(options.nearby?'Nearby unavailable on this network. Use QR pairing or try another Wi-Fi.':'Desktop discovery needs the EzPix Nearby companion running locally. QR pairing works without it.');});
  q<HTMLButtonElement>('[data-share-disconnect]').onclick=()=>{reset('Disconnected. Pairing and received bytes cleared.');clearNearby();};
  return {dispose(){if(disposed)return;disposed=true;clearTimeout(nearbyTimer);void nearby.stop().catch(()=>{});abort.abort();epoch++;stopScan();peer?.close();host.replaceChildren();}};
}
