import test from 'node:test';
import assert from 'node:assert/strict';
import {magicFocusSelection,shapeFocusSelection,brushFocusSelection,combineFocusSelection,cropFocusSelection,focusRaster,focusAnimation,defaultRecipe,composite} from '../dist/index.js';
const raster=(w,h,color)=>({width:w,height:h,pixels:Uint8ClampedArray.from({length:w*h*4},(_,i)=>color(i/4|0)[i%4])});
test('magic selects connected moon greys, excludes dark sky, disconnected matches and transparent pixels',()=>{
 const source=raster(7,3,i=>i===0?[220,220,220,255]:[9,10,11,255]);
 for(const [i,v] of [[9,230],[10,190],[11,170],[16,220]])source.pixels.set([v,v,v,255],i*4);
 source.pixels.set([230,230,230,0],17*4);
 const mask=magicFocusSelection(source,{x:2,y:1},64);assert.deepEqual([...mask].flatMap((v,i)=>v?[i]:[]),[9,10,11,16]);assert.equal(mask[0],0);
 assert.equal(magicFocusSelection(source,{x:3,y:2},255).some(Boolean),false);
 assert.equal(magicFocusSelection(source,{x:2,y:1},20).reduce((a,b)=>a+b),2);
});
test('seed-relative tolerance prevents a gradual colour ramp leaking into the background',()=>{
 const source=raster(8,1,i=>[i*25,i*25,i*25,255]);assert.deepEqual([...magicFocusSelection(source,{x:0,y:0},50)],[1,1,1,0,0,0,0,0]);
});
test('lasso rasterization matches an independent even-odd pixel-centre oracle including crossed outlines',()=>{
 for(const points of [[{x:1,y:0},{x:8,y:2},{x:6,y:7},{x:3,y:8},{x:0,y:4}],[{x:0,y:0},{x:8,y:8},{x:0,y:8},{x:8,y:0}]]){
  const mask=shapeFocusSelection(9,9,'polygon',points);
  for(let y=0;y<9;y++)for(let x=0;x<9;x++){let inside=false;for(let k=0,j=points.length-1;k<points.length;j=k++){const a=points[k],b=points[j];if((a.y>y+.5)!==(b.y>y+.5)&&x+.5<(b.x-a.x)*(y+.5-a.y)/(b.y-a.y)+a.x)inside=!inside;}assert.equal(mask[y*9+x],Number(inside));}
 }
});
test('add and subtract refine multicolour objects; crop retains holes and leaves source intact',()=>{
 const red=Uint8Array.from([0,1,0,0,0,0,0,0,0]),blue=Uint8Array.from([0,0,0,1,1,1,0,1,0]);
 let mask=combineFocusSelection(red,blue,'add');mask=combineFocusSelection(mask,Uint8Array.from([0,0,0,0,1,0,0,0,0]),'subtract');
 const cut=cropFocusSelection(mask,3,3);assert.deepEqual(cut.rect,{x:0,y:0,width:3,height:3});assert.equal(cut.mask[4],0);assert.equal(red[3],0);
 assert.equal(cropFocusSelection(new Uint8Array(9),3,3),null);assert.deepEqual([...combineFocusSelection(null,red,'subtract')],[1,0,1,1,1,1,1,1,1]);
});
test('selection brush joins sparse pointer samples continuously and clamps at image edges',()=>{
 const mask=new Uint8Array(100);brushFocusSelection(mask,10,10,{x:0,y:0},{x:9,y:9},.5);for(let i=0;i<10;i++)assert.equal(mask[i*10+i],1);assert.equal(mask[9],0);
});
test('cutout survives photo adjustments, blur, flips, quantization, animation and export pixels',()=>{
 const source=raster(5,5,()=>[160,80,30,255]),before=source.pixels.slice(),mask=Uint8Array.from({length:25},(_,i)=>Number(i===7||i===11||i===12||i===13||i===17));
 const options={rect:{x:0,y:0,width:5,height:5},method:'crop',tolerance:24,mask,adjustments:{brightness:30,blur:2,flipX:true}};
 const cut=focusRaster(source,options);for(let i=0;i<25;i++)assert.equal(cut.pixels[i*4+3],mask[i]*255);
 const recipe={...defaultRecipe(source),width:5,height:5,palette:'original'};
 const doc=focusAnimation([source,source],options,recipe,4,true);for(const frame of doc.frames){const pixels=composite(doc,frame.id);for(let i=0;i<25;i++)assert.equal(pixels[i*4+3],mask[i]*255);}
 assert.deepEqual(source.pixels,before);
});
test('malformed masks, geometry and out-of-budget inputs reject',()=>{
 const source=raster(2,2,()=>[1,2,3,255]),options={rect:{x:0,y:0,width:2,height:2},method:'crop',tolerance:0};
 for(const mask of [new Uint8Array(3),Uint8Array.from([0,1,2,0]),[0,1,0,1]])assert.throws(()=>focusRaster(source,{...options,mask}),/mask/);
 assert.throws(()=>magicFocusSelection(source,{x:-1,y:0},10));assert.throws(()=>magicFocusSelection(source,{x:0,y:0},NaN));assert.throws(()=>shapeFocusSelection(4096,4096,'rectangle',[{x:0,y:0},{x:1,y:1}]));
});
