import test from 'node:test';
import assert from 'node:assert/strict';
import {developPhoto,clonePhoto,luminanceHistogram} from '../dist/photo-lab.js';
import {validatePreferences,mergePreferences,readLocalPreferences} from '../dist/preferences.js';
import {PhotoWorkspace} from '../dist/photo-workspace.js';
import {encodePhotoProject,decodePhotoProject} from '../dist/photo-project.js';
const tone={kind:'develop',mode:'levels',black:0,white:255,gamma:1,shadows:0,midtones:0,highlights:0,strength:1};
const raster=(values)=>({width:values.length,height:1,pixels:new Uint8ClampedArray(values.flat())});
test('levels use known endpoints, gamma and strength while preserving alpha and original pixels',()=>{
 const source=raster([[32,128,224,255],[128,64,32,128],[9,8,7,0]]),before=structuredClone(source);
 assert.deepEqual([...developPhoto(source,{...tone,black:32,white:224}).pixels],[0,128,255,255,128,42,0,128,9,8,7,0]);
 const result=developPhoto(raster([[64,64,64,255]]),{...tone,gamma:2,strength:.5});assert.deepEqual([...result.pixels],[96,96,96,255]);assert.deepEqual(source,before);
 assert.throws(()=>developPhoto(source,{...tone,black:100,white:50}),/Black point/);assert.throws(()=>developPhoto(source,{...tone,gamma:NaN}),/bounds/);
});
test('histograms exclude transparent pixels; auto tone and curve have deterministic independent results',()=>{
 const source=raster([[50,50,50,255],[100,100,100,255],[200,200,200,255],[0,0,0,0]]),hist=luminanceHistogram(source);
 assert.equal(hist.count,3);assert.equal(hist.bins[50],1);assert.equal(hist.bins[0],0);
 assert.deepEqual([...developPhoto(source,{...tone,mode:'auto'}).pixels],[0,0,0,255,85,85,85,255,255,255,255,255,0,0,0,0]);
 const flat=raster([[100,100,100,255]]);assert.deepEqual(developPhoto(flat,{...tone,mode:'auto'}),flat);
 assert.deepEqual([...developPhoto(raster([[128,128,128,255]]),{...tone,mode:'curves',midtones:.1}).pixels],[153,153,153,255]);
 assert.throws(()=>developPhoto(source,{...tone,mode:'curves',shadows:.24,midtones:-.24}),/rising/);
});
test('sampled repair copies from immutable source and blends translucent pixels without dark fringes',()=>{
 const source={width:8,height:8,pixels:new Uint8ClampedArray(8*8*4)};source.pixels.set([200,40,10,128],(1*8+1)*4);source.pixels.set([10,20,200,255],(6*8+6)*4);
 const before=structuredClone(source),edit={kind:'clone',sourceX:1/7,sourceY:1/7,x:6/7,y:6/7,radius:.125,softness:1};
 const result=clonePhoto(source,edit);assert.deepEqual([...result.pixels.slice((6*8+6)*4,(6*8+6)*4+4)],[200,40,10,128]);assert.deepEqual(source,before);
 assert.throws(()=>clonePhoto(source,{...edit,x:2}),/bounds/);
});
test('tone and repair survive editable project roundtrip and undo',()=>{
 const source={width:8,height:8,pixels:new Uint8ClampedArray(Array.from({length:64},(_,i)=>[i*4,100,200,255]).flat())},ws=new PhotoWorkspace([source],true);
 ws.append({...tone,gamma:2},'Levels');const toned=ws.render();ws.append({kind:'clone',sourceX:0,sourceY:0,x:.8,y:.8,radius:.125,softness:.5},'Repair');
 const restored=new PhotoWorkspace([source],true);restored.restore(decodePhotoProject(encodePhotoProject(ws.snapshot())));assert.deepEqual(restored.render(),ws.render());
 ws.undoEdit();assert.deepEqual(ws.render(),toned);ws.undoEdit();assert.deepEqual(ws.render()[0],source);
});
test('sync rejects artwork, unsafe font sources, invalid settings and future clocks',()=>{
 const now=1000000;const valid={theme:{updated:now,value:'dark'},fonts:{updated:now,value:[{family:'Roboto',source:'https://fonts.google.com/specimen/Roboto'}]}};assert.deepEqual(validatePreferences(valid,now),valid);
 for(const bad of [{projects:{updated:0,value:[]}},{fonts:{updated:0,value:[{family:'Bad',source:'https://example.com/font.woff'}]}},{workspace:{updated:0,value:{image:'data:image/png;base64,AA'}}},{theme:{updated:now+300001,value:'dark'}},{tools:{updated:0,value:['draw','draw']}},{theme:{updated:0,value:'dark',image:'secret'}}])assert.throws(()=>validatePreferences(bad,now));
 const values=new Map([['ezpix.theme.v1','light'],['ezpix.projects','private artwork'],['ezpix.tools.v2','["draw"]']]);globalThis.localStorage={getItem:key=>values.get(key)??null};
 try{assert.deepEqual(readLocalPreferences(),{theme:'light',tools:['draw']});}finally{delete globalThis.localStorage;}
});
test('sync merges distinct fields, newer offline edits and equal-clock conflicts symmetrically',()=>{
 const a={theme:{updated:10,value:'dark'},fonts:{updated:5,value:[]}},b={theme:{updated:20,value:'light'},tools:{updated:20,value:['draw']}};
 assert.deepEqual(mergePreferences(a,b),{...a,...b});assert.deepEqual(mergePreferences(a,b),mergePreferences(b,a));
 assert.deepEqual(mergePreferences({theme:{updated:20,value:'dark'}},b),mergePreferences(b,{theme:{updated:20,value:'dark'}}));assert.equal(a.theme.value,'dark');
});
