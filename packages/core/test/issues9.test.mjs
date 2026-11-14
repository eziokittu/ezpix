import test from 'node:test';
import assert from 'node:assert/strict';
import {editPhoto} from '../dist/photo-edit.js';
import {BRUSH_STYLES} from '../dist/creative.js';
import {composeCollage,validateCollageCells} from '../dist/design-tools.js';
import {PhotoWorkspace} from '../dist/photo-workspace.js';
import {encodePhotoProject,decodePhotoProject} from '../dist/photo-project.js';
import {validatePreferences} from '../dist/preferences.js';
const solid=(r,g,b,a=255)=>({width:8,height:8,pixels:Uint8ClampedArray.from({length:256},(_,i)=>[r,g,b,a][i%4])});
const at=(r,x,y)=>[...r.pixels.slice((y*r.width+x)*4,(y*r.width+x+1)*4)];
const cells=[{x:0,y:0,width:.5,height:1},{x:.5,y:0,width:.5,height:1}];
const base={kind:'collage',template:'diptych',width:32,height:16,gap:0,color:[255,255,255,255],fit:'cover',cells,images:[solid(255,0,0)],slots:[0,null]};
test('explicit collage slots keep empty windows and swap without repeating or replacing another photo',()=>{
 const first=composeCollage(base);assert.deepEqual(at(first,4,4),[255,0,0,255]);assert.deepEqual(at(first,24,4),[255,255,255,255]);
 const second={...base,images:[...base.images,solid(0,0,255)],slots:[0,1]},filled=composeCollage(second);assert.deepEqual(at(filled,4,4),at(first,4,4));assert.deepEqual(at(filled,24,4),[0,0,255,255]);
 const swapped=composeCollage({...second,slots:[1,0]});assert.deepEqual(at(swapped,4,4),[0,0,255,255]);assert.deepEqual(at(swapped,24,4),[255,0,0,255]);assert.equal(base.images.length,1);
});
test('custom 16-slot collage transforms and borders survive editable export, reopening and Undo',()=>{
 const custom=Array.from({length:16},(_,i)=>({x:i%4/4,y:Math.floor(i/4)/4,width:.25,height:.25,borderWidth:.02,borderColor:[0,255,0,255],borderStyle:'double',angle:i%2?12:0,zoom:1.2,offsetX:.1}));
 const edit={...base,width:80,height:80,cells:custom,slots:custom.map((_,i)=>i%2),images:[solid(255,0,0),solid(0,0,255)]},workspace=new PhotoWorkspace([solid(10,20,30)],true);workspace.append(edit,'Custom collage');
 const rendered=workspace.renderFirst(),restored=new PhotoWorkspace([solid(0,0,0)]);restored.restore(decodePhotoProject(encodePhotoProject(workspace.snapshot())));assert.deepEqual(restored.renderFirst(),rendered);assert.ok(rendered.pixels.some((n,i)=>i%4===1&&n>100));assert.ok(workspace.undoEdit());assert.deepEqual(workspace.renderFirst(),solid(10,20,30));
 assert.throws(()=>validateCollageCells([...custom,custom[0]]));assert.throws(()=>composeCollage({...base,slots:[0,3]}));assert.throws(()=>validateCollageCells([{...cells[0],width:2}]));assert.throws(()=>validateCollageCells([{...cells[0],angle:NaN}]));
});
test('collage background choice and canvas sizing preserve source pixels and chosen background',()=>{
 const source=solid(12,34,56),keep=editPhoto(source,{...base,images:[],slots:[null,null],keepBackground:true}),empty=editPhoto(source,{...base,images:[],slots:[null,null],keepBackground:false});assert.deepEqual(at(keep,20,4),[12,34,56,255]);assert.deepEqual(at(empty,20,4),[255,255,255,255]);
 const scene=editPhoto(source,{kind:'canvas',width:16,height:12,color:[255,255,255,255]});assert.deepEqual(at(scene,0,0),[255,255,255,255]);assert.deepEqual(at(scene,6,4),[12,34,56,255]);assert.deepEqual(source,solid(12,34,56));
});
test('every brush paints visible deterministic previews and handles edge strokes',()=>{
 assert.ok(BRUSH_STYLES.length>=28);const source={width:120,height:90,pixels:new Uint8ClampedArray(120*90*4)};
 for(const brush of BRUSH_STYLES){for(const points of [Array.from({length:40},(_,i)=>({x:.08+i/39*.84,y:.5+Math.sin(i/39*Math.PI*2)*.24})),[{x:0,y:0},{x:1,y:1}]]){const edit={kind:'draw',brush,points,size:.07,color:[0,0,0,255]},r=editPhoto(source,edit);assert.ok(r.pixels.some((n,i)=>i%4===3&&n>0),brush+' is visible');assert.deepEqual(r,editPhoto(source,edit));}}
 assert.ok(source.pixels.every(n=>n===0));
});
test('synced layouts accept geometry only and reject embedded media or project records',()=>{
 const value=[{id:'custom-one',name:'My layout',cells}];assert.deepEqual(validatePreferences({layouts:{updated:0,value}}).layouts.value,value);
 for(const extra of [{images:[solid(1,2,3)]},{project:'private'},{sourceUrl:'https://example.com'}])assert.throws(()=>validatePreferences({layouts:{updated:0,value:[{...value[0],...extra}]}}));
 assert.throws(()=>validatePreferences({layouts:{updated:0,value:[{...value[0],cells:[{...cells[0],image:solid(1,2,3)}]}]}}));
});
