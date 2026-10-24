import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {PixelEditor,createDocument,prepareAuthored,encodeProject,captureIndexedCel,encodeIndexedCel,encodeIndexedCelPng,decodeIndexedCelPng,defaultIndexedBrush,ENGINE_VERSION} from '../packages/core/dist/index.js';
const out=resolve('artifacts/phase13gkgt-independent');await mkdir(out,{recursive:true});const cases=[];
const fixture=(w=8,h=6)=>{const e=new PixelEditor(createDocument(w,h,'Indexed canvas fixture'));for(let i=0;i<w*h;i++)e.paint(i%w,Math.floor(i/w),[[255,0,0,255],[0,0,0,0],[0,0,255,128]][i%3]);e.commit();e.addFrame();e.linkCel('frame-1');e.selectFrame('frame-1');for(const o of [{action:'enter'},{action:'append-slot',color:[255,0,0,255]},{action:'append-slot',color:[0,255,0,255]}])e.applyAuthored(prepareAuthored(e.document,{kind:'indexed-document',...o}));return e;};
const operations=[
 {action:'stroke',points:[{x:0,y:0},{x:7,y:5}],brush:defaultIndexedBrush(3,0),erase:false},
 {action:'stroke',points:[{x:3,y:2}],brush:{...defaultIndexedBrush(3,0),size:3,mirrorX:true,mirrorY:true},erase:true},
 {action:'flood',point:{x:0,y:0},slot:3},
 ...['Line','Rectangle','Ellipse'].flatMap(shape=>[false,true].map(filled=>({action:'shape',shape,a:{x:7,y:5},b:{x:0,y:0},slot:3,filled}))),
 {action:'stroke',points:[{x:3,y:2}],brush:{...defaultIndexedBrush(3,0),size:8,mode:'dither'},erase:false},
 {action:'stroke',points:[{x:3,y:2}],brush:{...defaultIndexedBrush(3,0),size:8,mode:'shade'},erase:false},
 ...['flip-x','flip-y','rotate-180','offset'].map(transform=>({action:'transform',transform,x:2,y:-1,wrap:true})),
 {action:'transform',transform:'offset',x:2,y:-1,wrap:false},
 {action:'remove-slot',slot:3},{action:'prune-slots'}
];
for(const [i,operation] of operations.entries()){const e=fixture(),before=JSON.parse(encodeIndexedCel(captureIndexedCel(e.document)));e.applyAuthored(prepareAuthored(e.document,{kind:'indexed-tool',...operation}));const raw=captureIndexedCel(e.document),json=`case-${i}.ezindexed`,png=`case-${i}.png`;await writeFile(resolve(out,json),encodeIndexedCel(raw));await writeFile(resolve(out,png),await encodeIndexedCelPng(raw));assert.deepEqual(await decodeIndexedCelPng(await readFile(resolve(out,png))),raw);cases.push({operation,before,json,png,project:JSON.parse(encodeProject(e.document))});}
await writeFile(resolve(out,'fixture.ezpix'),encodeProject(fixture().document));await writeFile(resolve(out,'fixture.png'),await encodeIndexedCelPng(captureIndexedCel(fixture().document)));
await writeFile(resolve(out,'cases.json'),JSON.stringify({version:ENGINE_VERSION,cases}));const p=spawnSync('python',['-X','utf8','scripts/phase13gkgt-readers.py',out],{stdio:'inherit',windowsHide:true});if(p.status)process.exit(p.status);const external=JSON.parse(await readFile(resolve(out,'external.json'),'utf8'));for(const c of external){const decoded=await decodeIndexedCelPng(await readFile(resolve(out,c.file)));assert.equal(encodeIndexedCel(decoded),JSON.stringify(c.expected));}
const result=JSON.parse(await readFile(resolve(out,'readers.json'),'utf8'));result.checks+=external.length;result.externalPNGFilters=external.length;await writeFile(resolve(out,'result.json'),JSON.stringify(result,null,2));console.log('PASS independent indexed tools',JSON.stringify(result));
