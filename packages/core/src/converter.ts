import {composite,setDocumentOutput,OUTPUT_MODE_NOTE,PNG_MODE_NOTE,decodeTga,decodePcx,LEGACY_IMAGE_LOSSES,exportAssets,defaultAssetExport,GIF_LOSSES,RASTER_EXCHANGE_LOSS,decodeBmp,decodeQoi} from './index.js';
import { createDocument, defaultRecipe, validateRaster, quickRecipe, alphaBounds, type PixelDocument, type Raster, type Recipe } from './index.js';
import { downloadFile, paintRaster, readImage } from './browser.js';
import { encodeProject } from './index.js';
/** Shared local conversion UI for the website and extension. It owns no editor artwork. */
export function mountConverter(host: HTMLElement, options: { createWorker: () => Worker; onApply: (doc: PixelDocument) => void; applyLabel?: string }) {
  // This template is authored constant markup. Imported filenames/pixels never enter HTML.
  host.innerHTML = `<section class="ez-converter">
    <header><div><h2>Turn an image into pixels</h2><p>Local processing. PNG/JPEG: up to 4 megapixels / 20 MiB. BMP/QOI/TGA/PCX: up to 256 pixels per axis / 16 MiB.</p></div></header>
    <label class="ez-upload">Choose image <input data-file type="file" accept="image/png,image/jpeg,.bmp,.qoi,.tga,.pcx"></label>
    <p data-source class="ez-note">Upload an image, then crop and tune. Applying creates new artwork.</p>
    <div class="ez-quick"><strong>Fast starts</strong><button data-preset="sprite" disabled>Clean sprite</button><button data-preset="icon" disabled>Tiny icon</button><button data-preset="photo" disabled>Photo dither</button><button data-preset="tile" disabled>Centered tile 16</button><button data-trim disabled>Trim transparent edges</button></div>
    <div class="ez-convert-controls">
      <fieldset><legend>Crop in source pixels</legend><label>X <input data-field="x" type="number" min="0"></label><label>Y <input data-field="y" type="number" min="0"></label><label>Crop width <input data-field="cropWidth" type="number" min="1"></label><label>Crop height <input data-field="cropHeight" type="number" min="1"></label><button data-reset>Full image</button></fieldset>
      <fieldset><legend>Pixel grid</legend><label>Output width <input data-field="width" type="number" min="1" max="256"></label><label>Output height <input data-field="height" type="number" min="1" max="256"></label><label><input data-lock type="checkbox" checked> Keep crop aspect</label><label>Quick size <select data-size><option value="">Choose…</option><option>16</option><option>32</option><option>64</option><option>128</option><option>256</option></select></label><label>Sampling <select data-field="sampling"><option value="area">Area average</option><option value="nearest">Nearest pixel</option></select></label></fieldset>
      <fieldset><legend>Colour & texture</legend><label>Palette <select data-field="palette"><option value="original">Original colours</option><option value="adaptive">Extract palette</option><option value="pocket">Pocket · 4 greens</option><option value="neon">GlitchBong · 8 colours</option></select></label><label>Colour count <input data-field="colors" type="number" min="2" max="256"></label><label><input data-field="dither" type="checkbox"> Ordered dithering</label><label>Alpha threshold <input data-field="alphaThreshold" type="number" min="0" max="255"></label></fieldset>
    </div>
    <label>Converted output mode <select data-output-mode><option value="rgba">RGBA source colours</option><option value="grayscale">Grayscale composite output</option><option value="palette">Default project-palette output</option></select></label><p>${OUTPUT_MODE_NOTE} Palette output uses the default project swatches.</p><div class="ez-comparison"><section><h3>Original & crop</h3><canvas data-original></canvas></section><section><h3>Converted pixels</h3><canvas data-result></canvas><p data-palette class="ez-note"></p></section></div>
    <div class="ez-convert-actions"><button data-cancel>Cancel preview</button><button data-apply disabled class="ez-primary"></button><button data-png disabled>Download converted PNG</button><button data-project disabled>Download converted project</button><label><input data-retain type="checkbox" checked> Include original source in project</label></div>
    <fieldset><legend>More local image formats</legend><label>Converted image format <select data-image-format><option value="gif">GIF</option><option value="bmp">BMP RGBA</option><option value="qoi">QOI RGBA</option><option value="svg">SVG pixel rectangles</option><option value="tga">TGA RGBA</option><option value="pcx">PCX RGB on white</option><option value="ico">ICO PNG-backed</option><option value="cur">CUR PNG-backed</option><option value="gray-png">Grayscale + alpha PNG</option><option value="indexed-png">Exact indexed PNG</option></select></label><p>${RASTER_EXCHANGE_LOSS} ${GIF_LOSSES} ${LEGACY_IMAGE_LOSSES} ${PNG_MODE_NOTE}</p><label><input data-image-review type="checkbox"> I reviewed these image export differences</label><div data-hotspot-fields hidden><label>Cursor hotspot X <input data-hotspot-x type="number" min="0" max="255" value="0"></label><label>Cursor hotspot Y <input data-hotspot-y type="number" min="0" max="255" value="0"></label></div><button data-image-prepare disabled>Prepare converted image</button><button data-image-download disabled>Download prepared converted image</button><p data-image-prepared></p></fieldset><p role="status" data-status>Choose a local image to begin.</p><p class="ez-note">Included source means the entire imported image, including pixels outside the crop. Uncheck to omit it. Conversion reduces pixels, not objects. Photos usually need manual cleanup. Reapplying a recipe replaces artwork only after you choose to apply.</p>
  </section>`;
  const q = <T extends HTMLElement>(selector: string) => host.querySelector<T>(selector)!;
  let source: Raster | null = null, recipe: Recipe | null = null, result: PixelDocument | null = null, worker: Worker | null = null, timer: ReturnType<typeof setTimeout> | undefined, job = 0, disposed = false, loadId = 0, busy=false, workerHasSource=false;
  let sourcePreview:HTMLCanvasElement|null=null,preparedImage:{blob:Blob;name:string}|null=null,imageJob=0;
  function clearImage(){imageJob++;preparedImage=null;q<HTMLButtonElement>('[data-image-download]').disabled=true;q('[data-image-prepared]').textContent='';}
  const status = (text: string) => { q('[data-status]').textContent = text; };
  const enable = (enabled: boolean) => { for (const key of ['apply','png','project','image-prepare']) q<HTMLButtonElement>(`[data-${key}]`).disabled = !enabled; };
  q('[data-apply]').textContent = options.applyLabel ?? 'Use conversion as new artwork';
  function stop(reset=true) {clearImage();clearTimeout(timer);if(reset||busy){worker?.terminate();worker=null;workerHasSource=false;}busy=false;job++;result=null;enable(false);}
  function sync() {
    if (!recipe || !source) return;
    const values: Record<string, string | number | boolean> = { ...recipe, x: recipe.crop.x, y: recipe.crop.y, cropWidth: recipe.crop.width, cropHeight: recipe.crop.height } as unknown as Record<string,string|number|boolean>;
    host.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-field]').forEach(el => { const value = values[el.dataset.field!]; if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = Boolean(value); else el.value = String(value); });
    q<HTMLInputElement>('[data-field="dither"]').disabled = recipe.palette === 'original';
    q<HTMLInputElement>('[data-field="colors"]').disabled = recipe.palette !== 'adaptive';
    const c = q<HTMLCanvasElement>('[data-original]');
    // Retain only the small thumbnail, built once on load. Crop edits reuse it.
    if(sourcePreview){c.width=sourcePreview.width;c.height=sourcePreview.height;const ctx=c.getContext('2d')!;ctx.drawImage(sourcePreview,0,0);ctx.strokeStyle='#ff647c';ctx.lineWidth=2;ctx.strokeRect(recipe.crop.x*c.width/source.width,recipe.crop.y*c.height/source.height,recipe.crop.width*c.width/source.width,recipe.crop.height*c.height/source.height);}
    q('[data-source]').textContent = `Source ${source.width} × ${source.height}. The pink box marks the crop. Source is retained separately from edits.`;
  }
  function schedule() {
    stop(false); if (!source || !recipe) return;
    sync(); const id = job, selectedSource = source, selectedRecipe = structuredClone(recipe);
    status('Updating preview…');
    timer = setTimeout(() => {
      try {
        worker ??= options.createWorker();
        worker.onerror = () => { if (id === job) { status('Preview worker failed. Try a smaller image or reload.'); stop(); } };
        worker.onmessage = event => {
          if (disposed || id !== job) return;
          busy=false;
          if (event.data.error) { status(event.data.error); return; }
          const data = event.data;
          const doc = createDocument(data.width, data.height, 'Converted artwork'); doc.cel.pixels.set(data.pixels);
          doc.conversion = { source: selectedSource, recipe: selectedRecipe };setDocumentOutput(doc,q<HTMLSelectElement>('[data-output-mode]').value as 'rgba'|'grayscale'|'palette');result = doc;
          paintRaster(q('[data-result]'), { width: doc.width, height: doc.height, pixels: composite(doc) });
          const swatches = new Set<number>(),preview=composite(doc); for (let i=0;i<preview.length;i+=4) if (preview[i+3]) swatches.add((preview[i]<<16)|(preview[i+1]<<8)|preview[i+2]);
          q('[data-palette]').textContent = `${doc.width} × ${doc.height} · ${swatches.size} RGB colours · alpha preserved above threshold`;
          status('Preview ready. Your current artwork has not changed.'); enable(true);
        };
        worker.postMessage({source:workerHasSource?undefined:selectedSource,recipe:selectedRecipe});workerHasSource=true;busy=true;
      } catch {stop();status('Workers are unavailable. Conversion requires a supported browser.');}
    }, 120);
  }
  function load(raster: Raster, initial?: Recipe) {validateRaster(raster);stop();source=raster;recipe=initial?structuredClone(initial):defaultRecipe(raster);if(sourcePreview)sourcePreview.width=sourcePreview.height=0;sourcePreview=document.createElement('canvas');const ratio=Math.min(1,600/Math.max(raster.width,raster.height));sourcePreview.width=Math.max(1,Math.round(raster.width*ratio));sourcePreview.height=Math.max(1,Math.round(raster.height*ratio));const full=document.createElement('canvas');paintRaster(full,raster);sourcePreview.getContext('2d')!.drawImage(full,0,0,sourcePreview.width,sourcePreview.height);full.width=full.height=0;host.querySelectorAll<HTMLButtonElement>('[data-preset],[data-trim]').forEach(b=>b.disabled=false);schedule();}
  host.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach(button=>{button.onclick=()=>{if(!source||!recipe)return;try{recipe=quickRecipe(source,recipe,button.dataset.preset as 'sprite'|'icon'|'photo'|'tile');schedule();}catch(e){status(e instanceof Error?e.message:'Preset failed.');}};});
  q('[data-trim]').onclick=()=>{if(!source||!recipe)return;const bounds=alphaBounds(source);if(!bounds){status('Image is fully transparent. Choose a crop manually.');return;}if(bounds.x===0&&bounds.y===0&&bounds.width===source.width&&bounds.height===source.height){status('No transparent margin found. Use crop controls for opaque backgrounds.');return;}recipe.crop=bounds;if(q<HTMLInputElement>('[data-lock]').checked){const ratio=Math.min(256,Math.max(recipe.width,recipe.height))/Math.max(bounds.width,bounds.height);recipe.width=Math.max(1,Math.round(bounds.width*ratio));recipe.height=Math.max(1,Math.round(bounds.height*ratio));}schedule();};
  const fileInput = q<HTMLInputElement>('[data-file]');
  fileInput.onchange = async () => {
    const file = fileInput.files?.[0]; if (!file) return;
    const current = ++loadId; stop(); status('Reading image…');
    try { const ext=file.name.split('.').at(-1)?.toLowerCase();if(['bmp','qoi','tga','pcx'].includes(ext??'')&&file.size>16*1024*1024)throw new Error('Raster input exceeds 16 MiB.');const raster = ['bmp','qoi','tga','pcx'].includes(ext??'')?({bmp:decodeBmp,qoi:decodeQoi,tga:decodeTga,pcx:decodePcx}[ext as 'bmp'|'qoi'|'tga'|'pcx'])(new Uint8Array(await file.arrayBuffer())):await readImage(file); if (!disposed && current === loadId) load(raster); }
    catch (error) { if (!disposed && current === loadId) status(error instanceof Error ? error.message : 'Cannot read image.'); }
    fileInput.value = '';
  };
  host.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-field]').forEach(el => {
    el.onchange = () => {
      if (!recipe || !source) return;
      const key = el.dataset.field!;
      if (['x','y','cropWidth','cropHeight'].includes(key)) {
        const field = key === 'cropWidth' ? 'width' : key === 'cropHeight' ? 'height' : key as 'x'|'y';
        recipe.crop[field] = Number(el.value);
      } else if (key === 'dither') recipe.dither = (el as HTMLInputElement).checked;
      else if (key === 'sampling') recipe.sampling = el.value as Recipe['sampling'];
      else if (key === 'palette') recipe.palette = el.value as Recipe['palette'];
      else recipe[key as 'width'|'height'|'colors'|'alphaThreshold'] = Number(el.value);
      if (q<HTMLInputElement>('[data-lock]').checked && ['width','height','cropWidth','cropHeight'].includes(key)) {
        if (key === 'height') recipe.width = Math.max(1, Math.min(256, Math.round(recipe.height * recipe.crop.width / recipe.crop.height)));
        else recipe.height = Math.max(1, Math.min(256, Math.round(recipe.width * recipe.crop.height / recipe.crop.width)));
      }
      schedule();
    };
  });
  q<HTMLSelectElement>('[data-size]').onchange = event => { if (!recipe || !(event.target as HTMLSelectElement).value) return; recipe.width = Number((event.target as HTMLSelectElement).value); recipe.height = q<HTMLInputElement>('[data-lock]').checked ? Math.max(1,Math.min(256,Math.round(recipe.width * recipe.crop.height / recipe.crop.width))) : recipe.width; schedule(); };
  q('[data-reset]').onclick = () => { if (source && recipe) { recipe.crop = { x:0,y:0,width:source.width,height:source.height };if(q<HTMLInputElement>('[data-lock]').checked)recipe.height=Math.max(1,Math.min(256,Math.round(recipe.width*source.height/source.width)));schedule(); } };
  q('[data-cancel]').onclick = () => { loadId++; stop(); status('Preview cancelled. Change any setting to restart.'); };
  q('[data-apply]').onclick = () => { if (result) options.onApply(result); };
  q('[data-png]').onclick = () => { if (!result) return; q<HTMLCanvasElement>('[data-result]').toBlob(blob => { if (blob) downloadFile(blob,'ezpix-converted.png'); else status('PNG export failed.'); },'image/png'); };
  q('[data-project]').onclick = () => { if (!result) return; try { downloadFile(new Blob([encodeProject(result,q<HTMLInputElement>('[data-retain]').checked)],{type:'application/json'}),'ezpix-converted.ezpix'); } catch (e) { status(e instanceof Error ? e.message : 'Project export failed.'); } };
  q('[data-output-mode]').onchange=()=>schedule();
  q('[data-image-format]').onchange=()=>{clearImage();q('[data-hotspot-fields]').hidden=q<HTMLSelectElement>('[data-image-format]').value!=='cur';};q('[data-hotspot-x]').onchange=clearImage;q('[data-hotspot-y]').onchange=clearImage;q('[data-image-review]').onchange=clearImage;
  q('[data-image-prepare]').onclick=async()=>{if(!result)return;clearImage();if(!q<HTMLInputElement>('[data-image-review]').checked){status('Review image export differences first.');return;}const id=job,imageId=imageJob,document=result,format=q<HTMLSelectElement>('[data-image-format]').value as 'gif'|'bmp'|'qoi'|'svg'|'tga'|'pcx'|'ico'|'cur'|'gray-png'|'indexed-png';try{const files=await exportAssets(document,{...defaultAssetExport(),format,...(format==='cur'?{hotspotX:Number(q<HTMLInputElement>('[data-hotspot-x]').value),hotspotY:Number(q<HTMLInputElement>('[data-hotspot-y]').value)}:{})}),entry=[...files].find(([path])=>path!=='assets.json')!;if(disposed||job!==id||imageId!==imageJob||result!==document||q<HTMLSelectElement>('[data-image-format]').value!==format||!q<HTMLInputElement>('[data-image-review]').checked)return;preparedImage={blob:new Blob([new Uint8Array(entry[1])],{type:format==='svg'?'image/svg+xml':format==='gif'?'image/gif':format==='bmp'?'image/bmp':format==='gray-png'||format==='indexed-png'?'image/png':'application/octet-stream'}),name:'ezpix-converted.'+(format==='gray-png'?'gray.png':format==='indexed-png'?'indexed.png':format)};q('[data-image-prepared]').textContent=preparedImage.name+' / '+preparedImage.blob.size+' bytes';q<HTMLButtonElement>('[data-image-download]').disabled=false;status('Image prepared. Review, then request the download.');}catch(error){if(!disposed&&job===id&&imageId===imageJob)status(error instanceof Error?error.message:'Image export failed.');}};
  q('[data-image-download]').onclick=()=>{if(preparedImage&&q<HTMLInputElement>('[data-image-review]').checked){downloadFile(preparedImage.blob,preparedImage.name);status('Image download requested. Check browser downloads.');}};
  return { load, dispose() { disposed = true; loadId++; stop();if(sourcePreview)sourcePreview.width=sourcePreview.height=0;sourcePreview=null;source=null;recipe=null;host.replaceChildren(); } };
}
