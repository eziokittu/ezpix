import { MAX_SOURCE_PIXELS,validateRaster, type Raster } from './conversion.js';
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
/** Read PNG/JPEG dimensions before codec allocation; SVG, animation and remote URLs are excluded. */
export function imageDimensions(bytes: Uint8Array): { width: number; height: number } {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length >= 24 && [137,80,78,71,13,10,26,10].every((n,i) => bytes[i] === n) && String.fromCharCode(...bytes.subarray(12,16)) === 'IHDR') {
    for(let i=8;i+12<=bytes.length;){const length=v.getUint32(i);if(i+12+length>bytes.length)break;const type=String.fromCharCode(...bytes.subarray(i+4,i+8));if(type==='acTL')throw new Error('Animated PNG is not supported. Import a static sprite sheet.');if(type==='IEND')break;i+=12+length;}
    return { width: v.getUint32(16), height: v.getUint32(20) };
  }
  if (bytes[0] === 255 && bytes[1] === 216) {
    let i = 2;
    while (i + 4 <= bytes.length) {
      if (bytes[i++] !== 255) break;
      while (bytes[i] === 255) i++;
      const marker = bytes[i++];
      if (marker === 218 || marker === 217) break;
      if (marker === 1 || marker >= 208 && marker <= 215) continue;
      if (i + 2 > bytes.length) break;
      const length = v.getUint16(i);
      if (length < 2 || i + length > bytes.length) break;
      if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker) && length >= 7) return { width: v.getUint16(i + 5), height: v.getUint16(i + 3) };
      i += length;
    }
  }
  if(bytes.length>=30&&String.fromCharCode(...bytes.subarray(0,4))==='RIFF'&&String.fromCharCode(...bytes.subarray(8,12))==='WEBP'){
    const type=String.fromCharCode(...bytes.subarray(12,16));if(type==='VP8X'){if(bytes[20]&2)throw new Error('Animated WebP needs video/animation import.');return {width:1+bytes[24]+bytes[25]*256+bytes[26]*65536,height:1+bytes[27]+bytes[28]*256+bytes[29]*65536};}
    if(type==='VP8L'&&bytes[20]===47){const n=v.getUint32(21,true);return {width:(n&16383)+1,height:((n>>>14)&16383)+1};}
    if(type==='VP8 '&&bytes[23]===157&&bytes[24]===1&&bytes[25]===42)return {width:v.getUint16(26,true)&16383,height:v.getUint16(28,true)&16383};
  }
  throw new Error('Choose a valid PNG, JPEG or static WebP image.');
}
export async function readImage(blob: Blob): Promise<Raster> {
  if (blob.size > MAX_IMAGE_BYTES) throw new Error('Image exceeds 20 MiB.');
  const dimensions = imageDimensions(new Uint8Array(await blob.arrayBuffer()));
  if (!dimensions.width || !dimensions.height || dimensions.width * dimensions.height > MAX_SOURCE_PIXELS) throw new Error('Image exceeds 4 megapixels. Resize it before importing.');
  const bitmap = await createImageBitmap(blob);
  try {
    if (bitmap.width * bitmap.height > MAX_SOURCE_PIXELS) throw new Error('Decoded image exceeds 4 megapixels.');
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas is unavailable.');
    ctx.drawImage(bitmap, 0, 0);
    return { width: bitmap.width, height: bitmap.height, pixels: ctx.getImageData(0, 0, bitmap.width, bitmap.height).data };
  } finally { bitmap.close(); }
}
export function paintRaster(canvas: HTMLCanvasElement, source: Raster) {
  canvas.width = source.width; canvas.height = source.height;
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(source.pixels), source.width, source.height), 0, 0);
}
export function downloadFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/** Restricted self-contained vector input: no scripts, remote assets, stylesheets or fonts. */
export async function readArtworkImage(file:Blob):Promise<Raster>{
 if(file.type!=='image/svg+xml')return readImage(file);
 if(file.size>1024*1024)throw new Error('SVG exceeds 1 MiB.');const xml=await file.text();if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('SVG entities are unsupported.');
 const svg=new DOMParser().parseFromString(xml,'image/svg+xml'),root=svg.documentElement,allowed=new Set(['svg','g','path','rect','circle','ellipse','line','polygon','polyline','defs','linearGradient','radialGradient','stop','clipPath','mask','title','desc']);
 if(root.localName!=='svg'||svg.querySelector('parsererror'))throw new Error('Invalid SVG.');
 for(const el of [root,...root.querySelectorAll('*')]){if(!allowed.has(el.localName)||el.namespaceURI!=='http://www.w3.org/2000/svg')throw new Error('SVG contains an unsupported element.');for(const a of el.attributes){if(/^on/i.test(a.localName)||a.localName==='style'||a.localName==='src'||/href$/i.test(a.localName)&&!a.value.startsWith('#')||/\\|javascript:|https?:|data:|@/i.test(a.value)&&!a.name.startsWith('xmlns')||/url\(\s*[^#]/i.test(a.value))throw new Error('SVG must be self-contained, with presentation attributes and no scripts/styles/external resources.');}}
 const view=(root.getAttribute('viewBox')??'').trim().split(/[ ,]+/).map(Number),dim=(name:string,index:number)=>{const value=root.getAttribute(name);if(value&&/^\d+(?:\.\d+)?(?:px)?$/.test(value))return Math.ceil(parseFloat(value));return view.length===4?Math.ceil(view[index]):0;},width=dim('width',2),height=dim('height',3);
 if(width<1||height<1||width*height>MAX_SOURCE_PIXELS)throw new Error('SVG dimensions must fit within 4 megapixels.');root.setAttribute('width',String(width));root.setAttribute('height',String(height));
 const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(root)],{type:'image/svg+xml'}));try{const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(image,0,0,width,height);return {width,height,pixels:ctx.getImageData(0,0,width,height).data};}finally{URL.revokeObjectURL(url);}
}

/** Explicit selected-frame interchange; JPEG uses a white matte and lossy encoding. */
export async function encodeBrowserImage(source:Raster,format:'jpeg'|'webp',quality=.95):Promise<Blob>{
 if(!['jpeg','webp'].includes(format)||!Number.isFinite(quality)||quality<0||quality>1)throw new Error('Invalid image export.');
 validateRaster(source);const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
 if(source.width*source.height>MAX_SOURCE_PIXELS||source.pixels.length!==source.width*source.height*4)throw new Error('Image export exceeds 4 megapixels.');
 const layer=document.createElement('canvas');paintRaster(layer,source);const ctx=canvas.getContext('2d')!;if(format==='jpeg'){ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);}ctx.drawImage(layer,0,0);
 const mime='image/'+format;return new Promise((resolve,reject)=>canvas.toBlob(blob=>{if(!blob||blob.type!==mime)reject(new Error('This browser cannot export '+format+'. Use PNG.'));else resolve(blob);},mime,quality));
}
