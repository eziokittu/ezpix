import {spawnSync} from 'node:child_process';import {mkdir,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
import {PixelEditor,createDocument,prepareAuthored,prepareLayerWorkflow,encodeProject,composite,BLEND_MODES,LIVE_EFFECTS} from '../packages/core/dist/index.js';
const docs=[],actual=[];let seed=183192;const byte=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed>>>24;};
for(const mode of BLEND_MODES)for(const kind of LIVE_EFFECTS)for(let n=0;n<4;n++){
 const e=new PixelEditor(createDocument(3,5));for(let l=0;l<2;l++){if(l)e.addLayer();for(let i=0;i<15;i++)e.paint(i%3,Math.floor(i/3),[byte(),byte(),byte(),[0,1,128,255][(i+n)%4]]);e.commit();e.setLayerOpacity([73,128,254,255][(l+n)%4]);e.setLayerBlendMode(mode);}e.createGroup();
 const amount=kind==='brightness'?byte()-128:kind==='contrast'?byte()%199-99:kind==='alpha'?50+n*50:kind==='posterize'?4:kind==='mosaic'?2:kind==='blur'?1:0;
 e.applyAuthored(prepareAuthored(e.document,{kind:'adjustment',name:'Adjust',effects:[{kind,amount,enabled:true}]}));e.setLayerOpacity([73,128,254,255][n]);
 e.applyLayerWorkflow(prepareLayerWorkflow(e.document,{kind:'mask',layerId:e.document.activeLayerId,source:'coverage',coverage:{width:3,height:5,values:Uint8Array.from({length:15},()=>byte())}}));
 e.applyAuthored(prepareAuthored(e.document,{kind:'group-effects',id:'group-1',effects:[{kind:n%2?'blur':'alpha',amount:n%2?1:80,enabled:true}]}));e.setGroupProperties('group-1',{opacity:[73,128,254,255][n]});
 e.selectLayer('layer-1');e.applyAuthored(prepareAuthored(e.document,{kind:'text',name:'Title',text:{text:n%2?'A':'B',x:n%3-1,y:0,scale:1,spacing:1,color:[byte(),byte(),byte(),[0,1,128,255][n]]}}));e.setLayerBlendMode(mode);
 docs.push(JSON.parse(encodeProject(e.document,false)));actual.push([...composite(e.document)]);
}
const python=spawnSync('python',['scripts/phase13eket-reference.py'],{input:JSON.stringify(docs),encoding:'utf8',maxBuffer:8*1024*1024});assert.equal(python.status,0,python.stderr);const expected=JSON.parse(python.stdout);expected.forEach((p,i)=>assert.deepEqual(actual[i],p,`authored rational case ${i}`));await mkdir('artifacts/phase13eket-reference',{recursive:true});await writeFile('artifacts/phase13eket-reference/result.json',JSON.stringify({status:'passed',cases:docs.length,pixels:docs.length*15,oracle:'Independent Python Fraction: all blends/effects, adjustment masks/opacity, isolated group filters, original glyph placement and partial alpha'},null,2));console.log('PASS',docs.length,'independent authored composites');
