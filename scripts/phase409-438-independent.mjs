import {mkdir,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';import {spawnSync} from 'node:child_process';
import {createLargeCanvas,LargeCanvasEditor,encodeLargeProject,exportLargePng} from '../packages/core/dist/index.js';
const out=resolve('artifacts/phase409-438');await mkdir(out,{recursive:true});const fixtures=[];
for(let i=0;i<12;i++){
 const e=new LargeCanvasEditor(createLargeCanvas(32,24,'Animated independent '+i,[30+i,70,110,180+i]));e.paint(3,3,[7,8,9,0]);e.commit();for(let k=0;k<3;k++)e.addFrame(true);e.linkCel('frame-1');
 e.apply(e.prepareMaskTimeline({kind:'animate'}));
 const inputs=[];for(let k=0;k<4;k++){e.selectFrame('frame-'+(k+1));e.frameDuration([100,200,300,400][k]);const m={enabled:i%5!==0,outside:(i*17+k*43)%256,rect:{x:2,y:2,width:5,height:4},coverage:Uint8Array.from({length:20},(_,j)=>(i*37+j*19+k*23)%256)};e.apply(e.prepareLayerMask({kind:'replace',mask:m}));inputs.push({...m,coverage:[...m.coverage]});}
 const before=JSON.parse(encodeLargeProject(e.document));e.apply(e.prepareMaskTimeline({kind:'tween',from:0,to:3}));const after=JSON.parse(encodeLargeProject(e.document));
 for(let k=0;k<4;k++)await writeFile(resolve(out,`fixture-${i}-frame-${k}.png`),Buffer.from(await(await exportLargePng(e.document,'frame-'+(k+1))).arrayBuffer()));
 e.apply(e.prepareLayerMask({kind:'bake'}));const baked=JSON.parse(encodeLargeProject(e.document));fixtures.push({i,inputs,before,after,baked});
}
await writeFile(resolve(out,'fixtures.json'),JSON.stringify(fixtures));const r=spawnSync('python',[resolve('scripts/phase409-438-reference.py'),out],{stdio:'inherit',windowsHide:true});process.exit(r.status??1);
