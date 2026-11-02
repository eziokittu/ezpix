import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const out=resolve('artifacts/resource-pages');await mkdir(out,{recursive:true});
const base=process.env.EZPIX_QA_BASE??'http://localhost:3791',browser=await chromium.launch({headless:true,executablePath:process.env.EZPIX_CHROMIUM_PATH});
const checks=[],errors=[];const check=name=>{checks.push(name);console.log('PASS',name);};
try{
 const c=await browser.newContext({viewport:{width:1440,height:1000}});const page=await c.newPage();page.setDefaultNavigationTimeout(180000);page.on('pageerror',e=>errors.push(e.message));
 for(const [route,anchor]of [['help','start'],['docs','documentation'],['faq','faq'],['privacy','privacy'],['extension','extension']]){
  const response=await page.goto(base+'/tools/ezpix/'+route+'#'+anchor);assert.equal(response.status(),200);await page.locator('.ez-resource-logo').waitFor();await page.waitForTimeout(200);
  assert.equal(await page.locator('h1').count(),1);assert.ok((await page.locator('h1').innerText()).length>8);assert.match(await page.title(),/EzPIX/);
  assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),'https://glitchbong.com/tools/ezpix/'+route);assert.ok((await page.locator('meta[name=description]').getAttribute('content')).length>70);assert.equal(await page.locator('meta[property="og:url"]').getAttribute('content'),'https://glitchbong.com/tools/ezpix/'+route);
  assert.equal(await page.locator('.ez-resource-logo').getAttribute('href'),'/tools/ezpix');
  assert.equal(await page.locator('.ez-resource-article p').first().evaluate(e=>getComputedStyle(e).textAlign),'justify');
  assert.ok(await page.locator('.ez-resource-footer a').count()>=8);
  assert.equal(await page.locator('a[href="/contact"]').count(),0);
  const target=page.locator('#'+anchor);assert.ok(await target.count());assert.ok(await target.evaluate(e=>e.getBoundingClientRect().top>=-2&&e.getBoundingClientRect().top<innerHeight));
  for(const theme of ['dark','light']){await page.getByLabel('Appearance',{exact:true}).selectOption(theme);await page.screenshot({path:resolve(out,route+'-'+theme+'.png'),fullPage:route!=='docs'});}
  const report=page.locator('.ez-resource-footer a').filter({hasText:'Report an issue'});assert.equal(await report.getAttribute('href'),'https://mail.google.com/mail/u/0/?to=glitchbong.dev@gmail.com&fs=1&tf=cm');assert.equal(await report.getAttribute('target'),'_blank');
  check(route+' branded page, anchored entry, theme, canonical/social metadata and Gmail support');
 }
 await page.goto(base+'/tools/ezpix/faq#faq');assert.ok(await page.locator('#faq details').count()>=19);await page.getByText('How do I select an object with Magic colour selection?',{exact:true}).click();assert.match(await page.locator('#faq details[open]').innerText(),/default/);check('FAQ answers include current selection and expanded workspace behaviour');
 await page.goto(base+'/tools/ezpix/docs#documentation');await page.getByRole('link',{name:'Large-workspace raw indexed PNG',exact:true}).click();await page.waitForFunction(()=>{const r=document.querySelector('#large-workspace-raw-indexed-png').getBoundingClientRect();return r.top>=-2&&r.top<150;});check('Docs navigation scrolls directly to retained technical sections');
 for(const width of [390,320]){await page.setViewportSize({width,height:800});for(const route of ['help','docs','faq','privacy','extension']){await page.goto(base+'/tools/ezpix/'+route);await page.locator('.ez-resource-logo').waitFor();assert.ok(await page.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth));if(width===390)await page.screenshot({path:resolve(out,route+'-mobile.png')});}check(width+'px pages fit without horizontal overflow');}
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/tools/ezpix');await page.getByRole('button',{name:'Use default canvas',exact:true}).click();await page.getByRole('button',{name:'Select',exact:true}).click();assert.equal(await page.getByLabel('Selection tool',{exact:true}).inputValue(),'wand');await page.locator('.ez-menus').getByText('Help',{exact:true}).click();assert.equal(await page.getByRole('link',{name:'Report a problem',exact:true}).getAttribute('href'),'https://mail.google.com/mail/u/0/?to=glitchbong.dev@gmail.com&fs=1&tf=cm');check('web editor defaults to wand selection and its issue menu opens Gmail');
 assert.deepEqual(errors,[]);await writeFile(resolve(out,'result.json'),JSON.stringify({checks,errors,browser:browser.version()},null,2));await c.close();
}finally{await browser.close();}
