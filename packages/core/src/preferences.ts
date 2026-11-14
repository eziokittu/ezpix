/** Account sync is deliberately limited to settings. Artwork and project records are never accepted. */
import {validateCollageCells} from './design-tools.js';
export const PREF_KEYS = ['theme','tools','colours','palettes','fonts','workspace','shortcuts','layouts'] as const;
export type PreferenceKey = typeof PREF_KEYS[number];
export interface PreferenceEntry {updated:number;value:unknown}
export type Preferences = Partial<Record<PreferenceKey,PreferenceEntry>>;
export const PREFERENCE_BYTES=128*1024;
export function validatePreferences(input:unknown,now=Date.now()):Preferences {
 if(!input||typeof input!=='object'||Array.isArray(input)||JSON.stringify(input).length>PREFERENCE_BYTES)throw Error('Invalid or oversized preferences.');
 const out:Preferences={};
 for(const [key,item]of Object.entries(input)){
  if(!PREF_KEYS.includes(key as PreferenceKey)||!item||typeof item!=='object')throw Error('Unsupported preference.');
  const entry=item as PreferenceEntry;if(Object.keys(entry).some(k=>!['updated','value'].includes(k))||!Number.isSafeInteger(entry.updated)||entry.updated<0||entry.updated>now+300000)throw Error('Invalid preference timestamp.');
  const value=entry.value;
  if(key==='layouts'){
   if(!Array.isArray(value)||value.length>32)throw Error('Invalid saved layouts.');
   if(new Set(value.map(v=>v?.id)).size!==value.length)throw Error('Duplicate saved layouts.');
   for(const layout of value){if(!layout||Object.keys(layout).some(k=>!['id','name','cells','width','height','gap','color','fit'].includes(k))||typeof layout.id!=='string'||!/^[-a-zA-Z0-9_]{1,64}$/.test(layout.id)||typeof layout.name!=='string'||!layout.name.trim()||layout.name.length>40)throw Error('Invalid saved layout.');validateCollageCells(layout.cells);
    if((layout.width!==undefined||layout.height!==undefined)&&(!Number.isInteger(layout.width)||!Number.isInteger(layout.height)||layout.width<1||layout.height<1||layout.width>8192||layout.height>8192||layout.width*layout.height>4_000_000)||layout.gap!==undefined&&(!Number.isFinite(layout.gap)||layout.gap<0||layout.gap>.15)||layout.fit!==undefined&&!['cover','contain'].includes(layout.fit)||layout.color!==undefined&&(!Array.isArray(layout.color)||layout.color.length!==4||layout.color.some((n:number)=>!Number.isInteger(n)||n<0||n>255)))throw Error('Invalid saved layout canvas.');
   }
  }
  if(key==='theme'&&!['light','dark','system'].includes(String(value)))throw Error('Invalid theme.');
  if(key==='tools'&&(!Array.isArray(value)||value.length>8||new Set(value).size!==value.length||value.some(v=>typeof v!=='string'||!/^[-a-z]{1,24}$/.test(v))))throw Error('Invalid favourite tools.');
  if(key==='colours'&&(!Array.isArray(value)||value.length>20||value.some(v=>typeof v!=='string'||!/^#[0-9a-f]{6}$/i.test(v))))throw Error('Invalid colour history.');
  if(key==='palettes'&&(!Array.isArray(value)||value.length>32||value.some(p=>!p||Object.keys(p).some(k=>!['id','name','colors'].includes(k))||typeof p.id!=='string'||p.id.length>64||typeof p.name!=='string'||p.name.length>40||!Array.isArray(p.colors)||p.colors.length<2||p.colors.length>256||p.colors.some((v:unknown)=>typeof v!=='string'||!/^#[0-9a-f]{6}$/i.test(v)))))throw Error('Invalid saved palettes.');
  if(key==='fonts'&&(!Array.isArray(value)||value.length>32||value.some(f=>!f||Object.keys(f).some(k=>!['family','source'].includes(k))||typeof f.family!=='string'||f.family.length>100||typeof f.source!=='string'||!/^https:\/\/fonts\.google\.com\/specimen\/[A-Za-z0-9%+_-]+$/.test(f.source))))throw Error('Invalid Google font references.');
  // Only scalar UI settings. No URLs, scripts, files, arbitrary nested objects or document data.
  if(['workspace','shortcuts'].includes(key)&&(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>256||Object.entries(value).some(([k,v])=>!/^[-a-zA-Z0-9_.]{1,60}$/.test(k)||!['string','number','boolean'].includes(typeof v)||typeof v==='string'&&(v.length>120||/[<>]|https?:|data:|blob:/i.test(v))||typeof v==='number'&&!Number.isFinite(v))))throw Error('Invalid editor preferences.');
  out[key as PreferenceKey]={updated:entry.updated,value:structuredClone(value)};
 }
 return out;
}
export function mergePreferences(current:Preferences,incoming:Preferences):Preferences {
 const result=structuredClone(current);for(const key of PREF_KEYS){const next=incoming[key],old=result[key];if(next&&(!old||next.updated>old.updated||next.updated===old.updated&&JSON.stringify(next.value)>JSON.stringify(old.value)))result[key]=structuredClone(next);}return result;
}
export const LOCAL_PREFS:Partial<Record<PreferenceKey,string>>={theme:'ezpix.theme.v1',tools:'ezpix.tools.v2',colours:'ezpix.colours.v1',workspace:'ezpix.workspace.v1',shortcuts:'ezpix.shortcuts.v1',layouts:'ezpix.layouts.v1'};
export function readLocalPreferences():Partial<Record<PreferenceKey,unknown>> {
 const out:Partial<Record<PreferenceKey,unknown>>={};for(const [key,storage]of Object.entries(LOCAL_PREFS)){try{const raw=localStorage.getItem(storage!);if(raw!==null){const value=key==='theme'?raw:JSON.parse(raw);validatePreferences({[key]:{updated:0,value}});out[key as PreferenceKey]=value;}}catch{/* Ignore incompatible or corrupt device settings. */}}return out;
}
export function applyLocalPreferences(values:Preferences){
 for(const [key,storage]of Object.entries(LOCAL_PREFS)){const entry=values[key as PreferenceKey];if(entry)localStorage.setItem(storage!,key==='theme'?String(entry.value):JSON.stringify(entry.value));}
 const theme=values.theme?.value;if(theme){document.querySelectorAll<HTMLElement>('.ez-app,.ez-mobile').forEach(node=>node.dataset.theme=String(theme));const picker=document.querySelector<HTMLSelectElement>('[data-theme-picker]');if(picker)picker.value=String(theme);window.dispatchEvent(new Event('ezpix-theme'));}
 if(values.workspace)window.dispatchEvent(new Event('ezpix-workspace'));
 window.dispatchEvent(new CustomEvent('ezpix:prefs-applied',{detail:values}));
}
