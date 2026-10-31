import {chromium} from 'playwright';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {encodeNativePng} from '../packages/core/dist/native-png.js';
const out=resolve('dist/store-assets');await mkdir(out,{recursive:true});
const width=384,height=192,pixels=new Uint8ClampedArray(width*height*4);
// Original landscape fixture, authored here; no captured/third-party artwork.
for(let y=0;y<height;y++)for(let x=0;x<width;x++){
 let c=y<122?[104+Math.round(y*.3),170+Math.round(y*.2),207+Math.round(y*.1),255]:[54,106+Math.round((height-y)*.5),142,255];
 const ridge=34+Math.abs(x-210)*.65;
 if(y>=ridge&&y<131)c=y<ridge+12?[235,242,240,255]:[98,124,147,255];
 if(y>=109&&y<134)c=[59,99,91,255];
 if(y>=134&&x>95&&x<320&&((y+x)%11)<4)c=[139,181,196,255];
 if((x<92||x>330)&&y<72&&((x*17+y*23)%19)<14)c=[180+(x+y)%55,46+(x*3+y)%55,22,255];
 if(x<25&&y<150)c=[76,55,42,255];
 pixels.set(c,(y*width+x)*4);
}
const context=await chromium.launchPersistentContext(resolve('artifacts/ext-issues1/assets-profile-'+Date.now()),{channel:'chromium',executablePath:process.env.EZPIX_CHROMIUM_PATH,headless:true,viewport:{width:780,height:580},screen:{width:1920,height:1080},args:['--screen-info={1920x1080}',`--disable-extensions-except=${resolve('dist/extension')}`,`--load-extension=${resolve('dist/extension')}`]});
try{
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host,page=await context.newPage();await page.goto(`chrome-extension://${id}/app.html`);
 await page.locator('[data-focus-file]:not([disabled])').waitFor();await page.locator('[data-theme-picker]').selectOption('dark');
 await page.locator('[data-focus-file]').setInputFiles({name:'original-mountain.png',mimeType:'image/png',buffer:Buffer.from(await encodeNativePng(width,height,pixels))});await page.locator('[data-focus-download]:not([disabled])').waitFor();
 if(await page.locator('body').evaluate(el=>Math.round(el.getBoundingClientRect().height))!==580)throw Error('Listing capture must use the actual 580px popup height.');
 // Keep the actual popup viewport and CSS breakpoints, then centre its screenshot.
 const storePage=await context.newPage();await storePage.setViewportSize({width:1280,height:800});
 await storePage.setContent('<!doctype html><body style="margin:0;height:100vh;display:grid;place-items:center;background:#081425"><img style="width:780px;height:580px;border:1px solid #3b6185;border-radius:10px;box-shadow:0 12px 60px #0008"></body>');
 const shot=async name=>{await page.bringToFront();await page.locator('[data-focus-download]:not([disabled])').waitFor();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const png=await page.screenshot();await storePage.locator('img').evaluate((img,base64)=>{img.src='data:image/png;base64,'+base64;return img.decode();},png.toString('base64'));await storePage.screenshot({path:resolve(out,name+'-1280x800.png')});};
 await shot('01-capture-convert');
 const expand=async selector=>{await page.bringToFront();await page.locator(selector).evaluate(el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));};
 await expand('[data-focus-palette]');await expand('[data-focus-width]');await page.locator('[data-focus-width]').scrollIntoViewIfNeeded();await page.locator('.sf-image-stage:first-child .sf-preview-toggle').click();await shot('02-pixel-grid');
 await expand('[data-focus-method]');await page.locator('[data-focus-method]').selectOption('chroma');await page.locator('.sf-image-stage:last-child .sf-preview-toggle').click();await page.locator('[data-focus-pick]').click();const b=await page.locator('[data-focus-source]').boundingBox();await page.mouse.click(b.x+b.width*.5,b.y+b.height*.25);await page.locator('[data-focus-download]:not([disabled])').waitFor();await page.locator('[data-focus-pick]').click();await page.mouse.move(b.x+b.width*.5,b.y+b.height*.25);await shot('03-background-picker');await page.keyboard.press('Escape');await page.locator('[data-focus-method]').selectOption('crop');
 await page.locator('.sf-image-stage:first-child .sf-preview-toggle').click();await expand('[data-photo="brightness"]');await page.locator('[data-photo="brightness"]').scrollIntoViewIfNeeded();await shot('04-photo-adjustments');
 await page.locator('.sf-image-stage:first-child .sf-preview-toggle').click();await expand('[data-focus-method]');await page.locator('[data-focus-method]').selectOption('chroma');await page.locator('[data-focus-key-swatch]').click();await page.locator('[data-focus-result]').dispatchEvent('pointermove',{clientX:0,clientY:0});await page.locator('[data-focus-download]:not([disabled])').waitFor();await shot('05-download');
 await copyFile('extension/icons/ezpix-insta-128.png',resolve(out,'ezpix-insta-icon-128.png'));
 const policy=(await readFile('extension/privacy.html','utf8')).replace('<link rel="stylesheet" href="app.css">','<style>'+await readFile('extension/app.css','utf8')+'</style>');await writeFile(resolve(out,'privacy.html'),policy);
 await writeFile(resolve(out,'ARTWORK.txt'),'Original canvas/pencil icon, promo vectors and landscape fixture authored locally for EzPIX Insta. Screenshots show the packaged 780x580 toolbar-popup UI centred on a store-sized background. No third-party images or bundled fonts.\n');
 console.log('Generated five current 1280x800 capture/conversion screenshots, cyan/blue icon and standalone privacy policy.');
}finally{await context.close();}
