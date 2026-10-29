import {mkdir,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';import {spawnSync} from 'node:child_process';
import {createLargeIndexed,LargeCanvasEditor,encodeLargeProject,exportLargePng,largeMaskShape} from '../packages/core/dist/index.js';
const out=resolve('artifacts/phase439-468');await mkdir(out,{recursive:true});const fixtures=[];
for(let i=0;i<16;i++){
 const palette=[[10,20,30,255],[10,20,30,255],[7,8,9,0],[23,45,67,128],[60,80,100,0],[130,50,220,220],[1,2,3,255]],e=new LargeCanvasEditor(createLargeIndexed(70,66,palette,2,0,'Indexed fixture '+i));
 e.apply(e.prepareIndexed({kind:'index-fill',rect:{x:1,y:2,width:7,height:6},index:1,mask:largeMaskShape({x:1,y:2,width:7,height:6},'diamond')}));
 for(let k=0;k<3;k++){if(k)e.addFrame(true);e.strokeIndex([{x:63,y:63},{x:64,y:64},{x:69,y:65}],(i+k)%6);e.commit();e.frameDuration(100+k*100);}
 e.linkCel('frame-1');e.addLayer();e.strokeIndex([{x:3,y:4},{x:64,y:64}],5,2);e.commit();e.layerProperties({opacity:128+i});
 const m={enabled:i%5!==0,outside:64+i*7,rect:{x:1,y:2,width:7,height:6},coverage:Uint8Array.from({length:42},(_,j)=>(j*13+i*17)%256)};e.apply(e.prepareLayerMask({kind:'replace',mask:m}));e.apply(e.prepareMaskTimeline({kind:'animate'}));e.apply(e.prepareMaskTimeline({kind:'unlink'}));e.apply(e.prepareLayerMask({kind:'outside',value:200}));
 const before=JSON.parse(encodeLargeProject(e.document)),edit=i%2?{kind:'palette-set',index:1,color:[20+i,100,200,128]}:{kind:'palette-reorder',mapping:[6,5,4,3,2,1,0]};e.apply(e.prepareIndexed(edit));const after=JSON.parse(encodeLargeProject(e.document));
 for(let k=0;k<3;k++)await writeFile(resolve(out,`fixture-${i}-${k}.png`),Buffer.from(await(await exportLargePng(e.document,'frame-'+(k+1))).arrayBuffer()));
 e.apply(e.prepareIndexed({kind:'to-rgba'}));const rgba=JSON.parse(encodeLargeProject(e.document));fixtures.push({i,edit,before,after,rgba});
}
await writeFile(resolve(out,'fixtures.json'),JSON.stringify(fixtures));const r=spawnSync('python',[resolve('scripts/phase439-468-reference.py'),out],{stdio:'inherit',windowsHide:true});process.exit(r.status??1);
