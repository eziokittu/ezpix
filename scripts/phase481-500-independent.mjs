import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {LargeCanvasEditor,createLargeIndexed,encodeLargeProject,encodeLargeClipboard,decodeLargeClipboard,exportLargePng,largeWarpIndices} from '../packages/core/dist/index.js';
import assert from 'node:assert/strict';
const out=resolve('artifacts/phase481-500');await mkdir(out,{recursive:true});const cases=[];
const warps=[];for(let turn=0;turn<4;turn++)for(const [width,height] of [[7,5],[10,8],[3,2]])warps.push({kind:'turn',turn,width,height});for(const angle of [0,15,-33,45,90,180,-90,360])warps.push({kind:'rotate',angle});for(const [shearX,shearY] of [[.5,0],[-.5,.25],[0,-1],[1,.5]])warps.push({kind:'shear',shearX,shearY});for(const quad of [[{x:0,y:0},{x:10,y:0},{x:10,y:8},{x:0,y:8}],[{x:2,y:0},{x:8,y:1},{x:10,y:8},{x:0,y:7}],[{x:0,y:1},{x:9,y:0},{x:8,y:7},{x:1,y:8}],[{x:2,y:2},{x:8,y:1},{x:9,y:7},{x:0,y:8}]])warps.push({kind:'perspective',width:10,height:8,quad});
for(let i=0;i<warps.length;i++){
 const palette=[[8,9,10,0],[210,20,40,255],[210,20,40,255],[4,5,6,0],[20,70,210,128],[99,77,55,255]],e=new LargeCanvasEditor(createLargeIndexed(96,80,palette,3,1,'Slot transform '+i)),mask={rect:{x:61,y:60,width:7,height:5},bits:Uint8Array.from({length:35},(_,j)=>Number((j*7+i*3)%11<7))};
 for(let j=0;j<35;j++)e.strokeIndex([{x:61+j%7,y:60+Math.floor(j/7)}],(j+i)%5);e.commit();e.addFrame(true);e.linkCel('frame-1');e.addFrame(true);e.strokeIndex([{x:90,y:70}],4);e.commit();e.selectFrame('frame-1');
 e.apply(e.prepareLayerMask({kind:'replace',mask:{enabled:true,outside:128,rect:{x:61,y:60,width:7,height:5},coverage:Uint8Array.from({length:35},(_,j)=>(j*23+i*13)%256)}}));e.apply(e.prepareMaskTimeline({kind:'animate'}));e.addLayer();e.strokeIndex([{x:65,y:64},{x:70,y:66}],4,2);e.commit();e.layerProperties({opacity:170});e.selectLayer('layer-1');e.selection.set(mask);
 const before=JSON.parse(encodeLargeProject(e.document)),options={x:63,y:61,copy:!!(i%2),flipX:!!(i&2),flipY:!!(i&4),warp:warps[i]},clipboard=i%3===0?e.copyMasked():undefined;
 if(clipboard)await writeFile(resolve(out,`fixture-${i}.ezclipboard`),encodeLargeClipboard(clipboard));
 const plan=e.prepareWarp(options,clipboard?decodeLargeClipboard(encodeLargeClipboard(clipboard)):undefined);e.apply(plan);const after=JSON.parse(encodeLargeProject(e.document));
 for(const f of e.document.frames)await writeFile(resolve(out,`fixture-${i}-${f.id}.png`),new Uint8Array(await(await exportLargePng(e.document,f.id)).arrayBuffer()));
 cases.push({i,before,after,mask:{rect:mask.rect,bits:[...mask.bits]},options,clipboard:!!clipboard,output:{width:plan.width,height:plan.height,bits:[...plan.membership],indices:[...plan.indices]}});
}
const maximum={rect:{x:0,y:0,width:1024,height:1024},bits:new Uint8Array(1048576).fill(1)},r=largeWarpIndices(maximum,new Uint8Array(1048576).fill(255),{kind:'turn',turn:1,width:1024,height:1024},true);assert.equal(r.indices.length,1048576);assert.ok(r.indices.every(v=>v===255));
await writeFile(resolve(out,'fixtures.json'),JSON.stringify(cases));await writeFile(resolve(out,'capacity.json'),JSON.stringify({status:'passed',inputSlots:1048576,outputSlots:1048576,membership:1048576},null,2));
const result=spawnSync('python',[resolve('scripts/phase481-500-reference.py'),out],{stdio:'inherit',windowsHide:true});process.exitCode=result.status??1;
