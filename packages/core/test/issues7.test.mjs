import test from 'node:test';
import assert from 'node:assert/strict';
import {PhotoWorkspace} from '../dist/photo-workspace.js';
import {encodePhotoProject,decodePhotoProject} from '../dist/photo-project.js';
import {editPhoto} from '../dist/photo-edit.js';
import {PHOTO_EFFECTS} from '../dist/photo-effects.js';
import {PIXEL_SHAPES} from '../dist/pixel-shapes.js';
import {createLivePreview} from '../dist/live-preview.js';
const source=()=>({width:32,height:24,pixels:new Uint8ClampedArray(Array.from({length:32*24},(_,i)=>[i%256,(i*3)%256,(i*7)%256,i%11?255:0]).flat())});
test('automatic updates replace one editable object, group Undo by gesture, and retain Original',()=>{
 const original=source(),ws=new PhotoWorkspace([original],true);let id=ws.append({kind:'effect',effect:'sepia',amount:.2},'Colour',null,undefined,'gesture1');ws.append({kind:'effect',effect:'sepia',amount:.5},'Colour',null,id,'gesture1');const one=ws.render();
 assert.equal(ws.objects().length,1);assert.equal(ws.history().steps,1);ws.append({kind:'effect',effect:'sepia',amount:.9},'Colour',null,id,'gesture2');assert.equal(ws.history().steps,2);ws.undoEdit();assert.deepEqual(ws.render(),one);ws.undoEdit();assert.deepEqual(ws.render()[0],original);ws.redoEdit();assert.deepEqual(ws.render(),one);assert.deepEqual(ws.original(),original);
});
test('automatic preview stores latest valid value without Apply and rejects failed edits',()=>{
 const tasks=new Map();let next=0,value=1,committed=[],shown=[];const preview=createLivePreview({automatic:true,read:()=>value,preview:v=>{if(v<0)throw Error('invalid');shown.push(v);},apply:v=>committed.push(v),cancel(){},state(){},schedule:fn=>{tasks.set(++next,fn);return next;},unschedule:id=>tasks.delete(id)});
 preview.request();value=2;preview.request();for(const fn of [...tasks.values()])fn();tasks.clear();assert.deepEqual(shown,[2]);assert.deepEqual(committed,[2]);assert.equal(preview.apply(),false);value=-1;preview.request(true);assert.deepEqual(committed,[2]);preview.dispose();
});
test('all effects are bounded, deterministic, immutable and preserve alpha',()=>{
 assert.ok(PHOTO_EFFECTS.length>=24);const original=source(),before=structuredClone(original);const distinct=new Set();for(const[id]of PHOTO_EFFECTS){const first=editPhoto(original,{kind:'effect',effect:id,amount:.8}),second=editPhoto(original,{kind:'effect',effect:id,amount:.8});assert.deepEqual(first,second,id);assert.equal(first.width,32);for(let i=3;i<first.pixels.length;i+=4)assert.equal(first.pixels[i],original.pixels[i],id);distinct.add(Buffer.from(first.pixels).toString('base64'));}assert.ok(distinct.size>24);assert.deepEqual(original,before);assert.throws(()=>editPhoto(original,{kind:'effect',effect:'invalid',amount:1}));
});
test('custom geometric pixels support independent axes and editable roundtrip',()=>{
 const original=source(),ws=new PhotoWorkspace([original],true),distinct=new Set();for(const shape of PIXEL_SHAPES){const edit={kind:'mosaic',columns:7,rows:4,shape,gap:.05};const image=editPhoto(original,edit);assert.equal(image.pixels.length,original.pixels.length);distinct.add(Buffer.from(image.pixels).toString('base64'));}assert.ok(distinct.size>=6);ws.append({kind:'mosaic',columns:7,rows:4,shape:'hexagon',gap:.05},'Hexagons');const restored=new PhotoWorkspace([original],true);restored.restore(decodePhotoProject(encodePhotoProject(ws.snapshot())));assert.deepEqual(restored.render(),ws.render());assert.throws(()=>editPhoto(original,{kind:'mosaic',columns:0,rows:3,shape:'circle',gap:0}));
});
test('sampled repair supports oriented object regions without mutating outside membership',()=>{
 const original=source(),base={kind:'clone',sourceX:.2,sourceY:.3,x:.7,y:.6,radius:.15,softness:.5,aspect:1.7,angle:30},variants=new Set();for(const shape of ['circle','rectangle','ellipse','diamond','hexagon']){const result=editPhoto(original,{...base,shape});assert.deepEqual([...result.pixels.slice(0,32*4)],[...original.pixels.slice(0,32*4)]);variants.add(Buffer.from(result.pixels).toString('base64'));}assert.ok(variants.size>=3);assert.throws(()=>editPhoto(original,{...base,aspect:100}));
});
test('generated patch changes selected pixels only and remains undoable in editable projects',()=>{
 const original=source(),image={...original,pixels:new Uint8ClampedArray(original.pixels.length).fill(255)},mask=new Uint8Array(32*24);mask[200]=mask[201]=1;const ws=new PhotoWorkspace([original],true);ws.append({kind:'patch',image,mask},'Local AI edit');const result=ws.render()[0];for(let i=0;i<mask.length;i++)assert.deepEqual([...result.pixels.slice(i*4,i*4+4)],[...(mask[i]?image:original).pixels.slice(i*4,i*4+4)]);const restored=new PhotoWorkspace([original],true);restored.restore(decodePhotoProject(encodePhotoProject(ws.snapshot())));assert.deepEqual(restored.render(),ws.render());ws.undoEdit();assert.deepEqual(ws.render()[0],original);assert.throws(()=>editPhoto(original,{kind:'patch',image,mask:new Uint8Array([1])}));
});

test('committed automatic pixel preview exactly matches saved artwork while retaining project transfer',async()=>{
 const {createConversionProcessor}=await import('../dist/worker.js');const {defaultRecipe}=await import('../dist/conversion.js');const {defaultFocusAdjustments}=await import('../dist/focus.js');const original=source(),ws=new PhotoWorkspace([original],true);ws.append({kind:'mosaic',columns:7,rows:5,shape:'hexagon',gap:.06},'Pixels');const baked=ws.render()[0],recipe={...defaultRecipe(baked),width:7,height:5},options={rect:{x:0,y:0,width:32,height:24},method:'crop',tolerance:0,adjustments:defaultFocusAdjustments()};const result=createConversionProcessor()({recipe,focus:{frames:[baked],workspace:true,committed:true,options,fps:4,track:false,photo:false}});assert.deepEqual(result.photo,baked);assert.ok(result.project);
});
