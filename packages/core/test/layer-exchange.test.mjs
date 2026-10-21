import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDocument,PixelEditor,encodeProject,decodePsd,encodePsd,decodeOra,encodeOra,composite} from '../dist/index.js';
import {readNativeZip,writeNativeZip} from '../dist/native-zip.js';
import {deflateRawSync} from 'node:zlib';
import {crc32} from '../dist/native-png.js';
function deflatedArchive(payload,declared=payload.length){const files=[['mimetype',Buffer.from('image/openraster'),0],['data/test.png',payload,8]],parts=[],central=[];let offset=0;for(const [path,raw,method]of files){const n=Buffer.from(path),packed=method?deflateRawSync(raw):raw,size=method?declared:raw.length,crc=crc32(raw),h=Buffer.alloc(30+n.length);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(method,8);h.writeUInt32LE(crc,14);h.writeUInt32LE(packed.length,18);h.writeUInt32LE(size,22);h.writeUInt16LE(n.length,26);n.copy(h,30);parts.push(h,packed);const d=Buffer.alloc(46+n.length);d.writeUInt32LE(0x02014b50);d.writeUInt16LE(20,6);d.writeUInt16LE(method,10);d.writeUInt32LE(crc,16);d.writeUInt32LE(packed.length,20);d.writeUInt32LE(size,24);d.writeUInt16LE(n.length,28);d.writeUInt32LE(offset,42);n.copy(d,46);central.push(d);offset+=h.length+packed.length;}const dir=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(2,8);end.writeUInt16LE(2,10);end.writeUInt32LE(dir.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...parts,dir,end]);}
const fixture=()=>{const e=new PixelEditor(createDocument(3,2,'Layer study'));e.paint(0,0,[13,23,33,73]);e.commit();e.addLayer();e.renameLayer('Hidden & 月');e.paint(2,1,[43,53,63,255]);e.commit();e.toggleLayer();e.addFrame(true);e.paint(1,1,[83,93,103,255]);e.commit();return e;};
test('PSD/ORA selected frame preserve exact RGBA, order, names and hidden pixels',async()=>{
 const d=fixture().document,before=encodeProject(d);
 for(const kind of ['psd','ora']){const out=kind==='psd'?encodePsd(d):await encodeOra(d),back=(kind==='psd'?decodePsd(out.bytes):await decodeOra(out.bytes)).document;assert.match(out.warnings.join(),/selected frame/);assert.equal(back.layers[1].visible,false);for(let i=0;i<2;i++){assert.equal(back.layers[i].name,d.layers[i].name);assert.deepEqual(back.layers[i].pixels,d.layers[i].pixels);}assert.deepEqual(composite(back),composite(d));}assert.equal(encodeProject(d),before);
});
test('PSD/ORA explicit animation frames as layers and immutable async snapshot',async()=>{
 const d=fixture().document,frames=d.frames.map(f=>composite(d,f.id)),job=encodeOra(d,'frames-as-layers');d.layers[0].pixels.fill(0);const back=(await decodeOra((await job).bytes)).document;assert.deepEqual(back.layers.map(l=>l.pixels),frames);const e=fixture();for(let i=0;i<15;i++)e.addFrame();assert.throws(()=>encodePsd(e.document,'frames-as-layers'),/16 layers/);
});
test('ORA rejects unsafe ZIP paths, checksums, expansion, DTD, groups and rendering changes',async()=>{
 const bytes=(await encodeOra(fixture().document)).bytes,files=await readNativeZip(bytes),original=new TextDecoder().decode(files.get('stack.xml'));
 for(const replacement of [original.replace('<stack>','<stack><stack>'),original.replace('opacity="1"','opacity="1.5"'),original.replace('svg:src-over','svg:multiply'),original.replace('x="0"','x="1"'),'<!DOCTYPE image [<!ENTITY e SYSTEM "https://invalid">]>'+original,original.replace('src="data/layer0.png"','src="https://invalid/p.png"')]){const f=new Map(files);f.set('stack.xml',new TextEncoder().encode(replacement));await assert.rejects(decodeOra(writeNativeZip(f)));}
 assert.throws(()=>writeNativeZip(new Map([['../bad',new Uint8Array()]])),/Unsafe/);const crc=bytes.slice();crc[40]^=1;await assert.rejects(decodeOra(crc));const bomb=bytes.slice(),v=new DataView(bomb.buffer);for(let at=0;at<bomb.length-46;at++)if(v.getUint32(at,true)===0x02014b50){v.setUint32(at+24,9*1024*1024,true);break;}await assert.rejects(decodeOra(bomb),/expansion/);
});
test('PSD rejects malformed bounds, bit depth, blend, clipping and truncated channel streams',()=>{
 const base=encodePsd(fixture().document).bytes;for(const mutate of [v=>v.setUint32(18,257),v=>v.setUint16(22,16),v=>v.setInt32(44,-1),v=>v.setUint8(95,1)]){const b=base.slice();mutate(new DataView(b.buffer));assert.throws(()=>decodePsd(b));}assert.throws(()=>decodePsd(base.subarray(0,base.length-2)));
});
test('streamed raw-deflate ZIP enforces output cap independently of forged directory sizes',async()=>{
 const payload=Buffer.alloc(100000,7),good=deflatedArchive(payload);assert.deepEqual((await readNativeZip(good)).get('data/test.png'),new Uint8Array(payload));await assert.rejects(readNativeZip(deflatedArchive(payload,8)),/expansion exceeds/);await assert.rejects(readNativeZip(deflatedArchive(payload,payload.length+1)),/Truncated ZIP expansion/);
 const bad=good.slice();bad.writeUInt16LE(1,6);await assert.rejects(readNativeZip(bad),/mismatch/);
});
