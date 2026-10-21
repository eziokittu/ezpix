// Dependency-free, deterministic npm-compatible USTAR package.
import { readFileSync,readdirSync,writeFileSync,mkdirSync } from 'node:fs';
import { resolve,join } from 'node:path';
import { gzipSync } from 'node:zlib';
const root=resolve('packages/core'),vendor=resolve('../glitchbong/vendor');
const version=JSON.parse(readFileSync(join(root,'package.json'),'utf8')).version;
if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('Invalid package version.');
function files(dir){return readdirSync(join(root,dir),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(`${dir}/${entry.name}`):[`${dir}/${entry.name}`]);}
const paths=['package.json','README.md',...files('dist')].sort(),parts=[];
for(const path of paths){
  const data=readFileSync(join(root,path)),header=Buffer.alloc(512),name=`package/${path}`;
  if(Buffer.byteLength(name)>100)throw new Error('Package path exceeds USTAR name limit.');
  header.write(name);const octal=(offset,length,value)=>header.write(value.toString(8).padStart(length-1,'0')+'\0',offset,length,'ascii');
  octal(100,8,0o644);octal(108,8,0);octal(116,8,0);octal(124,12,data.length);octal(136,12,0);
  header.fill(32,148,156);header[156]=48;header.write('ustar\0',257,6,'ascii');header.write('00',263,2,'ascii');
  const sum=header.reduce((n,b)=>n+b,0);header.write(sum.toString(8).padStart(6,'0')+'\0 ',148,8,'ascii');
  parts.push(header,data,Buffer.alloc((512-data.length%512)%512));
}
parts.push(Buffer.alloc(1024));mkdirSync(vendor,{recursive:true});const file=join(vendor,`ezpix-core-${version}.tgz`);writeFileSync(file,gzipSync(Buffer.concat(parts),{level:9}));console.log(`Packed @ezpix/core ${version} (${paths.length} files, zero timestamps).`);
