import {createDocument,PixelEditor,encodeProject,composite} from '../packages/core/dist/index.js';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const out=resolve('artifacts/phase10a');await mkdir(out,{recursive:true});const docs=[];let seed=1717;const next=()=>{seed=(1664525*seed+1013904223)>>>0;return seed>>>24;};
for(let study=0;study<30;study++){const e=new PixelEditor(createDocument(4,3));for(let i=0;i<4;i++){if(i)e.addLayer();for(let y=0;y<3;y++)for(let x=0;x<4;x++)e.paint(x,y,[next(),next(),next(),next()]);e.commit();e.setLayerOpacity(next());if(i===1)e.createGroup();if(i===2)e.createGroup();}e.createGroup('group-1');e.setGroupProperties('group-1',{opacity:next(),visible:study%7!==0});e.setGroupProperties('group-2',{opacity:next()});e.setGroupProperties('group-3',{opacity:next()});e.addFrame(true);e.paint(0,0,[next(),next(),next(),next()]);e.commit();docs.push(e.document);}
const path=resolve(out,'reference-fixtures.json');await writeFile(path,'['+docs.map(d=>encodeProject(d,false)).join(',')+']');const reference=JSON.parse(execFileSync('python',['scripts/phase10a-reference.py',path],{encoding:'utf8',windowsHide:true}));for(let i=0;i<docs.length;i++)for(let f=0;f<2;f++)assert.deepEqual([...composite(docs[i],docs[i].frames[f].id)],reference[i][f],`study ${i}, frame ${f}`);
await writeFile(resolve(out,'independent-result.json'),JSON.stringify({status:'passed',documents:30,frames:60,checks:['independent Python Fraction compositor matches every RGBA byte for nested isolated groups, hidden groups, fractional opacity and multiple frames']},null,2));console.log('PASS independent rational group compositor: 30 documents / 60 frames');
