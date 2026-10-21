import { createDocument, defaultRecipe, validateRaster, quickRecipe, alphaBounds, type PixelDocument, type Raster, type Recipe } from './index.js';
import { downloadFile, paintRaster, readImage } from './browser.js';
import { encodeProject } from './index.js';
/** Shared local conversion UI for the website and extension. It owns no editor artwork. */
export function mountConverter(host: HTMLElement, options: { createWorker: () => Worker; onApply: (doc: PixelDocument) => void; applyLabel?: string }) {
  // This template is authored constant markup. Imported filenames/pixels never enter HTML.
  host.innerHTML = `<section class="ez-converter">
    <header><div><h2>Turn an image into pixels</h2><p>Local processing · PNG/JPEG · up to 4 megapixels / 20 MiB</p></div></header>
    <label class="ez-upload">Choose image <input data-file type="file" accept="image/png,image/jpeg"></label>
    <p data-source class="ez-note">Upload an image, then crop and tune. Applying creates new artwork.</p>
    <div class="ez-quick"><strong>Fast starts</strong><button data-preset="sprite" disabled>Clean sprite</button><button data-preset="icon" disabled>Tiny icon</button><button data-preset="photo" disabled>Photo dither</button><button data-preset="tile" disabled>Centered tile 16</button><button data-trim disabled>Trim transparent edges</button></div>
    <div class="ez-convert-controls">
      <fieldset><legend>Crop in source pixels</legend><label>X <input data-field="x" type="number" min="0"></label><label>Y <input data-field="y" type="number" min="0"></label><label>Crop width <input data-field="cropWidth" type="number" min="1"></label><label>Crop height <input data-field="cropHeight" type="number" min="1"></label><button data-reset>Full image</button></fieldset>
      <fieldset><legend>Pixel grid</legend><label>Output width <input data-field="width" type="number" min="1" max="256"></label><label>Output height <input data-field="height" type="number" min="1" max="256"></label><label><input data-lock type="checkbox" checked> Keep crop aspect</label><label>Quick size <select data-size><option value="">Choose…</option><option>16</option><option>32</option><option>64</option><option>128</option><option>256</option></select></label><label>Sampling <select data-field="sampling"><option value="area">Area average</option><option value="nearest">Nearest pixel</option></select></label></fieldset>
      <fieldset><legend>Colour & texture</legend><label>Palette <select data-field="palette"><option value="original">Original colours</option><option value="adaptive">Extract palette</option><option value="pocket">Pocket · 4 greens</option><option value="neon">GlitchBong · 8 colours</option></select></label><label>Colour count <input data-field="colors" type="number" min="2" max="256"></label><label><input data-field="dither" type="checkbox"> Ordered dithering</label><label>Alpha threshold <input data-field="alphaThreshold" type="number" min="0" max="255"></label></fieldset>
    </div>
    <div class="ez-comparison"><section><h3>Original & crop</h3><canvas data-original></canvas></section><section><h3>Converted pixels</h3><canvas data-result></canvas><p data-palette class="ez-note"></p></section></div>
    <div class="ez-convert-actions"><button data-cancel>Cancel preview</button><button data-apply disabled class="ez-primary"></button><button data-png disabled>Download converted PNG</button><button data-project disabled>Download converted project</button><label><input data-retain type="checkbox" checked> Include original source in project</label></div>
    <p role="status" data-status>Choose a local image to begin.</p><p class="ez-note">Included source means the entire imported image, including pixels outside the crop. Uncheck to omit it. Conversion reduces pixels, not objects. Photos usually need manual cleanup. Reapplying a recipe replaces artwork only after you choose to apply.</p>
  </section>`;
  const q = <T extends HTMLElement>(selector: string) => host.querySelector<T>(selector)!;
  let source: Raster | null = null, recipe: Recipe | null = null, result: PixelDocument | null = null, worker: Worker | null = null, timer: ReturnType<typeof setTimeout> | undefined, job = 0, disposed = false, loadId = 0, busy=false, workerHasSource=false;
  let sourcePreview:HTMLCanvasElement|null=null;
  const status = (text: string) => { q('[data-status]').textContent = text; };
  const enable = (enabled: boolean) => { for (const key of ['apply','png','project']) q<HTMLButtonElement>(`[data-${key}]`).disabled = !enabled; };
  q('[data-apply]').textContent = options.applyLabel ?? 'Use conversion as new artwork';
  function stop(reset=true) {clearTimeout(timer);if(reset||busy){worker?.terminate();worker=null;workerHasSource=false;}busy=false;job++;result=null;enable(false);}
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
          doc.conversion = { source: selectedSource, recipe: selectedRecipe }; result = doc;
          paintRaster(q('[data-result]'), { width: doc.width, height: doc.height, pixels: doc.cel.pixels });
          const swatches = new Set<number>(); for (let i=0;i<doc.cel.pixels.length;i+=4) if (doc.cel.pixels[i+3]) swatches.add((doc.cel.pixels[i]<<16)|(doc.cel.pixels[i+1]<<8)|doc.cel.pixels[i+2]);
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
    try { const raster = await readImage(file); if (!disposed && current === loadId) load(raster); }
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
  return { load, dispose() { disposed = true; loadId++; stop();if(sourcePreview)sourcePreview.width=sourcePreview.height=0;sourcePreview=null;source=null;recipe=null;host.replaceChildren(); } };
}
