import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir,cp,readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { decodeProject } from '../packages/core/dist/index.js';
const port=Number(process.env.EZPIX_QA_PORT??3791),fixturePort=port+1,base=`http://localhost:${port}`;
const artifacts=resolve('artifacts/phase23');await mkdir(artifacts,{recursive:true});
const web=resolve('../glitchbong'), extension=resolve(artifacts,'extension-qa-'+Date.now());await cp('dist/extension-dev',extension,{recursive:true});
const manifest=JSON.parse(await readFile(resolve(extension,'manifest.json'),'utf8'));
// Keep production permissions; CDP triggers the real toolbar action to grant activeTab.
await writeFile(resolve(extension,'manifest.json'),JSON.stringify(manifest,null,2));
const fixture=createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><title>Original EzPix capture fixture</title><style>body{margin:0;background:rgb(20,30,50);height:1800px}#target{position:absolute;left:40px;top:80px;width:240px;height:160px;background:rgb(224,50,70)}#partial{position:absolute;left:-30px;top:300px;width:100px;height:100px;background:rgb(30,210,90)}</style></head><body><div id="target" aria-label="Red test rectangle"></div><div id="partial"></div></body></html>');});
await new Promise(r=>fixture.listen(fixturePort,'127.0.0.1',r));
const harness=process.env.EZPIX_QA_HARNESS==='1';
const server=spawn(process.execPath,harness?[resolve('scripts/editor-harness.mjs')]:[resolve(web,'node_modules/next/dist/bin/next'),'start','-p',String(port)],{cwd:harness?process.cwd():web,stdio:'ignore',windowsHide:true});
let context;
try {
  let ready=false;for(let i=0;i<90;i++){try{if((await fetch(base+'/tools/ezpix')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,'website starts');
  context=await chromium.launchPersistentContext(resolve(artifacts,'profile-'+Date.now()),{channel:'chromium',executablePath:process.env.EZPIX_CHROMIUM_PATH,headless:true,viewport:{width:960,height:720},deviceScaleFactor:2,args:['--enable-unsafe-extension-debugging',`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  console.log('Browser launched');context.setDefaultTimeout(15000);
  let worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');
  console.log('Extension worker loaded');
  const id=new URL(worker.url()).host, errors=[];
  context.on('page',p=>p.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR',e.message);}));
  const source=await context.newPage();await source.goto(`http://127.0.0.1:${fixturePort}`);
  const popup=await context.newPage();await popup.goto(`chrome-extension://${id}/popup.html`);
  const browserCDP=await context.browser().newBrowserCDPSession(),sourceCDP=await context.newCDPSession(source);
  const {targetInfos}=await browserCDP.send('Target.getTargets',{filter:[{type:'tab',exclude:false}]});

  const targetInfo=targetInfos.find(t=>t.url===source.url());if(!targetInfo)throw new Error('Capture fixture has no browser tab target.');
  async function start(mode){await source.bringToFront();await browserCDP.send('Extensions.triggerAction',{id,targetId:targetInfo.targetId});await source.bringToFront();const response=await popup.evaluate(mode=>chrome.runtime.sendMessage({type:'START',mode}),mode);assert.ok(!response.error,JSON.stringify(response));}
  async function capturedPage(action){const next=context.waitForEvent('page');await action();const p=await next;await p.waitForURL(/\/app.html$/);await p.waitForLoadState();await p.locator('[data-status]').filter({hasText:'Preview ready'}).waitFor({timeout:30000});return p;}
  console.log('Fixture loaded; starting region capture');
  await start('region');await source.locator('#ezpix-capture-overlay').waitFor();
  const app=await capturedPage(async()=>{await source.mouse.move(50,90);await source.mouse.down();await source.mouse.move(150,170,{steps:6});await source.mouse.up();});
  console.log('Region preview ready');
  const projectDownload=app.waitForEvent('download');await app.locator('[data-project]').click();const project=await projectDownload;await project.saveAs(resolve(artifacts,'region.ezpix'));
  const region=decodeProject(await readFile(resolve(artifacts,'region.ezpix'),'utf8'));
  await source.bringToFront();const fullDimensions=await worker.evaluate(async()=>{const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});const url=await chrome.tabs.captureVisibleTab(tab.windowId,{format:'png'});const b=Uint8Array.from(atob(url.split(',')[1]),c=>c.charCodeAt(0)),v=new DataView(b.buffer);return {width:v.getUint32(16),height:v.getUint32(20)};});await app.bringToFront();const viewport=await source.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio}));const sx=fullDimensions.width/viewport.width,sy=fullDimensions.height/viewport.height;assert.equal(viewport.dpr,2);
  assert.equal(region.conversion.source.width,Math.ceil(150*sx)-Math.floor(50*sx));assert.equal(region.conversion.source.height,Math.ceil(170*sy)-Math.floor(90*sy));
  const captured=region.conversion.source.pixels;for(let i=0;i<captured.length;i+=4)assert.deepEqual([...captured.slice(i,i+4)],[224,50,70,255],'capture is exact and overlay-free at DPR 2');
  await app.locator('[data-theme-picker]').selectOption('light');assert.equal(await app.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(246, 244, 251)');
  await app.locator('[data-field="palette"]').selectOption('neon');await app.locator('[data-status]').filter({hasText:'Preview ready'}).waitFor();
  await app.screenshot({path:resolve(artifacts,'extension-light.png'),fullPage:true});
  console.log('Starting website handoff');
  await app.locator('[data-apply]').click();await app.waitForFunction(()=>!document.querySelector('[data-handoff-status]').textContent.includes('Preparing a local handoff'));console.log('Handoff status:',await app.locator('[data-handoff-status]').innerText());
  // The toolbar action can create its own initially blank popup. Select by the
  // completed destination URL rather than accepting the first new page event.
  let website;for(let i=0;i<60&&!website;i++){website=context.pages().find(p=>p.url().startsWith(base+'/tools/ezpix'));if(!website)await new Promise(r=>setTimeout(r,250));}if(!website){console.log('Browser pages',context.pages().map(p=>p.url()));console.log('Chrome tabs',await worker.evaluate(()=>chrome.tabs.query({})));console.log('Targets',await browserCDP.send('Target.getTargets'));}assert.ok(website,'handoff opened the configured editor');await website.waitForLoadState();
  await website.getByRole('button',{name:'Receive extension artwork',exact:true}).waitFor();
  const hash=new URL(website.url()).hash,token=hash.split('.')[1], extensionId=hash.slice('#ezpix='.length).split('.')[0];
  const send=(page,msg)=>page.evaluate(({extensionId,msg})=>new Promise(resolve=>chrome.runtime.sendMessage(extensionId,msg,r=>{const error=chrome.runtime.lastError;resolve(error?{error:'runtime denied'}:r);})),{extensionId,msg});
  const wrongTab=await context.newPage();await wrongTab.goto(base+'/tools/ezpix');
  assert.ok((await send(wrongTab,{op:'manifest',protocol:1,token})).error,'wrong target tab rejected');await wrongTab.close();
  assert.ok((await send(website,{op:'manifest',protocol:1,token:'wrong'})).error,'wrong token rejected');
  const metadata=await send(website,{op:'manifest',protocol:1,token});assert.ok(metadata.sha256);assert.deepEqual(await send(website,{op:'manifest',protocol:1,token}),metadata,'manifest retry');
  console.log('Handoff bound; testing worker restart');
  // Stop the actual MV3 worker, then prove persisted transfer state wakes and resumes.
  const cdp=await context.newCDPSession(source);let versionId;
  cdp.on('ServiceWorker.workerVersionUpdated',({versions})=>{for(const v of versions)if(v.scriptURL===`chrome-extension://${id}/background.js`&&v.status!=='redundant')versionId=v.versionId;});
  await cdp.send('ServiceWorker.enable');for(let i=0;i<20&&!versionId;i++)await new Promise(r=>setTimeout(r,100));
  assert.ok(versionId,'extension worker version found');await cdp.send('ServiceWorker.stopWorker',{versionId});
  assert.deepEqual(await send(website,{op:'manifest',protocol:1,token}),metadata,'transfer survives real worker stop/restart');
  worker=context.serviceWorkers().find(w=>w.url().startsWith(`chrome-extension://${id}/`))??await context.waitForEvent('serviceworker');
  console.log('Transfer resumed; testing import preservation');
  const canvas=website.locator('.ez-canvas');await canvas.scrollIntoViewIfNeeded();const bounds=await canvas.boundingBox();await website.mouse.click(bounds.x+4,bounds.y+4);
  const current=await canvas.evaluate(c=>[...c.getContext('2d').getImageData(0,0,c.width,c.height).data]);
  await website.getByRole('button',{name:'Receive extension artwork',exact:true}).click();await website.getByRole('button',{name:'Import received artwork',exact:true}).waitFor();
  assert.deepEqual(await canvas.evaluate(c=>[...c.getContext('2d').getImageData(0,0,c.width,c.height).data]),current,'receiving does not replace art');
  website.once('dialog',d=>d.dismiss());await website.getByRole('button',{name:'Import received artwork',exact:true}).click();assert.deepEqual(await canvas.evaluate(c=>[...c.getContext('2d').getImageData(0,0,c.width,c.height).data]),current,'cancel import preserves edits');
  website.once('dialog',d=>d.accept());await website.getByRole('button',{name:'Import received artwork',exact:true}).click();await website.waitForFunction(()=>!location.hash);
  assert.equal((await send(website,{op:'ack',protocol:1,token,sha256:metadata.sha256})).status,'imported','ACK retry is idempotent');
  const save=website.waitForEvent('download');await website.getByRole('button',{name:'Download project',exact:true}).click();await(await save).saveAs(resolve(artifacts,'website-import.ezpix'));
  const imported=decodeProject(await readFile(resolve(artifacts,'website-import.ezpix'),'utf8'));assert.equal(imported.conversion.recipe.palette,'neon');assert.deepEqual(imported.conversion.source,region.conversion.source);
  const png=website.waitForEvent('download');await website.getByRole('button',{name:'Export',exact:true}).click();await website.getByRole('button',{name:'Export PNG',exact:true}).click();await(await png).saveAs(resolve(artifacts,'website-import.png'));
  await website.getByRole('button',{name:'Close Import & export'}).click();
  // Website upload / worker conversion, and source-retaining re-tune.
  await website.getByRole('button',{name:'Use dark theme'}).click();
  if(await website.getByRole('button',{name:'Application menu',exact:true}).isVisible())await website.getByRole('button',{name:'Application menu',exact:true}).click();await website.getByText('Image',{exact:true}).click();await website.getByRole('button',{name:'Re-tune source',exact:true}).click();await website.locator('[data-status]').filter({hasText:'Preview ready'}).waitFor();
  await website.locator('[data-field="palette"]').selectOption('pocket');await website.locator('[data-status]').filter({hasText:'Preview ready'}).waitFor();
  await website.screenshot({path:resolve(artifacts,'website-converter-dark.png'),fullPage:true});
  await website.locator('[data-cancel]').click();assert.ok(await website.locator('[data-apply]').isDisabled());
  await website.locator('[data-field="width"]').fill('32');await website.locator('[data-field="width"]').press('Tab');await website.locator('[data-status]').filter({hasText:'Preview ready'}).waitFor();
  await website.locator('[data-apply]').click();await website.locator('[data-converter]').count();await website.getByRole('status').filter({hasText:'Conversion applied'}).waitFor();assert.equal(await canvas.getAttribute('width'),'32');
  await start('element');
  const elementApp=await capturedPage(async()=>{await source.mouse.move(100,150);await source.mouse.click(100,150);});
  const elementDownload=elementApp.waitForEvent('download');await elementApp.locator('[data-project]').click();await(await elementDownload).saveAs(resolve(artifacts,'element.ezpix'));
  const element=decodeProject(await readFile(resolve(artifacts,'element.ezpix'),'utf8'));assert.equal(element.conversion.source.width,Math.ceil(280*sx)-Math.floor(40*sx));assert.equal(element.conversion.source.height,Math.ceil(240*sy)-Math.floor(80*sy));
  await start('region');await source.keyboard.press('Escape');await source.locator('#ezpix-capture-overlay').waitFor({state:'detached'});
  // Standalone local upload, malformed input and emulated-mobile layout.
  const mobile=await context.newPage();await mobile.setViewportSize({width:390,height:844});await mobile.goto(base+'/tools/ezpix');await mobile.getByRole('button',{name:'Use default canvas',exact:true}).click();await mobile.getByRole('button',{name:'Application menu',exact:true}).click();await mobile.getByText('Image',{exact:true}).click();await mobile.getByRole('button',{name:'Import & convert image',exact:true}).click();
  const fixturePNG=await source.evaluate(()=>{const c=document.createElement('canvas');c.width=16;c.height=16;const x=c.getContext('2d');x.fillStyle='#49bfff';x.fillRect(0,0,16,16);x.clearRect(0,0,4,4);return c.toDataURL().split(',')[1];});
  await mobile.locator('[data-file]').setInputFiles({name:'original.png',mimeType:'image/png',buffer:Buffer.from(fixturePNG,'base64')});await mobile.locator('[data-status]').filter({hasText:'Preview ready'}).waitFor();
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile converter no overflow');
  await mobile.screenshot({path:resolve(artifacts,'mobile-converter.png'),fullPage:true});
  await mobile.locator('[data-file]').setInputFiles({name:'bad.png',mimeType:'image/png',buffer:Buffer.from('invalid')});await mobile.locator('[data-status]').filter({hasText:'valid PNG or JPEG'}).waitFor();assert.ok(await mobile.locator('[data-apply]').isDisabled());
  assert.deepEqual(errors,[]);
  await writeFile(resolve(artifacts,'result.json'),JSON.stringify({status:'passed',browser:await context.browser().version(),fixtureOnlyHostGrant:false,toolbarActiveTabGrant:true,harness,checks:['real region/element capture, DPR 2, overlay-free pixel golden','selection cancel','extension light theme','shared worker tuning','real external-message handoff','wrong tab/token rejection','manifest retry','MV3 worker stop/restart','receive and cancelled import preserve edits','idempotent ACK','source/recipe/pixels project download','PNG export','website retained-source retune and cancellation','standalone upload and malformed PNG rejection','390px layout','no page exceptions']},null,2));
  console.log('PASS: Phase 2/3 browser and unpacked-extension checks. Real toolbar action granted activeTab; physical-device checks remain separate.');
}catch(error){console.error(error);if(context){for(const w of context.serviceWorkers()){try{console.log('DB state',await Promise.race([w.evaluate(async()=>{const db=await new Promise((r,j)=>{const q=indexedDB.open('ezpix-local',1);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});const get=key=>new Promise(r=>{const q=db.transaction('state').objectStore('state').get(key);q.onsuccess=()=>r(q.result);});const sel=await get('selection'),cap=await get('capture'),transfer=await get('transfer');db.close();return {selection:!!sel,capture:!!cap,error:cap?.error,blob:cap?.blob?.size,transfer:!!transfer,acked:transfer?.acked};}),new Promise(r=>setTimeout(()=>r('DB probe timeout'),2000))]));}catch{}}}if(context){for(const [index,page] of context.pages().entries()){try{await page.screenshot({path:resolve(artifacts,`failure-${index}.png`),timeout:2000});console.log('Page',index,(await page.locator('body').innerText({timeout:2000})).slice(0,1500));}catch{}}}process.exitCode=1;}finally{if(context)await Promise.race([context.close(),new Promise(r=>setTimeout(r,5000))]);server.kill();server.unref();fixture.closeAllConnections();await new Promise(r=>fixture.close(r));setTimeout(()=>process.exit(process.exitCode??0),1000).unref();}
