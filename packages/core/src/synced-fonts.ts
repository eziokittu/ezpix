import {downloadFont,type FontPart} from './font-import.js';
import type {AccountStorage} from './account-client.js';
import {validatePreferences} from './preferences.js';
export interface CachedFont {family:string;parts:FontPart[];bytes:number;source:string}
/** Shared Google Font cache; only font references, never binary files, enter account sync. */
export function mountFontLibrary(host:HTMLElement,storage:AccountStorage,scope:HTMLElement=host,onChange:()=>void=()=>{}){
 const section=document.createElement('details');section.className='font-settings';section.id='font-settings';
 section.innerHTML='<summary>Add a new text font</summary><div class="font-settings-body"><p>Import a Google Fonts family for offline use. With account sync enabled, the font reference follows you and its files download from Google on another device. Photos and editing text are never sent.</p><a href="https://fonts.google.com/" target="_blank" rel="noopener noreferrer">Browse Google Fonts</a><label>Google Fonts link<input data-font-link type="url" placeholder="https://fonts.google.com/specimen/Noto+Sans"></label><button data-font-install>Import font</button><p data-font-status role="status"></p><div data-font-list></div></div>';host.append(section);
 let fonts:CachedFont[]=[],disposed=false,queue=Promise.resolve();const registered=new Map<string,FontFace[]>();
 const status=(text:string)=>{section.querySelector('[data-font-status]')!.textContent=text;};
 async function register(font:CachedFont){
  if(typeof FontFace==='undefined'||!document.fonts)return;const faces:FontFace[]=[];
  for(const part of font.parts){if(!(part.bytes instanceof ArrayBuffer)||part.bytes.byteLength>8*1024*1024)throw Error('Invalid cached font.');const face=new FontFace(font.family,part.bytes,{style:part.style,weight:part.weight,unicodeRange:part.unicodeRange});await face.load();faces.push(face);}
  if(disposed)return;for(const face of registered.get(font.family)??[])document.fonts.delete(face);for(const face of faces)document.fonts.add(face);registered.set(font.family,faces);
 }
 function render(){
  if(disposed)return;const list=section.querySelector('[data-font-list]')!;list.replaceChildren();
  for(const font of fonts){for(const select of scope.querySelectorAll<HTMLSelectElement>('[data-creative=font]'))if(![...select.options].some(o=>o.value===font.family))select.add(new Option(font.family+' (imported)',font.family));const row=document.createElement('p');row.textContent=font.family+' - available offline';list.append(row);}onChange();
 }
 const checkedCache=(value:unknown):CachedFont[]=>{
  if(!Array.isArray(value)||value.length>32)throw Error('Invalid font cache.');let total=0;
  for(const font of value as CachedFont[]){validatePreferences({fonts:{updated:0,value:[{family:font.family,source:font.source}]}});if(!Array.isArray(font.parts)||font.parts.length>160||font.parts.some(p=>!(p.bytes instanceof ArrayBuffer)||p.bytes.byteLength>8*1024*1024))throw Error('Invalid cached font.');const size=font.parts.reduce((n,p)=>n+p.bytes.byteLength,0);if(size!==font.bytes||size>16*1024*1024||(total+=size)>48*1024*1024)throw Error('Invalid or oversized font cache.');}return value;
 };
 const ready=storage.read('font-cache').then(async value=>{if(value===undefined)return;if(disposed)return;for(const font of checkedCache(value)){await register(font);fonts.push(font);}render();}).catch(()=>status('Some cached fonts could not load. Import their Google Fonts links again.'));
 async function install(source:string){
  const next=await downloadFont(source);if(disposed)return;
  if(fonts.length>=32&&!fonts.some(f=>f.family===next.family))throw Error('You can keep up to 32 imported font families.');
  if(fonts.filter(f=>f.family!==next.family).reduce((n,f)=>n+f.bytes,0)+next.bytes>48*1024*1024)throw Error('Installed fonts exceed 48 MiB.');
  await register(next);const values=[...fonts.filter(f=>f.family!==next.family),next];await storage.write('font-cache',values);if(disposed)return;fonts=values;render();try{localStorage.setItem('ezpix.font-cache-revision',String(Date.now()));}catch{}
 }
 function importSources(sources:unknown){
  validatePreferences({fonts:{updated:0,value:sources}});
  const task=queue.then(async()=>{await ready;for(const source of sources as {family:string;source:string}[]){if(disposed)return;if(fonts.some(f=>f.family===source.family&&f.source===source.source))continue;status('Downloading '+source.family+' for offline use...');await install(source.source);}status('Fonts are ready on this device.');});queue=task.catch(error=>status((error as Error).message));return task;
 }
 section.querySelector<HTMLButtonElement>('[data-font-install]')!.onclick=async()=>{const button=section.querySelector<HTMLButtonElement>('[data-font-install]')!;button.disabled=true;try{await ready;const value=section.querySelector<HTMLInputElement>('[data-font-link]')!.value;status('Downloading font files...');const task=queue.then(()=>install(value));queue=task.catch(()=>{});await task;status('Font installed for offline use.');}catch(error){status((error as Error).message);}finally{button.disabled=false;}};
 const refresh=async()=>{await ready;const cached=checkedCache(await storage.read('font-cache'));for(const font of cached){if(disposed)return;if(fonts.some(f=>f.family===font.family))continue;await register(font);fonts.push(font);}render();};
 const changed=(event:StorageEvent)=>{if(event.key==='ezpix.font-cache-revision')void refresh().catch(()=>status('A synced font could not be loaded.'));};window.addEventListener('storage',changed);
 return {section,ready,importSources,async sources(){await ready;return fonts.map(({family,source})=>({family,source}));},dispose(){disposed=true;window.removeEventListener('storage',changed);for(const faces of registered.values())for(const face of faces)document.fonts.delete(face);section.remove();}};
}
