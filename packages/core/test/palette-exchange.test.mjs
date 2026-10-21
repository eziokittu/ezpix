import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decodePaletteFile,encodePaletteFile,PALETTE_FORMATS,PixelEditor,createDocument,encodeProject,decodeProject} from '../dist/index.js';
const colors=['#000000','#ff0000','#123456','#ffffff'],text=s=>new TextEncoder().encode(s);
test('eight palette families preserve exact ordered RGB in golden roundtrips',()=>{
 for(const format of Object.keys(PALETTE_FORMATS)){const result=encodePaletteFile(colors,format),back=decodePaletteFile(result.bytes,result.filename);assert.equal(back.format,format);assert.deepEqual(back.colors,colors);assert.ok(result.bytes.length<=16384);}const maximum=Array.from({length:256},(_,i)=>'#0000'+i.toString(16).padStart(2,'0'));for(const format of Object.keys(PALETTE_FORMATS)){const file=encodePaletteFile(maximum,format);assert.deepEqual(decodePaletteFile(file.bytes,file.filename).colors,maximum);}assert.deepEqual([...encodePaletteFile(['#123456'],'riff').bytes.slice(-4)],[18,52,86,0]);assert.deepEqual([...encodePaletteFile(['#123456'],'aco').bytes.slice(4,14)],[0,0,18,18,52,52,86,86,0,0]);
});
test('external text palettes, names, duplicate order and precision losses are explicit',()=>{
 const gpl=decodePaletteFile(text('GIMP Palette\nName: Example\nColumns: 2\n# Test\n18 52 86 Named\n255 0 0 Red\n18 52 86 Again\n'),'external.gpl');assert.deepEqual(gpl.colors,['#123456','#ff0000']);assert.match(gpl.warnings.join(),/names/);assert.match(gpl.warnings.join(),/Duplicate/);
 assert.deepEqual(decodePaletteFile(text('JASC-PAL\r\n0100\r\n2\r\n0 127 255\r\n18 52 86\r\n'),'external.pal').colors,['#007fff','#123456']);assert.deepEqual(decodePaletteFile(text(';comment\n123456\n#ABCDEF\n'),'external.hex').colors,['#123456','#abcdef']);
 const aco=encodePaletteFile(['#123456'],'aco').bytes.slice();new DataView(aco.buffer).setUint16(6,1);new DataView(aco.buffer).setUint16(20,1);const rounded=decodePaletteFile(aco,'precision.aco');assert.equal(rounded.colors[0],'#003456');assert.match(rounded.warnings.join(),/rounded/);
});
test('hostile counts, sizes, flags, colour spaces, alpha and malformed framing fail',()=>{
 for(const [s,name]of [['','empty.hex'],['#abcd','bad.hex'],['#ff0000\nhttps://invalid','bad.hex'],['JASC-PAL\n0100\n2\n1 2 3\n','bad.pal'],['GIMP Palette\n256 0 0\n','bad.gpl'],[Array(257).fill('123456').join('\n'),'many.hex']])assert.throws(()=>decodePaletteFile(text(s),name));assert.throws(()=>decodePaletteFile(new Uint8Array(16385),'big.gpl'));
 for(const format of ['ase','aco','riff']){const result=encodePaletteFile(colors,format);assert.throws(()=>decodePaletteFile(result.bytes.slice(0,-1),result.filename));}
 const act=encodePaletteFile(colors,'act').bytes.slice();new DataView(act.buffer).setUint16(770,0);assert.throws(()=>decodePaletteFile(act,'transparent.act'),/transparency/);
 const aco=encodePaletteFile(colors,'aco').bytes.slice();new DataView(aco.buffer).setUint16(4,2);assert.throws(()=>decodePaletteFile(aco,'cmyk.aco'),/Only RGB/);
 const ase=encodePaletteFile(colors,'ase').bytes.slice();new DataView(ase.buffer).setFloat32(40,NaN);assert.throws(()=>decodePaletteFile(ase,'nan.ase'));
 const riff=encodePaletteFile(colors,'riff').bytes.slice();riff[27]=1;assert.throws(()=>decodePaletteFile(riff,'flags.pal'),/flags/);
});
test('palette staging is pure; apply is one undo and v6 persistence never recolours pixels',()=>{
 const e=new PixelEditor(createDocument(1,1));e.paint(0,0,[11,22,33,44]);e.commit();const before=encodeProject(e.document),out=encodePaletteFile(colors,'gpl'),stage=decodePaletteFile(out.bytes,out.filename);assert.equal(encodeProject(e.document),before);e.setPalette(stage.colors);assert.deepEqual([...e.document.cel.pixels],[11,22,33,44]);assert.deepEqual(decodeProject(encodeProject(e.document)).palette,colors);e.undo();assert.equal(encodeProject(e.document),before);e.redo();assert.deepEqual(e.document.palette,colors);
});
