import test from 'node:test';
import assert from 'node:assert/strict';
import {FRAME_STYLES,COLLAGE_TEMPLATES,composeCollage,snapValue,stampVisible} from '../dist/design-tools.js';
import {editPhoto} from '../dist/photo-edit.js';
import {PhotoWorkspace} from '../dist/photo-workspace.js';
import {encodePhotoProject,decodePhotoProject} from '../dist/photo-project.js';
const image=(r,g,b)=>({width:8,height:8,pixels:Uint8ClampedArray.from({length:256},(_,i)=>[r,g,b,255][i%4])});
test('all 24 frame designs are deterministic, distinct, bounded and preserve the original interior',()=>{
 const source={width:80,height:80,pixels:Uint8ClampedArray.from({length:80*80*4},(_,i)=>[80,90,100,255][i%4])},before=source.pixels.slice(),outputs=new Set();
 for(const pattern of FRAME_STYLES){const value=editPhoto(source,{kind:'frame',size:.25,color:[240,230,210,255],pattern});assert.deepEqual(value,editPhoto(source,{kind:'frame',size:.25,color:[240,230,210,255],pattern}));assert.equal(value.width,120);assert.deepEqual([...value.pixels.slice((20*120+20)*4,(20*120+100)*4)],[...source.pixels.slice(0,320)]);outputs.add(Buffer.from(value.pixels).toString('base64'));}
 assert.equal(FRAME_STYLES.length,24);assert.ok(outputs.size===24);assert.deepEqual(source.pixels,before);assert.throws(()=>editPhoto(source,{kind:'frame',size:.1,color:[0,0,0,255],pattern:'bad'}));
});
test('collage has 24 layouts, repeatable crops, alpha compositing and editable portable project roundtrips',()=>{
 const red=image(255,0,0),blue=image(0,0,255),edit={kind:'collage',template:'diptych',images:[red,blue],width:16,height:8,gap:0,color:[255,255,255,255],fit:'cover'};
 const result=composeCollage(edit);assert.deepEqual([...result.pixels.slice(0,4)],[255,0,0,255]);assert.deepEqual([...result.pixels.slice(8*4,9*4)],[0,0,255,255]);
 assert.equal(Object.keys(COLLAGE_TEMPLATES).length,24);for(const template of Object.keys(COLLAGE_TEMPLATES))assert.equal(composeCollage({...edit,template,gap:.02}).pixels.length,512);
 const workspace=new PhotoWorkspace([red],true);workspace.append(edit,'Collage');const restored=new PhotoWorkspace([red]);restored.restore(decodePhotoProject(encodePhotoProject(workspace.snapshot())));assert.deepEqual(restored.renderFirst(),result);workspace.undoEdit();assert.deepEqual(workspace.renderFirst(),red);
 assert.throws(()=>composeCollage({...edit,width:3000,height:3000}));assert.throws(()=>composeCollage({...edit,images:[]}));assert.throws(()=>composeCollage({...edit,gap:-1}));
});
test('overlapping collage windows paint in order with their own border and survive project reload',()=>{
 const edit={kind:'collage',template:'insetPair',images:[image(255,0,0),image(0,0,255)],width:100,height:100,gap:.02,color:[255,255,255,255],fit:'cover'};
 const result=composeCollage(edit),at=(x,y)=>[...result.pixels.slice((y*100+x)*4,(y*100+x)*4+4)];
 assert.deepEqual(at(30,30),[255,0,0,255]);assert.deepEqual(at(58,65),[255,255,255,255],'inset border covers the image underneath');assert.deepEqual(at(70,70),[0,0,255,255]);
 const workspace=new PhotoWorkspace([image(0,0,0)],true);workspace.append(edit,'Inset collage');const restored=new PhotoWorkspace([image(0,0,0)]);restored.restore(decodePhotoProject(encodePhotoProject(workspace.snapshot())));assert.deepEqual(restored.renderFirst(),result);
 for(const entry of Object.values(COLLAGE_TEMPLATES))for(const cell of entry.cells){assert.ok(cell.x>=0&&cell.y>=0&&cell.width>0&&cell.height>0&&cell.x+cell.width<=1.000001&&cell.y+cell.height<=1.000001);}
 assert.ok(Object.values(COLLAGE_TEMPLATES).filter(t=>t.cells.length===3).length>=5);
 assert.throws(()=>composeCollage({...edit,template:'__proto__'}),/valid collage/);
});
test('snapping honours tolerance and off-canvas objects remain recoverable until the next applied object',()=>{
 assert.equal(snapValue(49,[0,50,100],1.5),50);assert.equal(snapValue(47,[50],1.5),47);assert.equal(snapValue(-2,[-90,0,90],4),0);
 const source=image(10,20,30),stamp={kind:'stamp',image:image(250,0,0),size:.2,x:-.5,y:.5,angle:0,opacity:1},workspace=new PhotoWorkspace([source],true);
 const first=workspace.append(stamp,'Off canvas');assert.equal(stampVisible(stamp,8,8),false);assert.equal(workspace.objects().length,1);assert.deepEqual(workspace.renderFirst(),source);
 workspace.append({...stamp,x:.5},'Visible');assert.equal(workspace.objects().length,1);assert.equal(workspace.objects()[0].name,'Visible');workspace.undoEdit();assert.equal(workspace.objects()[0].id,first,'Undo restores the discarded object');
 workspace.append({...stamp,x:.5},'Recovered',null,first);assert.equal(workspace.objects().length,1);assert.notDeepEqual(workspace.renderFirst(),source);assert.throws(()=>workspace.append({...stamp,x:5},'Out of bounds'));
});

test('eight brush styles render deterministic independent strokes with bounded validation',()=>{
 const source={width:64,height:64,pixels:new Uint8ClampedArray(64*64*4)},points=Array.from({length:16},(_,i)=>({x:.1+i*.05,y:.3+i*.02})),results=new Set();
 for(const brush of ['round','square','marker','pencil','spray','neon','dashed','calligraphy']){const edit={kind:'draw',points,size:.12,color:[80,150,240,255],brush},result=editPhoto(source,edit);assert.deepEqual(result,editPhoto(source,edit));results.add(Buffer.from(result.pixels).toString('base64'));}
 assert.equal(results.size,8);assert.ok(source.pixels.every(n=>n===0));assert.throws(()=>editPhoto(source,{kind:'draw',points,size:.1,color:[0,0,0,255],brush:'bad'}));
});
