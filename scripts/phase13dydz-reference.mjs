import {spawnSync} from 'node:child_process';import {mkdir,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
import {BLEND_MODES,PixelEditor,createDocument,composite} from '../packages/core/dist/index.js';
const fixtures=[],actual=[];let seed=91231;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed>>>24;};
for(const mode of BLEND_MODES)for(let i=0;i<64;i++){
 const e=new PixelEditor(createDocument(1,1)),nodes=[];
 for(let l=0;l<3;l++){if(l)e.addLayer();const pixels=[rand(),rand(),rand(),[0,1,127,128,254,255][(i+l)%6]],opacity=[0,1,73,128,254,255][(i+2*l)%6],visible=(i+l)%11!==0;e.paint(0,0,pixels);e.commit();e.setLayerOpacity(opacity);e.setLayerBlendMode(l?mode:'normal');if(!visible)e.toggleLayer();nodes.push({pixels,opacity,visible,mode:l?mode:'normal'});}
 if(i%2){e.selectLayer('layer-2');e.createGroup();e.selectLayer('layer-3');e.moveIntoGroup('layer-3','group-1');e.setGroupProperties('group-1',{opacity:73});const group={children:nodes.splice(1),opacity:73,visible:true};nodes.push(group);if(i%4===1){e.createGroup('group-1');e.setGroupProperties('group-2',{opacity:128});nodes[1]={children:[group],opacity:128,visible:true};}}
 fixtures.push(nodes);actual.push([...composite(e.document)]);
}
const p=spawnSync('python',['-X','utf8','scripts/phase13dydz-reference.py'],{input:JSON.stringify(fixtures),encoding:'utf8'});assert.equal(p.status,0,p.stderr);const expected=JSON.parse(p.stdout);for(let i=0;i<actual.length;i++)assert.deepEqual(actual[i],expected[i],`rational case ${i}`);
await mkdir('artifacts/phase13dydz-reference',{recursive:true});await writeFile('artifacts/phase13dydz-reference/result.json',JSON.stringify({status:'passed',cases:actual.length,modes:BLEND_MODES,oracle:'independent Python Fraction, partial alpha/opacity, hidden leaves, isolated nested groups'},null,2));console.log('PASS',actual.length,'independent blend cases');
