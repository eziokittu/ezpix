import {mkdir,writeFile} from 'node:fs/promises';
import {createDocument,PixelEditor,celAllocation,encodeProject,composite} from '../packages/core/dist/index.js';
import assert from 'node:assert/strict';
const e=new PixelEditor(createDocument(256,256));while(e.document.frames.length<16)e.addFrame();
const empty=celAllocation(e.document),emptyProject=encodeProject(e.document);for(const f of e.document.frames)composite(e.document,f.id);assert.equal(celAllocation(e.document).bytes,0);
e.paint(0,0,[12,34,56,255]);e.commit();const one=celAllocation(e.document),sparse=encodeProject(e.document),legacy=JSON.parse(sparse);legacy.version=7;for(const l of legacy.layers)for(const c of l.cels)if(c.empty){delete c.empty;c.rgba=Buffer.alloc(256*256*4).toString('base64');}
const result={scope:'Retained live cel RGBA payload and serialized bytes only; not peak heap, history, canvas or browser memory.',engine:JSON.parse(sparse).engine,empty,oneFilled:one,emptyProjectBytes:Buffer.byteLength(emptyProject),oneFilledProjectBytes:Buffer.byteLength(sparse),equivalentDenseV7Bytes:Buffer.byteLength(JSON.stringify(legacy)),payloadReductionPercent:100*(1-one.bytes/one.denseBytes)};
assert.equal(result.payloadReductionPercent,93.75);await mkdir('artifacts/phase11b',{recursive:true});await writeFile('artifacts/phase11b/allocation.json',JSON.stringify(result,null,2));console.log(result);
