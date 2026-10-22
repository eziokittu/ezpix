import {createDocument,captureSelection,advancedSelectionMask,exportSelectionMaskPng} from '../packages/core/dist/index.js';
import {mkdir,writeFile} from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {resolve} from 'node:path';import assert from 'node:assert/strict';
const out=resolve('artifacts/phase13blbz-independent');await mkdir(out,{recursive:true});let seed=135078;const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;},cases=[],kinds=['wand','colour','alpha','polygon','lasso','brush','shape','morphology','holes','components'];
for(const kind of kinds)for(let trial=0;trial<60;trial++){
 const w=1+rand(13),h=1+rand(12),n=w*h,s=captureSelection(createDocument(w,h),{x:0,y:0,width:w,height:h});s.mask=Uint8Array.from({length:n},()=>+(rand(3)!==0));for(let i=0;i<n;i++)s.baseline.set([rand(4)*60,rand(4)*60,rand(4)*60,[0,1,128,255][rand(4)]],i*4);const xy={x:rand(w),y:rand(h)},connectivity=rand(2)?4:8;let op;
 if(kind==='wand'||kind==='colour')op={kind,seed:xy,tolerance:[0,60,128,255][trial%4],channels:trial%2?'rgb':'rgba',connectivity};
 else if(kind==='alpha'){const min=rand(256);op={kind,min,max:min+rand(256-min)};}
 else if(kind==='polygon'||kind==='lasso')op={kind,points:Array.from({length:3+rand(8)},()=>({x:rand(w),y:rand(h)}))};
 else if(kind==='brush')op={kind,points:[{x:0,y:xy.y},{x:w-1,y:xy.y}],size:1+rand(8),shape:trial%2?'square':'round',erase:trial%3===0};
 else if(kind==='shape')op={kind,shape:['rectangle','ellipse','diamond'][trial%3],...xy,width:1+rand(w-xy.x),height:1+rand(h-xy.y)};
 else if(kind==='morphology')op={kind,mode:['grow','shrink','border','open','close'][trial%5],radius:1+rand(4),connectivity};
 else if(kind==='holes')op={kind,connectivity};
 else op={kind,mode:['largest','seed','size'][trial%3],seed:xy,min:1,max:1+rand(n),connectivity};
 const combine=['replace','union','subtract','intersect','xor'][trial%5],prior=Buffer.from(s.baseline),mask=s.mask.slice(),result=advancedSelectionMask(s,op,combine),c={w,h,raw:prior.toString('base64'),mask:[...mask],op,combine,result:[...(result.mask??new Uint8Array(n).fill(1))]};assert.deepEqual([...s.baseline],[...prior]);assert.deepEqual(s.mask,mask);if(trial%10===0)c.png=Buffer.from(await exportSelectionMaskPng(result)).toString('base64');cases.push(c);
}
const path=resolve(out,'fixtures.json');await writeFile(path,JSON.stringify(cases));const report=JSON.parse(execFileSync('python',['scripts/phase13blbz-reference.py',path],{encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024}));await writeFile(resolve(out,'result.json'),JSON.stringify(report,null,2));console.log('PASS '+JSON.stringify(report));
