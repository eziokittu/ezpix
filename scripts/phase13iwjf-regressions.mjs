import {execFileSync,spawn} from 'node:child_process';import {openSync,closeSync} from 'node:fs';import {resolve} from 'node:path';
const env={...process.env};
const runSync=(name,args,extra={})=>{console.log('START',name);const fd=openSync('artifacts/phase13iwjf-'+name+'.log','w');try{execFileSync(args[0],args.slice(1),{stdio:['ignore',fd,fd],windowsHide:true,env:{...env,...extra}});}finally{closeSync(fd);}console.log('PASS',name);};
const run=(name,args)=>new Promise((resolve,reject)=>{console.log('START',name);const fd=openSync('artifacts/phase13iwjf-'+name+'.log','w'),child=spawn(args[0],args.slice(1),{stdio:['ignore',fd,fd],windowsHide:true,env});child.on('error',e=>{closeSync(fd);reject(e);});child.on('exit',code=>{closeSync(fd);if(code===0){console.log('PASS',name);resolve();}else reject(new Error(name+' exited '+code));});});
if(!process.argv.includes('--ui-only')){
 runSync('render-fixtures',[process.execPath,'scripts/phase13iwjf-independent.mjs']);
 for(const [name,file] of [['pressure-fixtures','phase13isiv-independent.mjs'],['inks-fixtures','phase13iiir-independent.mjs'],['native-fixtures','phase13hoih-independent.mjs']])runSync(name,[process.execPath,'scripts/'+file]);
 for(const [name,file]of [['mask-fixtures','phase13hehn-independent.mjs'],['geometry-fixtures','phase13guhd-independent.mjs'],['canvas-fixtures','phase13gkgt-independent.mjs'],['storage-fixtures','phase13gagj-independent.mjs']])runSync(name,[process.execPath,'scripts/'+file]);
}
if(process.argv.includes('--fixtures-only'))process.exit(0);
runSync('render-ui',[process.execPath,'scripts/phase13iwjf-ui.mjs']);
runSync('pressure-ui',[process.execPath,'scripts/phase13isiv-ui.mjs']);
runSync('inks-ui',[process.execPath,'scripts/phase13iiir-ui.mjs']);
// One full production server, independent ephemeral Chrome contexts. Two suites
// may share serving; these are correctness checks, never latency/peak-RAM proof.
const web=resolve('../glitchbong'),server=spawn(process.execPath,[resolve(web,'node_modules/next/dist/bin/next'),'start','-p','3791'],{cwd:web,windowsHide:true,stdio:'ignore'});
try{
 for(let i=0;i<120;i++){try{if((await fetch('http://localhost:3791/tools/ezpix')).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
 const branchA=async()=>{
  await run('indexed-mask-ui',[process.execPath,'scripts/phase13hehn-ui.mjs']);
  await run('indexed-mask-downloads',['python','-X','utf8','scripts/phase13hehn-browser-readers.py']);
  await run('geometry-ui',[process.execPath,'scripts/phase13guhd-ui.mjs']);
  await run('geometry-guards',[process.execPath,'scripts/phase13guhd-ui-extra.mjs']);
  await run('geometry-downloads',['python','-X','utf8','scripts/phase13guhd-browser-readers.py']);
  await run('studio-ui',[process.execPath,'scripts/phase13gagj-ui.mjs']);
  await run('studio-extra',[process.execPath,'scripts/phase13gagj-ui-extra.mjs']);
  await run('studio-downloads',['python','-X','utf8','scripts/phase13gagj-browser-readers.py']);
 };
 const branchB=async()=>{
  await run('rgba-mask-ui',[process.execPath,'scripts/phase13blbz-ui.mjs']);
  await run('canvas-ui',[process.execPath,'scripts/phase13gkgt-ui.mjs']);
  await run('canvas-downloads',['python','-X','utf8','scripts/phase13gkgt-browser-readers.py']);
  await run('drawing-ui',[process.execPath,'scripts/phase9b-drawing.mjs']);
  await run('native-ui',[process.execPath,'scripts/phase13hoih-ui.mjs']);
 };
 const results=await Promise.allSettled([branchA(),branchB()]);for(const result of results)if(result.status==='rejected')throw result.reason;
}finally{server.kill();await new Promise(r=>server.exitCode===null?server.once('exit',r):r());}
// Real companion runs alone with its own server and actual toolbar activeTab.
runSync('companion',[process.execPath,'scripts/phase23-e2e.mjs'],{EZPIX_CHROMIUM_PATH:'C:/Users/User/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',EZPIX_QA_HARNESS:'0',EZPIX_QA_PHASE8D:'1',EZPIX_QA_RASTER:'1',EZPIX_QA_LEGACY:'1',EZPIX_QA_OUTPUT:'1'});
