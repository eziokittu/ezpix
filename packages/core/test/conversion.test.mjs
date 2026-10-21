import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convert, defaultRecipe, encodeProject, decodeProject, extractPalette } from '../dist/index.js';
import { imageDimensions } from '../dist/browser.js';
const source = { width: 2, height: 2, pixels: new Uint8ClampedArray([255,0,0,255, 0,255,0,255, 0,0,255,0, 255,255,255,255]) };
test('nearest identity, crop, area with premultiplied alpha golden values', () => {
  const r = { ...defaultRecipe(source), width: 2, height: 2, sampling: 'nearest' };
  assert.deepEqual([...convert(source,r).cel.pixels], [255,0,0,255,0,255,0,255,0,0,0,0,255,255,255,255]);
  const area = convert(source, { ...r, width: 1, height: 1, sampling: 'area' });
  assert.deepEqual([...area.cel.pixels], [170,170,85,191]);
  assert.deepEqual([...convert(source,{ ...r, width: 1,height:1,crop:{x:1,y:0,width:1,height:1} }).cel.pixels], [0,255,0,255]);
});
test('adaptive/dither is deterministic, palette-bound and preserves alpha', () => {
  const pixels = new Uint8ClampedArray(Array.from({length: 64*4},(_,i) => i%4===3 ? 255 : (i*37)%256));
  const s = { width: 8, height: 8, pixels }, recipe = { ...defaultRecipe(s), width:8,height:8,palette:'adaptive',colors:4,dither:true };
  const a=convert(s,recipe), b=convert(s,recipe);
  assert.deepEqual(a,b);
  const palette = extractPalette(pixels,4).map(c=>c.join(','));
  for(let i=0;i<a.cel.pixels.length;i+=4) { assert.ok(palette.includes([...a.cel.pixels.slice(i,i+3)].join(','))); assert.equal(a.cel.pixels[i+3],255); }
});
test('source/recipe survives edits; source-free export and v1/v2 readers remain usable', () => {
  const doc=convert(source,{...defaultRecipe(source),width:2,height:2}); doc.cel.pixels[0]=12;
  assert.deepEqual(decodeProject(encodeProject(doc)),doc);
  const without=decodeProject(encodeProject(doc,false)); assert.equal(without.conversion.source,undefined); assert.equal(without.cel.pixels[0],12);
  const old={format:'ezpix',version:1,name:'Legacy',width:2,height:2,pixels:[...doc.cel.pixels]};
  assert.equal(decodeProject(JSON.stringify(old)).width,2);
  const v2={...old,name:doc.name,version:2,conversion:JSON.parse(encodeProject(doc)).conversion};assert.deepEqual(decodeProject(JSON.stringify(v2)),doc);
  const hostile=JSON.parse(encodeProject(doc)); hostile.conversion.source.rgba='AA=='; assert.throws(()=>decodeProject(JSON.stringify(hostile)));
  assert.throws(()=>convert(source,{...defaultRecipe(source),crop:{x:1,y:0,width:2,height:2}}));
});
test('predecode header limits reject malformed and excessive images', () => {
  assert.throws(()=>imageDimensions(new Uint8Array([1,2,3])));
  const png = new Uint8Array(24); png.set([137,80,78,71,13,10,26,10],0); png.set([73,72,68,82],12);
  const view = new DataView(png.buffer); view.setUint32(16,100); view.setUint32(20,200);
  assert.deepEqual(imageDimensions(png),{width:100,height:200});
});
