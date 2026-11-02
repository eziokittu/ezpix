// Exercise actual action popups. Chrome does not expose these as Playwright pages.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {encodeNativePng} from '../packages/core/dist/native-png.js';
import {decodeProject,composite,ENGINE_VERSION} from '../packages/core/dist/index.js';
const small=process.env.EZPIX_QA_SCREEN==='800x600',expectedWidth=small?776:780,expectedHeight=small?490:580;
const out=resolve('artifacts/popup-performance/'+(process.env.EZPIX_PERF_LABEL??'current'));await mkdir(out,{recursive:true});
const ext=resolve(process.env.EZPIX_PERF_EXTENSION??'dist/extension');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><body style="margin:0;background:#eee"><div id="subject" style="position:absolute;left:100px;top:100px;width:100px;height:100px;background:rgb(180,20,30)"></div></body>');});await new Promise(done=>server.listen(3792,'127.0.0.1',done));
const ctx=await chromium.launchPersistentContext(resolve(out,'profile-'+Date.now()),{channel:'chromium',executablePath:process.env.EZPIX_CHROMIUM_PATH,headless:true,viewport:null,acceptDownloads:true,args:[`--screen-info={${process.env.EZPIX_QA_SCREEN??'1920x1080'}}`,'--window-size=1280,900','--enable-unsafe-extension-debugging',...(process.env.EZPIX_QA_MEDIA?['--use-fake-device-for-media-stream']:[]),`--disable-extensions-except=${ext}`,`--load-extension=${ext}`]});
const checks=[],errors=[];let popup;
const check=name=>{checks.push(name);console.log('PASS',name);};
async function until(fn){for(let i=0;i<250;i++){const result=await fn();if(result)return result;await new Promise(done=>setTimeout(done,40));}throw Error('Timed out waiting for popup state.');}
try{
 const worker=ctx.serviceWorkers()[0]??await ctx.waitForEvent('serviceworker'),id=new URL(worker.url()).host;
 const source=await ctx.newPage();await source.goto('http://127.0.0.1:3792');await source.bringToFront();
 const cdp=await ctx.browser().newBrowserCDPSession();
 await cdp.send('Browser.setDownloadBehavior',{behavior:'allowAndName',downloadPath:out,eventsEnabled:true});
 const targets=async()=> (await cdp.send('Target.getTargets')).targetInfos;
 const popupTarget=async()=> (await targets()).find(t=>t.url===`chrome-extension://${id}/app.html`);
 async function attach(){
  const target=await until(popupTarget),{sessionId}=await cdp.send('Target.attachToTarget',{targetId:target.targetId,flatten:false});
  let sequence=0;const pending=new Map();
  const listener=event=>{if(event.sessionId!==sessionId)return;const message=JSON.parse(event.message);if(message.id){const item=pending.get(message.id);if(item){pending.delete(message.id);message.error?item.reject(Error(JSON.stringify(message.error))):item.resolve(message.result);}}else if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description??message.params.exceptionDetails.text);};
  cdp.on('Target.receivedMessageFromTarget',listener);
  const detached=event=>{if(event.sessionId!==sessionId)return;cdp.off('Target.receivedMessageFromTarget',listener);cdp.off('Target.detachedFromTarget',detached);for(const item of pending.values())item.reject(Error('Popup closed.'));pending.clear();};cdp.on('Target.detachedFromTarget',detached);
  const send=async(method,params={})=>{const requestId=++sequence;let timeout;const promise=new Promise((resolve,reject)=>{timeout=setTimeout(()=>{pending.delete(requestId);reject(Error('Popup CDP timeout: '+method));},15000);pending.set(requestId,{resolve,reject});});try{await cdp.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id:requestId,method,params})});return await promise;}finally{clearTimeout(timeout);}};
  const evaluate=async(fn,arg)=>{const response=await send('Runtime.evaluate',{expression:`(${fn})(${JSON.stringify(arg)??''})`,returnByValue:true,awaitPromise:true,userGesture:true});if(response.exceptionDetails)throw Error(response.exceptionDetails.exception?.description??response.exceptionDetails.text);return response.result.value;};
  await send('Runtime.enable');await until(()=>evaluate(()=>!!document.querySelector('[data-focus-file]')));
  popup={send,evaluate,click:selector=>evaluate(s=>document.querySelector(s).click(),selector),value:(selector,value)=>evaluate(([s,v])=>{const el=document.querySelector(s);el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},[selector,value]),shot:async name=>writeFile(resolve(out,name+'.png'),Buffer.from((await send('Page.captureScreenshot')).data,'base64'))};
 }
 async function action(){await source.bringToFront();const tabs=await cdp.send('Target.getTargets',{filter:[{type:'tab',exclude:false}]});await cdp.send('Extensions.triggerAction',{id,targetId:tabs.targetInfos.find(t=>t.url===source.url()).targetId});await attach();}
 const ready=()=>until(()=>popup.evaluate(()=>!document.querySelector('[data-focus-download]').disabled));
 const geometry=()=>popup.evaluate(()=>{const b=s=>{const r=document.querySelector(s).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};return {source:b('[data-focus-source]'),result:b('[data-focus-result]'),settings:b('.sf-settings'),actions:b('.ez-focus-actions'),top:b('.sf-top'),bottom:b('.sf-bottom'),images:b('.sf-images'),width:innerWidth,height:innerHeight,scrollHeight:document.scrollingElement.scrollHeight,scrollWidth:document.scrollingElement.scrollWidth,open:document.querySelectorAll('.sf-settings>details[open]').length};});
 async function section(name){await popup.evaluate(name=>(()=>{const tab=[...document.querySelectorAll('.sf-setting-tabs:not([hidden]) button')].find(el=>el.textContent===name);if(tab)tab.click();else{const summary=[...document.querySelectorAll('.sf-settings>details>summary')].find(el=>el.textContent===name);if(!summary.parentElement.open)summary.click();}})(),name);await until(()=>popup.evaluate(name=>document.querySelectorAll('.sf-settings>details[open]').length===1&&document.querySelector('.sf-settings>details[open]>summary').textContent===name,name));}
 async function loadFile(name,width,height,pixels){const file=resolve(out,name+'.png');await writeFile(file,await encodeNativePng(width,height,pixels));const {root}=await popup.send('DOM.getDocument');const {nodeId}=await popup.send('DOM.querySelector',{nodeId:root.nodeId,selector:'[data-focus-file]'});await popup.send('DOM.setFileInputFiles',{nodeId,files:[file]});await ready();}
 async function saveDownload(name,click){const finished=new Promise(resolve=>{let guid;const begin=event=>{guid=event.guid;};const progress=event=>{if(event.guid===guid&&event.state==='completed'){cdp.off('Browser.downloadWillBegin',begin);cdp.off('Browser.downloadProgress',progress);resolve(guid);}};cdp.on('Browser.downloadWillBegin',begin);cdp.on('Browser.downloadProgress',progress);});await click();const guid=await Promise.race([finished,new Promise((_,reject)=>setTimeout(()=>reject(Error('Download timed out.')),15000))]);await rename(resolve(out,guid),resolve(out,name+'.ezpix'));return decodeProject(await readFile(resolve(out,name+'.ezpix'),'utf8'));}
 async function download(name){await popup.value('[data-focus-format]','ezpix');return saveDownload(name,()=>popup.click('[data-focus-download]'));}


 await action();await ready();
 await popup.evaluate(()=>{
  window.audit={created:0,terminated:0,frameLoads:0,frameBytes:0,messages:0,sourcePaints:0};
  const Original=window.Worker,post=Original.prototype.postMessage,terminate=Original.prototype.terminate,draw=CanvasRenderingContext2D.prototype.drawImage;
  window.Worker=class extends Original{constructor(...args){super(...args);window.audit.created++;window.auditWorker=this;}};
  Original.prototype.postMessage=function(data,...rest){if(data.focus){window.audit.messages++;if(data.focus.frames){window.audit.frameLoads++;window.audit.frameBytes+=data.focus.frames.reduce((n,f)=>n+f.pixels.byteLength,0);}}if(window.holdNext&&data.focus){window.holdNext=false;setTimeout(()=>post.call(this,data,...rest),700);}else post.call(this,data,...rest);};
  Original.prototype.terminate=function(){window.audit.terminated++;return terminate.call(this);};
  CanvasRenderingContext2D.prototype.drawImage=function(...args){if(this.canvas.hasAttribute('data-focus-source'))window.audit.sourcePaints++;return draw.apply(this,args);};
 });
 const w=1024,h=1024,pixels=Uint8ClampedArray.from({length:w*h*4},(_,i)=>[80,100,120,255][i%4]);
 await loadFile('one-megapixel',w,h,pixels);await section('Selection');
 await popup.evaluate(()=>{const c=document.querySelector('[data-focus-source]'),r=c.getBoundingClientRect();c.dispatchEvent(new PointerEvent('pointerdown',{clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0,bubbles:true}));});await ready();
 await section('Light, colour & finish');await popup.evaluate(()=>{for(const key in window.audit)window.audit[key]=0;});
 const durations=[];for(const value of ['10','20','30','40']){const start=performance.now();await popup.value('[data-photo="brightness"]',value);await ready();durations.push(performance.now()-start);}
 const steady=await popup.evaluate(()=>window.audit);assert.equal(steady.messages,4);if(process.env.EZPIX_PERF_LABEL!=='baseline'){assert.equal(steady.created,0);assert.equal(steady.terminated,0);assert.equal(steady.frameLoads,0);assert.equal(steady.frameBytes,0);assert.equal(steady.sourcePaints,0);}
 const doc=await download('optimized');assert.deepEqual([...composite(doc).slice(0,4)],[182,202,222,255]);check('four completed adjustments retain exact output pixels');
 if(process.env.EZPIX_PERF_LABEL!=='baseline'){
  await popup.evaluate(()=>window.holdNext=true);const previous=await popup.evaluate(()=>window.audit.messages);await popup.value('[data-photo="brightness"]','20');await until(()=>popup.evaluate(n=>window.audit.messages>n,previous));await popup.value('[data-photo="brightness"]','30');await ready();await popup.evaluate(()=>new Promise(r=>setTimeout(r,800)));
  const latest=composite(await download('latest'));assert.deepEqual([...latest.slice(0,4)],[157,177,197,255]);assert.ok(await popup.evaluate(()=>window.audit.terminated>0));check('superseded busy worker is cancelled and replacement reloads frames for the latest result');
  await popup.evaluate(()=>{const el=document.querySelector('[data-photo="brightness"]');el.value='20';el.dispatchEvent(new Event('input',{bubbles:true}));window.auditWorker.onerror(new Event('error'));});await ready();assert.deepEqual([...composite(await download('idle-error-recovered')).slice(0,4)],[131,151,171,255]);check('idle worker failure during debounce reloads media without losing the pending preview');await popup.value('[data-photo="brightness"]','30');await ready();
  const oldLoads=await popup.evaluate(()=>window.audit.frameLoads);await loadFile('replacement',2,2,new Uint8ClampedArray([10,20,30,255,10,20,30,255,10,20,30,255,10,20,30,255]));assert.ok(await popup.evaluate(n=>window.audit.frameLoads>n,oldLoads));assert.deepEqual([...composite(await download('replacement')).slice(0,4)],[87,97,107,255]);check('replacing media cannot reuse old cached pixels');
 }
 assert.deepEqual(errors,[]);const result={label:process.env.EZPIX_PERF_LABEL??'current',browser:ctx.browser().version(),steady,adjustmentMilliseconds:durations,checks,errors};await writeFile(resolve(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(error){await popup?.shot('failure').catch(()=>{});throw error;}finally{await ctx.close();await new Promise(done=>server.close(done));}
