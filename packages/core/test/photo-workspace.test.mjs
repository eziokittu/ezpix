import test from 'node:test';
import assert from 'node:assert/strict';
import {PhotoWorkspace,renderWorkspaceEdit} from '../dist/photo-workspace.js';
import {encodePhotoProject,decodePhotoProject} from '../dist/photo-project.js';
import {EMOJI_GROUPS} from '../dist/emoji-data.js';
import {defaultRecipe,convert} from '../dist/conversion.js';

const source=()=>({width:2,height:2,pixels:new Uint8ClampedArray([20,40,60,255,80,100,120,255,140,160,180,255,200,220,240,255])});
const negative={kind:'tone',options:{rect:{x:0,y:0,width:2,height:2},method:'crop',tolerance:0,adjustments:{filter:'invert'}}};
test('photo layers preserve Original and apply only selected pixels across edits and undo',()=>{
 const original=source(),workspace=new PhotoWorkspace([original]);
 workspace.put(negative,'Selected negative',new Uint8Array([1,0,0,0]));
 assert.deepEqual([...workspace.render()[0].pixels],[235,215,195,255,80,100,120,255,140,160,180,255,200,220,240,255]);
 assert.deepEqual(workspace.original(),original);
 workspace.put(negative,'Other area',new Uint8Array([0,0,0,1]));
 assert.deepEqual([...workspace.render()[0].pixels.slice(-4)],[55,35,15,255]);
 workspace.undoEdit();assert.deepEqual([...workspace.render()[0].pixels.slice(-4)],[200,220,240,255]);
 workspace.redoEdit();assert.deepEqual([...workspace.render()[0].pixels.slice(-4)],[55,35,15,255]);
});
test('reediting an applied stamp replaces the layer and never burns its previous position into the photo',()=>{
 const base={width:8,height:8,pixels:new Uint8ClampedArray(Array.from({length:64},()=>[20,40,60,255]).flat())};const workspace=new PhotoWorkspace([base]);const stamp={kind:'stamp',image:{width:1,height:1,pixels:new Uint8ClampedArray([255,0,0,255])},x:.25,y:.25,size:.25,angle:0,opacity:1};
 const id=workspace.put(stamp,'Emoji red');const first=workspace.render()[0];
 workspace.put({...stamp,x:.85,y:.85},'Emoji red',null,id);
 const edited=workspace.render()[0];assert.deepEqual([...edited.pixels.slice((1*8+1)*4,(1*8+1)*4+4)],[20,40,60,255]);assert.notDeepEqual(edited,first);
 assert.equal(workspace.layers().length,1);workspace.mutate(id,'delete');assert.deepEqual(workspace.render()[0],base);
});
test('layer visibility, reordering, duplication, locks and failed geometry edits are atomic',()=>{
 const workspace=new PhotoWorkspace([source()]);const first=workspace.put(negative,'Negative');const second=workspace.put({kind:'effect',effect:'duotone',amount:1},'Duotone');
 const before=workspace.render()[0];workspace.mutate(first,'up');assert.notDeepEqual(workspace.render()[0],before);
 workspace.mutate(second,'visible');workspace.mutate(first,'duplicate');assert.equal(workspace.layers().length,3);
 workspace.mutate(first,'lock');const locked=workspace.snapshot();assert.throws(()=>workspace.mutate(first,'delete'),/Unlock/);assert.deepEqual(workspace.snapshot(),locked);
 assert.throws(()=>workspace.put({kind:'resize',width:3,height:3,sampling:'nearest'},'Resize',new Uint8Array([1,0,0,0])),/Clear the selection/);assert.deepEqual(workspace.snapshot(),locked);
});
test('photo project roundtrip preserves independent original, emoji bytes, masks and layer settings',()=>{
 const workspace=new PhotoWorkspace([source()]);const id=workspace.put(negative,'My edit',new Uint8Array([1,0,1,0]));workspace.mutate(id,'opacity',.4);
 const snapshot=workspace.snapshot(),text=encodePhotoProject(snapshot),decoded=decodePhotoProject(text);assert.deepEqual(decoded,snapshot);
 const restored=new PhotoWorkspace([source()]);restored.restore(decoded);assert.deepEqual(restored.render(),workspace.render());
 assert.throws(()=>decodePhotoProject(text.replace('"version":1','"version":2')),/Invalid/);
 assert.throws(()=>decodePhotoProject('{"original":[]}'));
 const bad=structuredClone(snapshot);bad.layers[0].mask=new Uint8Array([1]);assert.throws(()=>restored.restore(bad),/selection/);assert.deepEqual(restored.snapshot(),decoded);
});
test('full-canvas pixelation and custom palettes preserve outside pixels and reject malformed colours',()=>{
 const original=source();const recipe={...defaultRecipe(original),width:1,height:1,palette:'custom',customPalette:['#000000','#ffffff'],sampling:'nearest'};
 const result=renderWorkspaceEdit(original,{...negative,options:{...negative.options,adjustments:{}},recipe},new Uint8Array([1,0,0,0]));
 assert.equal(result.width,2);assert.equal(result.height,2);assert.deepEqual([...result.pixels.slice(4)],[...original.pixels.slice(4)]);
 assert.throws(()=>convert(original,{...recipe,customPalette:['red']}),/custom palette/);
});
test('bundled Unicode catalogue has full category coverage, named entries and skin tone/ZWJ sequences',()=>{
 const entries=Object.values(EMOJI_GROUPS).flat();assert.equal(entries.length,3781);assert.equal(Object.keys(EMOJI_GROUPS).length,9);assert.equal(new Set(entries.map(e=>e[0])).size,entries.length);assert.ok(entries.some(e=>e[0].includes('\u200d')));assert.ok(entries.some(e=>e[1].includes('skin tone')));assert.ok(entries.every(e=>e.length===3&&e.every(Boolean)));
});

test('grouped layers retain multiple editable objects, isolated removal, duplication and atomic locks',()=>{
 const base=source(),workspace=new PhotoWorkspace([base],true),layer=workspace.active;
 const first=workspace.append(negative,'Area one',new Uint8Array([1,0,0,0]));
 workspace.append(negative,'Area two',new Uint8Array([0,0,0,1]));
 assert.equal(workspace.layers().length,1);assert.equal(workspace.objects().length,2);assert.equal(workspace.active,layer);
 assert.deepEqual([...workspace.render()[0].pixels],[235,215,195,255,80,100,120,255,140,160,180,255,55,35,15,255]);
 workspace.removeObject(first);assert.equal(workspace.layers().length,1);assert.deepEqual([...workspace.render()[0].pixels.slice(0,4)],[20,40,60,255]);assert.deepEqual([...workspace.render()[0].pixels.slice(-4)],[55,35,15,255]);
 workspace.undoEdit();workspace.mutate(layer,'duplicate');assert.equal(new Set(workspace.objects().map(o=>o.id)).size,4);
 workspace.mutate(workspace.active,'lock');const before=workspace.snapshot();assert.throws(()=>workspace.append(negative,'Blocked'),/Unlock/);assert.deepEqual(workspace.snapshot(),before);
 const saved=decodePhotoProject(encodePhotoProject(before));assert.equal(saved.version,2);assert.deepEqual(saved,before);
});
test('legacy project migration preserves pixels and object identity; drafts never create layers',()=>{
 const legacy=new PhotoWorkspace([source()]);const id=legacy.put(negative,'Legacy area',new Uint8Array([1,0,0,0]));const before=legacy.render();
 const restored=new PhotoWorkspace([source()]);restored.restore(decodePhotoProject(encodePhotoProject(legacy.snapshot())));
 restored.append(negative,'Second area',new Uint8Array([0,0,0,1]));assert.equal(restored.layers().length,1);assert.equal(restored.objects()[0].id,id);
 const state=restored.snapshot(),draft=restored.withDraft({edit:negative,name:'Live',mask:new Uint8Array([0,1,0,0])});assert.equal(draft.layers.length,1);assert.equal(draft.layers[0].operations.length,3);assert.deepEqual(restored.snapshot(),state);
 restored.removeObject(restored.objects()[1].id);assert.deepEqual(restored.render(),before);
 const bad=structuredClone(draft);bad.layers[0].operations.push(bad.layers[0].operations[0]);assert.throws(()=>restored.restore(bad),/Invalid editable object/);
});

test('moving one object in a grouped layer restores its old pixels without moving later objects',()=>{
 const base={width:8,height:8,pixels:new Uint8ClampedArray(Array.from({length:64},()=>[20,40,60,255]).flat())},workspace=new PhotoWorkspace([base],true);
 const stamp={kind:'stamp',image:{width:1,height:1,pixels:new Uint8ClampedArray([255,0,0,255])},x:.2,y:.2,size:.2,angle:0,opacity:1};
 const first=workspace.append(stamp,'First');const second=workspace.append({...stamp,x:.8,y:.8},'Second');const previous=workspace.render()[0];
 workspace.append({...stamp,x:.5,y:.5},'First',null,first);const moved=workspace.render()[0];assert.deepEqual([...moved.pixels.slice(36,40)],[20,40,60,255]);assert.notDeepEqual(moved,previous);assert.equal(workspace.layers().length,1);assert.equal(workspace.objects().length,2);assert.equal(workspace.objects()[1].id,second);
 workspace.removeObject(first);assert.ok(workspace.render()[0].pixels.some((v,i)=>v!==base.pixels[i]));assert.equal(workspace.objects()[0].id,second);
});

test('global history retains every mixed action until the project-open baseline, including selection, without copying media into every step',()=>{
 const base={width:1024,height:1024,pixels:new Uint8ClampedArray(1024*1024*4)},workspace=new PhotoWorkspace([base],true);
 const initial=workspace.snapshot();workspace.rememberSelection(new Uint8Array(1024*1024).fill(1));
 const layer=workspace.active;for(let i=0;i<11;i++)workspace.mutate(layer,'rename','Name '+i);
 assert.equal(workspace.history().steps,12);
 for(let i=0;i<12;i++)assert.equal(workspace.undoEdit(),true);
 assert.equal(workspace.undoEdit(),false);assert.equal(workspace.layers()[0].name,'Layer 1');
 assert.deepEqual(workspace.original(),initial.original[0]);
 const small=new PhotoWorkspace([source()],true);const first=small.append(negative,'Negative');
 small.rememberSelection(new Uint8Array([1,0,0,1]));small.mutate(small.active,'rename','Selected');
 small.undoEdit();assert.deepEqual([...small.savedSelection()],[1,0,0,1]);small.undoEdit();assert.equal(small.savedSelection(),null);assert.equal(small.objects()[0].id,first);small.undoEdit();assert.equal(small.objects().length,0);
});

test('first-frame live previews match full rendering across replacement, masks, opacity, undo and invalid drafts',()=>{
 const workspace=new PhotoWorkspace([source(),source()],true);const first=workspace.append(negative,'First');
 workspace.append(negative,'Masked',new Uint8Array([0,1,0,0]));workspace.mutate(workspace.active,'opacity',.6);
 const edit={kind:'effect',effect:'duotone',amount:.6},draft={edit,id:first};
 const before=workspace.snapshot();assert.deepEqual(workspace.renderFirst(draft),workspace.render(undefined,draft)[0]);assert.deepEqual(workspace.snapshot(),before);
 const exported=workspace.withDraft(draft);exported.original[0].pixels[0]=254;assert.deepEqual(workspace.snapshot(),before,'exported drafts cannot mutate shared history');
 workspace.append(edit,'Replacement',null,first);assert.deepEqual(workspace.renderFirst(),workspace.render()[0]);workspace.undoEdit();assert.deepEqual(workspace.renderFirst(),workspace.render()[0]);
 assert.throws(()=>workspace.renderFirst({edit:{kind:'resize',width:3,height:3,sampling:'nearest'},mask:new Uint8Array([1,0,0,0])}));assert.deepEqual(workspace.snapshot(),before);
});
