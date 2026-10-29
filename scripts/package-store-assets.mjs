import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {writeNativeZip} from '../packages/core/dist/native-zip.js';
import {ENGINE_VERSION} from '../packages/core/dist/index.js';
const out='dist/store-assets';await mkdir(out,{recursive:true});
await copyFile('docs/chrome-store-ezpix-insta.md',out+'/STORE-LISTING.md');
await writeFile(out+'/UPLOAD-INSTRUCTIONS.txt',`Chrome Web Store extension package: ezpix-insta-${ENGINE_VERSION}.zip\nThis store-assets archive is NOT the extension package. Upload its icon/screenshots into the listing fields.\nKeep the existing item ID and replace its draft package.\nRead STORE-LISTING.md for copy-ready fields, privacy declarations and reviewer instructions.\nPublish privacy.html to a public HTTPS URL before submission. The intended /tools/ezpix/privacy route returned 404 when checked on 29 October 2026. No site deployment or store submission was performed.\n`);
const names=['ezpix-insta-icon-128.png','01-pixel-studio-1280x800.png','02-layers-animation-1280x800.png','03-shared-tilemaps-1280x800.png','04-capture-convert-1280x800.png','privacy.html','ARTWORK.txt','STORE-LISTING.md','UPLOAD-INSTRUCTIONS.txt'],files=new Map();for(const name of names)files.set(name,new Uint8Array(await readFile(out+'/'+name)));
const path=`dist/release/ezpix-insta-store-assets-${ENGINE_VERSION}.zip`;await writeFile(path,writeNativeZip(files));console.log('Prepared '+path+' with '+names.length+' listing/policy files. Not an extension upload package.');
