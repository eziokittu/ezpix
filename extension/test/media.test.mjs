import {test} from 'node:test';
import assert from 'node:assert/strict';
import {authorizeMedia} from '../media-capture.js';
import {mediaError} from '../media-errors.js';

test('capture return requires the exact extension page, live tab/document, top frame, nonce and expiry',()=>{
 const id='extension',url='chrome-extension://extension/media.html',record={tabId:7,nonce:'one-time-token',expires:2000};
 const sender={id,url,frameId:0,documentId:'current-document'},contexts=[{tabId:7,frameId:0,documentId:'current-document'}];
 const authorize=(r=record,s=sender,c=contexts,n=record.nonce,now=1000)=>authorizeMedia(r,s,c,id,url,n,now);
 assert.equal(authorize(),record);
 for(const patch of [{id:'other'},{url:url+'?changed'},{url:'chrome-extension://extension/app.html'},{frameId:1},{documentId:'old-document'},{documentId:undefined}])assert.throws(()=>authorize(record,{...sender,...patch}),/expired or changed/);
 for(const changed of [null,{...record,expires:1000},{...record,expires:NaN},{...record,tabId:9}])assert.throws(()=>authorize(changed),/expired or changed/);
 assert.throws(()=>authorize(record,sender,[]),/expired or changed/);
 assert.throws(()=>authorize(record,sender,contexts,'replayed-token'),/expired or changed/);
 assert.throws(()=>authorizeMedia(record,sender,contexts,id,url,undefined,1000),/expired or changed/);
 assert.throws(()=>authorizeMedia(record,sender,contexts,id,url,null,1000),/expired or changed/);
});
test('camera errors distinguish permissions, missing hardware, busy camera and screen-chooser cancellation',()=>{
 assert.match(mediaError({name:'NotAllowedError'},'camera'),/Chrome or Windows/);
 assert.match(mediaError({name:'NotAllowedError'},'screen'),/cancelled or blocked/);
 assert.match(mediaError({name:'NotFoundError'},'camera'),/No camera was found/);
 assert.match(mediaError({name:'NotReadableError'},'camera'),/busy or blocked/);
 assert.match(mediaError({name:'NotReadableError'},'screen'),/different screen/);
 assert.match(mediaError({name:'OverconstrainedError'},'camera'),/another camera/);
 assert.match(mediaError({name:'AbortError'},'camera'),/interrupted/);
 assert.equal(mediaError({message:'Local storage failed.'},'camera'),'Local storage failed.');
});
