// Component edge cases use a deterministic local message bridge. The toolbar QA
// separately checks the real extension protocol and exact automatic import.
import {chromium} from 'playwright';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createDocument,encodeProject,decodeProject,composite,ENGINE_VERSION} from '../packages/core/dist/index.js';
const out=resolve('artifacts/automatic-handoff');await mkdir(out,{recursive:true});
const base=process.env.EZPIX_QA_WEBSITE??'http://localhost:3791/tools/ezpix',id='a'.repeat(32),first='b'.repeat(64),second='c'.repeat(64);
function fixture(width,height){const doc=createDocument(width,height);doc.name='Original preview';const pixels=doc.layers[0].cels[doc.activeFrameId]=new Uint8ClampedArray(width*height*4);for(let i=0;i<pixels.length;i+=4)pixels.set([20+i%220,60,150,255],i);const bytes=Buffer.from(encodeProject(doc,false));return {pixels:[...pixels],width,height,manifest:{protocol:1,engine:ENGINE_VERSION,size:bytes.length,count:1,sha256:createHash('sha256').update(bytes).digest('hex')},data:bytes.toString('base64')};}
const a=fixture(8,5),b=fixture(7,3),browser=await chromium.launch({executablePath:process.env.EZPIX_CHROMIUM_PATH,headless:true});
const checks=[],errors=[];const check=name=>{checks.push(name);console.log('PASS',name);};
async function session(options={}){
 const context=await browser.newContext({viewport:{width:1365,height:900},acceptDownloads:true});
 await context.addInitScript(({id,first,second,a,b,options})=>{
  const records={[first]:a,[second]:b},stats={manifest:[],chunk:[],ack:[]};globalThis.qaHandoff={stats,options};
  const runtime={sendMessage(extension,message,callback){
   const record=records[message.token];if(extension!==id||!record){callback({error:'Denied'});return;}
   if(message.op==='manifest'){stats.manifest.push(message.token);callback({...record.manifest,engine:options.badEngine?'0.0.0':record.manifest.engine});}
   else if(message.op==='chunk'){stats.chunk.push(message.token);setTimeout(()=>callback({index:0,data:record.data}),message.token===first?(options.delay??0):0);}
   else if(message.op==='ack'){stats.ack.push(message.token);callback(options.failAck&&stats.ack.length===1?{error:'Temporary acknowledgment failure'}:{status:'imported'});}
  }};
  Object.defineProperty(globalThis.chrome,'runtime',{value:runtime,configurable:true});
 },{id,first,second,a,b,options});
 const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
 return {context,page};
}
const hash=token=>`#ezpix=${id}.${token}`;
async function saved(page,name){const event=page.waitForEvent('download');await page.getByRole('button',{name:'Download project',exact:true}).click();const path=resolve(out,name+'.ezpix');await(await event).saveAs(path);return decodeProject(await readFile(path,'utf8'));}
const imported=page=>page.waitForFunction(()=>!location.hash&&document.querySelector('.ez-statusbar')?.textContent.includes('Extension artwork imported'));
async function makeDirty(page){await page.goto(base);await page.getByLabel('Canvas width',{exact:true}).fill('8');await page.getByLabel('Canvas height',{exact:true}).fill('5');await page.getByRole('button',{name:'Create sprite',exact:true}).click();await page.locator('canvas[aria-label^="Pixel canvas."]').press('Space');}
try{
 {
  const {context,page}=await session();await page.goto(base+hash(first));await imported(page);assert.deepEqual([...composite(await saved(page,'automatic'))],a.pixels);assert.equal(await page.locator('.ez-incoming').count(),0);assert.equal(await page.getByRole('dialog').count(),0);assert.deepEqual(await page.evaluate(()=>globalThis.qaHandoff.stats.ack),[first]);await page.screenshot({path:resolve(out,'automatic.png')});await context.close();check('fresh valid handoff automatically opens exact preview pixels with no Receive/Import buttons');
 }
 {
  const {context,page}=await session();await makeDirty(page);const previous=await saved(page,'before-decline');await page.getByRole('button',{name:'Undo',exact:true}).click();await page.getByRole('button',{name:'Redo',exact:true}).click();let prompts=0;page.on('dialog',async dialog=>{prompts++;await dialog.dismiss();});await page.evaluate(value=>location.hash=value,hash(first));await page.getByRole('status').filter({hasText:'Import paused.'}).waitFor();assert.equal(prompts,1);assert.deepEqual(composite(await saved(page,'after-decline')),composite(previous));assert.equal(await page.evaluate(()=>globalThis.qaHandoff.stats.ack.length),0);
  await page.getByLabel('Import destination',{exact:true}).selectOption('layer');await page.getByRole('button',{name:'Import received artwork',exact:true}).click();await imported(page);const layered=await saved(page,'layered');assert.equal(layered.layers.length,2);assert.deepEqual(layered.layers[0].cels[layered.activeFrameId],previous.layers[0].cels[previous.activeFrameId]);await context.close();check('declining unsaved replacement preserves artwork and transfer; explicit layer import remains available');
 }
 {
  const {context,page}=await session({failAck:true});await page.goto(base+hash(first));await page.getByRole('button',{name:'Retry acknowledgment',exact:true}).waitFor();await page.locator('canvas[aria-label^="Pixel canvas."]').press('Space');const edited=await saved(page,'before-ack-retry');page.on('dialog',dialog=>{errors.push('Acknowledgment retry tried to replace artwork.');void dialog.dismiss();});await page.getByRole('button',{name:'Retry acknowledgment',exact:true}).click();await page.waitForFunction(()=>!location.hash);assert.deepEqual(composite(await saved(page,'after-ack-retry')),composite(edited));assert.equal(await page.evaluate(()=>globalThis.qaHandoff.stats.ack.length),2);await context.close();check('acknowledgment retry never reimports or overwrites edits made after the import');
 }
 {
  const {context,page}=await session({badEngine:true});await makeDirty(page);const previous=await saved(page,'before-invalid');await page.getByRole('button',{name:'Undo',exact:true}).click();await page.getByRole('button',{name:'Redo',exact:true}).click();page.on('dialog',dialog=>{errors.push('Invalid transfer reached replacement confirmation.');void dialog.dismiss();});await page.evaluate(value=>location.hash=value,hash(first));await page.getByRole('status').filter({hasText:'Invalid or incompatible transfer'}).waitFor();assert.deepEqual(composite(await saved(page,'after-invalid')),composite(previous));assert.equal(await page.evaluate(()=>globalThis.qaHandoff.stats.ack.length),0);await context.close();check('incompatible transfer is rejected before changing the canvas or acknowledging bytes');
 }
 {
  const {context,page}=await session({delay:500});await page.goto(base+hash(first));await page.waitForFunction(()=>globalThis.qaHandoff.stats.chunk.length===1);await page.evaluate(value=>location.hash=value,hash(second));await imported(page);await page.waitForTimeout(700);assert.deepEqual([...composite(await saved(page,'latest-transfer'))],b.pixels);assert.deepEqual(await page.evaluate(()=>globalThis.qaHandoff.stats.ack),[second]);await context.close();check('a superseded slow transfer cannot replace or acknowledge a newer imported preview');
 }
 {
  const {context,page}=await session({delay:250});await page.goto(base+hash(first));await page.waitForFunction(()=>globalThis.qaHandoff.stats.chunk.length===1);await page.evaluate(()=>dispatchEvent(new HashChangeEvent('hashchange')));await imported(page);assert.deepEqual(await page.evaluate(()=>globalThis.qaHandoff.stats.manifest),[first]);assert.deepEqual(await page.evaluate(()=>globalThis.qaHandoff.stats.ack),[first]);await context.close();check('duplicate hash notifications do not restart or double-import a transfer');
 }
 assert.deepEqual(errors,[]);await writeFile(resolve(out,'result.json'),JSON.stringify({engine:ENGINE_VERSION,checks,errors},null,2));
}finally{await browser.close();}
