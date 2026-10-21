import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {decodeProject} from '../packages/core/dist/index.js';
const out=resolve('artifacts/phase7a/capture');await mkdir(out,{recursive:true});
const fixture=createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(req.url==='/frame'?'<body style="margin:0;background:rgb(30,210,90)">':`<!doctype html><style>body{margin:0;height:2400px;background:rgb(20,30,50)}#target{position:absolute;left:40px;top:680px;width:240px;height:160px;background:rgb(224,50,70)}iframe{position:absolute;left:330px;top:680px;width:240px;height:120px;border:0}</style><div id="target"></div><iframe src="http://localhost:3793/frame"></iframe>`);});
await new Promise(r=>fixture.listen(3793,'0.0.0.0',r));let context;const cases=[];
try{
  const extension=resolve('dist/extension-dev');
  context=await chromium.launchPersistentContext(resolve(out,'profile-'+Date.now()),{channel:'chromium',executablePath:process.env.EZPIX_CHROMIUM_PATH,headless:true,viewport:{width:960,height:720},deviceScaleFactor:2,args:['--enable-unsafe-extension-debugging',`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});context.setDefaultTimeout(10000);
  const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host;
  const source=await context.newPage();await source.goto('http://127.0.0.1:3793');const popup=await context.newPage();await popup.goto(`chrome-extension://${id}/popup.html`);
  const cdp=await context.browser().newBrowserCDPSession();const {targetInfos}=await cdp.send('Target.getTargets',{filter:[{type:'tab',exclude:false}]});const targetId=targetInfos.find(t=>t.url===source.url()).targetId;
  async function start(mode){await source.waitForTimeout(650);await source.bringToFront();await cdp.send('Extensions.triggerAction',{id,targetId});await source.bringToFront();return popup.evaluate(mode=>chrome.runtime.sendMessage({type:'START',mode}),mode);}
  async function downloadSelection(name,act,color,cssRect){
    // Toolbar activation can create its own blank popup target. Select the new
    // converter by its actual URL, rather than assuming the first page event.
    const before=new Set(context.pages());await act();let app;
    for(let i=0;i<150&&!app;i++){app=context.pages().find(p=>!before.has(p)&&p.url()===`chrome-extension://${id}/app.html`);if(!app)await new Promise(r=>setTimeout(r,100));}
    assert.ok(app,name+' opens converter');try{await app.locator('[data-status]').filter({hasText:'Preview ready'}).waitFor({timeout:30000});}catch(error){console.error(name,await app.locator('body').innerText());throw error;}
    const saved=app.waitForEvent('download');await app.locator('[data-project]').click();const path=resolve(out,name+'.ezpix');await(await saved).saveAs(path);const doc=decodeProject(await readFile(path,'utf8')),r=doc.conversion.source;
    const metrics=await source.evaluate(()=>({w:innerWidth,h:innerHeight,dpr:devicePixelRatio,scrollY}));
    // Actual screenshot dimensions, independently read from the browser capture API.
    await source.waitForTimeout(650);await source.bringToFront();const size=await worker.evaluate(async()=>{const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});const url=await chrome.tabs.captureVisibleTab(tab.windowId,{format:'png'});const b=Uint8Array.from(atob(url.split(',')[1]),c=>c.charCodeAt(0)),v=new DataView(b.buffer);return {w:v.getUint32(16),h:v.getUint32(20)};});
    if(cssRect){const sx=size.w/metrics.w,sy=size.h/metrics.h;assert.equal(r.width,Math.ceil((cssRect.x+cssRect.width)*sx)-Math.floor(cssRect.x*sx));assert.equal(r.height,Math.ceil((cssRect.y+cssRect.height)*sy)-Math.floor(cssRect.y*sy));}
    if(color)for(let i=0;i<r.pixels.length;i+=4)assert.deepEqual([...r.pixels.subarray(i,i+4)],color,name+' exact captured pixels');
    cases.push({name,metrics,screenshot:size,crop:{width:r.width,height:r.height},exactPixelCheck:!!color});await app.close();
  }
  for(const zoom of [.8,1,1.25,1.5]){
    await source.bringToFront();await worker.evaluate(async({targetId,zoom})=>{const tabs=await chrome.tabs.query({active:true,lastFocusedWindow:true});await chrome.tabs.setZoom(tabs[0].id,zoom);},{targetId,zoom});
    await source.evaluate(()=>scrollTo(0,600));await source.waitForTimeout(200);
    const rect=await source.locator('#target').boundingBox();assert.ok(!(await start('element')).error);
    await downloadSelection('scrolled-zoom-'+zoom,async()=>{await source.mouse.move(rect.x+20,rect.y+20);await source.mouse.click(rect.x+20,rect.y+20);},[224,50,70,255],rect);
  }
  await source.bringToFront();await worker.evaluate(async()=>{const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});await chrome.tabs.setZoom(tab.id,1);});await source.evaluate(()=>scrollTo(0,600));await source.waitForTimeout(200);
  const frame=await source.locator('iframe').boundingBox();assert.ok(!(await start('element')).error);
  await downloadSelection('cross-origin-iframe-element',async()=>{await source.mouse.move(frame.x+20,frame.y+20);await source.mouse.click(frame.x+20,frame.y+20);},[30,210,90,255],frame);
  assert.ok(!(await start('region')).error);
  await downloadSelection('cross-origin-iframe-region',async()=>{await source.mouse.move(frame.x+10,frame.y+10);await source.mouse.down();await source.mouse.move(frame.x+110,frame.y+60,{steps:6});await source.mouse.up();},[30,210,90,255],{x:frame.x+10,y:frame.y+10,width:100,height:50});
  await source.evaluate(()=>scrollTo(0,720));const partial=await source.locator('#target').boundingBox();assert.ok(partial.y<0);assert.ok(!(await start('element')).error);
  await downloadSelection('partially-scrolled-element',async()=>{await source.mouse.move(partial.x+20,20);await source.mouse.click(partial.x+20,20);},[224,50,70,255],{x:partial.x,y:0,width:partial.width,height:partial.y+partial.height});
  const viewport=await source.evaluate(()=>({x:0,y:0,width:innerWidth,height:innerHeight}));
  await downloadSelection('visible-viewport',async()=>{assert.ok(!(await start('visible')).error);},null,viewport);
  // Navigation invalidates the pending injected selector and its document binding.
  assert.ok(!(await start('region')).error);await source.goto('http://127.0.0.1:3793/?new-document');assert.equal(await source.locator('#ezpix-capture-overlay').count(),0);assert.ok(!(await start('region')).error);await source.keyboard.press('Escape');await source.locator('#ezpix-capture-overlay').waitFor({state:'detached'});cases.push({name:'navigate-while-selecting-then-restart-and-Escape'});
  await source.goto('chrome://version');const restricted=await start('region');assert.ok(restricted.error,'restricted browser page rejected');assert.match(restricted.error,/normal HTTP or HTTPS/);cases.push({name:'restricted-browser-page-rejected',message:restricted.error});
  await writeFile(resolve(out,'result.json'),JSON.stringify({status:'passed',browser:context.browser().version(),cases},null,2));console.log('PASS: zoom, scroll, cross-origin iframe, navigation and restricted-page capture matrix');
}finally{await context?.close();fixture.closeAllConnections();await new Promise(r=>fixture.close(r));}
