import { CHUNK_BYTES, TRANSFER_LIMIT } from '../packages/core/dist/transfer.js';
export { CHUNK_BYTES, TRANSFER_LIMIT };
export function authorizeDiscovery(message,sender,origin){
 let url;try{url=new URL(sender.url);}catch{throw new Error('Discovery denied.');}
 if(message?.op!=='discover'||message.protocol!==1||sender.frameId!==0||!Number.isInteger(sender.tab?.id)||url.origin!==origin||!['/tools/ezpix','/tools/ezpix/editor','/tools/ezpix/help'].includes(url.pathname))throw new Error('Discovery denied.');
}
export function authorize(record,message,sender,origin,now=Date.now()) {
  if (!record || !message || message.protocol!==1 || typeof message.token!=='string' || message.token!==record.token || record.expires<=now || sender.tab?.id!==record.tabId || sender.frameId!==0) throw new Error('Transfer denied.');
  let url; try { url=new URL(sender.url); } catch { throw new Error('Transfer denied.'); }
  if (url.origin!==origin || !['/tools/ezpix','/tools/ezpix/editor'].includes(url.pathname) || record.origin!==origin) throw new Error('Transfer denied.');
  if (!['manifest','chunk','ack'].includes(message.op)) throw new Error('Unknown transfer operation.');
}
export function responseFor(record,message) {
  if(message.op==='ack') { if(message.sha256!==record.sha256) throw new Error('Checksum acknowledgment denied.'); return {status:'imported'}; }
  if(record.acked) throw new Error('This transfer was already imported.');
  if(message.op==='manifest') return {protocol:1,engine:record.engine,size:record.bytes.length,count:Math.ceil(record.bytes.length/CHUNK_BYTES),sha256:record.sha256};
  if(!Number.isInteger(message.index) || message.index<0 || message.index>=Math.ceil(record.bytes.length/CHUNK_BYTES)) throw new Error('Invalid chunk index.');
  const chunk=record.bytes.slice(message.index*CHUNK_BYTES,(message.index+1)*CHUNK_BYTES);
  let text=''; for(let i=0;i<chunk.length;i+=32768) text+=String.fromCharCode(...chunk.subarray(i,i+32768));
  return {index:message.index,data:btoa(text)};
}
