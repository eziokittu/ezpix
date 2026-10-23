import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDocument,PixelEditor,encodeProject,decodeProject,composite,layerEditable,layerRows,encodePsd,encodeOra,encodeAseprite,encodePiskel} from '../dist/index.js';
const fixture=()=>{const e=new PixelEditor(createDocument(1,1));e.paint(0,0,[255,0,0,255]);e.commit();e.addLayer();e.paint(0,0,[0,0,255,255]);e.commit();e.createGroup();e.addLayer();e.paint(0,0,[0,255,0,128]);e.commit();return e;};
test('isolated normal group opacity differs from per-layer opacity and rounds once',()=>{
 const e=fixture();e.setGroupProperties('group-1',{opacity:128});assert.deepEqual([...composite(e.document)],[127,64,64,255]);e.createGroup('group-1');e.setGroupProperties('group-2',{opacity:128});assert.deepEqual([...composite(e.document)],[191,32,32,255]);e.setGroupProperties('group-2',{visible:false});assert.deepEqual([...composite(e.document)],[255,0,0,255]);e.undo();assert.deepEqual([...composite(e.document)],[191,32,32,255]);
});
test('ancestor locks/visibility block editing and finishing in every frame; pixels and child flags stay intact',()=>{
 const e=fixture();e.addFrame(true);const before=e.document.cel.pixels.slice();e.setGroupProperties('group-1',{locked:true});assert.equal(e.document.layers.at(-1).locked,false);assert.equal(layerEditable(e.document,e.document.layers.at(-1)),false);e.paint(0,0,[1,2,3,255]);e.fill(0,0,[1,2,3,255]);assert.deepEqual(e.document.cel.pixels,before);assert.throws(()=>e.finishArtwork('outline',[0,0,0,255]));e.setGroupProperties('group-1',{locked:false,visible:false});e.paint(0,0,[1,2,3,255]);assert.deepEqual(e.document.cel.pixels,before);
});
test('nested creation, sibling block moves, reparenting, ungroup/delete and undo preserve all frame bytes',()=>{
 const e=fixture();e.addFrame(true);const before=encodeProject(e.document);e.createGroup('group-1');e.moveNode('group-2',-1);assert.equal(e.document.layers[0].groupId,'group-1');e.undo();e.ungroup('group-2');assert.equal(encodeProject(e.document),before);e.moveIntoGroup('layer-1','group-1');assert.equal(e.document.layers.at(-1).id,'layer-1');e.undo();assert.equal(encodeProject(e.document),before);e.deleteGroup('group-1');assert.equal(e.document.layers.length,1);assert.equal(e.document.groups.length,0);e.undo();assert.equal(encodeProject(e.document),before);e.redo();assert.equal(e.document.layers.length,1);
});
test('v6 roundtrip and v1-v5 migrations; cycles, depth, empty/interleaved groups and unsafe operations are atomic',()=>{
 const e=fixture(),text=encodeProject(e.document),parsed=JSON.parse(text);assert.equal(parsed.version,13);assert.deepEqual(composite(decodeProject(text)),composite(e.document));assert.equal(layerRows(e.document).filter(r=>r.group).length,1);
 const old=JSON.parse(encodeProject(createDocument(1,1)));old.version=5;old.layers[0].cels=[{frameId:'frame-1',rgba:'AAAAAA=='}];delete old.groups;delete old.layers[0].groupId;assert.deepEqual(decodeProject(JSON.stringify(old)).groups,[]);
 for(const mutate of [p=>delete p.groups,p=>p.groups[0].parentId='group-1',p=>p.groups[0].opacity=256,p=>p.layers[1].groupId='group-999',p=>p.groups.push({...p.groups[0],id:'group-2'}),p=>{p.layers[0].groupId='group-1';p.layers[1].groupId=null;}]){const p=structuredClone(parsed);mutate(p);assert.throws(()=>decodeProject(JSON.stringify(p)));}
 e.createGroup('group-1');e.createGroup('group-2');e.createGroup('group-3');const before=encodeProject(e.document);assert.throws(()=>e.createGroup('group-4'),/four/);assert.equal(encodeProject(e.document),before);assert.throws(()=>e.moveIntoGroup('group-4','group-1'));assert.equal(encodeProject(e.document),before);const single=new PixelEditor(createDocument(1,1));single.createGroup();const saved=encodeProject(single.document);assert.throws(()=>single.moveIntoGroup('layer-1',null));assert.equal(encodeProject(single.document),saved);
});
test('grouped native exports reject implicit loss; explicit flattened PSD/ORA frames render the groups',async()=>{
 const e=fixture();e.setGroupProperties('group-1',{opacity:128});assert.throws(()=>encodeAseprite(e.document),/groups/);await assert.rejects(encodePiskel(e.document),/groups/);assert.throws(()=>encodePsd(e.document),/group export/);await assert.rejects(encodeOra(e.document),/group export/);assert.ok(encodePsd(e.document,'frames-as-layers').bytes.length);assert.ok((await encodeOra(e.document,'frames-as-layers')).bytes.length);
});

test('group count budget and merge within a group retain membership, inherited opacity and exact undo',()=>{
 const e=fixture();e.setGroupProperties('group-1',{opacity:128});const before=encodeProject(e.document),pixels=composite(e.document);e.mergeDown();assert.equal(e.document.layers.at(-1).groupId,'group-1');assert.deepEqual(composite(e.document),pixels);e.undo();assert.equal(encodeProject(e.document),before);
 const full=new PixelEditor(createDocument(1,1));for(let i=0;i<16;i++){if(i){full.selectLayer(full.document.layers[0].id);full.addLayer();full.moveIntoGroup(full.document.activeLayerId,null);}full.createGroup();}const snapshot=encodeProject(full.document);assert.throws(()=>full.createGroup(),/16 groups/);assert.equal(encodeProject(full.document),snapshot);
});
