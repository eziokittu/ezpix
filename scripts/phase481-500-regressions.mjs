import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const web=resolve('../glitchbong'),out=resolve('artifacts/phase481-500');await mkdir(out,{recursive:true});
const env={...process.env,NEXT_DIST_DIR:'.next-ezpix-indexwarp500',EZPIX_EXISTING_SERVER:'1'};
const buildId=(await readFile(resolve(web,env.NEXT_DIST_DIR,'BUILD_ID'),'utf8')).trim();
const server=spawn(process.execPath,[resolve(web,'node_modules/next/dist/bin/next'),'start','-p','3791'],{cwd:web,env,stdio:'ignore',windowsHide:true});let exited=false;server.on('exit',()=>exited=true);
const results=[];
try{
 let ready=false;for(let i=0;i<120;i++){if(exited)throw Error('Test server exited. Check port 3791.');try{if((await fetch('http://localhost:3791/tools/ezpix')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}if(!ready)throw Error('Test server failed to start.');
 for(const script of ['phase481-500-ui.mjs','phase349-368-ui.mjs','phase369-388-ui.mjs','phase389-408-ui.mjs','phase409-438-ui.mjs','issues4-ui.mjs','issues4-extension.mjs','issues4-ink-qa.mjs','phase439-468-ui.mjs','issues3-website-qa.mjs','issues3-formats-qa.mjs','snapforge-workspace-qa.mjs','issues3-transfer-qa.mjs']){
  console.log('RUN '+script);let log='';const child=spawn(process.execPath,[resolve('scripts',script)],{env,stdio:['ignore','pipe','pipe'],windowsHide:true});for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{process.stdout.write(data);log+=data;});const code=await new Promise((res,rej)=>{child.on('exit',res);child.on('error',rej);});await writeFile(resolve(out,script+'.log'),log);results.push({script,code});if(code!==0)throw Error(script+' failed');
 }
 await writeFile(resolve(out,'regressions.json'),JSON.stringify({status:'passed',buildId,results},null,2)+'\n');
}finally{server.kill();}
