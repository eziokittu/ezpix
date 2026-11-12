import test from 'node:test';import assert from 'node:assert/strict';
import {RTCPeerConnection} from 'werift';
import {LocalSharePeer,decodePairing,encodePairing,validateShareManifest,shareHash} from '../dist/local-share.js';
import qrcode from 'qrcode-generator';
import {decodeShareQrPixels} from '../dist/local-share-ui.js';

function channelAdapter(channel){return new Proxy(channel,{get(target,key){if(key==='send')return data=>target.send(typeof data==='string'?data:Buffer.from(data));const value=target[key];return typeof value==='function'?value.bind(target):value;},set(target,key,value){if(key==='onmessage'){target[key]=event=>value({data:Buffer.isBuffer(event.data)?Uint8Array.from(event.data).buffer:event.data});}else target[key]=value;return true;}});}
const factory=config=>{assert.deepEqual(config.iceServers,[]);const pc=new RTCPeerConnection({...config,iceUseDefaultStunServer:false,iceUseIpv6:false,iceInterfaceAddresses:{udp4:'127.0.0.1'}});return new Proxy(pc,{get(target,key){if(key==='createDataChannel')return (...args)=>channelAdapter(target.createDataChannel(...args));const value=target[key];return typeof value==='function'?value.bind(target):value;},set(target,key,value){if(key==='ondatachannel')target[key]=event=>value({channel:channelAdapter(event.channel)});else target[key]=value;return true;}});};
const wait=async(predicate)=>{for(let i=0;i<500;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,20));}throw Error('Direct WebRTC connection timed out.');};
test('pairing rejects malformed, expired, cloud relay and oversized metadata',async()=>{
 await assert.rejects(()=>decodePairing('not a code'));
 const pair={v:1,id:'a'.repeat(32),expires:Date.now()-1,type:'offer',sdp:'v=0\r\na=fingerprint:sha-256 ABC\r\n'};await assert.rejects(async()=>decodePairing(await encodePairing(pair)),/expired/);
 await assert.rejects(async()=>decodePairing(await encodePairing({...pair,expires:Date.now()+300000,sdp:pair.sdp+'a=candidate:x 1 UDP 1 1.1.1.1 123 typ relay\r\n'})));
 assert.throws(()=>validateShareManifest({id:'a'.repeat(32),name:'../secret.png',type:'image/png',size:4,sha256:'a'.repeat(64)}));
 assert.throws(()=>validateShareManifest({id:'a'.repeat(32),name:'image.png',type:'image/png',size:25*1024*1024,sha256:'a'.repeat(64)}));
});
test('real local DTLS/SCTP transfers exact bytes in both directions after mutual verification and consent', {timeout:30000}, async()=>{
 let codeA='',codeB='',readyA=false,readyB=false,accept=true;const gotA=[],gotB=[],statuses=[];
 const events=(which)=>({status:text=>statuses.push(text),connected:code=>{if(which==='a')codeA=code;else codeB=code;},ready:()=>{if(which==='a')readyA=true;else readyB=true;},offer:(_meta,yes,no)=>accept?yes():no(),received:async(file,finish)=>{(which==='a'?gotA:gotB).push({name:file.name,bytes:new Uint8Array(await file.arrayBuffer())});finish(true);}});
 const a=new LocalSharePeer(events('a'),factory),b=new LocalSharePeer(events('b'),factory);
 try{
  const offer=await a.createOffer(),answer=await b.acceptOffer(offer);await a.acceptAnswer(answer);await wait(()=>codeA&&codeB);assert.equal(codeA,codeB);
  await assert.rejects(()=>a.sendFile(new File(['x'],'x.png',{type:'image/png'})),/confirm/);
  a.confirm();await new Promise(resolve=>setTimeout(resolve,50));assert.equal(readyA,false);b.confirm();await wait(()=>readyA&&readyB);
  const bytes=Uint8Array.from({length:70003},(_,i)=>i*17%256);await a.sendFile(new File([bytes],'asset.png',{type:'image/png'}));assert.deepEqual(gotB[0].bytes,bytes);
  await b.sendFile(new File(['editable bytes'],'test.ezpix',{type:'application/json'}));assert.equal(new TextDecoder().decode(gotA[0].bytes),'editable bytes');
  accept=false;await assert.rejects(()=>a.sendFile(new File(['declined'],'no.png',{type:'image/png'})),/declined/);assert.equal(gotB.length,1);
  accept=true;await a.sendFile(new File(['after decline'],'yes.png',{type:'image/png'}));assert.equal(gotB.length,2);
 }finally{a.close();b.close();}
});
test('bundled QR encoder and offline decoder roundtrip real-size pairing details',async()=>{
 const pair={v:1,id:'e'.repeat(32),expires:Date.now()+300000,type:'offer',sdp:'v=0\r\na=fingerprint:sha-256 '+Array.from({length:32},(_,i)=>i.toString(16).padStart(2,'0')).join(':')+'\r\na=candidate:1 1 UDP 1234 192.168.1.20 54321 typ host\r\n'};
 const code=await encodePairing(pair),qr=qrcode(0,'L');qr.addData(code);qr.make();const cells=qr.getModuleCount(),scale=6,w=(cells+8)*scale,pixels=new Uint8ClampedArray(w*w*4).fill(255);
 for(let y=0;y<cells;y++)for(let x=0;x<cells;x++)if(qr.isDark(y,x))for(let yy=0;yy<scale;yy++)for(let xx=0;xx<scale;xx++){const at=(((y+4)*scale+yy)*w+(x+4)*scale+xx)*4;pixels[at]=pixels[at+1]=pixels[at+2]=0;}
 const read=await decodeShareQrPixels({pixels,width:w,height:w});assert.equal(read,code);assert.deepEqual(await decodePairing(read),pair);
});
test('unconfirmed, replayed, repeated/out-of-order and corrupt transfers never reach import',async()=>{
 let imports=0,accept,decline;
 const noop=()=>{},channel={readyState:'open',send:noop,close:noop};
 const peer=new LocalSharePeer({status:noop,connected:noop,ready:noop,received:()=>imports++,offer:(_m,a,d)=>{accept=a;decline=d;}},()=>({close:noop}));
 peer.channel=channel;
 const meta={id:'1'.repeat(32),name:'image.png',type:'image/png',size:3,sha256:await shareHash(Uint8Array.of(1,2,3))};
 try{
  await assert.rejects(()=>peer.message(JSON.stringify({t:'offer',file:meta})),/unconfirmed/);assert.equal(imports,0);
  peer.verified=peer.peerVerified=true;
  await peer.message(JSON.stringify({t:'offer',file:meta}));decline();await assert.rejects(()=>peer.message(JSON.stringify({t:'offer',file:meta})),/Replayed/);
  const next={...meta,id:'2'.repeat(32)};await peer.message(JSON.stringify({t:'offer',file:next}));accept();
  const packet=new Uint8Array(7);new DataView(packet.buffer).setUint32(0,1);packet.set([1,2,3],4);await assert.rejects(()=>peer.message(packet.buffer),/Missing/);
  new DataView(packet.buffer).setUint32(0,0);packet[4]=9;await peer.message(packet.buffer);await assert.rejects(()=>peer.message(packet.buffer),/Missing/);
  await assert.rejects(()=>peer.message(JSON.stringify({t:'end',id:next.id})),/checksum/);assert.equal(imports,0);
 }finally{peer.close();}
});
