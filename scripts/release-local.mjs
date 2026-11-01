// One reproducible local release gate. Never commits, deploys, uploads or submits.
import {spawn} from 'node:child_process';
import {createWriteStream} from 'node:fs';
import {mkdir,readFile,writeFile,readdir,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
const root=resolve(import.meta.dirname,'..'),web=resolve(root,'../glitchbong'),out=resolve(root,'artifacts/studio-release');
await mkdir(out,{recursive:true});
const npm=process.env.npm_execpath;if(!npm)throw Error('Run npm run release:local so the installed npm CLI is known.');
const env={...process.env,NEXT_DIST_DIR:'.next-ezpix-studio-release'};
const exists=async path=>{try{await access(path);return true;}catch{return false;}};
if(!env.EZPIX_CHROMIUM_PATH){
 const expected=chromium.executablePath();
 if(await exists(expected))env.EZPIX_CHROMIUM_PATH=expected;
 else{
  const cache=env.PLAYWRIGHT_BROWSERS_PATH??resolve(env.LOCALAPPDATA??resolve(env.HOME??'.','.cache'),'ms-playwright');
  const revisions=(await readdir(cache).catch(()=>[])).filter(name=>/^chromium-\d+$/.test(name)).sort((a,b)=>Number(b.slice(9))-Number(a.slice(9)));
  for(const revision of revisions){for(const relative of ['chrome-win64/chrome.exe','chrome-linux/chrome','chrome-linux64/chrome','chrome-mac/Chromium.app/Contents/MacOS/Chromium']){const candidate=resolve(cache,revision,relative);if(await exists(candidate)){env.EZPIX_CHROMIUM_PATH=candidate;break;}}if(env.EZPIX_CHROMIUM_PATH)break;}
  if(!env.EZPIX_CHROMIUM_PATH)throw Error('No installed extension-capable Chromium was found. Set EZPIX_CHROMIUM_PATH before running the local release gate.');
 }
}
const report={version:JSON.parse(await readFile(resolve(root,'extension/manifest.json'),'utf8')).version,engineVersion:JSON.parse(await readFile(resolve(root,'packages/core/package.json'),'utf8')).version,startedAt:new Date().toISOString(),status:'running',checks:[],externalGates:['product licence/name decision','hosted matching engine and HTTPS privacy policy','assigned store ID install/update and representative real-page qualification','physical devices, non-Chromium, accessibility and endurance/minimum hardware','owner-authorised store submission and external approval']};
report.browserExecutable=env.EZPIX_CHROMIUM_PATH;
async function save(){await writeFile(resolve(out,'local-release-result.json'),JSON.stringify(report,null,2)+'\n');}
async function run(name,command,args,cwd=root){
 const path=resolve(out,name+'.log'),log=createWriteStream(path),start=Date.now();
 const code=await new Promise((done,reject)=>{const child=spawn(command,args,{cwd,env,windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});child.on('error',reject);child.on('close',done);});
 await new Promise(done=>log.end(done));report.checks.push({name,passed:code===0,seconds:Math.round((Date.now()-start)/1000),log:path});await save();
 if(code!==0){console.error((await readFile(path,'utf8')).slice(-5000));throw Error(name+' failed; see '+path);}console.log('PASS '+name);
}
let server;
await save();
try{
 await run('sync-core',process.execPath,['scripts/sync-ezpix-core.mjs','--offline-copy'],web);
 await run('extension-package',process.execPath,[npm,'run','package:extension']);
 // Pin website handoff trust to this exact unpacked development build during QA.
 const extension=resolve(root,'dist/extension-dev');
 const probe=await chromium.launchPersistentContext(resolve(out,'id-profile'),{headless:true,executablePath:env.EZPIX_CHROMIUM_PATH,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
 try{const worker=probe.serviceWorkers()[0]??await probe.waitForEvent('serviceworker');env.NEXT_PUBLIC_EZPIX_EXTENSION_ID=new URL(worker.url()).host;env.EZPIX_QA_EXTENSION_ID=env.NEXT_PUBLIC_EZPIX_EXTENSION_ID;}finally{await probe.close();}
 await run('website-build',process.execPath,[npm,'run','build'],web);
 await run('website-lint',process.execPath,['node_modules/eslint/bin/eslint.js','src/app/tools/ezpix'],web);
 await run('route-policy',process.execPath,[npm,'run','test:adsense'],web);
 await run('package-integrity',process.execPath,['scripts/verify-package.mjs']);

 await run('store-screenshots',process.execPath,['scripts/floating-store-assets.mjs']);
 await run('store-assets-package',process.execPath,['scripts/package-store-assets.mjs']);

 server=spawn(process.execPath,[resolve(web,'node_modules/next/dist/bin/next'),'start','-p','3791'],{cwd:web,env,windowsHide:true,stdio:'ignore'});
 let ready=false;for(let i=0;i<120;i++){if(server.exitCode!==null)throw Error('Website QA server exited.');try{if((await fetch('http://localhost:3791/tools/ezpix')).ok){ready=true;break;}}catch{}await new Promise(done=>setTimeout(done,500));}if(!ready)throw Error('Website QA server did not start.');
 env.EZPIX_QA_WEBSITE='http://localhost:3791/tools/ezpix';env.EZPIX_QA_MEDIA='1';
 await run('toolbar-popup-capture-handoff',process.execPath,['scripts/toolbar-popup-qa.mjs']);
 await run('website-launch',process.execPath,['scripts/website-launch-qa.mjs']);
 await run('website-security-ui',process.execPath,['scripts/website-audit-qa.mjs']);
 env.EZPIX_AUDIT_PHASE='release';await run('website-performance',process.execPath,['scripts/website-performance-qa.mjs']);
 await run('automatic-handoff-safeguards',process.execPath,['scripts/automatic-handoff-qa.mjs']);
 await run('raw-indexed-website',process.execPath,['scripts/raw-indexed-png-ui.mjs']);
 await run('independent-conversion', 'python', ['scripts/floating-studio-reference.py']);
 await run('independent-archive','python',['scripts/phase481-500-release.py']);
 report.status='local checks passed; publication and broader roadmap remain open';await save();
 console.log('Local evidence: '+resolve(out,'local-release-result.json'));
}catch(error){report.status='failed';await save();throw error;}finally{server?.kill();}
