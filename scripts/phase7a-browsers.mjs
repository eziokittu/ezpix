import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {decodeProject} from '../packages/core/dist/index.js';
const web=resolve('../glitchbong'),out=resolve('artifacts/phase7a/browsers'),base='http://localhost:3791';await mkdir(out,{recursive:true});
const server=spawn(process.execPath,[resolve(web,'node_modules/next/dist/bin/next'),'start','-p','3791'],{cwd:web,stdio:'ignore',windowsHide:true});
const results=[];let browser,native;
try{
  let ready=false;for(let i=0;i<90;i++){try{if((await fetch(base+'/tools/ezpix/editor')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready);
  for(const channel of ['chrome','msedge']){
    // Headed, isolated automation profile. Visibility must come from native tabs.
    const executable=channel==='chrome'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
    const profile=resolve(out,channel+'-profile-'+Date.now());
    native=spawn(executable,['--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--edge-skip-compat-layer-relaunch','about:blank'],{windowsHide:true,stdio:'ignore'});
    // Read only this fresh profile's endpoint; never attach to an unrelated
    // browser that might already own a fixed debugging port.
    let endpoint;for(let i=0;i<60&&!endpoint;i++){try{const [port,path]=(await readFile(resolve(profile,'DevToolsActivePort'),'utf8')).trim().split(/\r?\n/);assert.match(port,/^\d+$/);assert.match(path,/^\/devtools\/browser\//);endpoint=`ws://127.0.0.1:${port}${path}`;}catch{}if(!endpoint)await new Promise(r=>setTimeout(r,500));}assert.ok(endpoint,'isolated native browser starts');
    browser=await chromium.connectOverCDP(endpoint,{noDefaults:true});const context=browser.contexts()[0],page=await context.newPage(),errors=[];await page.setViewportSize({width:1280,height:960});
    const browserCDP=await browser.newBrowserCDPSession();await browserCDP.send('Browser.setDownloadBehavior',{behavior:'allowAndName',downloadPath:out,eventsEnabled:true});
    page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/tools/ezpix/editor');await page.getByRole('button',{name:'Add frame',exact:true}).click();await page.getByRole('button',{name:'Play animation',exact:true}).click();
    // noDefaults avoids Playwright's focus emulation on its primary CDP session.
    // Disabling it on a secondary session does not undo the primary override.
    const cover=await context.newPage();await cover.goto('about:blank');await cover.bringToFront();
    await page.waitForFunction(()=>document.visibilityState==='hidden');
    await page.getByRole('button',{name:'Play animation',exact:true}).waitFor();
    await page.bringToFront();await page.waitForFunction(()=>document.visibilityState==='visible');
    assert.ok(await page.getByRole('button',{name:'Add frame',exact:true}).isEnabled(),'native hidden event stopped playback');
    const canvas=page.locator('.ez-canvas');await canvas.scrollIntoViewIfNeeded();const b=await canvas.boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);
    assert.ok(await canvas.evaluate(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.some(v=>v!==0)),'native browser drawing');
    const download=new Promise((done,reject)=>{const timer=setTimeout(()=>{browserCDP.off('Browser.downloadProgress',progress);reject(new Error('Native download timed out'));},15000);function progress(event){if(event.state==='completed'||event.state==='canceled'){clearTimeout(timer);browserCDP.off('Browser.downloadProgress',progress);event.state==='completed'?done(event.guid):reject(new Error('Native download cancelled'));}}browserCDP.on('Browser.downloadProgress',progress);});
    await page.getByRole('button',{name:'Download project',exact:true}).click();const bytes=await readFile(resolve(out,await download));assert.equal(decodeProject(bytes.toString()).frames.length,2);await writeFile(resolve(out,channel+'.ezpix'),bytes);
    await page.goto(base+'/tools/ezpix/tiles');await page.getByRole('heading',{level:1}).waitFor();
    for(const width of [320,390,768]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${channel} map fits ${width}`);}
    await page.screenshot({path:resolve(out,channel+'-tiles.png'),fullPage:true});assert.deepEqual(errors,[]);
    results.push({channel,browser:browser.version(),headed:true,nativeVisibility:true,checks:['real hidden/visible tab transitions stop animation','drawing','project download','tile route and 320/390/768 layout','no page exceptions']});
    await browser.close();browser=null;native.kill();native=null;console.log('PASS',channel);
  }
  await writeFile(resolve(out,'result.json'),JSON.stringify({status:'passed',results,notCovered:['Firefox','Safari','physical touch or stylus']},null,2));
}finally{await browser?.close();native?.kill();server.kill();}
