import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { encodeRawIndexedPng, decodeLargeProject, captureLargeIndexedPng } from '../packages/core/dist/index.js';
const out=resolve('artifacts/studio-release');await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.EZPIX_CHROMIUM_PATH,headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
const raw={width:257,height:3,palette:[[11,22,33,0],[80,90,100,255],[80,90,100,255],[44,55,66,0],[1,2,3,127],[99,88,77,255]],indices:Uint8Array.from({length:257*3},(_,i)=>i%5)};
const bytes=await encodeRawIndexedPng(raw);await writeFile(resolve(out,'raw-source.png'),bytes);
let passed=0;
try{
 await page.goto('http://localhost:3791/tools/ezpix');await page.getByLabel('Canvas width',{exact:true}).fill('1024');await page.getByLabel('Canvas height',{exact:true}).fill('1024');await page.getByRole('button',{name:'Create sprite',exact:true}).click();await page.getByLabel('Large tiled canvas',{exact:true}).waitFor();
 await page.locator('summary').filter({hasText:/^Raw indexed PNG$/}).click();await page.getByLabel('Raw indexed PNG file',{exact:true}).setInputFiles(resolve(out,'raw-source.png'));
 const review=page.getByRole('dialog',{name:'Review raw indexed PNG',exact:true});await review.waitFor();assert.equal(await review.getByRole('button',{name:'Replace tiled project with indexed PNG',exact:true}).isDisabled(),true);
 await review.getByRole('button',{name:'Cancel',exact:true}).click();assert.match(await page.locator('.ez-large-menubar').innerText(),/1024 x 1024/);passed++;
 await page.getByLabel('Raw indexed PNG file',{exact:true}).setInputFiles(resolve(out,'raw-source.png'));await review.waitFor();await review.getByLabel('Raw PNG clear slot',{exact:true}).selectOption('3');await review.getByRole('button',{name:'Prepare indexed import',exact:true}).click();await review.getByRole('button',{name:'Replace tiled project with indexed PNG',exact:true}).click();await page.locator('summary').filter({hasText:/^Indexed colour$/}).click();await page.getByLabel('Tiled colour mode',{exact:true}).filter({hasText:'6 slots / transparent 3'}).waitFor();assert.match(await page.getByLabel('Tiled colour mode',{exact:true}).textContent(),/6 slots \/ transparent 3/);passed++;
 const event=page.waitForEvent('download');await page.getByRole('button',{name:'Save project',exact:true}).click();const projectPath=resolve(out,'raw-import.ezpix');await(await event).saveAs(projectPath);const project=decodeLargeProject(await readFile(projectPath,'utf8'));assert.deepEqual(captureLargeIndexedPng(project,{x:0,y:0,width:257,height:3}),raw);passed++;
 await page.locator('summary').filter({hasText:/^Selection and placement$/}).click();await page.getByLabel('Selection width',{exact:true}).fill('257');await page.getByLabel('Selection height',{exact:true}).fill('3');await page.getByLabel('I reviewed raw indexed PNG differences',{exact:true}).check();await page.getByRole('button',{name:'Prepare raw indexed PNG',exact:true}).click();await review.waitFor();const download=page.waitForEvent('download');await review.getByRole('button',{name:'Download raw indexed PNG',exact:true}).click();await(await download).saveAs(resolve(out,'raw-browser-export.png'));passed++;
 await page.getByLabel('Raw indexed PNG file',{exact:true}).setInputFiles({name:'bad.png',mimeType:'image/png',buffer:Buffer.from('invalid')});await page.getByRole('status').filter({hasText:'Raw indexed PNG needs 33 bytes'}).waitFor();assert.match(await page.getByLabel('Tiled colour mode',{exact:true}).innerText(),/6 slots/);passed++;
 await page.screenshot({path:resolve(out,'raw-indexed-website.png')});
 await page.goto('http://localhost:3791/tools/ezpix/extension');assert.match(await page.locator('h1').innerText(),/pixel studio/i);await page.getByRole('link',{name:'extension privacy policy',exact:true}).click();assert.match(await page.locator('h1').innerText(),/SnapForge privacy/);assert.match(await page.locator('.ez-help').innerText(),/seven days and at most 8 MiB/);passed++;
 await page.setViewportSize({width:320,height:800});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:resolve(out,'extension-privacy-320.png'),fullPage:true});passed++;
 await writeFile(resolve(out,'raw-ui-result.json'),JSON.stringify({passed,errors,browser:browser.version()},null,2));assert.deepEqual(errors,[]);console.log('PASS',passed,'website raw indexed PNG and release-page groups');
}catch(error){console.error(errors);await page.screenshot({path:resolve(out,'raw-ui-failure.png')}).catch(()=>{});throw error;}finally{await browser.close();}
