// Run after build:extension. Package only production runtime files, reproducibly.
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {writeNativeZip} from '../packages/core/dist/native-zip.js';
import {ENGINE_VERSION} from '../packages/core/dist/index.js';
const expected=['app.css','app.html','app.js','background.js','converter.css','handoff.html','manifest.json','privacy.html','worker.js',...[16,32,48,128].map(s=>`icons/ezpix-insta-${s}.png`)].sort();
async function entries(dir,prefix=''){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){if(e.isSymbolicLink())throw Error('Release files must not be symlinks');const name=prefix+e.name;out.push(...(e.isDirectory()?await entries(dir+'/'+e.name,name+'/'):[name]));}return out;}
assert.deepEqual((await entries('dist/extension')).sort(),expected,'Unexpected/missing production files. Rebuild in a clean output directory.');
const files=new Map();for(const name of expected)files.set(name,new Uint8Array(await readFile('dist/extension/'+name)));
const manifest=JSON.parse(new TextDecoder().decode(files.get('manifest.json')));
assert.equal(manifest.version,ENGINE_VERSION);assert.equal(manifest.manifest_version,3);
assert.deepEqual(manifest.permissions,['activeTab','scripting','alarms','sidePanel']);
assert.equal(manifest.name,'EzPIX Insta');assert.deepEqual(manifest.externally_connectable,{matches:['https://glitchbong.com/*']});assert.equal(manifest.side_panel.default_path,'app.html');assert.equal(manifest.action.default_popup,undefined);
assert.ok(!manifest.name.includes('development'));assert.ok(!manifest.host_permissions);
assert.ok(new TextDecoder().decode(files.get('background.js')).includes('https://glitchbong.com'));
const bytes=writeNativeZip(files),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
let offset=0;for(const [name,data] of files){assert.equal(view.getUint32(offset,true),0x04034b50);const size=view.getUint32(offset+18,true),nl=view.getUint16(offset+26,true);assert.equal(new TextDecoder().decode(bytes.subarray(offset+30,offset+30+nl)),name);assert.deepEqual(bytes.subarray(offset+30+nl,offset+30+nl+size),data);offset+=30+nl+size;}
assert.equal(view.getUint32(offset,true),0x02014b50);assert.equal(view.getUint32(bytes.length-22,true),0x06054b50);
for(const [name,data] of files)if(/\.(?:html|js|css|json)$/.test(name))assert.ok(!/snapforge/i.test(new TextDecoder().decode(data)),name+' contains the old product name');
await mkdir('dist/release',{recursive:true});const path=`dist/release/ezpix-insta-${ENGINE_VERSION}.zip`;
await writeFile(path,bytes);const report={path,version:ENGINE_VERSION,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),files:expected,status:'local upload candidate; external release gates remain open'};
await writeFile(path+'.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
