import {mkdir,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';import {execFileSync} from 'node:child_process';
import {createLargeCanvas,LargeCanvasEditor,encodeLargeProject,exportLargePng,exportLargeFrames} from '../packages/core/dist/index.js';
const out=resolve('artifacts/phase309-328');await mkdir(out,{recursive:true});const cases=[];let seed=309328;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed>>>8;};
for(let n=0;n<12;n++){
 const d=createLargeCanvas(65+n%3,65+n%3,'Independent '+n,n%3===0?[21,42,63,128]:[0,0,0,0]),e=new LargeCanvasEditor(d);
 for(let l=0;l<3;l++){if(l)e.addLayer();for(let j=0;j<8;j++)e.paint(rand()%d.width,rand()%d.height,[rand()%256,rand()%256,rand()%256,[0,1,128,255][rand()%4]]);e.paint(64,64,[l*80+1,7,90,[128,1,255][l]]);e.commit();e.layerProperties({opacity:[255,128,1][l]});if(n%4===0&&l===1)e.layerProperties({visible:false});}
 e.selectLayer('layer-1');e.addFrame();e.linkCel('frame-1');e.selectLayer('layer-3');e.paint(64,0,[200,0,80,128]);e.commit();e.frameDuration(220);if(n%2)e.geometry(d.width+2,d.height+1,1,1);
 const frames={};for(const f of d.frames){frames[f.id]=Array.from({length:d.height},(_,y)=>[...e.row(y,f.id)]).flat();await writeFile(resolve(out,`case-${n}-${f.id}.png`),Buffer.from(await(await exportLargePng(d,f.id)).arrayBuffer()));}
 await writeFile(resolve(out,`case-${n}.zip`),Buffer.from(await(await exportLargeFrames(d)).arrayBuffer()));cases.push({id:n,project:JSON.parse(encodeLargeProject(d)),frames});
}
await writeFile(resolve(out,'cases.json'),JSON.stringify(cases));const max=createLargeCanvas(10240,10240,'Maximum sparse'),e=new LargeCanvasEditor(max);e.paint(10239,10239,[12,34,56,255]);e.commit();await writeFile(resolve(out,'maximum.png'),Buffer.from(await(await exportLargePng(max)).arrayBuffer()));
const reports=execFileSync('python',['scripts/phase309-328-reference.py',out],{encoding:'utf8',windowsHide:true,maxBuffer:1024*1024}).trim().split(/\r?\n/).map(line=>JSON.parse(line));const report={status:'passed',fixtures:reports[0],downloads:reports[1]??null};await writeFile(resolve(out,'independent.json'),JSON.stringify(report,null,2));console.log('PASS '+JSON.stringify(report));
