// Production-site layer/recovery gates using original synthetic artwork only.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { decodeProject,composite,convert,defaultRecipe,encodeProject } from '../packages/core/dist/index.js';
const web=resolve('../glitchbong'),out=resolve('artifacts/phase4'),base='http://localhost:3791';await mkdir(out,{recursive:true});
const server=spawn(process.execPath,[resolve(web,'node_modules/next/dist/bin/next'),'start','-p','3791'],{cwd:web,stdio:'ignore',windowsHide:true});
let browser;
try {
  let ready=false;for(let i=0;i<90;i++){try{if((await fetch(base+'/tools/ezpix/editor')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready);
  browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1280,height:960}}),page=await context.newPage(),errors=[];
  let acceptDialogs=true;context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>acceptDialogs?d.accept():d.dismiss());
  await page.goto(base+'/tools/ezpix/editor');
  const recovery=page.getByRole('region',{name:'Local recovery'}),canvas=page.locator('.ez-canvas');
  const saved=()=>recovery.getByRole('status').filter({hasText:'Local checkpoint saved'}).waitFor();
  const pixels=()=>canvas.evaluate(c=>[...c.getContext('2d').getImageData(0,0,c.width,c.height).data]);
  const readCheckpoint=p=>p.evaluate(async()=>{const db=await new Promise((r,j)=>{const q=indexedDB.open('ezpix-recovery',1);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});return await new Promise((r,j)=>{const tx=db.transaction('workspace'),q=tx.objectStore('workspace').get('latest');tx.oncomplete=()=>{db.close();r(q.result);};tx.onabort=()=>{db.close();j(tx.error);};});});
  await saved();console.log('Recovery ready; testing layers');await page.getByLabel('New canvas').selectOption('16');await page.getByRole('button',{name:'New',exact:true}).click();
  await canvas.press('Space');const bottom=await pixels();assert.equal(bottom[3],255);
  await page.getByRole('button',{name:'Add layer',exact:true}).click();await page.getByLabel('Layer name',{exact:true}).fill('Glow');await page.getByRole('button',{name:'Rename layer',exact:true}).click();
  await page.getByRole('button',{name:'Use #a855f7',exact:true}).click();await canvas.press('Space');const top=await pixels();assert.deepEqual(top.slice(0,4),[168,85,247,255]);
  await page.getByLabel('Layer visible',{exact:true}).uncheck();assert.deepEqual(await pixels(),bottom);await canvas.press('ArrowRight');await canvas.press('Space');assert.deepEqual(await pixels(),bottom,'hidden layer cannot be painted');await page.getByLabel('Layer visible',{exact:true}).check();
  await page.getByRole('button',{name:'Move layer down',exact:true}).click();assert.deepEqual(await pixels(),bottom);await page.getByRole('button',{name:'Undo'}).click();assert.deepEqual(await pixels(),top);
  await page.getByRole('button',{name:'Delete layer',exact:true}).click();assert.deepEqual(await pixels(),bottom);await page.getByRole('button',{name:'Undo'}).click();assert.deepEqual(await pixels(),top);
  await saved();const checkpoint=await readCheckpoint(page);assert.equal(decodeProject(checkpoint.text).layers.length,2);
  const project=page.waitForEvent('download');await page.getByRole('button',{name:'Download project',exact:true}).click();await(await project).saveAs(resolve(out,'layers.ezpix'));const doc=decodeProject(await readFile(resolve(out,'layers.ezpix'),'utf8'));assert.deepEqual([...composite(doc)],top);
  const png=page.waitForEvent('download');await page.getByRole('button',{name:'Export PNG'}).click();await(await png).saveAs(resolve(out,'layers.png'));
  const pngPixels=await page.evaluate(async b64=>{const blob=await(await fetch('data:image/png;base64,'+b64)).blob(),img=await createImageBitmap(blob),c=document.createElement('canvas');c.width=img.width;c.height=img.height;c.getContext('2d').drawImage(img,0,0);img.close();return [...c.getContext('2d').getImageData(0,0,c.width,c.height).data];},(await readFile(resolve(out,'layers.png'))).toString('base64'));assert.deepEqual(pngPixels,top,'PNG matches all composited pixels');
  console.log('Layer export passed; testing reload recovery');await page.reload();await page.getByRole('button',{name:'Restore checkpoint',exact:true}).waitFor();assert.ok((await pixels()).every(v=>v===0),'recovery never applies implicitly');
  await canvas.press('Space');const scratch=await pixels();acceptDialogs=false;await page.getByRole('button',{name:'Restore checkpoint',exact:true}).click();assert.deepEqual(await pixels(),scratch,'cancelled restore preserves new manual edits');acceptDialogs=true;
  await page.getByRole('button',{name:'Restore checkpoint',exact:true}).click();assert.deepEqual(await pixels(),top);assert.equal(await page.getByRole('button',{name:'Select layer Glow',exact:true}).getAttribute('aria-pressed'),'true');await saved();
  // A second tab must neither acquire the writer nor overwrite its checkpoint.
  const beforeSecond=await readCheckpoint(page);console.log('Reload passed; testing duplicate tab and quota');const second=await context.newPage();second.on('dialog',d=>d.accept());await second.goto(base+'/tools/ezpix/editor');await second.getByRole('status').filter({hasText:'Recovery belongs to another tab'}).waitFor();await second.locator('.ez-canvas').press('Space');
  await second.waitForTimeout(900);assert.equal((await readCheckpoint(second)).text,beforeSecond.text,'second tab cannot overwrite the primary checkpoint after debounce');
  // Inject a quota-like synchronous failure at the real IDB write boundary.
  await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;window.__failRecovery=true;IDBObjectStore.prototype.put=function(...args){if(window.__failRecovery&&this.transaction.db.name==='ezpix-recovery')throw new DOMException('Synthetic quota failure','QuotaExceededError');return put.apply(this,args);};});
  const beforeFailure=await readCheckpoint(page);await canvas.press('ArrowRight');await canvas.press('Space');const unsaved=await pixels();await recovery.getByRole('status').filter({hasText:'Recovery failed'}).waitFor();assert.equal((await readCheckpoint(page)).text,beforeFailure.text,'failed write preserves previous checkpoint');
  await page.screenshot({path:resolve(out,'recovery-failure.png'),fullPage:true});
  await page.evaluate(()=>{window.__failRecovery=false;});await canvas.press('ArrowRight');await canvas.press('Space');await saved();assert.notEqual((await readCheckpoint(page)).text,beforeFailure.text);
  // Close the owning tab; explicitly reload the second tab to acquire and restore.
  const lastCommitted=await readCheckpoint(page);console.log('Quota checks passed; testing owner release and interrupted debounce');await canvas.press('ArrowRight');await canvas.press('Space');await page.close();await second.reload();await second.getByRole('button',{name:'Restore checkpoint',exact:true}).waitFor();await second.getByRole('button',{name:'Restore checkpoint',exact:true}).click();assert.equal((await second.locator('.ez-canvas').getAttribute('width')),'16');assert.deepEqual(await second.locator('.ez-canvas').evaluate(c=>[...c.getContext('2d').getImageData(0,0,c.width,c.height).data]),[...composite(decodeProject(lastCommitted.text))],'closing during debounce preserves the last committed checkpoint');
  await second.locator('[data-ez-theme]').selectOption('dark');await second.screenshot({path:resolve(out,'layers-dark.png'),fullPage:true});
  for(const width of [320,390,768]){await second.setViewportSize({width,height:844});assert.ok(await second.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`layers and recovery fit ${width}px`);}
  await second.locator('[data-ez-theme]').selectOption('light');await second.setViewportSize({width:390,height:844});await second.screenshot({path:resolve(out,'layers-mobile-light.png'),fullPage:true});
  await second.getByRole('button',{name:'Clear local checkpoint',exact:true}).click();await second.getByRole('status').filter({hasText:'Local checkpoint cleared'}).waitFor();assert.equal(await readCheckpoint(second),undefined);
  await second.reload();await second.getByRole('status').filter({hasText:'Local checkpoint saved'}).waitFor();assert.ok(await second.locator('.ez-canvas').evaluate(c=>[...c.getContext('2d').getImageData(0,0,c.width,c.height).data].every(v=>v===0)),'cleared checkpoint does not return');
  // Source privacy applies to the checkpoint as well as project downloads.
  const source={width:1,height:1,pixels:new Uint8ClampedArray([22,44,66,255])},converted=convert(source,{...defaultRecipe(source),width:1,height:1});
  await second.locator('input[accept=".ezpix,application/json"]').setInputFiles({name:'source.ezpix',mimeType:'application/json',buffer:Buffer.from(encodeProject(converted))});await second.waitForFunction(()=>document.querySelector('.ez-canvas').width===1);await second.getByRole('status').filter({hasText:'Local checkpoint saved'}).waitFor();assert.ok(decodeProject((await readCheckpoint(second)).text).conversion.source);
  await second.getByLabel('Include source in project downloads',{exact:true}).uncheck();await second.getByRole('status').filter({hasText:'Local checkpoint saved'}).waitFor();assert.equal(decodeProject((await readCheckpoint(second)).text).conversion.source,undefined);
  // Corrupt stored data stays staged and never replaces the current canvas.
  await second.evaluate(async()=>{const db=await new Promise(r=>{const q=indexedDB.open('ezpix-recovery',1);q.onsuccess=()=>r(q.result);});await new Promise((r,j)=>{const tx=db.transaction('workspace','readwrite');tx.objectStore('workspace').put({version:1,text:'invalid',savedAt:Date.now()},'latest');tx.oncomplete=r;tx.onabort=()=>j(tx.error);});db.close();});
  await second.reload();await second.getByRole('status').filter({hasText:'unreadable checkpoint'}).waitFor();assert.equal(await second.getByRole('button',{name:'Restore checkpoint',exact:true}).count(),0);await second.getByRole('button',{name:'Keep this canvas',exact:true}).click();await second.getByRole('status').filter({hasText:'Local checkpoint saved'}).waitFor();assert.equal(decodeProject((await readCheckpoint(second)).text).width,64);
  assert.ok(unsaved.some(v=>v));assert.deepEqual(errors,[]);
  await writeFile(resolve(out,'result.json'),JSON.stringify({status:'passed',browser:await browser.version(),production:true,checks:['selected-layer drawing and hidden-layer protection','rename/order/delete and undo','composite PNG every pixel','v3 download','explicit reload recovery and cancel preserves edits','duplicate-tab exclusion and ownership release','quota failure preserves checkpoint and next-write recovery','interrupted debounce retains last committed pixels','clear and reload','source omission in checkpoint','corrupt checkpoint staging and explicit discard','320/390/768 layout','no page exceptions']},null,2));console.log('PASS: phase 4 production layers and recovery checks.');
}finally{await browser?.close();server.kill();}
