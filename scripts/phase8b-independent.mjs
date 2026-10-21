// Independent-reader gates. Readers stay under ignored artifacts, never product deps.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createDocument,PixelEditor,encodeAseprite,encodePiskel,decodePiskel} from '../packages/core/dist/index.js';
const out=resolve('artifacts/phase8b');await mkdir(out,{recursive:true});
const require=createRequire(import.meta.url),Ase=require(resolve(out,'independent/node_modules/ase-parser'));
const editor=new PixelEditor(createDocument(5,3,'Cross-reader fixture'));editor.paint(0,0,[23,45,67,255]);editor.paint(4,2,[89,111,133,255]);editor.commit();editor.addLayer();editor.renameLayer('Top');editor.paint(2,1,[251,191,71,255]);editor.commit();editor.toggleLayer();editor.setFrameDuration(80);editor.addFrame(true);editor.setFrameDuration(140);editor.paint(3,1,[61,231,171,255]);editor.commit();const doc=editor.document;
const bytes=encodeAseprite(doc);await writeFile(resolve(out,'independent.aseprite'),bytes);const ase=new Ase(Buffer.from(bytes),'independent');ase.parse();assert.equal(ase.width,5);assert.equal(ase.height,3);assert.equal(ase.numFrames,2);assert.equal(ase.layers.length,2);assert.equal(ase.layers[1].flags.visible,false);assert.equal(ase.layers[1].name,'Top');assert.deepEqual(ase.frames.map(f=>f.frameDuration),[80,140]);for(let f=0;f<2;f++)for(let l=0;l<2;l++)assert.deepEqual([...ase.frames[f].cels[l].rawCelData],[...doc.layers[l].cels[doc.frames[f].id]]);assert.equal(ase.palette.paletteSize,doc.palette.length);
// Additional Aseprite-only fixture verifies partial alpha independently.
editor.selectFrame(doc.frames[0].id);editor.selectLayer(doc.layers[0].id);editor.paint(1,1,[17,37,57,73]);editor.commit();const alpha=new Ase(Buffer.from(encodeAseprite(doc)),'alpha');alpha.parse();assert.deepEqual([...alpha.frames[0].cels[0].rawCelData.subarray((1*5+1)*4,(1*5+2)*4)],[17,37,57,73]);editor.undo();
const text=(await encodePiskel(doc,10)).text;await writeFile(resolve(out,'independent.piskel'),text);
const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage();await page.goto('https://www.piskelapp.com/p/create/sprite/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>globalThis.pskl?.app?.piskelController&&globalThis.pskl?.utils?.serialization?.Deserializer,{timeout:45000});
 // From this point no network requests are allowed: synthetic project stays local.
 await page.route('**/*',route=>route.abort());
 const result=await page.evaluate(text=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('Piskel native reader timed out')),15000);
  pskl.utils.serialization.Deserializer.deserialize(JSON.parse(text),piskel=>{clearTimeout(timer);try{pskl.app.piskelController.setFPS(10);const layers=piskel.getLayers().map(l=>({name:l.getName(),opacity:l.getOpacity(),frames:l.getFrames().map(f=>[...new Uint8Array(f.getPixels().buffer)])}));resolve({width:piskel.getWidth(),height:piskel.getHeight(),layers,serialized:pskl.utils.serialization.Serializer.serialize(piskel),model:Constants.MODEL_VERSION});}catch(e){reject(e);}},e=>{clearTimeout(timer);reject(e);});
 }),text);
 assert.equal(result.model,2);assert.equal(result.width,5);assert.equal(result.height,3);assert.equal(result.layers[1].opacity,0);assert.equal(result.layers[1].name,'Top');for(let l=0;l<2;l++)for(let f=0;f<2;f++)assert.deepEqual(result.layers[l].frames[f],[...doc.layers[l].cels[doc.frames[f].id]],'live Piskel native reader sees exact pixels');
 await writeFile(resolve(out,'piskel-native-resaved.piskel'),result.serialized);const back=(await decodePiskel(result.serialized)).document;for(let l=0;l<2;l++)for(let f=0;f<2;f++)assert.deepEqual([...back.layers[l].cels[back.frames[f].id]],[...doc.layers[l].cels[doc.frames[f].id]],'EzPix imports real Piskel serializer output');
 await writeFile(resolve(out,'independent-result.json'),JSON.stringify({status:'passed',aseReader:'ase-parser 0.0.19 (MIT), artifact-only',aseChecks:['dimensions, layer names/order/visibility, frame timing, palette size, exact RGBA for every cel, partial alpha'],piskelReader:'live piskelapp.com modelVersion 2 native Deserializer and Serializer services',browser:await browser.version(),piskelChecks:['embedded PNG pixels for every layer/frame, opacity-zero hidden layer, names, FPS 10','actual Piskel native serializer output imported back into EzPix'],network:'blocked before passing synthetic project to Piskel',notClaimed:['manual desktop Aseprite test','full unsupported-feature compatibility']},null,2));console.log('PASS: independent ase-parser and real Piskel native readers/serializer');
}finally{await browser.close();}
