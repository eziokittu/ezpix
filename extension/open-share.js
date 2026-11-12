import {state} from './db.js';
import {encodeProject} from '../packages/core/dist/index.js';
/** Snapshot into the same bounded, one-use local pairing handoff used by the popup. */
export async function openDeviceShare(api){
 const token=[...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join('');
 const project=api.getProject(),photo=api.getMode()==='photo'?await api.exportImage('png'):undefined,source=api.getSource();let sourceBlob;
 if(source){const canvas=new OffscreenCanvas(source.width,source.height);canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(source.pixels),source.width,source.height),0,0);sourceBlob=await canvas.convertToBlob({type:'image/png'});}
 await state('localShare',{token,photo,project:project?new Blob([encodeProject(project,false)],{type:'application/x-ezpix'}):undefined,source:sourceBlob,expires:Date.now()+10*60*1000});
 await chrome.alarms.create('ezpix-local-share-expiry',{when:Date.now()+10*60*1000});await chrome.tabs.create({url:chrome.runtime.getURL('share.html')+'#'+token});
}
