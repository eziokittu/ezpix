import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDocument,PixelEditor,encodeProject,decodeProject,composite,prepareLayerWorkflow,prepareReferenceTransform,prepareCanvasGeometry,encodeAseprite,encodePiskel,encodePsd,encodeOra,decodePsd,decodeOra,captureClip,decodeClip,renderLayerPixels} from '../dist/index.js';
const fixture=()=>{const e=new PixelEditor(createDocument(3,2,'Persistent study'));for(let i=0;i<6;i++)e.paint(i%3,Math.floor(i/3),[20+i*30,80+i,200-i*20,[255,128,0][i%3]]);e.commit();e.addFrame();e.linkCel('frame-1');e.addFrame();e.selectFrame('frame-1');return e;};
const apply=(e,o)=>e.applyLayerWorkflow(prepareLayerWorkflow(e.document,o,e.historyBudget));
const mask=(e,values)=>({kind:'mask',layerId:e.document.activeLayerId,source:'coverage',coverage:{width:e.document.width,height:e.document.height,values:Uint8Array.from(values)}});
const atomic=(e,fn)=>{const before=encodeProject(e.document);assert.equal(fn(),true);const after=encodeProject(e.document);assert.notEqual(after,before);e.undo();assert.equal(encodeProject(e.document),before);e.redo();assert.equal(encodeProject(e.document),after);return after;};
test('persistent mask v12 roundtrip, legacy migration and hidden RGBA preservation',()=>{
 const e=fixture(),raw=e.document.layers[0].pixels.slice();atomic(e,()=>apply(e,mask(e,[0,128,255,255,64,0])));const doc=e.document,data=JSON.parse(encodeProject(doc));assert.equal(data.version,16);assert.equal(encodeProject(decodeProject(JSON.stringify(data))),JSON.stringify(data));assert.deepEqual(doc.layers[0].pixels,raw);assert.equal(doc.layers[0].cels['frame-1'],doc.layers[0].cels['frame-2']);
 assert.deepEqual([...composite(doc)].filter((_,i)=>i%4===3),[0,64,0,255,32,0]);
 for(const version of [10,11]){const old=structuredClone(data);old.version=version;const migrated=decodeProject(JSON.stringify(old));assert.equal(migrated.layers[0].mask,undefined);assert.equal(migrated.layers[0].effects,undefined);}
});
test('hostile masks and live stack metadata reject, including disabled state',()=>{
 const e=fixture();apply(e,mask(e,[0,1,2,3,4,255]));const data=JSON.parse(encodeProject(e.document));
 for(const value of [null,{},[],{enabled:0,gray:'AAAAAA=='},{enabled:true,gray:'A'.repeat(7)+'='},{enabled:false,gray:'!!!!!!=='},{enabled:true,gray:'AAAA'}]){const bad=structuredClone(data);bad.layers[0].mask=value;assert.throws(()=>decodeProject(JSON.stringify(bad)),/mask/);}
 for(const effects of [null,[{kind:'invert',enabled:true,amount:0,unexpected:[1,2]}],{},Array(9).fill({kind:'invert',amount:0,enabled:true}),[{kind:'unknown',amount:0,enabled:false}],[{kind:'blur',amount:5,enabled:false}],[{kind:'posterize',amount:1,enabled:true}],[{kind:'invert',amount:0,enabled:1}]]){const bad=structuredClone(data);bad.layers[0].effects=effects;assert.throws(()=>decodeProject(JSON.stringify(bad)));}
});
test('mask draft source, feather, painting and immutable options do not alter raw cels',()=>{
 const e=fixture(),raw=e.document.layers[0].pixels.slice(),input=mask(e,[0,0,0,0,0,0]),plan=prepareLayerWorkflow(e.document,input);input.coverage.values.fill(255);e.applyLayerWorkflow(plan);assert.deepEqual([...e.document.layers[0].mask.values],[0,0,0,0,0,0]);
 atomic(e,()=>apply(e,{kind:'mask',layerId:'layer-1',source:'current',brush:{points:[{x:1,y:0},{x:1,y:1}],size:1,shape:'square',hardness:100,opacity:128,mode:'replace'}}));assert.deepEqual([...e.document.layers[0].mask.values],[0,128,0,0,128,0]);assert.deepEqual(e.document.layers[0].pixels,raw);
 atomic(e,()=>apply(e,{kind:'mask',layerId:'layer-1',source:'current',edit:{kind:'invert'}}));assert.deepEqual([...e.document.layers[0].mask.values],[255,127,255,255,127,255]);
});
test('mask state, disabled persistence and bake preserve final composite and links',()=>{
 const e=fixture();apply(e,mask(e,[0,128,255,255,64,0]));const expected=composite(e.document);atomic(e,()=>apply(e,{kind:'mask-state',layerId:'layer-1',action:'disable'}));assert.equal(e.document.layers[0].mask.enabled,false);assert.equal(decodeProject(encodeProject(e.document)).layers[0].mask.enabled,false);apply(e,{kind:'mask-state',layerId:'layer-1',action:'enable'});
 atomic(e,()=>apply(e,{kind:'mask-state',layerId:'layer-1',action:'bake'}));assert.equal(e.document.layers[0].mask,undefined);assert.deepEqual(composite(e.document),expected);assert.equal(e.document.layers[0].cels['frame-1'],e.document.layers[0].cels['frame-2']);
});
test('mask transforms fixed canvas crop without mutating source and undo exactly',()=>{
 const e=fixture();apply(e,mask(e,[1,2,3,4,5,6]));atomic(e,()=>apply(e,{kind:'mask-transform',layerId:'layer-1',dx:1,dy:0,flipX:true,flipY:false,rotation:0}));assert.deepEqual([...e.document.layers[0].mask.values],[0,3,2,0,6,5]);
});
test('canvas geometry samples masks with same mapping; spatial stack preview matches applied output',()=>{
 for(const options of [{kind:'rotate',rotation:90},{kind:'flip',axis:'vertical'},{kind:'scale',width:5,height:4},{kind:'crop',x:1,y:0,width:2,height:2},{kind:'resize',width:4,height:3,anchorX:'start',anchorY:'start',offsetX:0,offsetY:0}]){
  const e=fixture();apply(e,mask(e,[0,10,20,30,40,50]));apply(e,{kind:'effects',layerId:'layer-1',effects:[{kind:'mosaic',amount:2,enabled:true}]});const p=prepareCanvasGeometry(e.document,options);atomic(e,()=>e.applyCanvasGeometry(p));assert.equal(e.document.layers[0].mask.values.length,e.document.width*e.document.height);assert.deepEqual(composite(e.document),p.preview);assert.equal(e.document.layers[0].cels['frame-1'],e.document.layers[0].cels['frame-2']);
 }
});
test('duplicate masks and stack detach while linked duplicate cels remain linked',()=>{
 const e=fixture();apply(e,mask(e,[0,1,2,3,4,5]));apply(e,{kind:'effects',layerId:'layer-1',effects:[{kind:'invert',amount:0,enabled:true}]});e.addLayer(true);const [a,b]=e.document.layers;assert.notEqual(a.mask.values,b.mask.values);assert.notEqual(a.effects,b.effects);assert.notEqual(a.effects[0],b.effects[0]);assert.equal(b.cels['frame-1'],b.cels['frame-2']);assert.notEqual(a.cels['frame-1'],b.cels['frame-1']);assert.throws(()=>e.mergeDown(),/Bake/);
});
test('live colour stack is ordered, optional, byte exact and keeps raw RGBA',()=>{
 const e=fixture(),raw=e.document.layers[0].pixels.slice();atomic(e,()=>apply(e,{kind:'effects',layerId:'layer-1',effects:[{kind:'invert',amount:0,enabled:true},{kind:'brightness',amount:50,enabled:true},{kind:'alpha',amount:50,enabled:true}]}));assert.deepEqual([...renderLayerPixels(e.document.layers[0],3,2,'frame-1').slice(0,4)],[255,225,105,128]);assert.deepEqual(e.document.layers[0].pixels,raw);
 const first=composite(e.document);apply(e,{kind:'effects',layerId:'layer-1',effects:[{kind:'brightness',amount:50,enabled:true},{kind:'invert',amount:0,enabled:true}]});assert.notDeepEqual(composite(e.document),first);
});
test('spatial effects average premultiplied colour and clip edges; bake preserves appearance',()=>{
 const e=new PixelEditor(createDocument(2,1));e.paint(0,0,[200,100,50,255]);e.paint(1,0,[20,240,100,0]);e.commit();apply(e,{kind:'effects',layerId:'layer-1',effects:[{kind:'blur',amount:1,enabled:true}]});assert.deepEqual([...composite(e.document)],[200,100,50,128,200,100,50,128]);const before=composite(e.document);atomic(e,()=>apply(e,{kind:'bake-effects',layerId:'layer-1'}));assert.deepEqual(composite(e.document),before);assert.equal(e.document.layers[0].effects,undefined);
});
test('stack bake plus mask bake handles links and independent cels',()=>{
 const e=fixture();apply(e,mask(e,[0,1,127,128,254,255]));apply(e,{kind:'effects',layerId:'layer-1',effects:[{kind:'posterize',amount:4,enabled:true},{kind:'alpha',amount:80,enabled:true}]});const before=e.document.frames.map(f=>composite(e.document,f.id));assert.throws(()=>apply(e,{kind:'mask-state',layerId:'layer-1',action:'bake'}),/effects/);atomic(e,()=>apply(e,{kind:'bake-effects',layerId:'layer-1'}));atomic(e,()=>apply(e,{kind:'mask-state',layerId:'layer-1',action:'bake'}));assert.deepEqual(e.document.frames.map(f=>composite(e.document,f.id)),before);assert.notEqual(e.document.layers[0].cels['frame-1'],e.document.layers[0].cels['frame-3']);
});
test('stale plans, locked targets, memory limits, forged plans and no-op redo are safe',()=>{
 const e=fixture(),p=prepareLayerWorkflow(e.document,mask(e,[1,2,3,4,5,6]));e.renameLayer('Changed');assert.throws(()=>e.applyLayerWorkflow(p),/source changed/);assert.throws(()=>e.applyLayerWorkflow({...p}),/source changed/);e.undo();assert.equal(e.canRedo,true);assert.equal(apply(e,{kind:'effects',layerId:'layer-1',effects:[]}),false);assert.equal(e.canRedo,true);const before=encodeProject(e.document);assert.throws(()=>prepareLayerWorkflow(e.document,mask(e,[1,2,3,4,5,6]),1),/budget/);assert.equal(encodeProject(e.document),before);e.toggleLayerLock();assert.throws(()=>prepareLayerWorkflow(e.document,mask(e,[1,2,3,4,5,6])),/unlock/);
});
test('native formats reject even disabled metadata; flattened PSD/ORA and clips bake exact visible frames',async()=>{
 const e=fixture();apply(e,mask(e,[0,128,255,255,64,0]));apply(e,{kind:'effects',layerId:'layer-1',effects:[{kind:'invert',amount:0,enabled:false}]});const before=encodeProject(e.document),expected=e.document.frames.map(f=>composite(e.document,f.id));assert.throws(()=>encodeAseprite(e.document),/baking/);await assert.rejects(encodePiskel(e.document),/baking/);assert.throws(()=>encodePsd(e.document),/baking/);await assert.rejects(encodeOra(e.document),/baking/);const psd=decodePsd(encodePsd(e.document,'frames-as-layers').bytes).document,ora=(await decodeOra((await encodeOra(e.document,'frames-as-layers')).bytes)).document;for(let i=0;i<expected.length;i++){assert.deepEqual(psd.layers[i].pixels,expected[i]);assert.deepEqual(ora.layers[i].pixels,expected[i]);}const clip=decodeClip(captureClip(e.document,undefined,'Baked').text);assert.equal(clip.layers[0].mask,undefined);assert.equal(encodeProject(e.document),before);
});
test('reference rotate, scale, crop, bounds, stale and undo preserve artwork',()=>{
 const e=fixture();e.addReference({name:'Ref',width:2,height:1,pixels:new Uint8ClampedArray([1,2,3,0,4,5,6,255])});const art=composite(e.document);atomic(e,()=>e.applyReferenceTransform(prepareReferenceTransform(e.document,'reference-1',{kind:'rotate',rotation:90})));assert.deepEqual([e.document.references[0].width,e.document.references[0].height],[1,2]);assert.deepEqual([...e.document.references[0].pixels],[1,2,3,0,4,5,6,255]);assert.deepEqual(composite(e.document),art);const p=prepareReferenceTransform(e.document,'reference-1',{kind:'scale',width:2,height:4});e.renameReference('reference-1','Changed');assert.throws(()=>e.applyReferenceTransform(p),/source changed/);assert.throws(()=>prepareReferenceTransform(e.document,'reference-1',{kind:'crop',x:1,y:0,width:1,height:1}),/fit/);assert.throws(()=>prepareReferenceTransform(e.document,'reference-1',{kind:'scale',width:1024,height:1024},1),/budget/);
});
test('cel transfer overlap reads original; move clears source and detaches outside linked peers',()=>{
 const e=fixture(),source=e.document.layers[0].pixels.slice(),other=e.document.layers[0].cels['frame-2'];const o={kind:'cel-transfer',layers:['layer-1'],from:0,to:0,targetLayer:0,targetFrame:0,move:true,rect:{x:0,y:0,width:2,height:2},x:1,y:0};atomic(e,()=>apply(e,o));const p=e.document.layers[0].cels['frame-1'];assert.deepEqual([...p.slice(0,4)],[0,0,0,0]);assert.deepEqual(p.slice(4,12),source.slice(0,8));assert.equal(e.document.layers[0].cels['frame-2'],other);assert.notEqual(p,other);assert.deepEqual(other,source);
});
test('multi-layer/frame transfer is atomic, full RGBA replacement and complete-fit guarded',()=>{
 const e=fixture();e.addLayer();e.addLayer();const o={kind:'cel-transfer',layers:['layer-1','layer-2'],from:0,to:1,targetLayer:1,targetFrame:1,move:false,rect:{x:0,y:0,width:3,height:2},x:0,y:0};atomic(e,()=>apply(e,o));assert.deepEqual(e.document.layers[1].cels['frame-2'],e.document.layers[0].cels['frame-1']);const before=encodeProject(e.document);assert.throws(()=>apply(e,{...o,x:1}));assert.equal(encodeProject(e.document),before);e.selectLayer('layer-3');e.toggleLayerLock();assert.throws(()=>apply(e,o),/unlock/);
});
test('holds link first cel through range, unlink preserves bytes and outside identities',()=>{
 const e=fixture();atomic(e,()=>apply(e,{kind:'hold',layers:['layer-1'],from:0,to:2,action:'hold'}));const l=e.document.layers[0];assert.equal(l.cels['frame-1'],l.cels['frame-3']);atomic(e,()=>apply(e,{kind:'hold',layers:['layer-1'],from:1,to:2,action:'unlink'}));const next=e.document.layers[0];assert.notEqual(next.cels['frame-1'],next.cels['frame-2']);assert.notEqual(next.cels['frame-2'],next.cels['frame-3']);assert.deepEqual(next.cels['frame-2'],next.cels['frame-3']);atomic(e,()=>apply(e,{kind:'hold',layers:['layer-1'],from:1,to:2,action:'clear'}));assert.equal(e.document.layers[0].cels['frame-2'].length,0);assert.ok(e.document.layers[0].cels['frame-1'].length);
});
