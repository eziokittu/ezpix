import { MAX_SOURCE_PIXELS, type Raster } from './conversion.js';
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
  throw new Error('Choose a valid PNG or JPEG image.');
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
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
