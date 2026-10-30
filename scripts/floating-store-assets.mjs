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
const context=await chromium.launchPersistentContext(resolve('artifacts/ext-issues1/assets-profile-'+Date.now()),{channel:'chromium',executablePath:process.env.EZPIX_CHROMIUM_PATH,headless:true,viewport:{width:1280,height:800},args:[`--disable-extensions-except=${resolve('dist/extension')}`,`--load-extension=${resolve('dist/extension')}`]});
try{
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host,page=await context.newPage();await page.goto(`chrome-extension://${id}/app.html`);
 await page.locator('[data-theme-picker]').selectOption('dark');
 await page.locator('[data-focus-file]').setInputFiles({name:'original-mountain.png',mimeType:'image/png',buffer:Buffer.from(await encodeNativePng(width,height,pixels))});await page.locator('[data-focus-download]:not([disabled])').waitFor();
 const shot=async name=>{await page.locator('[data-focus-download]:not([disabled])').waitFor();await page.screenshot({path:resolve(out,name+'-1280x800.png')});};
 await shot('01-capture-convert');
 const expand=async selector=>page.locator(selector).evaluate(el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});
 await expand('[data-focus-palette]');await expand('[data-focus-width]');await page.locator('[data-focus-width]').scrollIntoViewIfNeeded();await shot('02-pixel-grid');
 await expand('[data-focus-method]');await page.locator('[data-focus-method]').selectOption('chroma');await page.locator('[data-focus-pick]').click();const b=await page.locator('[data-focus-source]').boundingBox();await page.mouse.move(b.x+b.width*.5,b.y+b.height*.25);await shot('03-background-picker');await page.keyboard.press('Escape');await page.locator('[data-focus-method]').selectOption('crop');
 await expand('[data-photo="brightness"]');await page.locator('[data-photo="brightness"]').scrollIntoViewIfNeeded();await shot('04-photo-adjustments');
 await expand('[data-focus-fps]');await page.locator('[data-focus-download]:not([disabled])').waitFor();await shot('05-download');
 await copyFile('extension/icons/ezpix-insta-128.png',resolve(out,'ezpix-insta-icon-128.png'));
 const policy=(await readFile('extension/privacy.html','utf8')).replace('<link rel="stylesheet" href="app.css">','<style>'+await readFile('extension/app.css','utf8')+'</style>');await writeFile(resolve(out,'privacy.html'),policy);
 await writeFile(resolve(out,'ARTWORK.txt'),'Original canvas/pencil icon, promo vectors and landscape fixture authored locally for EzPIX Insta. Screenshots show the packaged floating capture/conversion UI. No third-party images or bundled fonts.\n');
 console.log('Generated five current 1280x800 capture/conversion screenshots, shared icon and standalone privacy policy.');
}finally{await context.close();}
