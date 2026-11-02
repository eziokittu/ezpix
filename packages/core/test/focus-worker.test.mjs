import test from 'node:test';
import assert from 'node:assert/strict';
import {createConversionProcessor} from '../dist/worker.js';
import {defaultRecipe,decodeProject,composite} from '../dist/index.js';
const frame=(red)=>({width:3,height:2,pixels:Uint8ClampedArray.from({length:24},(_,i)=>i%4===0?red:i%4===3?255:0)});
const options={rect:{x:0,y:0,width:3,height:2},method:'crop',tolerance:0};
test('idle focus worker reuses loaded frames and produces the same adjusted cutout',()=>{
 const source=frame(80),process=createConversionProcessor(),recipe={...defaultRecipe(source),width:3,height:2,palette:'original'};
 const request={recipe,focus:{frames:[source],options,fps:4,track:false}};
 process(request);
 const adjusted={...options,mask:Uint8Array.from([1,0,1,0,1,0]),adjustments:{brightness:20}};
 const cached=process({recipe,focus:{options:adjusted,fps:4,track:false}});
 const fresh=createConversionProcessor()({...request,focus:{...request.focus,options:adjusted}});
 assert.deepEqual(composite(decodeProject(cached.project)),composite(decodeProject(fresh.project)));
});
test('replacement frames replace cached media; invalid replacement cannot poison successful cache',()=>{
 const process=createConversionProcessor(),source=frame(80),recipe={...defaultRecipe(source),width:3,height:2,palette:'original'},focus={options,fps:4,track:false};
 assert.throws(()=>process({recipe,focus}),/Load focus frames/);
 process({recipe,focus:{...focus,frames:[source]}});
 assert.throws(()=>process({recipe,focus:{...focus,frames:[]}}));
 assert.equal(composite(decodeProject(process({recipe,focus}).project))[0],80);
 process({recipe,focus:{...focus,frames:[frame(160)]}});
 assert.equal(composite(decodeProject(process({recipe,focus}).project))[0],160);
 const other=createConversionProcessor();assert.throws(()=>other({recipe,focus}),/Load focus frames/);
});
