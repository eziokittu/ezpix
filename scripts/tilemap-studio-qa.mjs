import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {PixelEditor,createDocument,encodeProject,decodeProject,activeLayer,composite} from '../packages/core/dist/index.js';

const out=resolve('artifacts/tilemaps');await mkdir(out,{recursive:true});
const ext=resolve('dist/extension'),errors=[],checks=[],network=[];
const context=await chromium.launchPersistentContext(resolve(out,'profile-'+Date.now()),{channel:'chromium',executablePath:process.env.EZPIX_CHROMIUM_PATH,headless:true,acceptDownloads:true,viewport:{width:1440,height:1000},args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`,'--disable-gpu']});
context.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());p.on('request',r=>{if(p.url().startsWith('chrome-extension:')&&/^https?:/.test(r.url()))network.push(r.url());});});
const fixture=new PixelEditor(createDocument(8,8,'Authored tiles'));
for(const [x,y,color] of [[0,0,[255,0,0,255]],[1,0,[0,255,0,255]],[0,1,[0,0,255,255]],[1,1,[17,18,19,0]],[2,0,[255,255,0,255]]])fixture.paint(x,y,color);
fixture.commit();const source=encodeProject(fixture.document);
let page;
try{
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host;
 const surfaces=[{name:'extension',url:`chrome-extension://${id}/app.html#studio`,canvas:'[data-ps-canvas]',save:'[data-ps-save]',open:'[data-ps-open]',undo:'[data-ps-undo]'}];
 if(process.env.EZPIX_TILEMAP_WEBSITE)surfaces.push({name:'website',url:process.env.EZPIX_TILEMAP_WEBSITE,canvas:'.ez-canvas',save:'[aria-label="Download project"]',open:'input[accept=".ezpix,application/json"]',undo:'[aria-label="Undo"]'});
 for(const surface of surfaces){
  page=await context.newPage();page.setDefaultTimeout(15000);await page.goto(surface.url);
  if(surface.name==='website')await page.getByRole('button',{name:'Create sprite',exact:true}).click();
  async function open(text){await page.locator(surface.open).setInputFiles({name:'tiles.ezpix',mimeType:'application/json',buffer:Buffer.from(text)});if(surface.name==='extension')await page.locator('[data-ps-dialog-apply]').click();}
  async function file(selector,name){const event=page.waitForEvent('download');await page.locator(selector).click();const path=resolve(out,`${surface.name}-${name}`);await(await event).saveAs(path);return path;}
  async function project(name){return decodeProject(await readFile(await file(surface.save,name+'.ezpix'),'utf8'));}
  async function apply(){await page.locator('.ez-tilemap-review[open]').waitFor();await page.locator('[data-map-apply]').click();await page.locator('.ez-tilemap-review[open]').waitFor({state:'hidden'});}
  await open(source);
  if(surface.name==='website')await page.locator('.ez-inspector-tabs button[aria-label=Layers]').click();
  await page.locator('.ez-tilemap-panel>summary').click();await page.locator('[data-map-width]').fill('2');await page.locator('[data-map-height]').fill('2');
  await page.locator('[data-map-create]').click();await page.locator('[data-map-cancel]').click();assert.equal((await project('create-cancel')).layers.length,1);
  await page.locator('[data-map-create]').click();await apply();let d=await project('created');assert.ok(activeLayer(d).tilemap);assert.equal(d.layers.length,2);assert.equal(activeLayer(d).tilemap.tileset.tiles.length,16);
  checks.push(surface.name+': reviewed integrated tilemap creation preserves source/hidden RGB');

  await page.locator(surface.canvas).scrollIntoViewIfNeeded();let box=await page.locator(surface.canvas).boundingBox();
  const at=(x,y)=>({x:box.x+box.width*(x+.5)/4,y:box.y+box.height*(y+.5)/4});
  await page.mouse.move(at(0,2).x,at(0,2).y);await page.mouse.down();await page.mouse.move(at(3,2).x,at(3,2).y,{steps:6});await page.mouse.up();
  d=await project('stroke');assert.deepEqual([...activeLayer(d).tilemap.cells.slice(8,12)],[0,0,0,0]);
  await page.locator(surface.undo).click();assert.ok(activeLayer(await project('stroke-undo')).tilemap.cells.every(i=>i===-1));
  await page.locator(surface.canvas).scrollIntoViewIfNeeded();box=await page.locator(surface.canvas).boundingBox();
  await page.mouse.move(at(0,1).x,at(0,1).y);await page.mouse.down();await page.mouse.move(at(3,1).x,at(3,1).y);await page.keyboard.press('Escape');await page.mouse.up();assert.ok(activeLayer(await project('escape')).tilemap.cells.every(i=>i===-1));
  await page.mouse.move(at(0,1).x,at(0,1).y);await page.mouse.down();await page.locator(surface.canvas).dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();assert.ok(activeLayer(await project('pointercancel')).tilemap.cells.every(i=>i===-1));
  checks.push(surface.name+': connected canvas map strokes use one Undo; Escape/pointercancel discard preview');

  await page.locator('[data-map-x]').fill('1');await page.locator('[data-map-y]').fill('2');await page.locator('[data-map-flags]').selectOption('7');await page.locator('[data-map-use]').click();d=await project('flags');assert.equal(activeLayer(d).tilemap.cells[9],0);assert.equal(activeLayer(d).tilemap.flags[9],7);
  await page.locator('[data-map-share]').click();await apply();await page.locator('[data-map-x]').fill('3');await page.locator('[data-map-y]').fill('3');await page.locator('[data-map-use]').click();
  await page.locator('summary').filter({hasText:/^Edit shared tiles$/}).click();await page.locator('[data-tile-color]').fill('#112233');await page.locator('[data-tile-alpha]').fill('127');const before=encodeProject(await project('before-shared-edit'));
  await page.locator('[data-tile-pixel]').click();await page.locator('[data-map-cancel]').click();assert.equal(encodeProject(await project('shared-cancel')),before);
  await page.locator('[data-tile-pixel]').click();await apply();d=await project('shared-edit');let maps=d.layers.filter(l=>l.tilemap);assert.equal(maps.length,2);assert.equal(maps[0].tilemap.tileset,maps[1].tilemap.tileset);assert.deepEqual([...maps[0].tilemap.tileset.tiles[0].slice(0,4)],[17,34,51,127]);
  await page.locator(surface.undo).click();assert.equal(encodeProject(await project('shared-undo')),before);
  checks.push(surface.name+': transform flags, shared layers and reviewed global tile edits retain exact identities/atomic Undo');

  for(let flags=0;flags<8;flags++){await page.locator('[data-map-x]').fill(String(flags%4));await page.locator('[data-map-y]').fill(String(Math.floor(flags/4)));await page.locator('[data-map-flags]').selectOption(String(flags));await page.locator('[data-map-use]').click();}
  await page.locator('summary').filter({hasText:/^Game tilemap export$/}).click();await file('[data-map-export]','tiled.zip');
  const saved=encodeProject(await project('reopen-source'));await open(saved);d=await project('reopened');maps=d.layers.filter(l=>l.tilemap);assert.equal(maps[0].tilemap.tileset,maps[1].tilemap.tileset);assert.equal(activeLayer(d).tilemap.flags[15],7);
  await page.locator('[data-map-rasterize]').click();await apply();assert.equal(activeLayer(await project('rasterized')).tilemap,undefined);await page.locator(surface.undo).click();assert.ok(activeLayer(await project('rasterize-undo')).tilemap);
  checks.push(surface.name+': real Tiled ZIP/project downloads, shared save/reopen and reviewed rasterization Undo');
  await page.locator(surface.canvas).scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,surface.name+'-desktop.png'),fullPage:true});
  for(const width of [390,320]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no page overflow at '+width);await page.screenshot({path:resolve(out,`${surface.name}-${width}.png`),fullPage:true});}
  checks.push(surface.name+': desktop/390/320px map inspector without page overflow');await page.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
 await writeFile(resolve(out,'result.json'),JSON.stringify({version:JSON.parse(await readFile('extension/manifest.json','utf8')).version,browser:context.browser().version(),checks,errors,network},null,2));console.log('PASS',checks.length,'integrated tilemap browser groups');
}catch(error){console.error(errors);if(page){console.error(await page.locator('[data-map-status]').allTextContents());await page.screenshot({path:resolve(out,'failure.png'),fullPage:true}).catch(()=>{});}throw error;}finally{await context.close();}
