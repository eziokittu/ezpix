// Bounded repeated-use measurement, original generated fixture only.
import {chromium} from 'playwright';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {cpus,totalmem} from 'node:os';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const exec=promisify(execFile),web=resolve('../glitchbong'),out=resolve('artifacts/phase7a/soak'),base='http://localhost:3791';await mkdir(out,{recursive:true});
const duration=Number(process.env.EZPIX_SOAK_MS??300000);assert.ok(Number.isFinite(duration)&&duration>=10000&&duration<=3600000);
const server=spawn(process.execPath,[resolve(web,'node_modules/next/dist/bin/next'),'start','-p','3791'],{cwd:web,stdio:'ignore',windowsHide:true});let context;
const quantile=(a,q)=>[...a].sort((a,b)=>a-b)[Math.min(a.length-1,Math.ceil(a.length*q)-1)];
try{
  let ready=false;for(let i=0;i<90;i++){try{if((await fetch(base+'/tools/ezpix/editor')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready);
  const extension=resolve('dist/extension-dev');context=await chromium.launchPersistentContext(resolve(out,'profile-'+Date.now()),{channel:'chromium',executablePath:process.env.EZPIX_CHROMIUM_PATH,headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  const browserCDP=await context.browser().newBrowserCDPSession(),worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host;
  const extensionBuildVersion=await worker.evaluate(()=>chrome.runtime.getManifest().version),results={};
  for(const surface of ['website','extension']){
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(surface==='website'?base+'/tools/ezpix/editor':`chrome-extension://${id}/app.html`);if(surface==='website')await page.getByRole('button',{name:'Convert image',exact:true}).click();
    const png=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=1024;const x=c.getContext('2d'),d=x.createImageData(1024,1024);for(let i=0;i<d.data.length;i+=4){d.data[i]=i/4%251;d.data[i+1]=Math.floor(i/4096)%239;d.data[i+2]=i/4*17%256;d.data[i+3]=255;}x.putImageData(d,0,0);return c.toDataURL().split(',')[1];}),'base64');
    const upload=()=>page.locator('[data-file]').setInputFiles({name:'original-soak.png',mimeType:'image/png',buffer:png});
    const ready=()=>page.waitForFunction(()=>document.querySelector('[data-status]').textContent.includes('Preview ready'));
    await upload();await ready();await page.locator('[data-field="palette"]').selectOption('adaptive');await ready();
    const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
    const samples=[],latency=[],input=[],start=performance.now();let rounds=0,replacements=0,cancels=0;
    async function sample(){
      await cdp.send('HeapProfiler.collectGarbage');const metrics=(await cdp.send('Performance.getMetrics')).metrics;
      const processes=(await browserCDP.send('SystemInfo.getProcessInfo')).processInfo;
      const ids=processes.map(p=>p.id).filter(Number.isInteger);assert.ok(ids.length);
      const {stdout}=await exec('powershell.exe',['-NoProfile','-Command',`Get-Process -Id ${ids.join(',')} -ErrorAction SilentlyContinue | Select-Object Id,WorkingSet64,PrivateMemorySize64,PeakWorkingSet64 | ConvertTo-Json -Compress`],{windowsHide:true});
      const raw=JSON.parse(stdout),memory=Array.isArray(raw)?raw:[raw];
      samples.push({elapsedMs:performance.now()-start,rounds,postGCHeapUsedBytes:metrics.find(m=>m.name==='JSHeapUsedSize').value,workingSetBytes:memory.reduce((s,p)=>s+p.WorkingSet64,0),privateBytes:memory.reduce((s,p)=>s+p.PrivateMemorySize64,0),processes:memory});
    }
    await sample();
    while(performance.now()-start<duration){
      const t=performance.now();await page.locator('[data-field="colors"]').fill(String([8,16,24,32,48,64][rounds%6]));await page.locator('[data-field="colors"]').press('Tab');await ready();latency.push(performance.now()-t);
      // Real keyboard delivery to the next RAF, not an end-to-end paint metric.
      await page.locator('[data-field="width"]').focus();await page.evaluate(()=>{window.__nextInput=null;document.querySelector('[data-field="width"]').addEventListener('keydown',e=>{const t=e.timeStamp;requestAnimationFrame(()=>window.__nextInput=performance.now()-t);},{once:true});});await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>window.__nextInput!==null);input.push(await page.evaluate(()=>window.__nextInput));await ready();
      rounds++;
      if(rounds%17===0){await page.locator('[data-cancel]').click();assert.ok(await page.locator('[data-apply]').isDisabled());await page.locator('[data-field="colors"]').fill('12');await page.locator('[data-field="colors"]').press('Tab');await ready();cancels++;}
      if(rounds%25===0){await upload();await ready();await page.locator('[data-field="palette"]').selectOption('adaptive');await ready();replacements++;}
      if(rounds%40===0){await sample();console.log(surface,rounds,'rounds',Math.round((performance.now()-start)/1000)+'s');}
    }
    await sample();assert.deepEqual(errors,[]);results[surface]={durationMs:performance.now()-start,rounds,replacements,cancels,previewReadyMs:{median:quantile(latency,.5),p95:quantile(latency,.95),first40Median:quantile(latency.slice(0,40),.5),last40Median:quantile(latency.slice(-40),.5)},keyToAnimationFrameMs:{median:quantile(input,.5),p95:quantile(input,.95)},samples};
    await page.close();await writeFile(resolve(out,'result.json'),JSON.stringify({status:surface==='extension'?'passed':'running',cpu:cpus()[0].model,totalRAMBytes:totalmem(),browser:context.browser().version(),extensionBuildVersion,node:process.version,measurement:'1MP fixture; palette-setting rounds, ArrowRight in width control, source replacement and cancellation; some settings after source reset can already equal the requested value; CDP forced GC before samples; Windows process working sets/private bytes include entire isolated browser and GPU, not just page JS; sampled maximum is not a true peak; sequential surfaces share browser',results},null,2));
  }
  console.log('PASS: repeated conversion/cancellation/replacement soak');
}finally{await context?.close();server.kill();}
