import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authorize, authorizeDiscovery, responseFor } from '../protocol.js';
import { receiveProject } from '../../packages/core/dist/transfer.js';
import { createDocument, encodeProject, ENGINE_VERSION } from '../../packages/core/dist/index.js';
const origin='http://localhost:3791', sender={tab:{id:4},frameId:0,url:origin+'/tools/ezpix/editor'}, message={op:'manifest',token:'secret',protocol:1};
test('discovery returns no transfer data and requires exact origin, allowed page and top frame',()=>{const request={op:'discover',protocol:1};authorizeDiscovery(request,sender,origin);authorizeDiscovery(request,{...sender,url:origin+'/tools/ezpix/help'},origin);for(const bad of [{...sender,frameId:1},{...sender,url:origin+'/tools/other'},{...sender,url:'https://invalid/tools/ezpix'},{...sender,tab:undefined}])assert.throws(()=>authorizeDiscovery(request,bad,origin));assert.throws(()=>authorizeDiscovery({...request,protocol:2},sender,origin));assert.throws(()=>authorize(null,request,sender,origin));});
test('bind transfer to origin, exact path, tab, top frame, token and expiry',()=>{
  const record={token:'secret',tabId:4,origin,expires:2000};
  authorize(record,message,sender,origin,1000);
  authorize(record,message,{...sender,url:origin+'/tools/ezpix'},origin,1000);
  for(const bad of [{...sender,url:'http://evil.example/tools/ezpix/editor'},{...sender,url:origin+'/tools/ezpix/help'},{...sender,url:origin+'/tools/ezpix/other'},{...sender,tab:{id:5}},{...sender,frameId:1}])assert.throws(()=>authorize(record,message,bad,origin,1000));
  assert.throws(()=>authorize(record,{...message,token:'wrong'},sender,origin,1000));assert.throws(()=>authorize(record,message,sender,origin,2000));
});
test('pull chunks round-trip, corruption rejected, ACK retry is idempotent',async()=>{
  const text=encodeProject(createDocument(256,256)), bytes=new TextEncoder().encode(text),sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
  const record={bytes,sha256,engine:ENGINE_VERSION,acked:false};
  const result=await receiveProject(async message=>responseFor(record,message));
  assert.equal(result.document.width,256);await result.acknowledge();
  record.acked=true;delete record.bytes;assert.deepEqual(responseFor(record,{op:'ack',sha256}),{status:'imported'});
  assert.throws(()=>responseFor(record,{op:'manifest'}));
  const corrupt={bytes:new Uint8Array(bytes),sha256,engine:ENGINE_VERSION,acked:false};corrupt.bytes[20]^=1;
  await assert.rejects(receiveProject(async message=>responseFor(corrupt,message)),/checksum/);
  assert.throws(()=>responseFor(corrupt,{op:'chunk',index:-1}));assert.throws(()=>responseFor(corrupt,{op:'ack',sha256:'wrong'}));
});
