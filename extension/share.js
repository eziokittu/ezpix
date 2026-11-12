import {encodePhotoProject} from '../packages/core/dist/photo-project.js';
import {mountLocalShare} from '../packages/core/dist/local-share-ui.js';
import {mountFocusStudio} from '../packages/core/dist/focus-ui.js';
import {encodeProject,decodeProject} from '../packages/core/dist/index.js';
import {readArtworkImage,downloadFile,paintRaster} from '../packages/core/dist/browser.js';
import {state,updateState,purgeExpired} from './db.js';
import {decodeSharedArtwork,saveSharedFile} from '../packages/core/dist/shared-artwork.js';
await purgeExpired();
const token=location.hash.slice(1);history.replaceState(null,'',location.pathname);
let outgoing,disposed=false,loadJob=0;
if(/^[a-f0-9]{64}$/.test(token))await updateState('localShare',item=>{if(item?.token===token&&item.expires>Date.now()){outgoing=item;return null;}return item;});
const host=document.querySelector('[data-converter]'),section=document.querySelector('.received-studio');
const ui=mountFocusStudio(host,{createWorker:()=>new Worker(new URL('worker.js',location.href),{type:'module'}),applyLabel:'Save editable project',sourceLoaded(){section.hidden=false;section.open=true;},onApply(doc){downloadFile(new Blob([encodeProject(doc,false)],{type:'application/json'}),'EzPix-project.ezpix');}});
host.querySelector('[data-focus-palette]').value='original';
const share=mountLocalShare(document.querySelector('[data-share-host]'),{
 current:async()=>{const photo=ui.getWorkspace();if(photo)return new File([encodePhotoProject(photo)],'EzPix-creation.ezphoto',{type:'application/x-ezpix-photo'});if(ui.getPhoto())return ui.exportImage('png');if(outgoing?.photo instanceof Blob)return new File([outgoing.photo],'EzPix-photo.png',{type:'image/png'});const current=ui.getProject();if(current)return new File([encodeProject(current,false)],'EzPix-creation.ezpix',{type:'application/x-ezpix'});if(outgoing?.project instanceof Blob)return new File([outgoing.project],'EzPix-creation.ezpix',{type:'application/x-ezpix'});throw Error('Open media in the editor below, or use Choose an image.');},
 source:async()=>{const source=ui.getSource();if(source){const canvas=document.createElement('canvas');paintRaster(canvas,source);const blob=await new Promise(resolve=>canvas.toBlob(resolve));if(!blob)throw Error('PNG encoding failed.');return new File([blob],'EzPix-source.png',{type:'image/png'});}if(outgoing?.source instanceof Blob)return new File([outgoing.source],'EzPix-source.png',{type:'image/png'});throw Error('No source image is open. Use Choose an image.');},
 open:async(file,signal)=>{const job=++loadJob;const {document:project,source,photo}=await decodeSharedArtwork(file);if(disposed||signal.aborted||job!==loadJob)return false;if(ui.getSource()&&!confirm('Replace the image in this sharing tab? Save its edited project first if needed.'))return false;if(project?.layers.length>1&&!confirm('Open combined visible pixels for conversion? Save the original received file to retain editable layers.'))return false;if(photo)ui.loadWorkspace(photo);else if(project)ui.loadProject(project);else ui.load(source);return true;},
 save:saveSharedFile,
});
document.querySelector('[data-focus-file]').closest('label').hidden=false;
section.hidden=false;
window.addEventListener('pagehide',()=>{disposed=true;loadJob++;share.dispose();ui.dispose();outgoing=undefined;},{once:true});
