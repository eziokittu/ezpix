// Isolated clean installs: never changes either working checkout's dependencies.
import {cp, mkdir, readdir, readFile, writeFile} from 'node:fs/promises';
import {resolve, relative, sep} from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const root=resolve('artifacts/phase7a/clean-'+Date.now());await mkdir(root,{recursive:true});
const useLocalEnv=process.argv.includes('--use-local-env');
const excluded=new Set(['node_modules','.git','.next','.next-standby','artifacts','dist','build','coverage','.vercel']);
const results=[];
async function command(cwd,args){
  const logfile=resolve(root,`${results.length}-${args.join('-').replace(/[^\w-]/g,'')}.log`);
  console.log(`Running ${args.join(' ')} in ${relative(root,cwd)}`);
  const chunks=[];
  const code=await new Promise((done,reject)=>{const child=spawn(process.platform==='win32'?'npm.cmd':'npm',args,{cwd,windowsHide:true,shell:process.platform==='win32',env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'}});child.stdout.on('data',b=>chunks.push(b));child.stderr.on('data',b=>chunks.push(b));child.on('error',reject);child.on('close',done);});
  await writeFile(logfile,Buffer.concat(chunks));results.push({repository:relative(root,cwd),command:['npm',...args].join(' '),exitCode:code,log:relative(root,logfile)});
  await writeFile(resolve(root,'result.json'),JSON.stringify({root,websiteEnvironment:useLocalEnv?'existing local .env.local loaded in memory, not copied':'no dotenv files copied or loaded; full site SSG requires configured database',results},null,2));assert.equal(code,0,`See ${logfile}`);
}
for(const name of ['ezpix','glitchbong']){
  const source=resolve('..',name),target=resolve(root,name);
  await mkdir(target,{recursive:true});
  for(const entry of await readdir(source)){
  if(excluded.has(entry)||entry.startsWith('.env'))continue;
  await cp(resolve(source,entry),resolve(target,entry),{recursive:true,filter:path=>{
    const parts=relative(source,path).split(sep);
    return !parts.some(p=>excluded.has(p)||p.startsWith('.env')||p.endsWith('.log')||p.endsWith('.tsbuildinfo'))&&parts.join('/')!=='src/generated';
  }});
  }
  const before=await readFile(resolve(target,'package-lock.json'),'utf8');
  await command(target,['ci','--no-audit','--no-fund']);
  assert.equal(await readFile(resolve(target,'package-lock.json'),'utf8'),before,'npm ci preserves lockfile');
  if(name==='ezpix'){await command(target,['test']);await command(target,['run','build:extension']);}
  else{if(useLocalEnv)process.loadEnvFile(resolve(source,'.env.local'));await command(target,['run','build']);await command(target,['run','test:adsense']);}
}
console.log(`PASS: clean installs, tests and production builds. ${root}`);
