import test from 'node:test';
import assert from 'node:assert/strict';
import {PhotoWorkspace} from '../dist/photo-workspace.js';
import {encodePhotoProject,decodePhotoProject} from '../dist/photo-project.js';
import {selectionContour} from '../dist/selection-outline.js';
const raster=(w=12,h=8)=>({width:w,height:h,pixels:new Uint8ClampedArray(w*h*4).fill(255)});
const image={kind:'stamp',image:raster(2,4),x:.5,y:.5,size:.5,angle:0,opacity:.6,editor:{tool:'image',fields:{name:'Portrait.png'}}};
test('image import and scene resize are atomic, portable and one undo step',()=>{
 const workspace=new PhotoWorkspace([raster()],true),before=workspace.snapshot();
 workspace.appendBatch([{edit:{kind:'canvas',width:8,height:16,color:[255,255,255,255]},name:'Scene size'},{edit:image,name:'Image'}],'import');
 assert.equal(workspace.renderFirst().height,16);assert.equal(workspace.history().steps,1);assert.deepEqual(decodePhotoProject(encodePhotoProject(workspace.snapshot())),workspace.snapshot());assert.equal(workspace.objects(['image']).length,1);
 workspace.undoEdit();assert.deepEqual(workspace.snapshot(),before);workspace.redoEdit();const imported=workspace.snapshot();
 assert.throws(()=>workspace.appendBatch([{edit:{kind:'canvas',width:5,height:5,color:[0,0,0,255]},name:'Resize'},{edit:{...image,opacity:2},name:'Invalid'}]));assert.deepEqual(workspace.snapshot(),imported);
});
test('collage property updates reuse immutable media, preserve pixels and grouped undo, and enforce locks',()=>{
 const source=raster(),photos=[raster(3,5),raster(5,3)],edit={kind:'collage',template:'diptych',width:12,height:8,gap:.02,color:[255,255,255,255],fit:'cover',images:photos};
 const workspace=new PhotoWorkspace([source],true),reference=new PhotoWorkspace([source],true),id=workspace.append(edit,'Collage'),other=reference.append(edit,'Collage');
 const {images:unused,...properties}=edit;const before=workspace.renderFirst();workspace.updateCollage(id,{...properties,gap:.06},'gesture');workspace.updateCollage(id,{...properties,gap:.09},'gesture');reference.append({...edit,gap:.09},'Collage',null,other);
 assert.deepEqual(workspace.renderFirst(),reference.renderFirst());assert.equal(workspace.history().steps,2);const media=workspace.value.layers[0].operations[0].edit.images;assert.equal(workspace.undo.at(-1).layers[0].operations[0].edit.images,media,'history shares owned media');photos[0].pixels.fill(0);assert.equal(media[0].pixels[0],255,'caller cannot mutate owned media');assert.equal(workspace.objects(['emoji','image']).length,0);assert.equal(workspace.hasObject(id),true);
 workspace.undoEdit();assert.deepEqual(workspace.renderFirst(),before);workspace.redoEdit();workspace.mutate(workspace.active,'lock');const locked=workspace.snapshot();assert.throws(()=>workspace.updateCollage(id,properties),/Unlock/);assert.deepEqual(workspace.snapshot(),locked);
});
test('selection contours are continuous clockwise loops with separate holes and never change membership',()=>{
 const mask=new Uint8Array([1,1,1,1,0,1,1,1,1]),before=mask.slice(),contour=selectionContour(mask,3,3);assert.deepEqual(mask,before);assert.equal((contour.path.match(/M/g)??[]).length,2);assert.equal((contour.path.match(/Z/g)??[]).length,2);assert.ok(contour.path.startsWith('M0 0l1 0l1 0l1 0l0 1'));assert.deepEqual(selectionContour(new Uint8Array(4),2,2),{path:'',width:2,height:2});const large=selectionContour(new Uint8Array(1200*600).fill(1),1200,600);assert.ok(large.width<=512&&large.height<=512);
});

test('transferring unchanged worker output cannot detach its cached workspace frames',async()=>{
 const {createConversionProcessor}=await import('../dist/worker.js'),{defaultRecipe}=await import('../dist/conversion.js'),source=raster(),recipe=defaultRecipe(source),options={rect:{x:0,y:0,width:source.width,height:source.height},method:'crop',tolerance:0};
 for(const photo of [true,false]){const process=createConversionProcessor(),focus={frames:[source],options,fps:4,track:false,photo,workspace:true,committed:true},first=process({recipe,focus});structuredClone(first,{transfer:[first.pixels.buffer]});assert.equal(source.pixels.length,12*8*4);const next=process({recipe,focus:{...focus,frames:undefined}});assert.deepEqual(next.photo,source);}
});
