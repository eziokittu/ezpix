import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PixelEditor,createDocument,animationAtTime,encodeProject,decodeProject,composite,MAX_TAGS,encodePsd,piskelExportWarnings} from '../dist/index.js';
function fixture(){const e=new PixelEditor(createDocument(2,1));for(const duration of [20,60,100,40]){if(e.document.frames.length>1||e.document.frames[0].duration===20)e.addFrame();e.setFrameDuration(duration);e.paint(0,0,[duration,0,0,255]);e.commit();}return e;}
test('tag playback uses duration boundaries for all four modes and never changes editing state',()=>{
 const e=fixture(),d=e.document;e.setTag({name:'Walk',from:0,to:2,mode:'loop'});const before=encodeProject(d);
 const expected={loop:[[0,1],[19,1],[20,2],[79,2],[80,3],[179,3],[180,1]],once:[[0,1],[80,3],[179,3],[180,3],[10000,3]],reverse:[[0,3],[99,3],[100,2],[159,2],[160,1],[179,1],[180,3]],'ping-pong':[[0,1],[20,2],[80,3],[180,2],[239,2],[240,1]]};
 for(const [mode,pairs]of Object.entries(expected))for(const [time,frame]of pairs){const result=animationAtTime(d,time,{tagId:'tag-1',mode});assert.equal(result.frameId,`frame-${frame}`,`${mode}/${time}`);assert.equal(result.done,mode==='once'&&time>=180);}
 assert.equal(encodeProject(d),before);assert.equal(animationAtTime(d,0).frameId,d.activeFrameId);assert.equal(animationAtTime(d,0,{mode:'reverse'}).frameId,'frame-4');
 for(const elapsed of [-1,NaN,Infinity])assert.throws(()=>animationAtTime(d,elapsed));assert.throws(()=>animationAtTime(d,0,{tagId:'missing'}));assert.throws(()=>animationAtTime(d,0,{mode:'bad'}));
});
test('single-frame and two-frame ping-pong neither duplicates endpoints nor mutates buffers',()=>{
 const e=fixture(),d=e.document;e.setTag({name:'One',from:1,to:1,mode:'ping-pong'});for(const time of [0,60,600000])assert.equal(animationAtTime(d,time,{tagId:'tag-1'}).frameId,'frame-2');
 e.setTag({name:'Two',from:0,to:1,mode:'ping-pong'});for(const [time,id]of [[0,1],[20,2],[80,1],[100,2],[160,1]])assert.equal(animationAtTime(d,time,{tagId:'tag-2'}).frameId,`frame-${id}`);
});
test('tag insertion/deletion/reorder semantics, overlapping ranges and metadata history are atomic',()=>{
 const e=fixture(),d=e.document;e.setTag({name:'Outer',from:1,to:3,mode:'reverse'});e.setTag({name:'Single',from:2,to:2,mode:'once'});const original=encodeProject(d);
 e.selectFrame('frame-1');e.addFrame();assert.deepEqual(d.tags.map(t=>[t.from,t.to]),[[2,4],[3,3]]);e.undo();
 e.selectFrame('frame-2');e.addFrame(true);assert.deepEqual(d.tags.map(t=>[t.from,t.to]),[[1,4],[3,3]]);e.undo();
 e.selectFrame('frame-4');e.addFrame();assert.deepEqual(d.tags.map(t=>[t.from,t.to]),[[1,3],[2,2]]);e.undo();
 e.selectFrame('frame-3');e.deleteFrame();assert.deepEqual(d.tags.map(t=>[t.from,t.to]),[[1,2]]);e.undo();assert.deepEqual(d.tags.map(t=>[t.from,t.to]),[[1,3],[2,2]]);e.redo();e.undo();
 e.selectFrame('frame-1');e.deleteFrame();assert.deepEqual(d.tags.map(t=>[t.from,t.to]),[[0,2],[1,1]]);e.undo();e.selectFrame('frame-2');e.moveFrame(-1);assert.deepEqual(d.tags.map(t=>[t.from,t.to]),[[1,3],[2,2]]);e.undo();
 e.selectFrame('frame-4');assert.equal(encodeProject(d),original);e.setTag({name:'Renamed',from:0,to:0,mode:'ping-pong'},'tag-1');e.undo();assert.equal(encodeProject(d),original);e.deleteTag('tag-2');e.undo();assert.equal(encodeProject(d),original);
 const pixels=d.layers.map(l=>Object.values(l.cels).map(p=>[...p]));e.createGroup();e.undo();assert.equal(encodeProject(d),original);assert.deepEqual(d.layers.map(l=>Object.values(l.cels).map(p=>[...p])),pixels);
});
test('v7 validates tag limits and hostile ranges; v1-v6 readers default to no tags',()=>{
 const e=fixture();e.createGroup();e.setGroupProperties('group-1',{opacity:73});e.setTag({name:'Idle',from:0,to:3,mode:'once'});const text=encodeProject(e.document),data=JSON.parse(text);assert.equal(data.version,10);assert.equal(encodeProject(decodeProject(text)),text);
 for(const tags of [undefined,null,{},Array(17).fill(data.tags[0]),[data.tags[0],data.tags[0]],[{...data.tags[0],id:'__proto__'}],[{...data.tags[0],name:'  '}],[{...data.tags[0],name:'x'.repeat(81)}],[{...data.tags[0],from:-1}],[{...data.tags[0],from:1.5}],[{...data.tags[0],from:3,to:2}],[{...data.tags[0],to:4}],[{...data.tags[0],mode:'random'}]])assert.throws(()=>decodeProject(JSON.stringify({...data,tags})));
 const legacy=decodeProject(JSON.stringify({...data,version:6}));assert.deepEqual(legacy.groups,e.document.groups);assert.deepEqual(legacy.frames,e.document.frames);for(const frame of legacy.frames)assert.deepEqual(composite(legacy,frame.id),composite(e.document,frame.id));
 for(let version=1;version<=6;version++){const old={...data,version,pixels:[...e.document.layers[0].cels['frame-1']]};if(version===3)old.layers=old.layers.map(l=>({...l,rgba:l.cels[0].rgba}));assert.deepEqual(decodeProject(JSON.stringify(old)).tags,[]);}
 const before=encodeProject(e.document);for(const bad of [{name:'IDLE',from:0,to:0,mode:'loop'},{name:'x',from:2,to:1,mode:'loop'},{name:'x',from:0,to:99,mode:'loop'}]){assert.throws(()=>e.setTag(bad));assert.equal(encodeProject(e.document),before);}
 for(let n=1;n<MAX_TAGS;n++)e.setTag({name:`Tag ${n}`,from:0,to:0,mode:'loop'});const full=encodeProject(e.document);assert.throws(()=>e.setTag({name:'Overflow',from:0,to:0,mode:'loop'}));assert.equal(encodeProject(e.document),full);
});
test('native static snapshot clears tags and reports omissions without altering the project',()=>{
 const e=fixture();e.setTag({name:'Loop',from:1,to:3,mode:'loop'});const before=encodeProject(e.document),result=encodePsd(e.document,'frames-as-layers');assert.ok(result.warnings.some(w=>w.includes('tags/playback')));assert.ok(piskelExportWarnings(e.document,10).some(w=>w.includes('tags/playback')));assert.equal(encodeProject(e.document),before);assert.equal(composite(decodeProject(before)).length,8);
});
