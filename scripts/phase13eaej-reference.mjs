import {spawnSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createDocument,PixelEditor,composite,prepareLayerWorkflow,BLEND_MODES,LIVE_EFFECTS} from '../packages/core/dist/index.js';
const cases=[],actual=[];let seed=172182;const byte=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed>>>24;};
for(const mode of BLEND_MODES)for(const kind of LIVE_EFFECTS)for(let n=0;n<8;n++){
 const e=new PixelEditor(createDocument(3,2)),nodes=[];
 for(let l=0;l<3;l++){
  if(l)e.addLayer();const d=e.document,pixels=Array.from({length:24},(_,i)=>i%4===3?[0,1,128,254,255][byte()%5]:byte()),mask=Array.from({length:6},()=>byte()),opacity=byte(),maskEnabled=n%3!==0;
  d.layers[l].cels[d.activeFrameId]=Uint8ClampedArray.from(pixels);e.setLayerOpacity(opacity);e.setLayerBlendMode(mode);
  const effects=[{kind,enabled:true,amount:kind==='brightness'?byte()-128:kind==='contrast'?byte()%199-99:kind==='alpha'?byte()%201:kind==='posterize'?2+byte()%31:kind==='mosaic'?1+byte()%3:kind==='blur'?1+byte()%4:0},{kind:'brightness',enabled:n%2===0,amount:17}];
  e.applyLayerWorkflow(prepareLayerWorkflow(d,{kind:'effects',layerId:d.activeLayerId,effects}));
  e.applyLayerWorkflow(prepareLayerWorkflow(d,{kind:'mask',layerId:d.activeLayerId,source:'coverage',coverage:{width:3,height:2,values:Uint8Array.from(mask)}}));
  if(!maskEnabled)e.applyLayerWorkflow(prepareLayerWorkflow(d,{kind:'mask-state',layerId:d.activeLayerId,action:'disable'}));
  nodes.push({pixels,mask,maskEnabled,effects,opacity,mode,visible:true});
 }
 if(n%2){e.selectLayer('layer-2');e.createGroup();e.selectLayer('layer-3');e.moveIntoGroup('layer-3','group-1');e.setGroupProperties('group-1',{opacity:73});nodes.push({children:nodes.splice(1),opacity:73,visible:true});}
 cases.push({width:3,height:2,nodes});actual.push([...composite(e.document)]);
}
const oracle=spawnSync('python',['scripts/phase13eaej-reference.py'],{input:JSON.stringify(cases),encoding:'utf8',maxBuffer:8*1024*1024});assert.equal(oracle.status,0,oracle.stderr);const expected=JSON.parse(oracle.stdout);expected.forEach((v,i)=>assert.deepEqual(actual[i],v,`case ${i}`));await mkdir('artifacts/phase13eaej-reference',{recursive:true});await writeFile('artifacts/phase13eaej-reference/result.json',JSON.stringify({status:'passed',cases:cases.length,pixels:cases.length*6,oracle:'Independent Python Fraction, eight blends, eight live effects, masks, partial alpha/opacity, isolated groups'},null,2));console.log('PASS',cases.length,'independent mask/effect cases');
