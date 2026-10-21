import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const path='artifacts/phase7a/soak/result.json',raw=JSON.parse(await readFile(path,'utf8'));assert.equal(raw.status,'passed');
// Correct the measurement description: ArrowRight moves the caret; it is not
// a width mutation or a measurement of paint completion.
raw.measurement='1024-square original fixture -> 64-square output; palette-setting rounds, ArrowRight in width control, source replacements and cancellation; a setting after source reset can already equal the requested value, so rounds are not exact conversion-job counts; CDP forced GC before samples; Windows process working sets/private bytes cover the isolated browser including its GPU process; aggregate working sets can double-count shared pages and do not measure VRAM; sampled maximum is not a true peak; sequential surfaces share browser';
const results={};
for(const [surface,r] of Object.entries(raw.results)){
  assert.ok(r.rounds>0&&r.samples.length>=2);const first=r.samples[0],last=r.samples.at(-1),mib=n=>Math.round(n/1048576*100)/100;
  results[surface]={durationSeconds:Math.round(r.durationMs/1000),rounds:r.rounds,replacements:r.replacements,cancels:r.cancels,previewReadyMs:r.previewReadyMs,keyToAnimationFrameMs:r.keyToAnimationFrameMs,memoryMiB:Object.fromEntries(['postGCHeapUsedBytes','workingSetBytes','privateBytes'].map(k=>[k,{first:mib(first[k]),last:mib(last[k]),sampledMax:mib(Math.max(...r.samples.map(s=>s[k]))),delta:mib(last[k]-first[k])}]))};
}
await writeFile(path,JSON.stringify(raw,null,2));const summary={cpu:raw.cpu,totalRAMGiB:raw.totalRAMBytes/1073741824,browser:raw.browser,results};await writeFile('artifacts/phase7a/soak/summary.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
