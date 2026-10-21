// Real production UI input and downloaded-project checks; synthetic art only.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {decodeProject,composite} from '../packages/core/dist/index.js';
const web=resolve('../glitchbong'),out=resolve('artifacts/phase9b'),base='http://localhost:3791';
await mkdir(out,{recursive:true});
const server=spawn(process.execPath,[resolve(web,'node_modules/next/dist/bin/next'),'start','-p','3791'],{cwd:web,stdio:'ignore',windowsHide:true});
let browser;
try{
  let ready=false;for(let i=0;i<90;i++){try{if((await fetch(base+'/tools/ezpix')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready);
  browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  const button=name=>page.getByRole('button',{name,exact:true}),canvas=page.locator('.ez-canvas'),viewport=page.locator('.ez-viewport');
  const key=async value=>{await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press(value);};
  const pixels=()=>canvas.evaluate(c=>[...c.getContext('2d').getImageData(0,0,c.width,c.height).data]);
  const count=async()=>{const p=await pixels();return p.filter((v,i)=>i%4===3&&v>0).length;};
  const clickPixel=async(x,y)=>{const b=await canvas.boundingBox(),w=Number(await canvas.getAttribute('width'));await page.mouse.click(b.x+(x+.5)*b.width/w,b.y+(y+.5)*b.height/w);};
  const size=async n=>{await page.getByLabel('Brush size',{exact:true}).fill(String(n));await page.getByLabel('Brush size',{exact:true}).press('Enter');};
  const download=async name=>{const event=page.waitForEvent('download');await key('Control+s');const file=await event;await file.saveAs(resolve(out,name));const doc=decodeProject(await readFile(resolve(out,name),'utf8'));await button('Dismiss save notification').click();return doc;};
  await page.goto(base+'/tools/ezpix');await page.getByRole('dialog',{name:'Start a new sprite',exact:true}).waitFor();
  await page.getByLabel('Project name',{exact:true}).fill('Input gates');await page.getByLabel('Canvas width',{exact:true}).fill('64');await button('Create sprite').click();
  assert.equal(await page.locator('.ez-pixel-cursor').count(),0,'no initial corner marker');
  await canvas.focus();assert.equal(await page.locator('.ez-pixel-cursor').count(),0,'focus alone creates no marker');
  await canvas.press('ArrowRight');assert.equal(await page.locator('.ez-pixel-cursor').count(),1);
  await key('e');assert.equal(await button('Eraser').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('.ez-pixel-cursor').count(),0);
  for(const [shortcut,name] of [['f','Fill'],['i','Pick'],['h','Pan'],['l','Line'],['r','Rectangle'],['o','Ellipse'],['m','Select'],['b','Pencil']]){await button('Download project').focus();await page.keyboard.press(shortcut);assert.equal(await button(name).getAttribute('aria-pressed'),'true',shortcut+' works with toolbar focus');}
  await size(3);await clickPixel(10,10);assert.equal(await count(),9,'3px square stamp');
  await key('Control+z');assert.equal(await count(),0,'global undo');await key('Control+y');assert.equal(await count(),9,'global redo');await key('Control+Shift+z');assert.equal(await count(),9);
  await key('Control+z');const before=await canvas.boundingBox();await button('Choose pencil tip').click();
  const tips=page.getByRole('dialog',{name:'Pencil tips',exact:true});await tips.waitFor({state:'visible'});
  const a=await button('Square pencil').boundingBox(),b=await button('Round pencil').boundingBox();assert.ok(Math.abs(a.y-b.y)<2&&b.x>a.x,'horizontal tips');assert.deepEqual(await canvas.boundingBox(),before,'flyout does not shift workspace');
  await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');assert.equal(await tips.isVisible(),false);await clickPixel(10,10);assert.equal(await count(),5,'round 3px cross stamp');
  await key('Control+z');await key(']');assert.equal(await page.getByLabel('Brush size',{exact:true}).inputValue(),'4');await key('[');assert.equal(await page.getByLabel('Brush size',{exact:true}).inputValue(),'3');
  // Interpolated round stroke, one undo, independent sized eraser.
  const cb=await canvas.boundingBox();await page.mouse.move(cb.x+10.5*6,cb.y+10.5*6);await page.mouse.down();await page.mouse.move(cb.x+20.5*6,cb.y+10.5*6,{steps:2});await page.mouse.up();assert.equal(await count(),35);const stroke=await pixels();assert.deepEqual([...composite(await download('round-stroke.ezpix'))],stroke,'brush pixels survive real project download');
  await key('e');assert.equal(await page.getByLabel('Brush size',{exact:true}).inputValue(),'1');await size(3);await clickPixel(15,10);assert.equal(await count(),26);await key('Control+z');assert.deepEqual(await pixels(),stroke);await key('Control+z');assert.equal(await count(),0);await key('b');assert.equal(await page.getByLabel('Brush size',{exact:true}).inputValue(),'3');
  // Pan both canvas and gutter, without replacing an active selection or tool.
  for(let i=0;i<14;i++)await button('Zoom in').click();
  const pan=async(gutter=false)=>{await viewport.evaluate((e,gutter)=>{e.scrollLeft=gutter?0:100;e.scrollTop=gutter?0:100;},gutter);const v=await viewport.boundingBox(),c=await canvas.boundingBox(),start=gutter?{x:v.x+3,y:v.y+3}:{x:Math.max(c.x+180,v.x+100),y:Math.max(c.y+180,v.y+100)};await page.mouse.move(start.x,start.y);await page.mouse.down({button:'middle'});await page.mouse.move(start.x-55,start.y-45,{steps:5});await page.mouse.up({button:'middle'});const scroll=await viewport.evaluate(e=>({x:e.scrollLeft,y:e.scrollTop}));assert.ok(scroll.x>=(gutter?50:150)&&scroll.y>=(gutter?40:140),'middle pan scrolls '+JSON.stringify(scroll));};
  await pan();await pan(true);assert.equal(await count(),0);assert.equal(await button('Pencil').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('.ez-brush-cursor').count(),0);
  await viewport.evaluate(e=>{e.scrollLeft=0;e.scrollTop=0;});await key('m');const sel=await canvas.boundingBox();await page.mouse.move(sel.x+30,sel.y+30);await page.mouse.down();await page.mouse.move(sel.x+70,sel.y+70);await page.mouse.up();assert.equal(await page.locator('.ez-selection-box').count(),1);const selection=await page.locator('.ez-selection-box').getAttribute('style');await pan();assert.equal(await page.locator('.ez-selection-box').getAttribute('style'),selection);assert.equal(await page.getByRole('dialog',{name:'Finish your preview',exact:true}).count(),0);await canvas.press('Escape');
  await key('b');await button('Palette').click();
  const hex=page.getByLabel('Hex colour',{exact:true});await hex.fill('');await hex.pressSequentially('#12abef');await hex.press('Enter');assert.equal(await page.getByLabel('Red',{exact:true}).inputValue(),'18');assert.equal(await button('Pencil').getAttribute('aria-pressed'),'true','typing tool letters does not switch');
  await hex.fill('garbag');await hex.press('Enter');assert.equal(await hex.getAttribute('aria-invalid'),'true');assert.equal(await page.getByLabel('Palette drawing colour',{exact:true}).inputValue(),'#12abef');await hex.press('Escape');assert.equal(await hex.inputValue(),'#12abef');
  await page.getByLabel('Red',{exact:true}).fill('255');await page.getByLabel('Red',{exact:true}).press('Enter');assert.equal(await hex.inputValue(),'#ffabef');
  await page.getByLabel('Saturation',{exact:true}).fill('100');await page.getByLabel('Brightness',{exact:true}).fill('100');await page.getByLabel('Hue',{exact:true}).fill('240');assert.equal(await hex.inputValue(),'#0000ff');
  await hex.fill('#123abc');await hex.press('Enter');await button('Add drawing colour').click();assert.equal(await button('Add drawing colour').isDisabled(),true);await button('Move colour left').click();
  let project=await download('palette-added.ezpix');assert.equal(project.palette.at(-2),'#123abc');assert.ok([...composite(project)].every(v=>v===0));
  await hex.fill('#789abc');await hex.press('Enter');await button('Replace selected colour').click();project=await download('palette-edited.ezpix');assert.equal(project.palette.at(-2),'#789abc');assert.ok(!project.palette.includes('#123abc'));
  await button('Remove selected colour').click();assert.equal(await button('Use #789abc').count(),0);await key('Control+z');assert.equal(await button('Use #789abc').count(),1,'palette removal undo');await key('Control+y');assert.equal(await button('Use #789abc').count(),0);
  await page.screenshot({path:resolve(out,'colour-desktop.png')});
  await key('Control+n');await page.getByRole('dialog',{name:'New canvas',exact:true}).waitFor();await page.getByLabel('Project name',{exact:true}).fill('bee flower');await page.keyboard.press('e');assert.equal(await button('Pencil').getAttribute('aria-pressed'),'true','modal typing protected');await button('Close New canvas').click();
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:844});await button('Choose pencil tip').click();await tips.waitFor({state:'visible'});const bounds=await tips.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width);await page.screenshot({path:resolve(out,`tips-${width}.png`)});await page.keyboard.press('Escape');const dims=await page.evaluate(()=>[innerWidth,document.documentElement.scrollWidth,innerHeight,document.documentElement.scrollHeight]);assert.ok(dims[1]<=dims[0]&&dims[3]<=dims[2],JSON.stringify(dims));}
  const touch=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),phone=await touch.newPage();phone.on('pageerror',e=>errors.push(e.message));await phone.goto(base+'/tools/ezpix');await phone.getByRole('button',{name:'Use default canvas',exact:true}).tap();await phone.getByRole('button',{name:'Choose pencil tip',exact:true}).tap();await phone.getByRole('button',{name:'Round pencil',exact:true}).tap();await phone.getByLabel('Brush size',{exact:true}).fill('3');await phone.getByLabel('Brush size',{exact:true}).press('Enter');const tc=phone.locator('.ez-canvas'),tb=await tc.boundingBox(),tv=await phone.locator('.ez-viewport').boundingBox();await phone.touchscreen.tap(Math.max(tb.x+25,tv.x+25),Math.max(tb.y+25,tv.y+25));assert.equal(await tc.evaluate(c=>[...c.getContext('2d').getImageData(0,0,c.width,c.height).data].filter((v,i)=>i%4===3&&v>0).length),5,'emulated touch uses round brush');await phone.screenshot({path:resolve(out,'touch-390.png')});await touch.close();
  assert.deepEqual(errors,[]);await writeFile(resolve(out,'result.json'),JSON.stringify({status:'passed',browser:await browser.version(),production:true,checks:['tool shortcuts outside canvas; typing/modal guards','global undo/redo and decoded Ctrl+S downloads','no persistent top-left cursor','square/round sized strokes, erasing and one-stroke undo','keyboard horizontal tip flyout and stable canvas','middle-button canvas/gutter pan and preserved pending selection','hex validation, HSV and RGB editing','palette add/replace/remove/reorder, undo and saved bytes','320/390/768/1440 overlay bounds; emulated touch round stamp; no page errors']},null,2));console.log('PASS: phase 9b drawing and input production checks');
}catch(error){console.error(error);for(const context of browser?.contexts()??[])for(const [i,page]of context.pages().entries())await page.screenshot({path:resolve(out,`failure-${i}.png`)}).catch(()=>{});process.exitCode=1;}
finally{await browser?.close();server.kill();}
