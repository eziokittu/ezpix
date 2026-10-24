import {execFileSync} from 'node:child_process';import {openSync,closeSync} from 'node:fs';import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('../',import.meta.url));
for(const name of ['ui','regressions']){const fd=openSync(new URL('../artifacts/phase13hehn-'+name+'.log',import.meta.url),'w');try{execFileSync(process.execPath,['scripts/phase13hehn-'+name+'.mjs'],{cwd,stdio:['ignore',fd,fd],windowsHide:true});}finally{closeSync(fd);}}
