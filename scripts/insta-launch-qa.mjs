import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {PixelEditor,createDocument,encodeProject,prepareAuthored} from '../packages/core/dist/index.js';
import {encodeNativePng} from '../packages/core/dist/native-png.js';
const out=resolve('dist/store-assets'),evidence=resolve('artifacts/insta-launch');await mkdir(out,{recursive:true});await mkdir(evidence,{recursive:true});
const doc=createDocument(64,64,'Sunset valley'),pixels=doc.cel.pixels;
// Original authored fixture for listing screenshots; no third-party source image.
for(let y=0;y<64;y++)for(let x=0;x<64;x++){
 let c=y<37?[29+Math.floor(y*1.3),42+Math.floor(y*.6),82+Math.floor(y*.8),255]:[24,70,58,255];
 if((x-45)**2+(y-17)**2<60)c=[255,199,116,255];
 if(y>=24+Math.floor(Math.abs(x-15)*.7)&&y<43)c=[65,84,112,255];
 if(y>=31+Math.floor(Math.abs(x-42)*.45)&&y<47)c=[36,65,81,255];
 if(y>=45&&Math.abs(x-(32+(y-45)*.7))<4)c=[64,155,164,255];
 if(y>=53)c=(x+y)%7===0?[69,116,73,255]:[28,84,62,255];
 for(const tx of [8,18,53]){if(x>=tx-1&&x<=tx+1&&y>=43&&y<57)c=[112,80,62,255];if(y>=34&&y<49&&Math.abs(x-tx)<=Math.floor((y-32)/3))c=[40,120,81,255];}
 if(y>=43&&y<=51&&x>=24&&x<=36)c=[177,115,78,255];if(y>=36&&y<=43&&Math.abs(x-30)<=y-36)c=[112,63,64,255];if(y>=46&&y<=51&&x>=29&&x<=31)c=[67,52,65,255];if(y>=45&&y<=47&&x>=25&&x<=27)c=[255,202,118,255];
 pixels.set(c,(y*64+x)*4);
}
const extension=resolve('dist/extension'),errors=[],network=[],checks=[];
const context=await chromium.launchPersistentContext(resolve(evidence,'profile-'+Date.now()),{channel:'chromium',executablePath:process.env.EZPIX_CHROMIUM_PATH,headless:true,acceptDownloads:true,viewport:{width:1280,height:800},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
context.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});});let page;
try{
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host;page=await context.newPage();page.setDefaultTimeout(15000);
 const manifest=JSON.parse(await readFile('dist/extension/manifest.json','utf8'));assert.equal(manifest.name,'EzPIX Insta');assert.equal(manifest.externally_connectable,undefined);
 await page.goto(`chrome-extension://${id}/popup.html`);assert.equal(await page.title(),'EzPIX Insta');assert.equal(await page.locator('button').first().textContent(),'Open Pixel studio');assert.match(await page.locator('.sf-brand').textContent(),/EzPIX Insta/);assert.equal(await page.locator('.sf-brand-mark').textContent(),'E');assert.equal(await page.locator('.sf-brand small').textContent(),'by GlitchBong');
 await page.goto(`chrome-extension://${id}/app.html#studio`);assert.match(await page.title(),/^EzPIX Insta/);assert.equal(await page.locator('.sf-brand-mark').textContent(),'E');assert.ok(await page.locator('[data-ps-handoff]').isHidden());assert.ok(await page.locator('[data-apply]').isHidden());assert.ok(await page.locator('[data-focus-apply]').isHidden());
 const denied=await page.evaluate(()=>chrome.runtime.sendMessage({type:'HANDOFF',project:'{}'}));assert.match(denied.error,/standalone release/);checks.push('renamed production manifest/popup/studio, studio-first entry, hidden website controls and blocked HANDOFF');
 async function open(document){await page.locator('[data-ps-open]').setInputFiles({name:'sunset-valley.ezpix',mimeType:'application/json',buffer:Buffer.from(encodeProject(document,false))});await page.locator('[data-ps-dialog-apply]').click();}
 await open(doc);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:resolve(out,'01-pixel-studio-1280x800.png')});
 await page.locator('[data-ps-copy-frame]').click();await page.locator('[data-ps-duration]').fill('160');await page.locator('[data-ps-duration]').dispatchEvent('change');await page.locator('[data-ps-copy-frame]').click();await page.locator('[data-ps-copy-frame]').click();await page.locator('[data-ps-frames]').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,'02-layers-animation-1280x800.png')});
 const tiles=new PixelEditor(doc);tiles.applyAuthored(prepareAuthored(doc,{kind:'tilemap',action:'create',tileWidth:8,tileHeight:8,name:'Valley tilemap',populate:true}));doc.layers[0].visible=false;await open(doc);await page.locator('[data-ps-canvas]').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,'03-shared-tilemaps-1280x800.png')});
 await page.locator('[data-studio-view=capture]').click();await page.locator('[data-focus-file]').setInputFiles({name:'original-valley.png',mimeType:'image/png',buffer:Buffer.from(await encodeNativePng(64,64,pixels))});await page.locator('[data-focus-enabled]').uncheck();await page.locator('[data-focus-palette]').selectOption('coastal');await page.waitForFunction(()=>!document.querySelector('[data-focus-download]').disabled);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:resolve(out,'04-capture-convert-1280x800.png')});checks.push('four current 1280x800 screenshots of real studio, animation, tilemap and conversion workflows using original artwork');
 assert.ok(await page.locator('[data-focus-apply]').isHidden());await page.goto(`chrome-extension://${id}/privacy.html`);assert.equal(await page.locator('h1').textContent(),'EzPIX Insta privacy');assert.match(await page.locator('main').textContent(),/does not send artwork/);assert.match(await page.locator('main').textContent(),/Limited Use/);
 await copyFile('extension/icons/ezpix-insta-128.png',resolve(out,'ezpix-insta-icon-128.png'));
 const publicPolicy=(await readFile('extension/privacy.html','utf8')).replace('<link rel="stylesheet" href="app.css">','<style>'+await readFile('extension/app.css','utf8')+'</style>').replace(' · <a href="app.html">Back to studio</a>','');
 await writeFile(resolve(out,'privacy.html'),publicPolicy);
 await writeFile(resolve(out,'ARTWORK.txt'),'Listing screenshot artwork and the EzPIX Insta pixel canvas and pencil icon are original artwork created for this project. No third-party images or fonts were used.\n');
 assert.deepEqual(errors,[]);assert.deepEqual(network,[]);checks.push('renamed offline privacy, limited-use disclosure and zero HTTP requests/page errors');
 await writeFile(resolve(evidence,'result.json'),JSON.stringify({version:manifest.version,name:manifest.name,browser:context.browser().version(),checks,errors,network},null,2));console.log('PASS',checks.length,'Insta launch/branding/store-asset groups');
}catch(error){if(page)await page.screenshot({path:resolve(evidence,'failure.png'),fullPage:true}).catch(()=>{});throw error;}finally{await context.close();}
