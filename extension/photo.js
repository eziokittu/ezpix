import {mountPhotoColours} from '../packages/core/dist/colour-controls.js';
import {mountPhotoFinishing} from '../packages/core/dist/photo-tools.js';
import {preferenceStorage} from '../packages/core/dist/account-client.js';
import {mountFontLibrary} from '../packages/core/dist/synced-fonts.js';
import {startAccountSync} from './account-sync.js';
import {mountFeedbackButtons} from '../packages/core/dist/feedback.js';
﻿import {mountFocusStudio} from '../packages/core/dist/focus-ui.js';
import {createCreativeTools} from '../packages/core/dist/creative-ui.js';
import {mountLiveCamera} from '../packages/core/dist/live-camera.js';
import {encodeProject} from '../packages/core/dist/index.js';
import {downloadFile} from '../packages/core/dist/browser.js';
import {openDeviceShare} from './open-share.js';
const host=document.querySelector('[data-converter]');
const ui=mountFocusStudio(host,{defaultMode:'photo',workspace:true,automatic:true,createWorker:()=>new Worker(new URL('worker.js',location.href),{type:'module'}),applyLabel:'Save pixel project',onApply:doc=>downloadFile(new Blob([encodeProject(doc,false)],{type:'application/json'}),'EzPix-project.ezpix')});
host.querySelector('[data-focus-palette]').value='original';host.querySelector('.ez-focus-kicker').textContent='EZPIX PHOTO';host.querySelector('h2').textContent='Create something yours.';
const disposeColours=mountPhotoColours(document.body,host,ui),disposeFinishing=mountPhotoFinishing(host,ui);window.addEventListener('pagehide',()=>{disposeColours();disposeFinishing();},{once:true});
const creative=createCreativeTools(host,ui,{automatic:true,livePreview:true,liveEmoji:true}),settings=host.querySelector('.ez-focus-settings');
creative.tools.forEach(([id,,,title],i)=>{const details=document.createElement('details');details.className='creative-group';const summary=document.createElement('summary');summary.textContent=title;details.append(summary,creative.contents[i]);settings.append(details);details.addEventListener('toggle',()=>{if(details.open){settings.querySelectorAll('.creative-group').forEach(other=>{if(other!==details)other.open=false;});creative.activate(id);}else if(!settings.querySelector('.creative-group[open]'))creative.activate();});});
const camera=mountLiveCamera(document.body,ui);host.querySelector('[data-focus-camera]').onclick=()=>camera.open();document.querySelector('[data-open-camera]').onclick=()=>camera.open();document.querySelector('[data-device-share]').onclick=async event=>{const button=event.currentTarget;button.disabled=true;try{await openDeviceShare(ui);}catch(error){document.querySelector('[data-tab-status]').textContent=error.message;}finally{button.disabled=false;}};
window.addEventListener('pagehide',()=>{camera.dispose();creative.dispose();ui.dispose();},{once:true});

const feedback=document.createElement('details');feedback.innerHTML='<summary>Help &amp; feedback</summary>';settings.append(feedback);mountFeedbackButtons(feedback,'EzPIX Insta');

const fontLibrary=await preferenceStorage().then(storage=>mountFontLibrary(settings,storage,host));window.addEventListener('pagehide',()=>fontLibrary.dispose(),{once:true});const accountButton=document.createElement('button');accountButton.textContent='Account & sync';accountButton.onclick=()=>chrome.tabs.create({url:chrome.runtime.getURL('account.html')});settings.append(accountButton);
void startAccountSync(fontLibrary,ui).catch(()=>{});
