import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PixelEditor,createDocument,encodeProject,decodeProject,prepareAdjustment,adjustmentPreview,curveLookup,MAX_CURVE_POINTS,rasterCel,composite,encodeAseprite,decodeAseprite,encodePsd,decodePsd,encodeOra,decodeOra,convert,defaultRecipe,auditPalette,paletteRamp,preparePaletteRamp} from '../dist/index.js';


const identity=[{input:0,output:0},{input:255,output:255}],invert=[{input:0,output:255},{input:255,output:0}],channels={kind:'curves',points:identity,channels:{red:invert,green:identity,blue:identity}},dither={kind:'dither',colors:['#000000','#ffffff'],strength:100};
for(const options of [channels,dither]){
test(`${options.kind} copied settings, exact linked history, metadata and conversion-source retention`,()=>{
 const source={width:3,height:1,pixels:new Uint8ClampedArray([12,34,56,255,70,80,90,255,5,6,7,255])},e=new PixelEditor(convert(source,defaultRecipe(source))),d=e.document;e.paint(0,0,[20,40,60,128]);e.paint(1,0,[7,8,9,0]);e.commit();e.addLayer();e.paint(2,0,[30,60,90,255]);e.commit();e.selectLayer('layer-1');e.createGroup();e.setGroupProperties('group-1',{opacity:200});e.addFrame();e.linkCel('frame-1');e.addFrame(true);e.selectFrame('frame-1');e.setTag({name:'Range',from:0,to:2,mode:'ping-pong'});e.addReference({name:'Study',width:1,height:1,pixels:new Uint8ClampedArray([2,4,6,255])});const before=encodeProject(d),independent=d.layers[0].cels['frame-3'].slice(),other=d.layers[1].cels['frame-1'].slice(),settings=structuredClone(options),plan=prepareAdjustment(d,settings);assert.equal(plan.linked,2);const expected=plan.pixels.slice();assert.deepEqual([...expected.slice(4,8)],[7,8,9,0]);assert.equal(encodeProject(d),before);assert.equal(adjustmentPreview(d,plan).length,d.width*d.height*4);if(settings.kind==='dither'){settings.colors[0]='#123456';assert.equal(plan.options.colors[0],'#000000');assert.ok(Object.isFrozen(plan.options.colors));}else{settings.channels.red[0].output=99;assert.equal(plan.options.channels.red[0].output,255);assert.ok(Object.isFrozen(plan.options.channels.red[0]));assert.ok(Object.isFrozen(plan.options.channels));}assert.ok(Object.isFrozen(plan.options));plan.pixels.fill(0);const history=e.historyBytes;e.applyAdjustment(plan);assert.ok(e.historyBytes>history);assert.deepEqual(rasterCel(d,d.layers[0]),expected);assert.equal(d.layers[0].cels['frame-1'],d.layers[0].cels['frame-2']);assert.deepEqual(d.layers[0].cels['frame-3'],independent);assert.deepEqual(d.layers[1].cels['frame-1'],other);assert.deepEqual(d.conversion.source.pixels,source.pixels);const after=encodeProject(d);assert.equal(encodeProject(decodeProject(after)),after);e.undo();assert.equal(encodeProject(d),before);e.redo();assert.equal(encodeProject(d),after);assert.throws(()=>e.applyAdjustment(plan),/changed/);e.clearCel();e.undo();e.undo();assert.equal(encodeProject(d),before);e.redo();assert.equal(encodeProject(d),after);
});

test(`${options.kind} baked native codec byte roundtrips`,async()=>{
 const e=new PixelEditor(createDocument(3,1)),d=e.document;e.paint(0,0,[10,100,200,128]);e.paint(1,0,[7,8,9,0]);e.paint(2,0,[100,200,50,1]);e.commit();e.applyAdjustment(prepareAdjustment(d,options));const source=rasterCel(d,d.layers[0]);assert.equal(JSON.parse(encodeProject(d)).version,16);for(const back of [(await decodeAseprite(encodeAseprite(d))).document,decodePsd(encodePsd(d).bytes).document,(await decodeOra((await encodeOra(d)).bytes)).document]){assert.deepEqual(rasterCel(back,back.layers[0]),source);assert.deepEqual(composite(back),composite(d));}
});

}


test('channel curves apply master then channel with discrete exact rounding; channels are independent',()=>{
 const e=new PixelEditor(createDocument(1,1)),d=e.document;e.paint(0,0,[10,50,100,128]);e.commit();
 const master=[{input:0,output:20},{input:255,output:220}];
 const result=prepareAdjustment(d,{...channels,points:master}).pixels;
 const lut=curveLookup(master);assert.deepEqual([...result],[255-lut[10],lut[50],lut[100],128]);
 assert.notEqual(result[0],lut[255-10]);
 for(const key of ['red','green','blue']){const c={red:identity,green:identity,blue:identity};c[key]=invert;const got=prepareAdjustment(d,{kind:'curves',points:identity,channels:c}).pixels;assert.deepEqual([...got],[key==='red'?245:10,key==='green'?205:50,key==='blue'?155:100,128]);}
 const identityPlan=prepareAdjustment(d,{kind:'curves',points:identity,channels:{red:identity,green:identity,blue:identity}});assert.equal(e.applyAdjustment(identityPlan),false);
 for(const c of [null,{},[],{red:identity,green:identity},{red:[],green:identity,blue:identity},{red:identity,green:[{input:0,output:0},{input:0,output:255}],blue:identity}])assert.throws(()=>prepareAdjustment(d,{...channels,channels:c}));
});
test('dither 4x4 exact checker goldens, origin anchoring, zero strength, idempotence and partial/hidden alpha',()=>{
 const e=new PixelEditor(createDocument(4,4)),d=e.document;for(let y=0;y<4;y++)for(let x=0;x<4;x++)e.paint(x,y,[128,128,128,128]);e.commit();
 const got=prepareAdjustment(d,dither).pixels;const ranks=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];for(let p=0;p<16;p++)assert.deepEqual([...got.slice(p*4,p*4+4)],[...Array(3).fill(ranks[p]<8?0:255),128]);
 assert.deepEqual([...prepareAdjustment(d,{...dither,strength:5}).pixels.slice(60,64)],[0,0,0,128]);assert.deepEqual([...prepareAdjustment(d,{...dither,strength:5,colors:['#ffffff','#000000']}).pixels.slice(60,64)],[255,255,255,128]);
 assert.deepEqual(prepareAdjustment(d,{...dither,strength:0}).pixels,prepareAdjustment(d,{kind:'palette',colors:dither.colors}).pixels);
 e.applyAdjustment(prepareAdjustment(d,dither));assert.equal(e.applyAdjustment(prepareAdjustment(d,dither)),false);
 e.paint(0,0,[7,8,9,0]);e.commit();assert.deepEqual([...prepareAdjustment(d,dither).pixels.slice(0,4)],[7,8,9,0]);
 for(const strength of [-1,101,NaN,Infinity,1.5,'50'])assert.throws(()=>prepareAdjustment(d,{...dither,strength}));
 for(const colors of [[],null,['bad'],Array(257).fill('#000000')])assert.throws(()=>prepareAdjustment(d,{...dither,colors}));
});
test('palette audit counts stored selected cel once, ignores hidden RGB and reports bounded outside samples without edits',()=>{
 const e=new PixelEditor(createDocument(32,1)),d=e.document;e.setPalette(['#ff0000','#00ff00']);e.paint(0,0,[255,0,0,1]);e.paint(1,0,[255,0,0,128]);e.paint(2,0,[0,255,0,0]);for(let x=3;x<32;x++)e.paint(x,0,[x,0,0,255]);e.commit();e.addFrame();e.linkCel('frame-1');e.selectFrame('frame-1');e.toggleLayer();const before=encodeProject(d),history=e.historyBytes,audit=auditPalette(d);assert.deepEqual(audit.counts,[{color:'#ff0000',pixels:2},{color:'#00ff00',pixels:0}]);assert.equal(audit.transparentPixels,1);assert.equal(audit.outsidePixels,29);assert.equal(audit.outsideSamples.length,16);assert.equal(audit.outsideSamples[0],'#030000');assert.equal(encodeProject(d),before);assert.equal(e.historyBytes,history);
 const empty=new PixelEditor(createDocument(2,2));assert.equal(auditPalette(empty.document).transparentPixels,4);assert.equal(empty.document.layers[0].cels['frame-1'].length,0);
});
test('ramp endpoints, half-up ties, descending channels, equal endpoints and 2-32 bounds',()=>{
 assert.deepEqual(paletteRamp({from:'#000000',to:'#ffffff',steps:3}),['#000000','#808080','#ffffff']);assert.deepEqual(paletteRamp({from:'#ffffff',to:'#000000',steps:3}),['#ffffff','#808080','#000000']);assert.deepEqual(paletteRamp({from:'#AABBCC',to:'#AABBCC',steps:2}),['#aabbcc','#aabbcc']);
 const r=paletteRamp({from:'#ff0040',to:'#00ff80',steps:32});assert.equal(r.length,32);assert.equal(r[0],'#ff0040');assert.equal(r[31],'#00ff80');
 for(const steps of [1,33,2.5,NaN,Infinity,'3'])assert.throws(()=>paletteRamp({from:'#000000',to:'#ffffff',steps}));assert.throws(()=>paletteRamp({from:'red',to:'#ffffff',steps:3}));
});
test('ramp staged append preserves art/links/metadata, regenerates output, freezes settings and has one undo/redo',()=>{
 const e=new PixelEditor(createDocument(1,1)),d=e.document;e.paint(0,0,[100,50,20,128]);e.commit();e.addFrame();e.linkCel('frame-1');e.setPalette(['#000000','#ffffff']);const before=encodeProject(d),pixels=d.layers[0].cels['frame-1'],options={from:'#000000',to:'#ffffff',steps:3},stage=preparePaletteRamp(d,options);options.steps=10;assert.ok(Object.isFrozen(stage.options));assert.ok(Object.isFrozen(stage.colors));assert.equal(stage.added,1);assert.equal(encodeProject(d),before);assert.throws(()=>stage.colors.push('#abcdef'));const forged={...stage,colors:['#123456']};e.applyPaletteRamp(forged);assert.deepEqual(d.palette,['#000000','#ffffff','#808080']);assert.equal(d.layers[0].cels['frame-1'],pixels);assert.equal(d.layers[0].cels['frame-2'],pixels);const after=encodeProject(d);e.undo();assert.equal(encodeProject(d),before);e.redo();assert.equal(encodeProject(d),after);assert.throws(()=>e.applyPaletteRamp(stage),/changed/);assert.equal(e.applyPaletteRamp(preparePaletteRamp(d,stage.options)),false);
});
test('ramp over-capacity rejects without mutation; duplicate-only append at 256 colours succeeds as no-op; metadata stale rejects',()=>{
 const e=new PixelEditor(createDocument(1,1)),d=e.document;e.setPalette(Array.from({length:256},(_,i)=>'#'+i.toString(16).padStart(6,'0')));const before=encodeProject(d);assert.throws(()=>preparePaletteRamp(d,{from:'#ff0000',to:'#ffffff',steps:32}));assert.equal(encodeProject(d),before);const p=preparePaletteRamp(d,{from:'#000000',to:'#0000ff',steps:2});assert.equal(p.added,0);assert.equal(e.applyPaletteRamp(p),false);const stale=preparePaletteRamp(d,p.options);e.renameLayer('Changed');assert.throws(()=>e.applyPaletteRamp(stale),/changed/);
});
for(const options of [channels,dither])test(`${options.kind} new family empty/hidden/stale/maximum canvas and eviction`,()=>{
 const e=new PixelEditor(createDocument(256,256)),d=e.document;assert.equal(e.applyAdjustment(prepareAdjustment(d,options)),false);assert.equal(e.canUndo,false);assert.equal(d.layers[0].cels['frame-1'].length,0);const pixels=rasterCel(d,d.layers[0]);for(let i=0;i<pixels.length;i+=4)pixels.set([64,128,192,128],i);d.layers[0].cels['frame-1']=pixels;const before=encodeProject(d);e.applyAdjustment(prepareAdjustment(d,options));assert.ok(e.historyBytes<=3*256*256*4+512);e.undo();assert.equal(encodeProject(d),before);const stale=prepareAdjustment(d,options);e.setPalette(['#abcdef']);assert.throws(()=>e.applyAdjustment(stale),/changed/);e.createGroup();e.setGroupProperties('group-1',{locked:true});assert.throws(()=>prepareAdjustment(d,options),/unlock/);e.setGroupProperties('group-1',{locked:false,visible:false});assert.throws(()=>prepareAdjustment(d,options),/unlock/);
 const tiny=new PixelEditor(createDocument(1,1),1);tiny.paint(0,0,[64,128,192,128]);tiny.commit();tiny.applyAdjustment(prepareAdjustment(tiny.document,options));assert.equal(tiny.historyBytes,0);assert.equal(tiny.evicted,true);
});
