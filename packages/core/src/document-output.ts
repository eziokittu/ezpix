import type {PixelDocument} from './document.js';
import {composite,encodeProject,decodeProject} from './document.js';
import {validatePalette} from './toolkit.js';
export type DocumentOutput='rgba'|'grayscale'|'palette';
export const OUTPUT_MODE_NOTE='Document output changes the final visible composite across frames, after layers and effects. Editable source cels, text, references and palette swatches retain RGBA/RGB colour. Grayscale uses encoded-byte 299/587/114 weights; palette output chooses nearest project RGB swatch (squared RGB distance, first slot wins ties), preserving pixel alpha. This is not grayscale/indexed storage editing or colour-profile conversion. Raw-cel workflows use source pixels.';
export function validateDocumentOutput(mode:unknown):asserts mode is PixelDocument['outputMode'] {if(mode!==undefined&&mode!=='grayscale'&&mode!=='palette')throw new Error('Document output must be grayscale, palette or absent for RGBA.');}
export function setDocumentOutput(doc:PixelDocument,mode:DocumentOutput){if(!['rgba','grayscale','palette'].includes(mode))throw new Error('Choose RGBA, grayscale or palette output.');if(doc.editingMode&&mode==='palette')throw new Error('Disable grayscale editing before selecting palette output.');if(mode==='rgba')delete doc.outputMode;else doc.outputMode=mode;}
export function renderDocumentOutput(doc:PixelDocument,pixels:Uint8ClampedArray){validateDocumentOutput(doc.outputMode);if(!doc.outputMode&&!doc.editingMode)return pixels;const colors=!doc.editingMode&&doc.outputMode==='palette'?validatePalette(doc.palette).map(c=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)]):null,cache=new Map<number,number>();
 for(let i=0;i<pixels.length;i+=4){if(!pixels[i+3]){pixels.fill(0,i,i+4);continue;}if(!colors){const gray=Math.floor((pixels[i]*299+pixels[i+1]*587+pixels[i+2]*114+500)/1000);pixels[i]=pixels[i+1]=pixels[i+2]=gray;}else{const key=(pixels[i]<<16)|(pixels[i+1]<<8)|pixels[i+2];let index=cache.get(key);if(index===undefined){index=0;let best=Infinity;for(let j=0;j<colors.length;j++){const c=colors[j],d=(pixels[i]-c[0])**2+(pixels[i+1]-c[1])**2+(pixels[i+2]-c[2])**2;if(d<best){best=d;index=j;}}cache.set(key,index);}pixels.set(colors[index],i);}}
 return pixels;
}
export interface DocumentOutputPlan {readonly baseline:string;readonly mode:DocumentOutput;readonly changed:boolean;readonly historyBytes:number;readonly preview:Uint8ClampedArray}
const plans=new WeakMap<DocumentOutputPlan,DocumentOutput>();
export function prepareDocumentOutput(doc:PixelDocument,mode:DocumentOutput,budget=8*1024*1024):DocumentOutputPlan {
 const baseline=encodeProject(doc,false),snapshot=decodeProject(baseline);setDocumentOutput(snapshot,mode);const changed=(doc.outputMode??'rgba')!==mode,historyBytes=512;if(changed&&(!Number.isFinite(budget)||budget<historyBytes))throw new Error('Output mode exceeds the undo memory budget.');const plan=Object.freeze({baseline,mode,changed,historyBytes,get preview(){return composite(snapshot);}});plans.set(plan,mode);return plan;
}
export function regenerateDocumentOutput(doc:PixelDocument,plan:DocumentOutputPlan,budget:number){const mode=plans.get(plan);if(!mode||plan.baseline!==encodeProject(doc,false))throw new Error('Output source changed. Prepare again.');return prepareDocumentOutput(doc,mode,budget);}
