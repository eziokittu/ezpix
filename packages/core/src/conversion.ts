import {nearestPalettePixel,orderedPaletteOffset} from './palette-map.js';
import { createDocument, type PixelDocument } from './document.js';
export interface Raster { width: number; height: number; pixels: Uint8ClampedArray }
export interface Recipe {
  version: 1; crop: { x: number; y: number; width: number; height: number };
  width: number; height: number; sampling: 'nearest' | 'area';
  palette: 'original' | 'adaptive' | 'pocket' | 'neon'; colors: number;
  dither: boolean; alphaThreshold: number;
}
export const MAX_SOURCE_PIXELS = 4 * 1024 * 1024;
export function validateRaster(source: Raster) {
  if (!source || !Number.isInteger(source.width) || !Number.isInteger(source.height) || source.width < 1 || source.height < 1 || source.width * source.height > MAX_SOURCE_PIXELS || !(source.pixels instanceof Uint8ClampedArray) || source.pixels.length !== source.width * source.height * 4) throw new Error('Source must contain valid RGBA pixels, up to 4 megapixels.');
}
export function validateRecipe(r: Recipe, source?: Pick<Raster, 'width' | 'height'>) {
  if (!r || r.version !== 1 || ![r.width, r.height].every(n => Number.isInteger(n) && n >= 1 && n <= 256) || !['nearest', 'area'].includes(r.sampling) || !['original', 'adaptive', 'pocket', 'neon'].includes(r.palette) || !Number.isInteger(r.colors) || r.colors < 2 || r.colors > 256 || typeof r.dither !== 'boolean' || !Number.isInteger(r.alphaThreshold) || r.alphaThreshold < 0 || r.alphaThreshold > 255) throw new Error('Invalid conversion recipe.');
  const c = r.crop;
  if (!c || ![c.x, c.y, c.width, c.height].every(Number.isInteger) || c.x < 0 || c.y < 0 || c.width < 1 || c.height < 1 || c.width * c.height > MAX_SOURCE_PIXELS || (source && (c.x + c.width > source.width || c.y + c.height > source.height))) throw new Error('Crop lies outside the source.');
}
export function defaultRecipe(source: Pick<Raster, 'width' | 'height'>): Recipe {
  const ratio = 64 / Math.max(source.width, source.height);
  return { version: 1, crop: { x: 0, y: 0, width: source.width, height: source.height }, width: Math.max(1, Math.round(source.width * ratio)), height: Math.max(1, Math.round(source.height * ratio)), sampling: 'area', palette: 'original', colors: 16, dither: false, alphaThreshold: 1 };
}
type Color = [number, number, number];
// Deterministic weighted median-cut over a bounded 5-bit/channel histogram.
export function extractPalette(pixels: Uint8ClampedArray, limit: number): Color[] {
  const bins = new Map<number, { rgb: number[]; weight: number }>();
  for (let i = 0; i < pixels.length; i += 4) {
    if (!pixels[i + 3]) continue;
    const key = (pixels[i] >> 3) * 1024 + (pixels[i + 1] >> 3) * 32 + (pixels[i + 2] >> 3), weight = pixels[i + 3];
    const bin = bins.get(key) ?? { rgb: [0, 0, 0], weight: 0 };
    for (let c = 0; c < 3; c++) bin.rgb[c] += pixels[i + c] * weight;
    bin.weight += weight; bins.set(key, bin);
  }
  const points = [...bins.values()].map(b => ({ rgb: b.rgb.map(c => c / b.weight), weight: b.weight }));
  if (!points.length) return [[0, 0, 0]];
  const boxes = [points];
  while (boxes.length < limit) {
    let selected = -1, axis = 0, best = -1;
    boxes.forEach((box, index) => {
      if (box.length < 2) return;
      for (let c = 0; c < 3; c++) {
        let min = 255, max = 0, weight = 0;
        for (const p of box) { min = Math.min(min, p.rgb[c]); max = Math.max(max, p.rgb[c]); weight += p.weight; }
        const score = (max - min) * Math.sqrt(weight);
        if (score > best) { best = score; selected = index; axis = c; }
      }
    });
    if (selected < 0) break;
    const box = boxes[selected].sort((a, b) => a.rgb[axis] - b.rgb[axis]);
    const half = box.reduce((v, p) => v + p.weight, 0) / 2;
    let sum = 0, split = 1;
    for (let i = 0; i < box.length - 1; i++) { sum += box[i].weight; split = i + 1; if (sum >= half) break; }
    boxes.splice(selected, 1, box.slice(0, split), box.slice(split));
  }
  return boxes.map(box => {
    const weight = box.reduce((v, p) => v + p.weight, 0);
    return [0, 1, 2].map(c => Math.round(box.reduce((v, p) => v + p.rgb[c] * p.weight, 0) / weight)) as Color;
  });
}
const POCKET: Color[] = [[15, 56, 15], [48, 98, 48], [139, 172, 15], [155, 188, 15]];
const NEON: Color[] = [[10, 0, 8], [57, 255, 20], [168, 85, 247], [255, 215, 0], [240, 230, 255], [255, 100, 124], [73, 191, 255], [96, 66, 166]];

export function convert(source: Raster, recipe: Recipe): PixelDocument {
  validateRaster(source); validateRecipe(recipe, source);
  const doc = createDocument(recipe.width, recipe.height, 'Converted artwork'), out = doc.cel.pixels, crop = recipe.crop;
  for (let y = 0; y < doc.height; y++) for (let x = 0; x < doc.width; x++) {
    const dst = (y * doc.width + x) * 4;
    if (recipe.sampling === 'nearest') {
      const sx = Math.min(source.width - 1, crop.x + Math.floor((x + .5) * crop.width / doc.width));
      const sy = Math.min(source.height - 1, crop.y + Math.floor((y + .5) * crop.height / doc.height));
      const p=(sy*source.width+sx)*4;out[dst]=source.pixels[p];out[dst+1]=source.pixels[p+1];out[dst+2]=source.pixels[p+2];out[dst+3]=source.pixels[p+3];
    } else {
      const x0 = crop.x + x * crop.width / doc.width, x1 = crop.x + (x + 1) * crop.width / doc.width;
      const y0 = crop.y + y * crop.height / doc.height, y1 = crop.y + (y + 1) * crop.height / doc.height;
      let total=0,alpha=0,red=0,green=0,blue=0;
      for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy++) for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx++) {
        const weight = (Math.min(x1, sx + 1) - Math.max(x0, sx)) * (Math.min(y1, sy + 1) - Math.max(y0, sy));
        const i = (sy * source.width + sx) * 4, a = source.pixels[i + 3] * weight;
        total += weight; alpha += a;
        red+=source.pixels[i]*a;green+=source.pixels[i+1]*a;blue+=source.pixels[i+2]*a;
      }
      out[dst]=alpha?Math.round(red/alpha):0;out[dst+1]=alpha?Math.round(green/alpha):0;out[dst+2]=alpha?Math.round(blue/alpha):0;
      out[dst + 3] = Math.round(alpha / total);
    }
    if (!out[dst + 3] || out[dst + 3] < recipe.alphaThreshold) out.fill(0, dst, dst + 4);
  }
  if (recipe.palette !== 'original') {
    const palette = recipe.palette === 'pocket' ? POCKET : recipe.palette === 'neon' ? NEON : extractPalette(out, recipe.colors);
    for (let i = 0; i < out.length; i += 4) {
      if (!out[i + 3]) continue;
      const x=i/4%doc.width,y=Math.floor(i/4/doc.width);
      out.set(nearestPalettePixel([out[i],out[i+1],out[i+2]],palette,recipe.dither?orderedPaletteOffset(x,y,100):0),i);
    }
  }
  doc.conversion = { source, recipe: structuredClone(recipe) }; return doc;
}
