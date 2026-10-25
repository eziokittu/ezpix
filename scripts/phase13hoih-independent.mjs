import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';import assert from 'node:assert/strict';
import {decodeAseprite,encodeAseprite,encodeProject,validateIndexedDocument,ENGINE_VERSION} from '../packages/core/dist/index.js';
const run=args=>{const r=spawnSync('python',['-X','utf8','scripts/phase13hoih-readers.py',...args],{stdio:'inherit',windowsHide:true});assert.equal(r.status,0);};
run(['--generate']);const out='artifacts/phase13hoih-independent',cases=JSON.parse(await readFile(out+'/cases.json','utf8'));let checks=0;
for(const c of cases){const {document:d,warnings}=await decodeAseprite(new Uint8Array(await readFile(out+'/'+c.file)),'Original fixture');assert.deepEqual(warnings,[]);assert.equal(d.layers[0].opacity,c.opacity);assert.equal(d.layers[0].locked,c.locked);assert.equal(d.tags[0].mode,c.mode);assert.equal(d.slices[0].pivotX,-3);checks+=5;
 if(c.depth===8){validateIndexedDocument(d);assert.deepEqual(d.indexed.palette,c.palette);assert.equal(d.indexed.transparentIndex,c.transparent);for(let f=0;f<3;f++)assert.deepEqual([...d.indexed.cels['layer-1'][`frame-${f+1}`]],c.planes[f]);assert.equal(d.indexed.cels['layer-1']['frame-1'],d.indexed.cels['layer-1']['frame-2']);checks+=6;}
 else{for(let f=0;f<3;f++)assert.deepEqual([...d.layers[0].cels[`frame-${f+1}`]],c.planes[f]);checks+=3;}
 assert.equal(d.layers[0].cels['frame-1'],d.layers[0].cels['frame-2']);checks++;
 await writeFile(out+'/'+c.file+'.ezpix',encodeProject(d));await writeFile(out+'/export-'+c.file,encodeAseprite(d));}
await writeFile(out+'/fixture.ezpix',await readFile(out+'/'+cases[0].file+'.ezpix'));run([]);const result=JSON.parse(await readFile(out+'/result.json','utf8'));await writeFile(out+'/result.json',JSON.stringify({...result,version:ENGINE_VERSION,coreImportChecks:checks,totalChecks:checks+result.checks},null,2));console.log('PASS independent Aseprite',checks+result.checks);
