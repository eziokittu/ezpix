// Production usability gates for issues2. All artwork is synthetic/original.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { decodeProject, composite } from '../packages/core/dist/index.js';

const web=resolve('../glitchbong'),out=resolve('artifacts/phase9a'),base='http://localhost:3791';
await mkdir(out,{recursive:true});
const server=spawn(process.execPath,[resolve(web,'node_modules/next/dist/bin/next'),'start','-p','3791'],{cwd:web,stdio:'ignore',windowsHide:true});
let browser;
try {
  let ready=false;for(let i=0;i<90;i++){try{if((await fetch(base+'/tools/ezpix')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,'production site starts');
  browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:900},colorScheme:'dark'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  const button=name=>page.getByRole('button',{name,exact:true}),canvas=page.locator('.ez-canvas');
  const pixels=()=>canvas.evaluate(c=>[...c.getContext('2d').getImageData(0,0,c.width,c.height).data]);
  const menu=async name=>{if(await button('Application menu').isVisible())await button('Application menu').click();await page.locator('.ez-menus summary').filter({hasText:new RegExp('^'+name+'$')}).click();};
  const download=async(action,name)=>{const event=page.waitForEvent('download');await action();const file=await event;await file.saveAs(resolve(out,name));return {name:file.suggestedFilename(),doc:name.endsWith('.ezpix')?decodeProject(await readFile(resolve(out,name),'utf8')):null};};
  const fits=async label=>{const b=await page.evaluate(()=>({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,v:document.querySelector('.ez-viewport').getBoundingClientRect().height}));assert.ok(b.sw<=b.w&&b.sh<=b.h,`${label} fixed viewport: ${JSON.stringify(b)}`);assert.ok(b.v>=70,`${label} usable canvas: ${JSON.stringify(b)}`);};
  await page.goto(base+'/tools/ezpix');
  await page.getByRole('dialog',{name:'Start a new sprite',exact:true}).waitFor();
  assert.equal(await page.locator('.ez-app').getAttribute('data-theme'),'light');
  assert.equal(await button('Preferences').count(),0);assert.equal(await button('Create from image or capture').count(),0);
  await page.screenshot({path:resolve(out,'startup-desktop.png')});
  await page.getByLabel('Project name',{exact:true}).fill('Dusk sprite');
  for(const invalid of ['0','257']){await page.getByLabel('Canvas width',{exact:true}).fill(invalid);await button('Create sprite').click();assert.ok(await page.getByRole('dialog',{name:'Start a new sprite',exact:true}).isVisible());assert.equal(await canvas.getAttribute('width'),'64','invalid dimensions preserve the default document');}
  await page.getByLabel('Canvas width',{exact:true}).fill('24');await page.getByLabel('Canvas height',{exact:true}).fill('16');
  await page.getByLabel('Background',{exact:true}).selectOption('white');await button('Create sprite').click();
  await page.waitForFunction(()=>document.querySelector('.ez-canvas').width===24);
  assert.ok((await pixels()).every(v=>v===255),'chosen white background is real artwork');
  const white=await download(()=>button('Download project').click(),'white.ezpix');
  assert.equal(white.name,'Dusk sprite.ezpix');assert.equal(white.doc.width,24);assert.equal(white.doc.height,16);assert.ok([...composite(white.doc)].every(v=>v===255));
  await page.getByRole('status').filter({hasText:'Download requested. Check your browser downloads.'}).waitFor();
  await button('Dismiss save notification').click();
  const hotkey=await download(()=>page.locator('body').press('Control+s'),'hotkey.ezpix');assert.deepEqual([...composite(hotkey.doc)],[...composite(white.doc)]);
  await button('Dismiss save notification').click();
  await menu('File');await button('New sprite Ctrl N').click();
  await button('16 × 16').click();await page.getByLabel('Project name',{exact:true}).fill('Selection test');await button('Create sprite').click();
  await page.waitForFunction(()=>document.querySelector('.ez-canvas').width===16);
  const clickPixel=async(x,y)=>{const b=await canvas.boundingBox();await page.mouse.click(b.x+(x+.5)*b.width/16,b.y+(y+.5)*b.height/16);};
  await clickPixel(2,2);const original=await pixels();assert.equal(original[(2*16+2)*4+3],255);
  async function stageSelection(){await button('Select').click();const b=await canvas.boundingBox();await page.mouse.move(b.x+2.5*b.width/16,b.y+2.5*b.height/16);await page.mouse.down();await page.mouse.move(b.x+4.5*b.width/16,b.y+4.5*b.height/16,{steps:3});await page.mouse.up();await canvas.press('ArrowRight');await canvas.press('ArrowRight');}
  await stageSelection();await button('Pencil').click();
  await page.getByRole('dialog',{name:'Finish your preview',exact:true}).waitFor();await page.screenshot({path:resolve(out,'preview-decision.png')});await button('Keep editing').click();
  assert.equal(await button('Select').getAttribute('aria-pressed'),'true');
  await button('Pencil').click();await button('Discard preview & continue').click();assert.equal(await button('Pencil').getAttribute('aria-pressed'),'true');assert.deepEqual(await pixels(),original,'discard does not alter committed artwork');
  await stageSelection();await button('Pencil').click();await button('Apply & continue').click();
  const moved=await pixels();assert.equal(moved[(2*16+2)*4+3],0);assert.equal(moved[(2*16+4)*4+3],255);
  await button('Undo').click();assert.deepEqual(await pixels(),original,'apply and switch is one undo');
  await stageSelection();await button('Download project').click();await page.getByRole('dialog',{name:'Finish your preview',exact:true}).waitFor();
  const pendingSave=await download(()=>button('Discard preview & continue').click(),'pending-selection.ezpix');assert.deepEqual([...composite(pendingSave.doc)],original,'save resumes after explicitly discarding preview');
  await button('Dismiss save notification').click();
  await button('Line').click();await canvas.press('Space');await canvas.press('ArrowRight');await button('Eraser').click();await button('Apply & continue').click();assert.equal(await button('Eraser').getAttribute('aria-pressed'),'true');await button('Undo').click();assert.deepEqual(await pixels(),original,'unfinished keyboard shape applies then undoes atomically');
  const started=Date.now();await button('Pencil').hover();await page.getByRole('tooltip').filter({hasText:'Pencil (B)'}).waitFor({timeout:500});assert.ok(Date.now()-started<500,'tooltip appears without native-title delay');
  await button('Download project').focus();await page.getByRole('tooltip').filter({hasText:'Save project (.ezpix)'}).waitFor({timeout:500});await page.keyboard.press('Escape');assert.equal(await page.getByRole('tooltip').count(),0);
  for(const name of ['File','Edit','Image','Layer','Select','Filter','Animation','View','Help']){await menu(name);assert.ok(await page.locator('.ez-menus details[open]').isVisible());await page.keyboard.press('Escape');}
  await menu('Layer');await button('New layer').click();assert.equal(await page.getByRole('button',{name:/Select layer/}).count(),2);
  await menu('Animation');await page.locator('.ez-menus details[open]').getByRole('button',{name:'Duplicate frame',exact:true}).click();assert.equal(await page.getByRole('button',{name:/Select frame/}).count(),2);
  await button('Use dark theme').click();await page.screenshot({path:resolve(out,'workspace-dark.png')});
  await button('Use light theme').click();await fits('desktop');await page.screenshot({path:resolve(out,'workspace-light.png')});
  await menu('View');await button('Colour & palette').click();assert.ok(await page.getByRole('button',{name:'Add drawing colour',exact:true}).isVisible());
  // Existing arbitrary colour picker remains available; richer colour work is next phase.
  await page.getByLabel('Palette drawing colour',{exact:true}).fill('#1177aa');
  await button('Export').click();const png=await download(()=>button('Export PNG').click(),'artwork.png');assert.ok(png.name.endsWith('.png'));await button('Close Import & export').click();
  await menu('Image');await button('Import & convert image').click();await page.locator('[data-file]').setInputFiles(resolve(out,'artwork.png'));await page.locator('[data-status]').filter({hasText:'Preview ready'}).waitFor();await page.locator('[data-apply]').click();await page.getByRole('dialog').waitFor({state:'detached'});
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:844});await fits(`${width}px`);await menu('Help');assert.ok(await page.getByRole('link',{name:'Controls & shortcuts',exact:true}).isVisible());await page.keyboard.press('Escape');await page.screenshot({path:resolve(out,`workspace-${width}.png`)});}
  await page.setViewportSize({width:844,height:390});await fits('landscape');await page.screenshot({path:resolve(out,'workspace-landscape.png')});
  // Fresh profile: closing startup leaves the default project; reload reoffers setup/recovery.
  const fresh=await browser.newContext({viewport:{width:390,height:844}}),phone=await fresh.newPage();phone.on('pageerror',e=>errors.push(e.message));phone.on('dialog',d=>d.accept());await phone.goto(base+'/tools/ezpix');await phone.getByRole('dialog',{name:'Start a new sprite',exact:true}).waitFor();await phone.screenshot({path:resolve(out,'startup-phone.png')});await phone.getByRole('button',{name:'Close Start a new sprite',exact:true}).click();assert.equal(await phone.locator('.ez-canvas').getAttribute('width'),'64');
  await phone.getByRole('button',{name:'Use dark theme',exact:true}).click();await phone.reload();await phone.getByRole('dialog',{name:'Start a new sprite',exact:true}).waitFor();assert.equal(await phone.locator('.ez-app').getAttribute('data-theme'),'dark');await phone.getByRole('button',{name:'Use default canvas',exact:true}).click();await fresh.close();
  const legacy=await context.newPage();legacy.on('pageerror',e=>errors.push(e.message));await legacy.goto(base+'/tools/ezpix/editor#ezpix='+'a'.repeat(32)+'.'+'b'.repeat(64));await legacy.getByRole('button',{name:'Receive extension artwork',exact:true}).waitFor();assert.ok(new URL(legacy.url()).pathname==='/tools/ezpix');assert.equal(await legacy.getByRole('dialog',{name:'Start a new sprite',exact:true}).count(),0,'handoff skips startup');await legacy.close();
  assert.deepEqual(errors,[]);
  await writeFile(resolve(out,'result.json'),JSON.stringify({status:'passed',browser:await browser.version(),production:true,checks:['startup custom rectangular canvas/background and invalid dimension rejection','startup close preserves 64px defaults','no settings or Create promotion','named project and Ctrl+S real downloads decoded','selection keep/discard/apply before tool switch','pending-selection save resumes and preserves pixels','unfinished shape apply/undo','immediate hover and focus tooltips','nine real menu groups','layer/frame menu commands','image converter moved to Image','fixed 320/390/768/1440 and landscape layouts','saved theme after reload','legacy fragment bypasses startup','no page exceptions']},null,2));console.log('PASS: phase 9a usability production checks');
}catch(error){console.error(error);for(const context of browser?.contexts()??[])for(const [i,page] of context.pages().entries()){await page.screenshot({path:resolve(out,`failure-${i}.png`)}).catch(()=>{});}process.exitCode=1;}
finally{await browser?.close();server.kill();}
