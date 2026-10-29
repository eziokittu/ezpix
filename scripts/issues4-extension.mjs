import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {decodeProject} from '../packages/core/dist/index.js';
const out=resolve('artifacts/issues4'),store=resolve(out,'store');await mkdir(store,{recursive:true});
const ext=resolve('dist/extension');
const context=await chromium.launchPersistentContext(resolve(out,'extension-profile-'+Date.now()),{channel:'chromium',executablePath:process.env.EZPIX_CHROMIUM_PATH,headless:true,acceptDownloads:true,viewport:{width:1280,height:800},args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`,'--disable-gpu']});
const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));let passed=0;
try{
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host,page=await context.newPage();page.setDefaultTimeout(20000);await page.goto(`chrome-extension://${id}/app.html`);
 await page.locator('[data-focus-file]').setInputFiles(resolve('../glitchbong/public/ezpix/starters/kenney-town.png'));await page.waitForFunction(()=>document.querySelector('[data-focus-source]').width===256);await page.locator('[data-focus-enabled]').uncheck();await page.locator('[data-focus-width]').fill('128');await page.locator('[data-focus-height]').fill('72');
 for(const palette of ['coastal','dusk','graphite','woodland','ember','arcade']){await page.locator('[data-focus-palette]').selectOption(palette);await page.waitForFunction(()=>!document.querySelector('[data-focus-download]').disabled);const event=page.waitForEvent('download');await page.locator('[data-focus-format]').selectOption('ezpix');await page.locator('[data-focus-download]').click();const path=resolve(out,'extension-'+palette+'.ezpix');await(await event).saveAs(path);const doc=decodeProject(await readFile(path,'utf8'));assert.equal(doc.width,128);assert.equal(doc.height,72);assert.equal(doc.conversion,undefined);passed++;}
 await page.locator('[data-focus-palette]').selectOption('original');await page.waitForFunction(()=>!document.querySelector('[data-focus-download]').disabled);await page.locator('[data-focus-format]').selectOption('png');await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:resolve(store,'01-focus-studio-1280x800.png')});
 await page.locator('[data-focus-palette]').selectOption('dusk');await page.waitForFunction(()=>!document.querySelector('[data-focus-download]').disabled);await page.evaluate(()=>scrollTo(0,160));await page.screenshot({path:resolve(store,'02-colour-styles-1280x800.png')});passed++;
 const policyEvent=context.waitForEvent('page');await page.getByRole('link',{name:'Privacy',exact:true}).click();const policy=await policyEvent;await policy.waitForLoadState();assert.match(await policy.locator('h1').innerText(),/privacy/i);passed++;
 assert.deepEqual(errors,[]);await writeFile(resolve(out,'extension-result.json'),JSON.stringify({passed,browser:context.browser().version(),variant:'production unpacked',screenshots:['01-focus-studio-1280x800.png','02-colour-styles-1280x800.png'],errors},null,2));console.log(`PASS ${passed} production extension palette, project download, listing screenshot and offline privacy groups`);
}catch(error){for(const p of context.pages()){console.log('PAGE',p.url(),await p.locator('[data-focus-status]').allTextContents());await p.screenshot({path:resolve(out,'extension-failure.png')}).catch(()=>{});}console.log(errors);throw error;}finally{await context.close();}
