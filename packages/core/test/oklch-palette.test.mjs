import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PixelEditor,createDocument,encodeProject,decodeProject,prepareAdjustment,adjustmentPreview,curveLookup,MAX_CURVE_POINTS,rasterCel,composite,encodeAseprite,decodeAseprite,encodePsd,decodePsd,encodeOra,decodeOra,convert,defaultRecipe} from '../dist/index.js';

const oklch={kind:'oklch',hue:120,chroma:10,lightness:10},palette={kind:'palette',colors:['#000000','#ff0000','#ffffff']};
for(const options of [oklch,palette]){
test(`${options.kind} copied settings, exact linked history, metadata and conversion-source retention`,()=>{
 const source={width:3,height:1,pixels:new Uint8ClampedArray([12,34,56,255,70,80,90,255,5,6,7,255])},e=new PixelEditor(convert(source,defaultRecipe(source))),d=e.document;e.paint(0,0,[20,40,60,128]);e.paint(1,0,[7,8,9,0]);e.commit();e.addLayer();e.paint(2,0,[30,60,90,255]);e.commit();e.selectLayer('layer-1');e.createGroup();e.setGroupProperties('group-1',{opacity:200});e.addFrame();e.linkCel('frame-1');e.addFrame(true);e.selectFrame('frame-1');e.setTag({name:'Range',from:0,to:2,mode:'ping-pong'});e.addReference({name:'Study',width:1,height:1,pixels:new Uint8ClampedArray([2,4,6,255])});const before=encodeProject(d),independent=d.layers[0].cels['frame-3'].slice(),other=d.layers[1].cels['frame-1'].slice(),settings=structuredClone(options),plan=prepareAdjustment(d,settings);assert.equal(plan.linked,2);const expected=plan.pixels.slice();assert.deepEqual([...expected.slice(4,8)],[7,8,9,0]);assert.equal(encodeProject(d),before);assert.equal(adjustmentPreview(d,plan).length,d.width*d.height*4);if(settings.kind==='palette'){settings.colors[0]='#ffffff';assert.equal(plan.options.colors[0],'#000000');assert.ok(Object.isFrozen(plan.options.colors));}else settings.hue=0;assert.ok(Object.isFrozen(plan.options));plan.pixels.fill(0);const history=e.historyBytes;e.applyAdjustment(plan);assert.ok(e.historyBytes>history);assert.deepEqual(rasterCel(d,d.layers[0]),expected);assert.equal(d.layers[0].cels['frame-1'],d.layers[0].cels['frame-2']);assert.deepEqual(d.layers[0].cels['frame-3'],independent);assert.deepEqual(d.layers[1].cels['frame-1'],other);assert.deepEqual(d.conversion.source.pixels,source.pixels);const after=encodeProject(d);assert.equal(encodeProject(decodeProject(after)),after);e.undo();assert.equal(encodeProject(d),before);e.redo();assert.equal(encodeProject(d),after);assert.throws(()=>e.applyAdjustment(plan),/changed/);e.clearCel();e.undo();e.undo();assert.equal(encodeProject(d),before);e.redo();assert.equal(encodeProject(d),after);
});

test(`${options.kind} baked native codec byte roundtrips`,async()=>{
 const e=new PixelEditor(createDocument(3,1)),d=e.document;e.paint(0,0,[10,100,200,128]);e.paint(1,0,[7,8,9,0]);e.paint(2,0,[100,200,50,1]);e.commit();e.applyAdjustment(prepareAdjustment(d,options));const source=rasterCel(d,d.layers[0]);assert.equal(JSON.parse(encodeProject(d)).version,16);for(const back of [(await decodeAseprite(encodeAseprite(d))).document,decodePsd(encodePsd(d).bytes).document,(await decodeOra((await encodeOra(d)).bytes)).document]){assert.deepEqual(rasterCel(back,back.layers[0]),source);assert.deepEqual(composite(back),composite(d));}
});

}

test('OKLCH identity, hue-only grey, full lightness endpoints and transparent bytes',()=>{
 const e=new PixelEditor(createDocument(256,1)),d=e.document,p=rasterCel(d,d.layers[0]);for(let x=0;x<256;x++)p.set([x,x,x,x%4===0?0:128],x*4);d.layers[0].cels['frame-1']=p;
 const neutral={kind:'oklch',hue:0,chroma:0,lightness:0};assert.deepEqual(prepareAdjustment(d,neutral).pixels,p);assert.equal(e.applyAdjustment(prepareAdjustment(d,neutral)),false);assert.equal(e.canUndo,false);
 assert.deepEqual(prepareAdjustment(d,{...neutral,hue:180}).pixels,p);
 for(const lightness of [-100,100]){const out=prepareAdjustment(d,{...neutral,lightness}).pixels;for(let i=0;i<p.length;i+=4)assert.deepEqual([...out.slice(i,i+4)],p[i+3]?[...Array(3).fill(lightness<0?0:255),128]:[...p.slice(i,i+4)]);}
 for(const patch of [{hue:181},{hue:1.5},{hue:NaN},{chroma:41},{chroma:-41},{chroma:Infinity},{lightness:101},{lightness:''}])assert.throws(()=>prepareAdjustment(d,{...neutral,...patch}));
});
test('palette integer distance, first-index ties, exact membership, frozen normalized palette and malformed bounds',()=>{
 const e=new PixelEditor(createDocument(3,1)),d=e.document;e.paint(0,0,[1,0,0,1]);e.paint(1,0,[255,0,0,128]);e.paint(2,0,[7,8,9,0]);e.commit();
 const p=prepareAdjustment(d,{kind:'palette',colors:['#000000','#020000','#FF0000','#ff0000']});assert.deepEqual([...p.pixels],[0,0,0,1,255,0,0,128,7,8,9,0]);assert.deepEqual(p.options.colors,['#000000','#020000','#ff0000']);assert.equal(p.changedPixels,1);
 assert.deepEqual([...prepareAdjustment(d,{kind:'palette',colors:['#020000','#000000']}).pixels.slice(0,4)],[2,0,0,1]);
 for(const colors of [null,[],['red'],['#00000000'],Array(257).fill('#000000'),[null],[1]])assert.throws(()=>prepareAdjustment(d,{kind:'palette',colors}));
 assert.equal(prepareAdjustment(d,{kind:'palette',colors:Array.from({length:256},(_,i)=>'#'+i.toString(16).padStart(6,'0'))}).options.colors.length,256);
});
for(const options of [oklch,palette])test(`${options.kind} sparse no-op, hidden/locked/stale source and bounded max-canvas history`,()=>{
 const empty=new PixelEditor(createDocument(1,1));assert.equal(empty.applyAdjustment(prepareAdjustment(empty.document,options)),false);assert.equal(empty.canUndo,false);assert.equal(empty.document.layers[0].cels['frame-1'].length,0);
 const e=new PixelEditor(createDocument(256,256)),d=e.document,p=rasterCel(d,d.layers[0]);for(let i=0;i<p.length;i+=4)p.set([64,128,192,128],i);d.layers[0].cels['frame-1']=p;const before=encodeProject(d),stage=prepareAdjustment(d,options);assert.ok(stage.changedPixels);e.applyAdjustment(stage);assert.ok(e.historyBytes<=3*256*256*4+512);e.undo();assert.equal(encodeProject(d),before);
 const stale=prepareAdjustment(d,options);e.setPalette(['#123456']);assert.throws(()=>e.applyAdjustment(stale),/changed/);e.createGroup();e.setGroupProperties('group-1',{locked:true});assert.throws(()=>prepareAdjustment(d,options),/unlock/);e.setGroupProperties('group-1',{locked:false,visible:false});assert.throws(()=>prepareAdjustment(d,options),/unlock/);
 const tiny=new PixelEditor(createDocument(1,1),1);tiny.paint(0,0,[64,128,192,255]);tiny.commit();tiny.applyAdjustment(prepareAdjustment(tiny.document,options));assert.equal(tiny.historyBytes,0);assert.equal(tiny.evicted,true);
});
