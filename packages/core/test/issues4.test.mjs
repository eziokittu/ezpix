import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDocument,PixelEditor,defaultDrawingOptions,prepareDrawing,rasterCel,encodeProject,decodeProject,PALETTE_PRESETS,convert,defaultRecipe,validateDrawingOptions} from '../dist/index.js';

test('spray softness tapers coverage and alpha; secondary mix preserves centre and Undo',()=>{
  const e=new PixelEditor(createDocument(33,33)),before=encodeProject(e.document);
  const options={...defaultDrawingOptions([255,0,0,255],[0,0,255,255]),mode:'spray',size:31,shape:'circle',density:100,seed:42};
  const hard=prepareDrawing(e.document,[{x:16,y:16}],options);
  const soft=prepareDrawing(e.document,[{x:16,y:16}],{...options,spraySoftness:100,sprayColorMix:100});
  const center=(16*33+16)*4;
  assert.deepEqual([...soft.pixels.slice(center,center+4)],[255,0,0,255]);
  assert.ok(soft.changedPixels<hard.changedPixels);
  const edges=Array.from({length:33*33},(_,i)=>[...soft.pixels.slice(i*4,i*4+4)]).filter(c=>c[3]>0&&c[3]<255);
  assert.ok(edges.length>0);assert.ok(edges.every(c=>c[0]<255&&c[2]>0));
  assert.deepEqual(soft.pixels,prepareDrawing(e.document,[{x:16,y:16}],{...options,spraySoftness:100,sprayColorMix:100}).pixels);
  e.applyDrawing(soft);assert.deepEqual(rasterCel(e.document,e.document.layers[0]),soft.pixels);
  e.undo();assert.equal(encodeProject(e.document),before);e.redo();assert.deepEqual(rasterCel(e.document,e.document.layers[0]),soft.pixels);
});
test('legacy spray defaults are byte-identical and invalid edge settings reject',()=>{
  const d=createDocument(9,9),a={...defaultDrawingOptions(),mode:'spray',size:7};
  const old={...a};delete old.spraySoftness;delete old.sprayColorMix;
  assert.deepEqual(prepareDrawing(d,[{x:4,y:4}],a).pixels,prepareDrawing(d,[{x:4,y:4}],old).pixels);
  for(const n of [-1,101,NaN,1.5])for(const key of ['spraySoftness','sprayColorMix'])assert.throws(()=>validateDrawingOptions({...a,[key]:n}),/0-100/);
});
for(const [id,preset] of Object.entries(PALETTE_PRESETS))test(`${id} conversion uses only the selected colours and survives recipe/project roundtrip`,()=>{
  const source={width:4,height:1,pixels:Uint8ClampedArray.from([240,10,100,255,10,200,60,255,150,150,150,128,100,20,40,0])};
  const recipe={...defaultRecipe(source),width:4,height:1,palette:id,dither:true};
  const doc=convert(source,recipe),rgba=rasterCel(doc,doc.layers[0]);
  for(let i=0;i<3;i++)assert.ok(preset.colors.includes('#'+[...rgba.slice(i*4,i*4+3)].map(v=>v.toString(16).padStart(2,'0')).join('')));
  assert.equal(rgba[15],0);assert.equal(decodeProject(encodeProject(doc)).conversion.recipe.palette,id);
});
