import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createDocument,encodeProject} from '../packages/core/dist/index.js';
const publicDir='../glitchbong/public/ezpix/starters', catalogPath='../glitchbong/src/app/tools/ezpix/editor/starter-catalog.json';
const catalog=JSON.parse(await readFile(catalogPath,'utf8')).filter(s=>!s.id.startsWith('kenney-')).map(s=>({...s,category:s.frames>1?'Animation':'Studies'}));
const added=[];
for(const file of (await readdir('artifacts/issues4/starters')).sort()){
  const s=JSON.parse(await readFile('artifacts/issues4/starters/'+file,'utf8'));
  const doc=createDocument(s.width,s.height,s.name);
  doc.layers=s.layers.map((l,i)=>({...doc.layers[0],id:`layer-${i+1}`,name:l.name,cels:{[doc.activeFrameId]:new Uint8ClampedArray(l.pixels)}}));
  doc.activeLayerId=doc.layers.at(-1).id;
  const text=encodeProject(doc,false);await writeFile(`${publicDir}/${s.id}.ezpix`,text);
  added.push({id:s.id,name:s.name,description:s.description,category:s.category,width:s.width,height:s.height,layers:doc.layers.length,frames:1,bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex')});
}
await writeFile(catalogPath,JSON.stringify([...added,...catalog],null,2)+'\n');
console.log(`Wrote ${added.length} CC0 projects; ${catalog.length} original projects retained.`);
