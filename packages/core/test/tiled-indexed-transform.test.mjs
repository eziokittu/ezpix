import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LargeCanvasEditor,createLargeIndexed,createLargeCanvas,largeLayer,largeRawIndex,largeWarpIndices,largeWarpRaster,encodeLargeProject,decodeLargeProject,encodeLargeClipboard,decodeLargeClipboard,largeAllocation,largeFrameMask} from '../dist/index.js';
import {readLargeClipboard} from '../dist/large-clipboard.js';
const palette=()=>[[8,9,10,0],[220,30,40,255],[220,30,40,255],[4,5,6,0],[30,60,200,128],[99,77,55,255]];
const rect={x:62,y:63,width:3,height:2},bits=()=>Uint8Array.of(1,0,1,1,1,0),slots=()=>Uint8Array.of(2,1,4,0,3,2);
const make=(w=132,h=100)=>{const e=new LargeCanvasEditor(createLargeIndexed(w,h,palette(),3,1));for(let i=0;i<6;i++)e.strokeIndex([{x:rect.x+i%3,y:rect.y+Math.floor(i/3)}],slots()[i]);e.commit();e.selection.set({rect:{...rect},bits:bits()});return e;};
const opts=(turn=0,extra={})=>({x:68,y:66,copy:true,flipX:false,flipY:false,warp:{kind:'turn',turn,width:turn%2?2:3,height:turn%2?3:2},...extra});
const save=e=>encodeLargeProject(e.document),raw=(e,x,y,f=e.document.activeFrameId)=>largeRawIndex(e.document,largeLayer(e.document),f,x,y);
const read=e=>e.captureIndices({x:0,y:0,width:e.document.width,height:e.document.height});
const expectedTurn=t=>[[0,1,2,3,4,5],[3,0,4,1,5,2],[5,4,3,2,1,0],[2,5,1,4,0,3]][t];

test('481 byte sampler shares coordinates and binary coverage with RGBA, without colour lookup',()=>{
 const m={rect:{...rect},bits:bits()},source=slots(),rgba=new Uint8ClampedArray(24);for(let i=0;i<6;i++)rgba.set([source[i],77,88,255],i*4);
 for(const warp of [opts(1).warp,{kind:'rotate',angle:33},{kind:'shear',shearX:-.5,shearY:.25},{kind:'perspective',width:5,height:4,quad:[{x:1,y:0},{x:4,y:0},{x:5,y:4},{x:0,y:4}]}]){
  const a=largeWarpIndices(m,source,warp,true,true),b=largeWarpRaster(m,rgba,warp,true,true);assert.deepEqual(a.bits,b.bits);for(let i=0;i<a.indices.length;i++)if(a.bits[i])assert.equal(a.indices[i],b.pixels[i*4]);
 }
 assert.throws(()=>largeWarpIndices(m,new Uint8Array(5),opts().warp));assert.throws(()=>largeWarpIndices(m,new Uint8ClampedArray(6),opts().warp));assert.throws(()=>largeWarpIndices(m,source,opts().warp,1));
});
test('482 preview planes/settings are defensive, including duplicate slots and selected hidden RGB',()=>{
 const e=make(),o=opts(1),before=save(e),p=e.prepareWarp(o),expected=p.indices.slice();assert.deepEqual([...expected],[0,2,3,3,3,4]);
 o.warp.turn=2;o.x=0;p.indices.fill(5);p.pixels.fill(255);p.membership.fill(0);p.context.fill(0);assert.equal(save(e),before);e.apply(p);
 assert.equal(raw(e,68,66),0);assert.equal(raw(e,69,66),2);assert.equal(raw(e,68,67),3);assert.equal(raw(e,69,67),1);assert.equal(raw(e,69,68),4);
});
for(const turn of [0,1,2,3])for(const copy of [true,false])test(`483-484 overlap ${copy?'copy':'move'} and turn ${turn} retain raw slots, holes and one Undo`,()=>{
 const e=make(),before=read(e),expected=before.slice(),order=expectedTurn(turn),w=turn%2?2:3,h=turn%2?3:2,x=63,y=63;
 if(!copy)for(let i=0;i<6;i++)if(bits()[i])expected[(rect.y+Math.floor(i/3))*132+rect.x+i%3]=3;
 for(let i=0;i<6;i++)if(bits()[order[i]])expected[(y+Math.floor(i/w))*132+x+i%w]=slots()[order[i]];
 const baseline=save(e);e.apply(e.prepareWarp(opts(turn,{x,y,copy})));assert.deepEqual(read(e),expected);const after=save(e);e.undo();assert.equal(save(e),baseline);e.redo();assert.equal(save(e),after);assert.equal(e.document.indexed.palette.length,6);
});
test('485 output flips preserve index and membership mapping after rotation',()=>{
 const e=make(),a=e.prepareWarp(opts(1)),b=e.prepareWarp(opts(1,{flipX:true,flipY:true}));for(let i=0;i<6;i++){assert.equal(b.indices[i],a.indices[5-i]);assert.equal(b.membership[i],a.membership[5-i]);}
});
test('486 nearest scaling retains selected transparent slots; downsample move clears every original member',()=>{
 const e=make(),a=e.prepareWarp(opts(0,{warp:{kind:'turn',turn:0,width:6,height:4}}));assert.equal(a.membership.reduce((a,b)=>a+b),16);assert.equal(a.indices[0],2);assert.equal(a.indices[1],2);
 const p=e.prepareWarp(opts(0,{copy:false,warp:{kind:'turn',turn:0,width:1,height:1}}));assert.deepEqual([...p.indices],[3]);assert.deepEqual([...p.membership],[1]);e.apply(p);assert.equal(raw(e,68,66),3);for(let i=0;i<6;i++)if(bits()[i])assert.equal(raw(e,rect.x+i%3,rect.y+Math.floor(i/3)),3);
});
test('487 rotations retain right-angle exactness and bounded padding at arbitrary angles',()=>{
 const e=make();for(const [angle,turn] of [[0,0],[90,1],[180,2],[-90,3],[360,0]]){const a=e.prepareWarp(opts(0,{warp:{kind:'rotate',angle}})),b=e.prepareWarp(opts(turn));assert.deepEqual(a.indices,b.indices);assert.deepEqual(a.membership,b.membership);}
 const p=e.prepareWarp(opts(0,{warp:{kind:'rotate',angle:45}}));assert.equal(p.width,4);assert.equal(p.height,4);assert.ok(p.membership.some(v=>!v));assert.ok(p.indices.every((v,i)=>p.membership[i]||v===3));
});
test('488 shear supports signed sampling, rejects singular geometry atomically',()=>{
 const e=make(),before=save(e);for(const x of [-1,.5]){const p=e.prepareWarp(opts(0,{warp:{kind:'shear',shearX:x,shearY:0}}));assert.equal(p.width,x===-1?5:4);assert.ok(p.indices.every((v,i)=>!p.membership[i]||[0,2,3,4].includes(v)));}assert.throws(()=>e.prepareWarp(opts(0,{warp:{kind:'shear',shearX:1,shearY:1}})),/singular/);assert.equal(save(e),before);
});
test('489 convex perspective preserves holes and rectangular mapping equals nearest scale',()=>{
 const e=make(),warp={kind:'perspective',width:6,height:4,quad:[{x:0,y:0},{x:6,y:0},{x:6,y:4},{x:0,y:4}]};const a=e.prepareWarp(opts(0,{warp})),b=e.prepareWarp(opts(0,{warp:{kind:'turn',turn:0,width:6,height:4}}));assert.deepEqual(a.indices,b.indices);assert.deepEqual(a.membership,b.membership);warp.quad[0].x=2;assert.equal(e.prepareWarp(opts(0,{warp})).membership[0],0);warp.quad[1]={x:0,y:4};assert.throws(()=>e.prepareWarp(opts(0,{warp})),/convex|singular/);
});
test('490 linked artwork changes together; independent cels and animated saved coverage stay separate',()=>{
 const e=make();e.addFrame(true);e.linkCel('frame-1');e.addFrame(true);const independent=e.document.activeFrameId;e.selectFrame('frame-1');
 e.apply(e.prepareLayerMask({kind:'replace',mask:{enabled:true,outside:64,rect:{x:60,y:60,width:2,height:2},coverage:Uint8Array.of(0,64,128,255)}}));e.apply(e.prepareMaskTimeline({kind:'animate'}));
 const masks=JSON.stringify(e.document.layers[0].maskCels,(_,v)=>v instanceof Uint8Array?[...v]:v),before=save(e),other=new Map(e.document.layers[0].cels[independent]);e.apply(e.prepareWarp(opts(1)));
 assert.equal(e.document.layers[0].cels['frame-1'],e.document.layers[0].cels['frame-2']);assert.notEqual(e.document.layers[0].cels[independent],e.document.layers[0].cels['frame-1']);assert.deepEqual(e.document.layers[0].cels[independent],other);assert.equal(JSON.stringify(e.document.layers[0].maskCels,(_,v)=>v instanceof Uint8Array?[...v]:v),masks);e.undo();assert.equal(save(e),before);
});
test('491 cut is staged and portable; applying clear is atomic and Undo does not mutate its copied slots',()=>{
 const e=make(),before=save(e),cut=e.prepareCut(),file=encodeLargeClipboard(cut.clipboard);assert.equal(save(e),before);e.apply(cut.plan);for(let i=0;i<6;i++)if(bits()[i])assert.equal(raw(e,rect.x+i%3,rect.y+Math.floor(i/3)),3);e.undo();assert.equal(save(e),before);e.apply(e.preparePaste(decodeLargeClipboard(file),68,66));assert.equal(raw(e,68,66),2);assert.equal(raw(e,69,66),1);assert.equal(raw(e,69,67),3);
});
test('492 copied slot planes, pixels, membership and internal reads cannot alter the private clipboard',()=>{
 const e=make(),clip=e.copyMasked(),file=encodeLargeClipboard(clip);clip.indexed.indices.fill(5);clip.pixels.fill(255);clip.membership.fill(0);const inspected=readLargeClipboard(clip);inspected.indices.fill(5);inspected.mask.bits.fill(0);inspected.palette[0][0]=99;assert.equal(encodeLargeClipboard(clip),file);assert.throws(()=>clip.indexed.palette[0][0]=99,TypeError);
 const target=new LargeCanvasEditor(createLargeIndexed(80,80,palette(),3,1));target.apply(target.prepareWarp(opts(1,{x:1,y:1,copy:false}),clip));assert.equal(raw(target,2,1),2);assert.equal(raw(e,62,63),2);assert.throws(()=>target.preparePaste({...clip},0,0),/unavailable/);
});
test('493 clipboard files retain complete palettes, unused/duplicate slots, membership and role',()=>{
 const clip=make().copyMasked(),text=encodeLargeClipboard(clip),v=JSON.parse(text),back=decodeLargeClipboard(text);assert.equal(encodeLargeClipboard(back),text);assert.deepEqual(back.indexed.palette,palette());assert.equal(back.indexed.transparentIndex,3);assert.equal(v.indices,Buffer.from([2,3,4,0,3,3]).toString('base64'));assert.deepEqual([...back.membership],[...bits()]);
});
test('493 hostile clipboard files reject malformed/smuggled metadata and planes before use',()=>{
 const original=JSON.parse(encodeLargeClipboard(make().copyMasked()));for(const edit of [v=>v.version=2,v=>v.width=10241,v=>v.height=1048576,v=>v.palette=[],v=>v.palette[0]=null,v=>v.palette[0][0]=256,v=>v.transparentIndex=1,v=>v.indices=Buffer.from([255,3,4,0,3,3]).toString('base64'),v=>v.indices=Buffer.from([2,2,4,0,3,3]).toString('base64'),v=>v.membership=Buffer.from([2,0,1,1,1,0]).toString('base64'),v=>v.membership='AB==',v=>v.rgba='AAAA',v=>delete v.mode]){const v=structuredClone(original);edit(v);assert.throws(()=>decodeLargeClipboard(JSON.stringify(v)));}assert.throws(()=>decodeLargeClipboard(' '.repeat(8*1048576+1)),/8 MiB/);
});
test('494 identical-table binding includes duplicate order, unused entries, hidden RGB and transparent role',()=>{
 const e=make(),clip=e.copyMasked();for(const edit of [d=>d.indexed.palette[5][0]++,d=>{const p=d.indexed.palette;[p[1],p[4]]=[p[4],p[1]];},d=>d.indexed.palette[0][0]++,d=>d.indexed.transparentIndex=0]){const t=make();edit(t.document);const before=save(t);assert.throws(()=>t.preparePaste(clip,0,0),/identical/);assert.equal(save(t),before);}const other=make();other.apply(other.preparePaste(clip,0,0));assert.equal(raw(other,0,0),2);
 const rgba=new LargeCanvasEditor(createLargeCanvas(132,100));rgba.selection.set({rect,bits:bits()});assert.throws(()=>rgba.preparePaste(clip,0,0),/mode/);assert.throws(()=>e.preparePaste(rgba.copyMasked(),0,0),/mode/);
});
test('495 plans reject foreign, forged, reused and changed frame/layer/palette/lock/selection contexts',()=>{
 for(const change of [e=>e.selection.set(null),e=>{e.selection.set(null);e.selection.undoSelection();},e=>e.addFrame(),e=>e.addLayer(),e=>e.layerProperties({locked:true}),e=>e.layerProperties({visible:false}),e=>e.apply(e.prepareIndexed({kind:'palette-set',index:5,color:[1,2,3,255]})),e=>e.strokeIndex([{x:10,y:10}],2)]){const e=make(),p=e.prepareWarp(opts());change(e);const before=save(e);assert.throws(()=>e.apply(p),/changed/);assert.equal(save(e),before);}
 const e=make(),p=e.prepareWarp(opts());assert.throws(()=>make().apply(p),/changed/);assert.throws(()=>e.apply({...p}),/changed/);e.apply(p);assert.throws(()=>e.apply(p),/changed/);
});
test('495 output membership adoption is explicit, defensive and separately undoable',()=>{
 const e=make(),original=e.selection.current,p=e.prepareWarp(opts(1));e.apply(p);assert.deepEqual(e.selection.current,original);p.membership.fill(0);e.adoptWarpSelection(p);assert.deepEqual(e.selection.current.rect,p.destination);assert.equal(e.selection.current.bits.reduce((a,b)=>a+b),4);e.selection.undoSelection();assert.deepEqual(e.selection.current,original);assert.throws(()=>e.adoptWarpSelection(p),/changed/);
});
test('496 identity and empty edits retain Redo, including selected transparent entries',()=>{
 const e=make();e.strokeIndex([{x:10,y:10}],2);e.commit();e.undo();for(const empty of [false,true]){if(empty)e.selection.set({rect,bits:new Uint8Array(6)});const p=e.prepareWarp(opts(0,{x:rect.x,y:rect.y,copy:false}));assert.equal(p.changed,false);assert.equal(e.apply(p),false);assert.equal(e.canRedo,true);}
});
test('496 tile budget/destination/output failures preserve all slots and history',()=>{
 const e=make(),before=save(e);for(const o of [opts(0,{x:131}),opts(0,{x:-1}),opts(0,{warp:{kind:'turn',turn:0,width:10240,height:10240}}),opts(0,{warp:{kind:'rotate',angle:NaN}})])assert.throws(()=>e.prepareWarp(o));assert.equal(save(e),before);
 const d=createLargeIndexed(2112,2048,palette(),3,1);for(let y=0;y<32;y++)for(let x=0;x<32;x++)d.tiles.set(x+','+y,new Uint8ClampedArray(4096).fill(2));const full=new LargeCanvasEditor(d);full.selection.set({rect:{x:0,y:0,width:1,height:1},bits:Uint8Array.of(1)});const b=save(full);assert.throws(()=>full.prepareWarp(opts(0,{x:2048,y:0,warp:{kind:'turn',turn:0,width:1,height:1}})),/allocation/);assert.equal(save(full),b);assert.equal(full.canUndo,false);assert.equal(largeAllocation(d).bytes,4*1048576);
});
test('496 one-megapixel slot sampling accepts maximum window and rejects oversized work before output',()=>{
 const mask={rect:{x:0,y:0,width:1024,height:1024},bits:new Uint8Array(1048576).fill(1)},source=new Uint8Array(1048576).fill(255),p=largeWarpIndices(mask,source,{kind:'turn',turn:1,width:1024,height:1024},true);assert.equal(p.indices.length,1048576);assert.ok(p.indices.every(v=>v===255));assert.throws(()=>largeWarpIndices(mask,source,{kind:'turn',turn:1,width:1025,height:1024}));
});
test('497 rectangle copy/cut/transform work without changing session selection membership',()=>{
 const e=make();e.selection.set(null);const clip=e.copyRect(rect);assert.ok(clip.membership.every(v=>v===1));const before=save(e);e.apply(e.prepare(rect,{kind:'transform',x:63,y:64,copy:false,flipX:true,flipY:true}));assert.equal(e.selection.current,null);assert.equal(raw(e,63,64),2);e.undo();assert.equal(save(e),before);const cut=e.prepareCut(rect);e.apply(cut.plan);assert.equal(raw(e,63,63),3);
});
test('499 project save/reopen retains slots, palette, masks and transformed artwork links',()=>{
 const e=make();e.addFrame(true);e.linkCel('frame-1');e.apply(e.prepareWarp(opts(1)));const text=save(e),d=decodeLargeProject(text);assert.equal(encodeLargeProject(d),text);assert.equal(d.layers[0].cels['frame-1'],d.layers[0].cels['frame-2']);assert.deepEqual(d.indexed.palette,palette());assert.equal(largeRawIndex(d,largeLayer(d),'frame-1',69,66),2);
});
test('493 RGBA clipboard files preserve selected hidden RGB and reject nonzero holes',()=>{
 const e=new LargeCanvasEditor(createLargeCanvas(4,4));e.paint(0,0,[9,8,7,0]);e.paint(1,0,[1,2,3,255]);e.commit();e.selection.set({rect:{x:0,y:0,width:2,height:1},bits:Uint8Array.of(1,0)});const clip=e.copyMasked(),text=encodeLargeClipboard(clip),back=decodeLargeClipboard(text);assert.equal(back.indexed,undefined);assert.deepEqual([...back.pixels],[9,8,7,0,0,0,0,0]);const target=new LargeCanvasEditor(createLargeCanvas(4,4));target.paint(2,1,[100,100,100,255]);target.commit();target.apply(target.preparePaste(back,1,1));assert.deepEqual([...target.capture({x:1,y:1,width:2,height:1})],[9,8,7,0,100,100,100,255]);const v=JSON.parse(text);v.rgba=Buffer.from([9,8,7,0,1,0,0,0]).toString('base64');assert.throws(()=>decodeLargeClipboard(JSON.stringify(v)),/holes/);
});
test('491 a no-op indexed cut retains Redo while yielding a usable transparent clipboard',()=>{
 const e=make();e.strokeIndex([{x:10,y:10}],2);e.commit();e.undo();e.selection.set({rect:{x:0,y:0,width:1,height:1},bits:Uint8Array.of(1)});e.apply(e.prepareIndexed({kind:'index-clear',rect:{x:0,y:0,width:1,height:1},index:3}));e.undo();e.selection.set({rect:{x:63,y:64,width:1,height:1},bits:Uint8Array.of(1)});const cut=e.prepareCut();assert.equal(cut.plan.changed,false);assert.equal(e.apply(cut.plan),false);assert.equal(e.canRedo,true);assert.equal(cut.clipboard.indexed.indices[0],3);
});
