/** Serverless LAN pairing and an authenticated, bounded WebRTC file protocol. */
export const SHARE_LIMIT = 24 * 1024 * 1024, SHARE_CHUNK = 16 * 1024;
export interface ShareManifest { id: string; name: string; type: string; size: number; sha256: string }
interface Pairing { v: 1; id: string; expires: number; type: 'offer'|'answer'; sdp: string }
export interface ShareEvents {
  status: (text: string) => void;
  connected: (code: string) => void;
  ready: () => void;
  offer: (file: ShareManifest, accept: () => void, decline: () => void) => void;
  received: (file: File, finish: (opened: boolean) => void) => void;
  progress?: (bytes: number, total: number) => void;
  closed?: () => void;
}
const id = () => [...crypto.getRandomValues(new Uint8Array(16))].map(b=>b.toString(16).padStart(2,'0')).join('');
export const shareHash = async (bytes: Uint8Array) => [...new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes)))].map(b=>b.toString(16).padStart(2,'0')).join('');
function base64(bytes: Uint8Array) { let text='';for(const byte of bytes)text+=String.fromCharCode(byte);return btoa(text).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,''); }
async function transform(bytes: Uint8Array, compress: boolean) {
  const stream=new Blob([new Uint8Array(bytes)]).stream().pipeThrough(compress?new CompressionStream('deflate'):new DecompressionStream('deflate'));
  const reader=stream.getReader(),chunks:Uint8Array[]=[];let size=0;
  try { while(true){const result=await reader.read();if(result.done)break;size+=result.value.length;if(size>64*1024)throw Error('Pairing details are too large.');chunks.push(result.value);} }
  finally { await reader.cancel(); }
  const out=new Uint8Array(size);let at=0;for(const chunk of chunks){out.set(chunk,at);at+=chunk.length;}return out;
}
export async function encodePairing(pair: Pairing) { return 'EZPX1.'+base64(await transform(new TextEncoder().encode(JSON.stringify(pair)),true)); }
export async function decodePairing(code: string): Promise<Pairing> {
  code=code.trim();if(!/^EZPX1\.[A-Za-z0-9_-]{30,12000}$/.test(code))throw Error('Scan or paste a complete EzPix pairing code.');
  const raw=atob(code.slice(6).replaceAll('-','+').replaceAll('_','/')),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
  const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await transform(bytes,false))) as Pairing;
  if(!value||Object.keys(value).sort().join(',')!=='expires,id,sdp,type,v'||value.v!==1||!/^[a-f0-9]{32}$/.test(value.id)||!Number.isSafeInteger(value.expires)||value.expires<Date.now()||value.expires>Date.now()+6*60*1000||!['offer','answer'].includes(value.type)||typeof value.sdp!=='string'||value.sdp.length>48*1024||!value.sdp.startsWith('v=0')||!value.sdp.includes('a=fingerprint:sha-256'))throw Error('Invalid, incompatible or expired pairing code. Create a new connection.');
  if(/a=candidate:.* typ (?:relay|srflx)/.test(value.sdp))throw Error('Only direct local-network candidates are accepted.');
  return value;
}
export function validateShareManifest(value: unknown): ShareManifest {
  const m=value as ShareManifest;
  if(!m||Object.keys(m).sort().join(',')!=='id,name,sha256,size,type'||!/^[a-f0-9]{32}$/.test(m.id)||typeof m.name!=='string'||!m.name.trim()||m.name.length>120||/[\/\\\x00-\x1f\x7f]/.test(m.name)||!Number.isSafeInteger(m.size)||m.size<1||m.size>SHARE_LIMIT||typeof m.type!=='string'||!['image/png','image/jpeg','image/webp','image/svg+xml','image/gif','image/bmp','image/qoi','application/x-ezpix','application/x-ezpix-photo'].includes(m.type)||!/^[a-f0-9]{64}$/.test(m.sha256))throw Error('Invalid file offer or file exceeds 24 MiB.');
  if(m.type==='application/x-ezpix-photo'&&!m.name.toLowerCase().endsWith('.ezphoto'))throw Error('Photo projects need an .ezphoto filename.');
  if(m.type==='application/x-ezpix'&&!m.name.toLowerCase().endsWith('.ezpix'))throw Error('Editable projects need an .ezpix filename.');
  return m;
}
interface Incoming { meta:ShareManifest; bytes?:Uint8Array; count:number; index:number; finished:boolean }
export class LocalSharePeer {
  private pc: RTCPeerConnection;
  private channel?: RTCDataChannel;
  private offerPair?: Pairing; private answerPair?: Pairing;
  private verified=false; private peerVerified=false; private code=''; private ended=false;
  private incoming?:Incoming; private seen=new Set<string>();
  private preparing=false;
  private sending?:{meta:ShareManifest;bytes:Uint8Array;resolve:()=>void;reject:(error:Error)=>void;accepted:boolean;endSent:boolean};
  private chain=Promise.resolve(); private timer?:ReturnType<typeof setTimeout>; private connectTimer:ReturnType<typeof setTimeout>;
  constructor(private events: ShareEvents, factory: (config: RTCConfiguration)=>RTCPeerConnection = config=>new RTCPeerConnection(config)) {
    this.pc=factory({iceServers:[],bundlePolicy:'max-bundle'});
    this.pc.ondatachannel=event=>{if(this.channel||event.channel.label!=='ezpix-local-v1'){event.channel.close();return;}this.bind(event.channel);};
    this.pc.onconnectionstatechange=()=>{if(['failed','closed','disconnected'].includes(this.pc.connectionState))this.close('Connection ended. Keep both devices on the same network and try again.');};
    this.connectTimer=setTimeout(()=>this.close('Connection timed out. Check Wi-Fi and network isolation, then pair again.'),5*60*1000);
  }
  private async gathered() {
    if(this.pc.iceGatheringState==='complete')return;
    await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{cleanup();reject(Error('Local address gathering timed out.'));},12000);const listener=()=>{if(this.pc.iceGatheringState==='complete'){cleanup();resolve();}};const cleanup=()=>{clearTimeout(timer);this.pc.removeEventListener('icegatheringstatechange',listener);};this.pc.addEventListener('icegatheringstatechange',listener);listener();});
    if(this.ended)throw Error('Connection closed.');
  }
  async createOffer(): Promise<string> {
    if(this.offerPair)throw Error('Create a fresh connection to pair again.');
    this.bind(this.pc.createDataChannel('ezpix-local-v1',{ordered:true}));
    await this.pc.setLocalDescription(await this.pc.createOffer());await this.gathered();
    this.offerPair={v:1,id:id(),expires:Date.now()+5*60*1000,type:'offer',sdp:this.pc.localDescription!.sdp};
    return encodePairing(this.offerPair);
  }
  async acceptOffer(code: string): Promise<string> {
    const pair=await decodePairing(code);if(pair.type!=='offer'||this.offerPair)throw Error('This device needs a new offer code.');
    this.offerPair=pair;await this.pc.setRemoteDescription({type:'offer',sdp:pair.sdp});
    await this.pc.setLocalDescription(await this.pc.createAnswer());await this.gathered();
    this.answerPair={...pair,type:'answer',sdp:this.pc.localDescription!.sdp};await this.fingerprint();
    return encodePairing(this.answerPair);
  }
  async acceptAnswer(code: string) {
    const pair=await decodePairing(code);
    if(pair.type!=='answer'||!this.offerPair||this.answerPair||pair.id!==this.offerPair.id||pair.expires!==this.offerPair.expires)throw Error('That reply belongs to a different connection.');
    this.answerPair=pair;await this.fingerprint();await this.pc.setRemoteDescription({type:'answer',sdp:pair.sdp});
  }
  private async fingerprint() { if(!this.offerPair||!this.answerPair)return;const hash=await shareHash(new TextEncoder().encode(JSON.stringify([this.offerPair.id,this.offerPair.sdp,this.answerPair.sdp])));this.code=hash.slice(0,4).toUpperCase()+' '+hash.slice(4,8).toUpperCase();if(this.channel?.readyState==='open')this.events.connected(this.code); }
  private bind(channel: RTCDataChannel) {
    this.channel=channel;channel.binaryType='arraybuffer';channel.bufferedAmountLowThreshold=64*1024;
    channel.onopen=()=>{clearTimeout(this.connectTimer);if(this.code)this.events.connected(this.code);};
    channel.onclose=()=>this.close('Connection closed.');channel.onerror=()=>this.close('Connection failed. Pair again.');
    channel.onmessage=event=>{this.chain=this.chain.then(()=>this.message(event.data)).catch(error=>this.close((error as Error).message));};
  }
  confirm() { if(!this.code||this.channel?.readyState!=='open')throw Error('Wait for the connection.');this.verified=true;this.control({t:'verify',code:this.code});this.ready(); }
  private ready(){if(this.verified&&this.peerVerified)this.events.ready();}
  private control(message: object){if(this.ended||this.channel?.readyState!=='open')throw Error('The connection is closed.');this.channel.send(JSON.stringify(message));}
  private arm(){clearTimeout(this.timer);this.timer=setTimeout(()=>this.close('Transfer timed out. Existing artwork is unchanged.'),120000);}
  async sendFile(file: File) {
    if(!this.verified||!this.peerVerified)throw Error('Both devices must confirm the matching security code.');
    if(this.preparing||this.sending||this.incoming)throw Error('Finish the current transfer first.');
    if(file.size<1||file.size>SHARE_LIMIT)throw Error('Choose an image or project up to 24 MiB.');
    this.preparing=true;
    let bytes:Uint8Array,meta:ShareManifest;
    try {
      const extension=file.name.toLowerCase().split('.').pop()!,types:Record<string,string>={ezphoto:'application/x-ezpix-photo',ezpix:'application/x-ezpix',qoi:'image/qoi',bmp:'image/bmp',gif:'image/gif',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',svg:'image/svg+xml'};
      const type=extension==='ezpix'?'application/x-ezpix':types[extension]||file.type;
      bytes=new Uint8Array(await file.arrayBuffer());meta=validateShareManifest({id:id(),name:file.name,type,size:bytes.length,sha256:await shareHash(bytes)});
    } finally {this.preparing=false;}
    if(this.ended)throw Error('The connection is closed.');
    if(this.sending||this.incoming)throw Error('Another transfer started while this file was being prepared.');
    const done=new Promise<void>((resolve,reject)=>{this.sending={meta,bytes,resolve,reject,accepted:false,endSent:false};});
    this.control({t:'offer',file:meta});this.arm();this.events.status('Waiting for the other device to accept…');return done;
  }
  private async stream() {
    const transfer=this.sending;if(!transfer)return;
    for(let offset=0,index=0;offset<transfer.bytes.length;offset+=SHARE_CHUNK,index++){
      while((this.channel?.bufferedAmount??0)>256*1024){if(this.ended||this.sending!==transfer)return;await new Promise(resolve=>setTimeout(resolve,20));}
      if(this.ended||this.sending!==transfer)return;
      const chunk=transfer.bytes.subarray(offset,offset+SHARE_CHUNK),packet=new Uint8Array(chunk.length+4);new DataView(packet.buffer).setUint32(0,index);packet.set(chunk,4);this.channel!.send(packet.buffer);this.arm();this.events.progress?.(Math.min(offset+SHARE_CHUNK,transfer.bytes.length),transfer.bytes.length);
    }
    if(this.sending===transfer){transfer.endSent=true;this.control({t:'end',id:transfer.meta.id});this.events.status('Sent. Waiting for the other device to open or save it…');}
  }
  private async message(data: unknown) {
    if(this.ended)return;
    if(typeof data==='string') {
      if(data.length>4096)throw Error('Oversized transfer message.');const message=JSON.parse(data);
      if(!message||typeof message.t!=='string')throw Error('Invalid transfer message.');
      if(message.t==='verify'){if(Object.keys(message).sort().join(',')!=='code,t'||message.code!==this.code||!this.code)throw Error('Security codes do not match.');this.peerVerified=true;this.ready();return;}
      if(!this.verified||!this.peerVerified)throw Error('An unconfirmed device attempted a transfer.');
      if(message.t==='offer') {
        if(Object.keys(message).sort().join(',')!=='file,t'||this.incoming||this.sending)throw Error('Unexpected file offer.');const meta=validateShareManifest(message.file);
        if(this.seen.has(meta.id)||this.seen.size>=100)throw Error('Replayed transfer or session limit reached. Pair again.');this.seen.add(meta.id);
        const incoming:Incoming={meta,count:0,index:0,finished:false};this.incoming=incoming;this.arm();
        this.events.offer(meta,()=>{if(this.incoming!==incoming||incoming.bytes||incoming.finished)return;incoming.bytes=new Uint8Array(meta.size);this.control({t:'accept',id:meta.id});this.arm();},()=>{if(this.incoming!==incoming||incoming.bytes)return;this.control({t:'decline',id:meta.id});this.incoming=undefined;clearTimeout(this.timer);});return;
      }
      if(Object.keys(message).sort().join(',')!=='id,t'||typeof message.id!=='string')throw Error('Invalid transfer control.');
      if(message.t==='accept'){if(!this.sending||this.sending.meta.id!==message.id||this.sending.accepted)throw Error('Unexpected transfer acceptance.');this.sending.accepted=true;void this.stream().catch(error=>this.close((error as Error).message));return;}
      if(message.t==='decline'||message.t==='saved'||message.t==='rejected'){
        const sending=this.sending;if(!sending||sending.meta.id!==message.id||message.t==='saved'&&(!sending.accepted||!sending.endSent))throw Error('Unexpected transfer acknowledgment.');this.sending=undefined;clearTimeout(this.timer);
        if(message.t==='saved')sending.resolve();else sending.reject(Error('The other device declined the file. Your artwork is unchanged.'));return;
      }
      if(message.t==='end') {
        const incoming=this.incoming;if(!incoming||incoming.meta.id!==message.id||!incoming.bytes||incoming.finished||incoming.count!==incoming.meta.size)throw Error('Incomplete file transfer.');
        incoming.finished=true;
        if(await shareHash(incoming.bytes)!==incoming.meta.sha256)throw Error('File checksum mismatch. File was not imported.');
        if(this.ended||this.incoming!==incoming)return;
        const file=new File([new Uint8Array(incoming.bytes)],incoming.meta.name,{type:incoming.meta.type});
        incoming.bytes=undefined;
        this.events.received(file,opened=>{if(this.ended||this.incoming!==incoming)return;this.control({t:opened?'saved':'rejected',id:incoming.meta.id});this.incoming=undefined;clearTimeout(this.timer);});return;
      }
      throw Error('Unknown transfer control.');
    }
    const incoming=this.incoming;
    if(!(data instanceof ArrayBuffer)||!this.verified||!this.peerVerified||!incoming?.bytes||incoming.finished||data.byteLength<5||data.byteLength>SHARE_CHUNK+4)throw Error('Unexpected transfer chunk.');
    const expected=Math.min(SHARE_CHUNK,incoming.meta.size-incoming.count);
    if(new DataView(data).getUint32(0)!==incoming.index||data.byteLength!==expected+4)throw Error('Missing, repeated or oversized transfer chunk.');
    incoming.bytes.set(new Uint8Array(data,4),incoming.count);incoming.count+=expected;incoming.index++;this.arm();this.events.progress?.(incoming.count,incoming.meta.size);
  }
  close(message='Disconnected. Pairing details have been cleared.') {
    if(this.ended)return;this.ended=true;clearTimeout(this.connectTimer);clearTimeout(this.timer);
    this.sending?.reject(Error(message));this.sending=undefined;this.incoming=undefined;this.offerPair=this.answerPair=undefined;this.channel?.close();this.pc.close();this.events.status(message);this.events.closed?.();
  }
}
