import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {PALETTE_FORMATS,encodePaletteFile,decodePaletteFile} from '../packages/core/dist/index.js';
const out=resolve('artifacts/phase10b'),require=createRequire(import.meta.url),ase=require(resolve(out,'independent/node_modules/ase-utils'));await build({entryPoints:[resolve(out,'independent/node_modules/adobe-aco/build/index.js')],bundle:true,platform:'node',format:'esm',outfile:resolve(out,'independent-aco.mjs')});const aco=await import(pathToFileURL(resolve(out,'independent-aco.mjs')));
await mkdir(out,{recursive:true});const colors=['#000000','#ff0000','#123456','#abcdef','#ffffff'],rgb=colors.map(h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)));
for(const format of Object.keys(PALETTE_FORMATS)){const file=encodePaletteFile(colors,format);await writeFile(resolve(out,file.filename),file.bytes);}
const externalAse=ase.decode(Buffer.from(encodePaletteFile(colors,'ase').bytes));assert.deepEqual(externalAse.colors.map(c=>c.color.map(n=>Math.round(n*255))),rgb);assert.ok(externalAse.colors.every(c=>c.type==='normal'));
const fromAse=new Uint8Array(ase.encode({version:'1.0',groups:[],colors:rgb.map((c,i)=>({name:`External ${i}`,model:'RGB',color:c.map(n=>n/255),type:'normal'}))}));await writeFile(resolve(out,'foreign.ase'),fromAse);assert.deepEqual(decodePaletteFile(fromAse,'foreign.ase').colors,colors);
const bytes=encodePaletteFile(colors,'aco').bytes;assert.deepEqual(aco.readAcoFile(bytes.buffer).map(c=>c[0].map(Math.round)),rgb);const fromAco=new Uint8Array(aco.createAcoFile(rgb.map((c,i)=>[c,'rgb',`External ${i}`])));await writeFile(resolve(out,'foreign.aco'),fromAco);assert.deepEqual(decodePaletteFile(fromAco,'foreign.aco').colors,colors);
// Existing Pillow independently interprets GPL RGB rows; stdlib independently inspects other simple containers.
const python=JSON.parse(execFileSync('python',['scripts/phase10b-independent.py',out],{encoding:'utf8',windowsHide:true}));assert.deepEqual(python.gpl,rgb);for(const format of ['ezpalette','hex','jasc','riff','act'])assert.deepEqual(python[format],rgb);
const licences={};for(const [pkg,file]of [['ase-utils','LICENSE.md'],['adobe-aco','LICENSE']]){const root=resolve(out,'independent/node_modules',pkg);licences[pkg]={version:JSON.parse(await readFile(resolve(root,'package.json'),'utf8')).version,license:(await readFile(resolve(root,file),'utf8')).split('\n')[0]};}
await writeFile(resolve(out,'independent-result.json'),JSON.stringify({status:'passed',licences,pillow:python.pillow,checks:['independent ASE reader/writer exact RGB and normal colour type','independent ACO reader/writer including v1/v2 sections','Pillow GPL loader and Python stdlib EzPix/HEX/JASC/RIFF/ACT readers']},null,2));console.log('PASS independent palette reader/writer checks',licences);
