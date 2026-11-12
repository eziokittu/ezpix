import {decodePhotoProject} from './photo-project.js';
import {PhotoWorkspace,type PhotoSnapshot} from './photo-workspace.js';
import {decodeProject,type PixelDocument} from './document.js';
import {decodeGif} from './native-gif.js';
import {decodeBmp,decodeQoi} from './raster-exchange.js';
import {readArtworkImage,downloadFile} from './browser.js';
import type {Raster} from './conversion.js';
export async function decodeSharedArtwork(file:File):Promise<{document?:PixelDocument;source?:Raster;photo?:PhotoSnapshot}>{
  if(file.size<1||file.size>24*1024*1024)throw Error('Choose an image or project up to 24 MiB.');
  const name=file.name.toLowerCase();
  if(name.endsWith('.ezphoto')){const photo=decodePhotoProject(await file.text());const workspace=new PhotoWorkspace(photo.original);workspace.restore(photo);return {photo,source:workspace.render()[0]};}
  if(name.endsWith('.ezpix'))return {document:decodeProject(await file.text())};
  if(file.type==='image/gif'||name.endsWith('.gif'))return {document:decodeGif(new Uint8Array(await file.arrayBuffer()),file.name).document};
  if(file.type==='image/bmp'||name.endsWith('.bmp'))return {source:decodeBmp(new Uint8Array(await file.arrayBuffer()))};
  if(file.type==='image/qoi'||name.endsWith('.qoi'))return {source:decodeQoi(new Uint8Array(await file.arrayBuffer()))};
  return {source:await readArtworkImage(file)};
}
export async function saveSharedFile(file:File):Promise<boolean>{
  const picker=(window as unknown as {showSaveFilePicker?:(options:{suggestedName:string})=>Promise<{createWritable:()=>Promise<{write:(blob:Blob)=>Promise<void>;close:()=>Promise<void>}>}>}).showSaveFilePicker;
  if(!picker){downloadFile(file,file.name);return true;}
  try{const handle=await picker({suggestedName:file.name}),writer=await handle.createWritable();await writer.write(file);await writer.close();return true;}catch(error){if((error as Error).name==='AbortError')return false;throw error;}
}
