// Production-site workspace regression: original fixtures, isolated browser profile.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { composite, decodeProject } from '../packages/core/dist/index.js';

const web=resolve('../glitchbong'), out=resolve('artifacts/phase8a'), base='http://localhost:3791';
await mkdir(out,{recursive:true});
const server=spawn(process.execPath,[resolve(web,'node_modules/next/dist/bin/next'),'start','-p','3791'],{cwd:web,stdio:'ignore',windowsHide:true});
let browser;
try {
  let ready=false;
  for(let i=0;i<90;i++){try{if((await fetch(base+'/tools/ezpix')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}
  assert.ok(ready,'built site starts');
  browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:900},colorScheme:'dark'}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
  await page.goto(base+'/tools/ezpix');
  const canvas=page.locator('.ez-canvas'),app=page.locator('.ez-app');
  await canvas.waitFor();
  assert.equal(await app.getAttribute('data-theme'),'light','first visit is light even with OS dark');
  const fits=async(label)=>{
    const bounds=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,viewport:document.querySelector('.ez-viewport').getBoundingClientRect().height,footer:document.querySelector('.ez-statusbar').getBoundingClientRect().bottom}));
    assert.ok(bounds.scrollWidth<=bounds.width,`${label}: no page horizontal scroll ${JSON.stringify(bounds)}`);
    assert.ok(bounds.scrollHeight<=bounds.height,`${label}: no page vertical scroll ${JSON.stringify(bounds)}`);
    assert.ok(bounds.viewport>=80,`${label}: canvas remains usable ${JSON.stringify(bounds)}`);
    assert.ok(bounds.footer<=bounds.height+1,`${label}: footer stays visible`);
  };
  await fits('desktop');
  await page.screenshot({path:resolve(out,'desktop-light.png')});
  await page.getByText('File',{exact:true}).click();await page.getByRole('button',{name:'New canvas',exact:true}).click();
  await page.getByRole('combobox',{name:'New canvas',exact:true}).selectOption('16');await page.getByRole('button',{name:'New',exact:true}).click();
  await canvas.press('Space');
  const pixels=()=>canvas.evaluate(c=>Array.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data));
  const drawn=await pixels();assert.equal(drawn[3],255);
  await page.getByRole('button',{name:'Undo',exact:true}).click();assert.ok((await pixels()).every(v=>v===0));
  await page.getByRole('button',{name:'Redo',exact:true}).click();assert.deepEqual(await pixels(),drawn);
  await page.getByRole('button',{name:'Add layer',exact:true}).click();assert.equal(await page.getByRole('button',{name:/Select layer/}).count(),2);
  await page.getByRole('button',{name:'Add frame',exact:true}).click();await page.getByRole('button',{name:'Duplicate frame',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:/Select frame/}).count(),3);
  await page.getByRole('button',{name:'Select frame 1',exact:true}).click();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download project',exact:true}).click();
  await(await download).saveAs(resolve(out,'layers-frames.ezpix'));
  const project=decodeProject(await readFile(resolve(out,'layers-frames.ezpix'),'utf8'));
  assert.equal(project.layers.length,2);assert.equal(project.frames.length,3);assert.deepEqual([...composite(project)],drawn);
  await page.getByRole('button',{name:'Export',exact:true}).click();
  const png=page.waitForEvent('download');await page.getByRole('button',{name:'Export PNG',exact:true}).click();await(await png).saveAs(resolve(out,'artwork.png'));
  await page.getByRole('button',{name:'Close Import & export',exact:true}).click();
  await page.getByRole('button',{name:'Preferences',exact:true}).click();
  await page.getByRole('button',{name:'Dark',exact:true}).click();assert.equal(await app.getAttribute('data-theme'),'dark');
  await page.getByRole('button',{name:'Close Preferences',exact:true}).press('Escape');
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Preferences','dialog returns focus');
  await page.screenshot({path:resolve(out,'desktop-dark.png')});
  // Recovery remains staged after reload; restored project retains layers/frames.
  await page.waitForFunction(()=>document.querySelector('.ez-recovery-indicator')?.title.includes('Local checkpoint saved'));
  await page.reload();assert.equal(await app.getAttribute('data-theme'),'dark');
  await page.getByRole('button',{name:'Review recovery',exact:true}).click();
  assert.ok((await pixels()).every(v=>v===0),'checkpoint is never auto-applied');
  await page.getByRole('button',{name:'Restore checkpoint',exact:true}).click();
  assert.deepEqual(await pixels(),drawn);assert.equal(await page.getByRole('button',{name:/Select frame/}).count(),3);
  // A failed checkpoint must be visible even while its management dialog is closed.
  await page.waitForFunction(()=>document.querySelector('.ez-recovery-indicator')?.title.includes('Local checkpoint saved'));
  await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;window.__failRecovery=true;IDBObjectStore.prototype.put=function(...args){if(window.__failRecovery&&this.transaction.db.name==='ezpix-recovery')throw new DOMException('Test quota failure','QuotaExceededError');return put.apply(this,args);};});
  await canvas.press('ArrowRight');await canvas.press('Space');
  await page.locator('.ez-recovery-indicator').filter({hasText:'Recovery issue'}).waitFor();
  await page.evaluate(()=>{window.__failRecovery=false;});await canvas.press('ArrowRight');await canvas.press('Space');
  await page.waitForFunction(()=>document.querySelector('.ez-recovery-indicator')?.title.includes('Local checkpoint saved'));
  // The old path must keep extension fragments across its redirect.
  const legacy=await context.newPage();
  await legacy.goto(base+'/tools/ezpix/editor#ezpix='+'a'.repeat(32)+'.'+'b'.repeat(64));
  await legacy.waitForURL(/\/tools\/ezpix#ezpix=/);
  await legacy.getByRole('button',{name:'Receive extension artwork',exact:true}).waitFor();await legacy.close();
  await page.getByRole('button',{name:'Create from image or capture',exact:true}).click();
  await page.locator('[data-file]').setInputFiles(resolve(out,'artwork.png'));
  await page.locator('[data-status]').filter({hasText:'Preview ready'}).waitFor();
  await page.locator('[data-apply]').click();await page.getByRole('dialog').waitFor({state:'detached'});
  assert.ok((await pixels()).some(v=>v),'worker conversion applies from the creation dialog');
  await page.getByRole('button',{name:'Use light theme',exact:true}).click();
  for(const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:844});await fits(`${width}px`);
    if(width<761){await page.getByRole('group',{name:'Open inspector'}).getByRole('button',{name:'layers',exact:true}).click();assert.ok(await page.getByRole('button',{name:'Add layer',exact:true}).isVisible());await page.getByRole('button',{name:'Close inspector',exact:true}).click();}
    await page.getByRole('button',{name:'Preferences',exact:true}).click();
    await page.screenshot({path:resolve(out,`preferences-${width}.png`)});
    await page.getByRole('button',{name:'Close Preferences',exact:true}).click();
    await page.screenshot({path:resolve(out,`workspace-${width}.png`)});
  }
  await page.setViewportSize({width:844,height:390});await fits('phone landscape');
  assert.deepEqual(errors,[]);
  await writeFile(resolve(out,'result.json'),JSON.stringify({status:'passed',browser:await browser.version(),production:true,checks:['light default with OS dark','bounded viewport at 320/390/768/1440 and landscape','original icon controls','new canvas, real drawing, undo/redo','layers and frames survive decoded download','PNG download','theme persisted after reload','modal Escape and focus restoration','explicit recovery','visible quota failure and successful next checkpoint','legacy redirect preserves fragment','worker conversion from modal','mobile inspector','no page exceptions']},null,2));
  console.log('PASS: phase 8a workspace production browser checks');
} catch(error) { console.error(error);for(const context of browser?.contexts()??[])for(const page of context.pages()){console.error('Recovery UI:',await page.locator('.ez-recovery-indicator').evaluateAll(nodes=>nodes.map(node=>({text:node.textContent,title:node.title}))));await page.screenshot({path:resolve(out,'failure.png')});}process.exitCode=1; }
finally { await browser?.close();server.kill(); }
