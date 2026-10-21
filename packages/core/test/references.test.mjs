import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PixelEditor,createDocument,encodeProject,decodeProject,composite,MAX_REFERENCE_PIXELS,encodePsd,piskelExportWarnings} from '../dist/index.js';
const image=(name='Study')=>({name,width:2,height:1,pixels:new Uint8ClampedArray([7,8,9,0,22,44,66,255])});
test('reference add/select/rename/remove is undoable, copied and independent from artwork/history',()=>{
 const e=new PixelEditor(createDocument(2,2)),d=e.document;e.paint(0,0,[255,0,0,255]);e.commit();const art=composite(d),source=image();e.addReference(source);source.pixels.fill(0);assert.deepEqual([...d.references[0].pixels],[7,8,9,0,22,44,66,255]);e.addReference(image('Second'));e.selectReference('reference-1');e.renameReference('reference-1','Renamed');const before=encodeProject(d);e.removeReference('reference-1');assert.equal(d.activeReferenceId,'reference-2');e.undo();assert.equal(encodeProject(d),before);e.redo();e.undo();e.addFrame(true);e.undo();assert.equal(encodeProject(d),before);assert.deepEqual(composite(d),art);e.undo();assert.equal(d.references[0].name,'Study');e.redo();assert.equal(d.references[0].name,'Renamed');
});
test('v10 persists references even when conversion source is omitted; v1-v9 default empty',()=>{
 const e=new PixelEditor(createDocument(2,1));e.addReference(image());const text=encodeProject(e.document,false),data=JSON.parse(text);assert.equal(data.version,10);assert.equal(encodeProject(decodeProject(text),false),text);
 for(let version=1;version<=9;version++){const old=structuredClone(data);old.version=version;old.pixels=Array(8).fill(0);old.layers[0].cels=[{frameId:'frame-1',rgba:'AAAAAAAAAAA='}];if(version===3)old.layers[0].rgba='AAAAAAAAAAA=';const d=decodeProject(JSON.stringify(old));assert.deepEqual(d.references,[]);assert.equal(d.activeReferenceId,null);}
});
test('reference count/pixel/axis/name/ID/encoded bounds reject atomically before imported allocation',()=>{
 const e=new PixelEditor(createDocument(1,1));for(let i=0;i<4;i++)e.addReference(image(String(i)));const before=encodeProject(e.document);assert.throws(()=>e.addReference(image()));assert.equal(encodeProject(e.document),before);assert.throws(()=>e.selectReference('missing'));assert.throws(()=>e.renameReference('reference-1',' '));
 const data=JSON.parse(before);for(const mutate of [p=>delete p.references,p=>p.references.push(p.references[0]),p=>p.references[0].id='__proto__',p=>p.references[0].name='',p=>p.references[0].width=1025,p=>p.references[0].height=0,p=>p.references[0].rgba='https://invalid',p=>p.references[0].rgba='AAAAAA==',p=>p.activeReferenceId='missing',p=>{for(const r of p.references){r.width=1024;r.height=1024;}}]){const bad=structuredClone(data);mutate(bad);assert.throws(()=>decodeProject(JSON.stringify(bad)));}
 const big=new PixelEditor(createDocument(1,1));big.addReference({name:'Max',width:1024,height:1024,pixels:new Uint8ClampedArray(MAX_REFERENCE_PIXELS*4)});assert.throws(()=>big.addReference(image()));assert.ok(big.historyBytes<=big.historyBudget);
});
test('native reference omission is explicit and static snapshot leaves reference pixels untouched',()=>{
 const e=new PixelEditor(createDocument(2,2));e.addReference(image());const before=encodeProject(e.document);assert.ok(encodePsd(e.document,'selected-frame').warnings.some(w=>w.includes('reference images')));assert.ok(piskelExportWarnings(e.document,10).some(w=>w.includes('reference images')));assert.equal(encodeProject(e.document),before);
});
