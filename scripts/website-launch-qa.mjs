// Real website launch -> Chrome action popup, without a toolbar permission grant.
import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {encodeNativePng} from '../packages/core/dist/native-png.js';
const out=resolve('artifacts/website-launch');await mkdir(out,{recursive:true});
const base=new URL(process.env.EZPIX_QA_WEBSITE??'http://localhost:3791').origin;
const executablePath=process.env.EZPIX_CHROMIUM_PATH??process.env.LOCALAPPDATA+'/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const checks=[],errors=[];let popup;
const check=name=>{checks.push(name);console.log('PASS',name);};
async function until(fn){for(let i=0;i<250;i++){const result=await fn();if(result)return result;await new Promise(done=>setTimeout(done,40));}throw Error('Timed out waiting for popup state.');}
async function create(page,width=8,height=8){await page.goto(base+'/tools/ezpix');const dialog=page.getByRole('dialog',{name:'New project',exact:true});await dialog.waitFor();await page.getByLabel('Canvas width',{exact:true}).fill(String(width));await page.getByLabel('Canvas height',{exact:true}).fill(String(height));await dialog.getByRole('button',{name:'Create sprite',exact:true}).click();await dialog.waitFor({state:'hidden'});}
const browser=await chromium.launch({headless:true,executablePath});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));await create(page);
 const install=page.locator('a.ez-insta-launch');await install.waitFor();assert.equal(await page.getByText('Focus studio',{exact:true}).count(),0);assert.match(await install.getAttribute('href'),/chromewebstore\.google\.com\/detail\/ezpix-insta\/eijjjhokfogdfcnednolghbegpddneci$/);assert.equal(await install.getAttribute('target'),'_blank');
 await page.route('https://chromewebstore.google.com/**',route=>route.fulfill({contentType:'text/html',body:'Store navigation fixture'}));const opened=page.waitForEvent('popup');await install.click();const store=await opened;await store.waitForLoadState();assert.match(store.url(),/chromewebstore.google.com/);await store.close();assert.equal(new URL(page.url()).pathname,'/tools/ezpix');check('without an extension the button opens its store listing and leaves website artwork in place');
 await page.screenshot({path:resolve(out,'install-desktop.png')});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth));await page.screenshot({path:resolve(out,'install-mobile.png')});check('the replacement action fits the mobile header');
 for(const mode of ['legacy','failure']){
  const context=await browser.newContext();await context.addInitScript(mode=>{const runtime={sendMessage:(_id,message,reply)=>setTimeout(()=>reply(message.op==='discover'?{protocol:1,status:'available',openPopup:mode!=='legacy'}:{error:'Cannot open popup'}),0)};window.chrome??={};Object.defineProperty(window.chrome,'runtime',{value:runtime,configurable:true});},mode);
  const p=await context.newPage();await create(p);
  if(mode==='legacy'){await p.locator('a.ez-insta-launch').waitFor();assert.match(await p.locator('a.ez-insta-launch').getAttribute('title'),/Update EzPIX Insta/);}
  else{const button=p.getByRole('button',{name:'EzPIX Insta',exact:true});await button.waitFor({state:'visible'});await until(()=>button.isEnabled());await button.click();await p.getByRole('alert').filter({hasText:'Could not open EzPIX Insta'}).waitFor();assert.equal(context.pages().length,1);}
  await context.close();
 }
 check('older extensions get update guidance; popup failures keep artwork in place with a toolbar fallback');
 await page.close();
}finally{await browser.close();}
const ext=resolve('dist/extension-dev');
const ctx=await chromium.launchPersistentContext(resolve(out,'profile-'+Date.now()),{headless:true,executablePath,viewport:null,args:['--screen-info={1920x1080}','--window-size=1280,900','--enable-unsafe-extension-debugging',`--disable-extensions-except=${ext}`,`--load-extension=${ext}`]});
try{
 const worker=ctx.serviceWorkers()[0]??await ctx.waitForEvent('serviceworker'),id=new URL(worker.url()).host;
 const source=await ctx.newPage();source.on('pageerror',e=>errors.push(e.message));await create(source);await source.bringToFront();
 const cdp=await ctx.browser().newBrowserCDPSession();
 const targets=async()=> (await cdp.send('Target.getTargets')).targetInfos;
 const popupTarget=async()=> (await targets()).find(t=>t.url===`chrome-extension://${id}/app.html`);
 async function attach(){
  const target=await until(popupTarget),{sessionId}=await cdp.send('Target.attachToTarget',{targetId:target.targetId,flatten:false});
  let sequence=0;const pending=new Map();
  const listener=event=>{if(event.sessionId!==sessionId)return;const message=JSON.parse(event.message);if(message.id){const item=pending.get(message.id);if(item){pending.delete(message.id);message.error?item.reject(Error(JSON.stringify(message.error))):item.resolve(message.result);}}else if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text);};
  cdp.on('Target.receivedMessageFromTarget',listener);
  const detached=event=>{if(event.sessionId!==sessionId)return;cdp.off('Target.receivedMessageFromTarget',listener);cdp.off('Target.detachedFromTarget',detached);for(const item of pending.values())item.reject(Error('Popup closed.'));pending.clear();};cdp.on('Target.detachedFromTarget',detached);
  const send=async(method,params={})=>{const requestId=++sequence;let timeout;const promise=new Promise((resolve,reject)=>{timeout=setTimeout(()=>{pending.delete(requestId);reject(Error('Popup CDP timeout: '+method));},15000);pending.set(requestId,{resolve,reject});});try{await cdp.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id:requestId,method,params})});return await promise;}finally{clearTimeout(timeout);}};
  const evaluate=async(fn,arg)=>{const response=await send('Runtime.evaluate',{expression:`(${fn})(${JSON.stringify(arg)??''})`,returnByValue:true,awaitPromise:true,userGesture:true});if(response.exceptionDetails)throw Error(response.exceptionDetails.exception?.description??response.exceptionDetails.text);return response.result.value;};
  await send('Runtime.enable');await until(()=>evaluate(()=>!!document.querySelector('[data-focus-file]')));
  popup={send,evaluate,click:selector=>evaluate(s=>document.querySelector(s).click(),selector),value:(selector,value)=>evaluate(([s,v])=>{const el=document.querySelector(s);el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},[selector,value]),shot:async name=>writeFile(resolve(out,name+'.png'),Buffer.from((await send('Page.captureScreenshot')).data,'base64'))};
 }

 const request=(page,op)=>page.evaluate(({id,op})=>new Promise(resolve=>chrome.runtime.sendMessage(id,{protocol:1,op},reply=>{const error=chrome.runtime.lastError;resolve(reply??{error:error?.message});})),{id,op});
 const launch=source.getByRole('button',{name:'EzPIX Insta',exact:true});await until(()=>launch.isEnabled());
 const originalTabs=(await worker.evaluate(()=>chrome.tabs.query({}))).map(t=>t.id),originalWindows=(await worker.evaluate(()=>chrome.windows.getAll())).map(w=>w.id);
 assert.equal(await popupTarget(),undefined);await source.waitForTimeout(150);assert.equal(await popupTarget(),undefined);check('discovery does not open a popup automatically');
 await launch.click();await attach();await until(()=>popup.evaluate(()=>!document.querySelector('[data-focus-file]').disabled));
 assert.equal(await popup.evaluate(()=>document.body.dataset.studioMode),'compact');assert.equal(await popup.evaluate(()=>[...document.querySelectorAll('[data-mode]')].every(el=>el.disabled)),true);assert.match(await popup.evaluate(()=>document.querySelector('[data-handoff-status]').textContent),/pinned EzPIX Insta toolbar icon/);assert.notEqual(await popup.evaluate(()=>document.querySelector('[data-handoff-status]').dataset.level),'error');await popup.shot('website-open-chooser');
 assert.deepEqual((await worker.evaluate(()=>chrome.tabs.query({}))).map(t=>t.id),originalTabs);assert.deepEqual((await worker.evaluate(()=>chrome.windows.getAll())).map(w=>w.id),originalWindows);check('the website button opens the real anchored toolbar popup with no extra tabs/windows and no false capture error');
 const pixels=new Uint8ClampedArray(8*8*4);for(let i=0;i<pixels.length;i+=4)pixels.set([20,110,190,255],i);const file=resolve(out,'synthetic.png');await writeFile(file,await encodeNativePng(8,8,pixels));const {root}=await popup.send('DOM.getDocument');const {nodeId}=await popup.send('DOM.querySelector',{nodeId:root.nodeId,selector:'[data-focus-file]'});await popup.send('DOM.setFileInputFiles',{nodeId,files:[file]});await until(()=>popup.evaluate(()=>!document.querySelector('[data-focus-download]').disabled));assert.equal(await popup.evaluate(()=>document.body.dataset.studioMode),'media');assert.equal(await popup.evaluate(()=>document.querySelector('[data-focus-source]').width),8);await popup.shot('website-open-media');check('local media and conversion are usable immediately in the website-opened extension');
 async function closePopup(){await popup.evaluate(()=>{setTimeout(()=>window.close(),0);});await until(async()=>!await popupTarget());}
 for(const selector of ['[data-focus-camera]','[data-focus-screen]']){
  await popup.click(selector);const media=await until(()=>ctx.pages().find(p=>p.url()===`chrome-extension://${id}/media.html`));await media.locator('[data-start]:not([disabled])').waitFor();await until(async()=>!await popupTarget());await media.locator('[data-cancel]').click();await until(()=>media.isClosed());await attach();await until(()=>popup.evaluate(()=>!document.querySelector('[data-focus-download]').disabled));assert.equal(await popup.evaluate(()=>document.querySelector('[data-focus-source]').width),8);assert.equal(await popup.evaluate(()=>[...document.querySelectorAll('[data-mode]')].every(el=>el.disabled)),true);
 }
 assert.deepEqual((await worker.evaluate(()=>chrome.tabs.query({}))).map(t=>t.id),originalTabs);check('website-opened camera/screen capture tabs cancel back to the existing media without page access or leaked tabs');

 await closePopup();await source.bringToFront();const tabs=await cdp.send('Target.getTargets',{filter:[{type:'tab',exclude:false}]});await cdp.send('Extensions.triggerAction',{id,targetId:tabs.targetInfos.find(t=>t.url===source.url()).targetId});await attach();await until(()=>popup.evaluate(()=>!document.querySelector('[data-focus-download]').disabled));assert.ok(await popup.evaluate(()=>document.querySelector('[data-focus-source]').width>8));check('a normal toolbar click still grants access and automatically captures the visible page');
 await closePopup();await launch.click();await attach();await until(()=>popup.evaluate(()=>!document.querySelector('[data-focus-download]').disabled));assert.equal(await popup.evaluate(()=>document.body.dataset.studioMode),'media');await closePopup();check('website launch also captures normally when Chrome has already granted page access');
 const other=await ctx.newPage();await other.goto(base+'/tools/ezpix/help');await other.bringToFront();assert.ok((await request(source,'open-popup')).error);assert.equal(await popupTarget(),undefined);await other.close();await source.bringToFront();
 await source.goto(base+'/tools/ezpix/privacy');assert.ok((await request(source,'open-popup')).error);assert.equal(await popupTarget(),undefined);
 await source.goto(base+'/tools/ezpix/help');const framed=await source.request.get(base+'/tools/ezpix/help');assert.equal(framed.headers()['x-frame-options'],'DENY');assert.match(framed.headers()['content-security-policy'],/frame-ancestors 'none'/);assert.equal(await popupTarget(),undefined);check('inactive tabs and disallowed paths cannot open the popup; EzPix pages disallow framing');
 await source.goto(base+'/tools/ezpix/extension');await until(()=>source.getByRole('button',{name:'EzPIX Insta',exact:true}).isEnabled());await source.getByRole('button',{name:'EzPIX Insta',exact:true}).click();await attach();await until(()=>popup.evaluate(()=>!document.querySelector('[data-focus-file]').disabled));await closePopup();check('the extension overview also launches the same toolbar popup');
 await create(source,512,512);await until(()=>source.getByRole('button',{name:'EzPIX Insta',exact:true}).isEnabled());assert.equal(await source.getByText('Focus studio',{exact:true}).count(),0);await source.getByRole('button',{name:'EzPIX Insta',exact:true}).click();await attach();await until(()=>popup.evaluate(()=>!document.querySelector('[data-focus-file]').disabled));await closePopup();await source.screenshot({path:resolve(out,'tiled-launch.png')});check('the large tiled workspace uses the same extension action');
 assert.deepEqual(errors,[]);await writeFile(resolve(out,'result.json'),JSON.stringify({version:JSON.parse(await readFile('extension/manifest.json')).version,browser:ctx.browser().version(),checks,errors},null,2));
}catch(error){await popup?.shot('failure').catch(()=>{});throw error;}finally{await ctx.close();}
