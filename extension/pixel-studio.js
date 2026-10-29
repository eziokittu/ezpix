import {
  createDocument, decodeProject, composite, activeLayer, rasterCel, animationAtTime,
  exportAssets, defaultAssetExport, encodeAseprite, asepriteExportWarnings, decodeAseprite,
  decodePiskel, decodeIndexedPngDocument, rectangle,
} from '../packages/core/dist/index.js';
import { encodeNativePng } from '../packages/core/dist/native-png.js';
import { readImage, paintRaster, downloadFile } from '../packages/core/dist/browser.js';
import { StudioSession, studioDrafts, retainStudioDraft } from './studio-model.js';
import { state, updateState } from './db.js';

/** Packaged offline editor. UI only: core owns all document, brush, format and Undo logic. */
export function mountPixelStudio(host, { onHandoff }) {
  host.innerHTML = `
    <section class="ps-workspace" aria-label="Pixel studio">
      <div class="ps-filebar">
        <label class="ps-name">Project <input data-ps-name maxlength="80" value="Untitled"></label>
        <button data-ps-new>New</button><label class="ps-open">Open project / image<input data-ps-open type="file" accept=".ezpix,.ase,.aseprite,.piskel,.png,.jpg,.jpeg,.webp" hidden></label>
        <button data-ps-save class="ez-primary">Download project</button><button data-ps-geometry>Canvas</button><button data-ps-export>Export</button><button data-ps-handoff>Open in EzPix website</button>
      </div>
      <div class="ps-context">
        <button data-ps-undo title="Undo (Ctrl+Z)" disabled>Undo</button><button data-ps-redo title="Redo (Ctrl+Shift+Z)" disabled>Redo</button>
        <label>Colour <input data-ps-color type="color" value="#4ce0b2"></label><label>Alpha <input data-ps-alpha type="number" min="0" max="255" value="255"></label>
        <label>Size <input data-ps-size type="number" min="1" max="32" value="1"></label><label>Tip <select data-ps-tip><option value="square">Square</option><option value="circle">Round</option></select></label>
        <label><input data-ps-filled type="checkbox"> Filled shapes</label><label><input data-ps-grid type="checkbox" checked> Grid</label>
        <label>Zoom <select data-ps-zoom><option value="fit">Fit</option><option value="1">100%</option><option value="2">200%</option><option value="4">400%</option><option value="8">800%</option><option value="16">1600%</option><option value="32">3200%</option></select></label>
      </div>
      <div class="ps-body">
        <div class="ps-tools" role="toolbar" aria-label="Drawing tools">
          <button data-ps-tool="pencil" aria-pressed="true" title="Pencil (B)">Pencil</button><button data-ps-tool="eraser" aria-pressed="false" title="Eraser (E)">Erase</button>
          <button data-ps-tool="fill" aria-pressed="false" title="Fill (F)">Fill</button><button data-ps-tool="pick" aria-pressed="false" title="Eyedropper (I)">Pick</button>
          <button data-ps-tool="Line" aria-pressed="false" title="Line (L)">Line</button><button data-ps-tool="Rectangle" aria-pressed="false" title="Rectangle (R)">Rect</button><button data-ps-tool="Ellipse" aria-pressed="false" title="Ellipse (O)">Ellipse</button>
          <button data-ps-tool="select" aria-pressed="false" title="Select (M)">Select</button><button data-ps-transform title="Transform the full selected cel">Transform</button>
        </div>
        <div class="ps-viewport" data-ps-viewport><div class="ps-surface" data-ps-surface><canvas data-ps-canvas tabindex="0" aria-label="Pixel artwork"></canvas><div class="ps-grid" data-ps-overlay></div></div></div>
        <aside class="ps-inspector" aria-label="Studio inspector">
          <section><h2>Layers</h2><div data-ps-layers class="ps-layer-list"></div>
            <div class="ps-button-row"><button data-ps-add-layer title="Add layer">+</button><button data-ps-copy-layer title="Duplicate layer">Duplicate</button><button data-ps-delete-layer title="Delete layer">Delete</button></div>
            <label>Layer name<input data-ps-layer-name maxlength="80"></label><label>Opacity <input data-ps-opacity type="range" min="0" max="255" value="255"></label>
            <div class="ps-button-row"><button data-ps-visible>Hide</button><button data-ps-lock>Lock</button><button data-ps-up title="Move layer up">↑</button><button data-ps-down title="Move layer down">↓</button></div>
          </section>
          <section><h2 data-ps-palette-title>Palette</h2><div class="ps-palette" data-ps-palette></div><p data-ps-mode></p></section>
          <section><h2>Keyboard drawing</h2><div class="ps-button-row"><label>X <input data-ps-x type="number" min="0" value="0"></label><label>Y <input data-ps-y type="number" min="0" value="0"></label><button data-ps-pixel>Use tool</button></div><p>Arrow keys move the canvas cursor. Space applies Pencil, Erase, Fill or Pick. Escape cancels a stroke.</p></section>
        </aside>
      </div>
      <div class="ps-timeline"><div class="ps-button-row"><button data-ps-play>Play</button><button data-ps-add-frame>+ Frame</button><button data-ps-copy-frame>Duplicate frame</button><button data-ps-delete-frame>Delete frame</button><label>Duration (ms) <input data-ps-duration type="number" min="20" max="5000" value="100"></label></div><div data-ps-frames class="ps-frames" role="group" aria-label="Animation frames"></div></div>
      <div class="ps-statusbar"><p role="status" data-ps-status>Draw here without opening the website. B / E / F / I choose tools.</p><span data-ps-info></span></div>
      <details class="ps-recovery"><summary>Local recovery</summary><p>Opt in to save up to four recent studio drafts on this device, for seven days and at most 8 MiB total. Original conversion images and Undo history are excluded. Browser data can be cleared; keep project downloads as backups.</p><label><input data-ps-autosave type="checkbox"> Save recovery on this device</label><button data-ps-recover>Review saved drafts</button><button data-ps-forget>Delete saved drafts</button><p data-ps-recovery-status></p></details>
    </section>
    <dialog data-ps-dialog><form method="dialog"><h2 data-ps-dialog-title></h2><div data-ps-dialog-body></div><div class="ps-dialog-actions"><button value="cancel">Cancel</button><button data-ps-dialog-apply type="button" class="ez-primary">Apply</button></div></form></dialog>`;

  const q = selector => host.querySelector(selector);
  const session = new StudioSession();
  const canvas = q('[data-ps-canvas]'), surface = q('[data-ps-surface]');
  const dialog = q('[data-ps-dialog]'), body = q('[data-ps-dialog-body]');
  const status = text => { q('[data-ps-status]').textContent = text; };
  let tool = 'pencil', slot = 0, gesture = null, drawFrame = 0, playing = 0, playStart = 0, disposed = false, loadJob = 0, saveTimer, autosave = false, recoveryEpoch = 0, exporting = false, dialogGeneration = 0;
  let draftId = crypto.randomUUID();
  const fileName = () => (session.document.name.replace(/[^a-z0-9_-]+/gi, '-').slice(0, 60) || 'artwork');
  const report = error => {
    const message = error instanceof Error ? error.message : 'Studio operation failed. Your current artwork is retained.';
    status(message);
    if (dialog.open) {
      let alert = body.querySelector('[data-dialog-error]');
      if (!alert) { alert = document.createElement('p'); alert.dataset.dialogError = ''; alert.setAttribute('role', 'alert'); body.append(alert); }
      alert.textContent = message;
    }
  };
  const doc = () => session.document;
  function stopPlayback() { cancelAnimationFrame(playing); playing = 0; q('[data-ps-play]').textContent = 'Play'; }
  function cancelGesture() { gesture = null; cancelAnimationFrame(drawFrame); drawFrame = 0; renderCanvas(); }
  function ready() { stopPlayback(); cancelGesture(); loadJob++; }
  function action(fn, message = 'Artwork updated. Undo restores the previous edit.') {
    try { ready(); const changed = fn(); render(); if (changed) { status(message); scheduleSave(); } }
    catch (error) { render(); report(error); }
  }
  function showDialog(title, build, applyLabel = 'Apply', onApply) {
    ready(); if (dialog.open) dialog.close(); body.replaceChildren();
    const generation = ++dialogGeneration, isCurrent = () => dialog.open && generation === dialogGeneration;
    q('[data-ps-dialog-title]').textContent = title;
    q('[data-ps-dialog-apply]').textContent = applyLabel;
    q('[data-ps-dialog-apply]').disabled = false;
    build(body);
    q('[data-ps-dialog-apply]').onclick = async () => {
      const button = q('[data-ps-dialog-apply]'); button.disabled = true;
      try { if (await onApply(isCurrent) !== false && isCurrent()) dialog.close(); }
      catch (error) { if (isCurrent()) report(error); }
      finally { if (isCurrent()) button.disabled = false; }
    };
    dialog.showModal();
  }
  function paragraph(parent, text) { const p = document.createElement('p'); p.textContent = text; parent.append(p); return p; }
  function review(document, label, warnings = []) {
    const plan = session.prepareReplacement(document, label);
    showDialog(label, parent => {
      paragraph(parent, `${plan.width} × ${plan.height} · ${plan.layers} layers · ${plan.frames} frames · ${plan.indexed ? 'Indexed slots preserved' : 'RGBA'}`);
      paragraph(parent, 'Apply replaces the studio artwork and starts a fresh Undo history. Download your current project first if you need a backup. Cancel keeps your artwork.');
      warnings.forEach(warning => paragraph(parent, warning));
      const preview = documentCanvas(plan.width, plan.height, plan.preview); preview.className = 'ps-review'; parent.append(preview);
    }, 'Apply replacement', () => { session.applyReplacement(plan); slot = 0; render(); scheduleSave(); status('Artwork opened locally. The original file is unchanged.'); });
  }
  function documentCanvas(width, height, pixels) { const result = document.createElement('canvas'); paintRaster(result, { width, height, pixels }); return result; }
  function renderCanvas(pixels, frameId) {
    if (disposed) return;
    paintRaster(canvas, { width: doc().width, height: doc().height, pixels: pixels ?? composite(doc(), frameId) });
    const viewport = q('[data-ps-viewport]'), fit = Math.max(1, Math.min(20, Math.floor(Math.min((viewport.clientWidth - 40) / doc().width, (viewport.clientHeight - 40) / doc().height))));
    const zoom = q('[data-ps-zoom]').value === 'fit' ? fit : Number(q('[data-ps-zoom]').value);
    surface.style.width = doc().width * zoom + 'px'; surface.style.height = doc().height * zoom + 'px';
    q('[data-ps-overlay]').style.backgroundSize = `${zoom}px ${zoom}px`;
    q('[data-ps-overlay]').hidden = !q('[data-ps-grid]').checked || zoom < 5;
  }
  function button(text, onClick, selected = false) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.setAttribute('aria-pressed', String(selected)); b.onclick = onClick; return b;
  }
  function render() {
    const document = doc(), layer = activeLayer(document);
    renderCanvas();
    q('[data-ps-name]').value = document.name;
    q('[data-ps-info]').textContent = `${document.width} × ${document.height} · ${document.layers.length} layers · ${document.frames.length} frames`;
    q('[data-ps-undo]').disabled = !session.editor.canUndo; q('[data-ps-redo]').disabled = !session.editor.canRedo;
    q('[data-ps-layer-name]').value = layer.name; q('[data-ps-opacity]').value = layer.opacity;
    q('[data-ps-visible]').textContent = layer.visible ? 'Hide' : 'Show'; q('[data-ps-lock]').textContent = layer.locked ? 'Unlock' : 'Lock';
    const layers = q('[data-ps-layers]'); layers.replaceChildren();
    [...document.layers].reverse().forEach(l => layers.append(button(`${l.visible ? '●' : '○'} ${l.name}${l.locked ? ' · locked' : ''}`, () => action(() => { session.select('Layer', l.id); return false; }), l.id === document.activeLayerId)));
    q('[data-ps-delete-layer]').disabled = document.layers.length === 1;
    q('[data-ps-delete-frame]').disabled = document.frames.length === 1;
    const frames = q('[data-ps-frames]'); frames.replaceChildren();
    document.frames.forEach((f, i) => {
      const b = button(`${i + 1} · ${f.duration} ms`, () => action(() => { session.select('Frame', f.id); return false; }), f.id === document.activeFrameId);
      b.prepend(documentCanvas(document.width, document.height, composite(document, f.id))); frames.append(b);
    });
    q('[data-ps-duration]').value = document.frames.find(f => f.id === document.activeFrameId).duration;
    q('[data-ps-x]').max = document.width - 1; q('[data-ps-y]').max = document.height - 1;
    const palette = q('[data-ps-palette]'); palette.replaceChildren();
    const colors = document.indexed ? document.indexed.palette : document.palette.map(hex => hex.match(/[a-f0-9]{2}/gi).map(v => parseInt(v, 16)).concat(255));
    slot = Math.min(slot, colors.length - 1);
    colors.forEach((color, index) => {
      const b = button('', () => { slot = index; q('[data-ps-color]').value = '#' + color.slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join(''); q('[data-ps-alpha]').value = color[3]; renderPaletteSelection(); }, Boolean(document.indexed) && slot === index);
      b.style.backgroundColor = `rgba(${color.join(',')})`; b.title = `${document.indexed ? 'Slot ' + index + ': ' : ''}${color.join(', ')}${index === document.indexed?.transparentIndex ? ' · clear slot' : ''}`;
      b.setAttribute('aria-label', b.title); b.dataset.slot = index; palette.append(b);
    });
    const indexed = Boolean(document.indexed); q('[data-ps-color]').disabled = indexed; q('[data-ps-alpha]').disabled = indexed;
    if (indexed) { q('[data-ps-color]').value = '#' + colors[slot].slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join(''); q('[data-ps-alpha]').value = colors[slot][3]; }
    q('[data-ps-mode]').textContent = indexed ? 'Indexed: choose an exact slot above. Duplicate and unused slots are retained. Erase uses the designated clear slot.' : 'RGBA · Pencil replaces complete colour and alpha bytes. Pick samples the raw selected layer.';
    q('[data-ps-palette-title]').textContent = indexed ? 'Indexed slots' : 'Palette';
  }
  function renderPaletteSelection() { q('[data-ps-palette]').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(Boolean(doc().indexed) && Number(b.dataset.slot) === slot))); }
  function pick(point) {
    if (doc().indexed) {
      slot = doc().indexed.cels[doc().activeLayerId][doc().activeFrameId][point.y * doc().width + point.x];
      // Palette buttons set the matching raw colour without collapsing duplicate slots.
      q(`[data-slot="${slot}"]`).click(); status(`Picked slot ${slot}.`);
    } else {
      const p = rasterCel(doc(), activeLayer(doc())), i = (point.y * doc().width + point.x) * 4;
      q('[data-ps-color]').value = '#' + [...p.subarray(i, i + 3)].map(v => v.toString(16).padStart(2, '0')).join(''); q('[data-ps-alpha]').value = p[i + 3]; status(`Picked (${point.x}, ${point.y}).`);
    }
  }
  function inputFor(points) {
    const hex = q('[data-ps-color]').value;
    const color = hex.match(/[a-f0-9]{2}/gi).map(v => parseInt(v, 16)).concat(Number(q('[data-ps-alpha]').value));
    return { tool, points, color, size: Number(q('[data-ps-size]').value), tip: q('[data-ps-tip]').value, filled: q('[data-ps-filled]').checked, slot };
  }
  function pointAt(event) {
    const box = canvas.getBoundingClientRect();
    return { x: Math.max(0, Math.min(doc().width - 1, Math.floor((event.clientX - box.x) / box.width * doc().width))), y: Math.max(0, Math.min(doc().height - 1, Math.floor((event.clientY - box.y) / box.height * doc().height))) };
  }
  function previewGesture() {
    drawFrame = 0; if (!gesture) return;
    if (tool === 'select') {
      renderCanvas(); const bounds = rectangle(gesture.points[0], gesture.points.at(-1));
      const context = canvas.getContext('2d'); context.strokeStyle = '#ff647c'; context.lineWidth = 1; context.strokeRect(bounds.x + .5, bounds.y + .5, Math.max(0, bounds.width - 1), Math.max(0, bounds.height - 1)); return;
    }
    try { gesture.plan = session.prepareGesture(inputFor(gesture.points)); renderCanvas(gesture.plan.preview); }
    catch (error) { gesture.plan = null; report(error); }
  }
  canvas.onpointerdown = event => {
    if (event.button !== 0 || dialog.open) return; event.preventDefault(); ready(); canvas.focus();
    const point = pointAt(event); q('[data-ps-x]').value = point.x; q('[data-ps-y]').value = point.y;
    if (tool === 'pick') return pick(point);
    gesture = { id: event.pointerId, points: [point], plan: null }; canvas.setPointerCapture(event.pointerId); previewGesture();
  };
  canvas.onpointermove = event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const point = pointAt(event), previous = gesture.points.at(-1);
    if (point.x === previous.x && point.y === previous.y) return;
    if (['pencil', 'eraser'].includes(tool)) { if (gesture.points.length >= 4096) { cancelGesture(); status('Stroke exceeded 4096 anchors and was cancelled.'); return; } gesture.points.push(point); }
    else if (tool !== 'fill') gesture.points = [gesture.points[0], point];
    if (!drawFrame) drawFrame = requestAnimationFrame(previewGesture);
  };
  canvas.onpointerup = event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    cancelAnimationFrame(drawFrame); drawFrame = 0;
    // Include the release coordinate even when the browser coalesces the final move.
    const point = pointAt(event); if (tool !== 'fill') { if (['pencil', 'eraser'].includes(tool)) gesture.points.push(point); else gesture.points = [gesture.points[0], point]; }
    if (tool === 'select') { const bounds = rectangle(gesture.points[0], gesture.points.at(-1)); gesture = null; renderCanvas(); transformDialog(bounds); return; }
    previewGesture(); const plan = gesture?.plan; gesture = null;
    action(() => plan ? session.applyGesture(plan) : false);
  };
  canvas.onpointercancel = () => { cancelGesture(); status('Stroke cancelled. Artwork is unchanged.'); };
  canvas.onlostpointercapture = () => { if (gesture) cancelGesture(); };
  function chooseTool(value) { cancelGesture(); tool = value; host.querySelectorAll('[data-ps-tool]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.psTool === value))); status(value + ' selected.'); }
  host.querySelectorAll('[data-ps-tool]').forEach(b => b.onclick = () => chooseTool(b.dataset.psTool));
  q('[data-ps-pixel]').onclick = () => {
    const point = { x: Number(q('[data-ps-x]').value), y: Number(q('[data-ps-y]').value) };
    if (![point.x, point.y].every(Number.isInteger) || point.x < 0 || point.y < 0 || point.x >= doc().width || point.y >= doc().height) return status('Choose a whole-pixel coordinate inside the canvas.');
    if (tool === 'pick') return pick(point);
    if (tool === 'select') return transformDialog({ ...point, width: 1, height: 1 });
    action(() => session.applyGesture(session.prepareGesture(inputFor([point]))));
  };
  const commands = { undo: ['undo'], redo: ['redo'], 'add-layer': ['addLayer'], 'copy-layer': ['addLayer', true], 'delete-layer': ['deleteLayer'], visible: ['toggleLayer'], lock: ['toggleLayerLock'], up: ['moveLayer', 1], down: ['moveLayer', -1], 'add-frame': ['addFrame'], 'copy-frame': ['addFrame', true], 'delete-frame': ['deleteFrame'] };
  Object.entries(commands).forEach(([key, args]) => q(`[data-ps-${key}]`).onclick = () => action(() => session.run(...args)));
  q('[data-ps-name]').onchange = () => action(() => session.rename(q('[data-ps-name]').value), 'Project renamed.');
  q('[data-ps-layer-name]').onchange = () => action(() => session.run('renameLayer', q('[data-ps-layer-name]').value));
  q('[data-ps-opacity]').onchange = () => action(() => session.run('setLayerOpacity', Number(q('[data-ps-opacity]').value)));
  q('[data-ps-duration]').onchange = () => action(() => session.run('setFrameDuration', Number(q('[data-ps-duration]').value)));
  q('[data-ps-grid]').onchange = q('[data-ps-zoom]').onchange = () => renderCanvas();
  function numeric(parent, label, key, value, min, max) {
    const l = document.createElement('label'); l.textContent = label; const input = document.createElement('input'); input.type = 'number'; input.min = String(min); input.max = String(max); input.value = String(value); input.dataset.psField = key; l.append(input); parent.append(l); return input;
  }
  function selectField(parent, label, key, values) {
    const l = document.createElement('label'); l.textContent = label; const select = document.createElement('select'); select.dataset.psField = key;
    values.forEach(([value, title]) => { const option = document.createElement('option'); option.value = value; option.textContent = title; select.append(option); }); l.append(select); parent.append(l); return select;
  }
  function preparedDialog(title, description, build, prepare) {
    let plan;
    showDialog(title, parent => {
      paragraph(parent, description); build(parent);
      const preview = document.createElement('canvas'); preview.className = 'ps-review'; preview.hidden = true;
      const prepareButton = button('Prepare preview', () => {
        try { plan = prepare(); paintRaster(preview, { width: plan.width, height: plan.height, pixels: plan.preview }); preview.hidden = false; q('[data-ps-dialog-apply]').disabled = false; body.querySelector('[data-dialog-error]')?.remove(); }
        catch (error) { plan = null; q('[data-ps-dialog-apply]').disabled = true; report(error); }
      }); prepareButton.dataset.psPrepare = ''; parent.append(prepareButton, preview);
      parent.querySelectorAll('input,select').forEach(input => { input.oninput = input.onchange = () => { plan = null; preview.hidden = true; q('[data-ps-dialog-apply]').disabled = true; }; });
    }, 'Apply', () => { if (!plan) throw Error('Prepare the preview first.'); const changed = session.applyGesture(plan); render(); if (changed) scheduleSave(); status(changed ? 'Reviewed edit applied. Undo restores the previous artwork.' : 'The reviewed edit did not change artwork.'); });
    q('[data-ps-dialog-apply]').disabled = true;
  }
  const numberField = key => Number(body.querySelector(`[data-ps-field="${key}"]`).value);
  function transformDialog(bounds) {
    preparedDialog('Transform selection', 'Move or copy the selected raw-layer rectangle. Transparent pixels replace their destinations. Scaling uses nearest pixels. Artwork changes only on Apply.', parent => {
      paragraph(parent, `Source: ${bounds.x}, ${bounds.y} · ${bounds.width} × ${bounds.height}`);
      numeric(parent, 'Destination X', 'x', bounds.x, 0, doc().width - 1); numeric(parent, 'Destination Y', 'y', bounds.y, 0, doc().height - 1);
      numeric(parent, 'Output width', 'width', bounds.width, 1, 256); numeric(parent, 'Output height', 'height', bounds.height, 1, 256);
      selectField(parent, 'Rotation', 'rotation', [['0', 'None'], ['90', '90° clockwise'], ['180', '180°'], ['270', '270° clockwise']]);
      for (const [key, label] of [['copy', 'Copy instead of move'], ['flipX', 'Flip horizontally'], ['flipY', 'Flip vertically']]) { const l = document.createElement('label'); l.textContent = label; const input = document.createElement('input'); input.type = 'checkbox'; input.dataset.psField = key; l.prepend(input); parent.append(l); }
    }, () => session.prepareSelection(bounds, { x: numberField('x'), y: numberField('y'), width: numberField('width'), height: numberField('height'), rotation: numberField('rotation'), copy: body.querySelector('[data-ps-field="copy"]').checked, flipX: body.querySelector('[data-ps-field="flipX"]').checked, flipY: body.querySelector('[data-ps-field="flipY"]').checked }));
  }
  q('[data-ps-transform]').onclick = () => transformDialog({ x: 0, y: 0, width: doc().width, height: doc().height });
  q('[data-ps-geometry]').onclick = () => preparedDialog('Canvas geometry', 'Applies across every artwork layer and frame. Nearest scaling can omit details; crop, resize and trim can remove pixels. Original conversion sources and references remain unchanged. Review before Apply.', parent => {
    selectField(parent, 'Operation', 'kind', [['scale', 'Scale sprite'], ['resize', 'Resize canvas (top-left anchor)'], ['crop', 'Crop rectangle'], ['cw', 'Rotate 90° clockwise'], ['half', 'Rotate 180°'], ['flipX', 'Flip horizontally'], ['flipY', 'Flip vertically'], ['trim', 'Trim transparent edges']]);
    numeric(parent, 'Width', 'width', doc().width, 1, 256); numeric(parent, 'Height', 'height', doc().height, 1, 256); numeric(parent, 'Crop X', 'x', 0, 0, doc().width - 1); numeric(parent, 'Crop Y', 'y', 0, 0, doc().height - 1);
  }, () => {
    const kind = body.querySelector('[data-ps-field="kind"]').value, width = numberField('width'), height = numberField('height');
    const options = kind === 'scale' ? { kind, width, height } : kind === 'resize' ? { kind, width, height, anchorX: 'start', anchorY: 'start', offsetX: 0, offsetY: 0 } : kind === 'crop' ? { kind, width, height, x: numberField('x'), y: numberField('y') } : kind === 'cw' || kind === 'half' ? { kind: 'rotate', rotation: kind === 'cw' ? 90 : 180 } : kind === 'trim' ? { kind } : { kind: 'flip', axis: kind === 'flipX' ? 'horizontal' : 'vertical' };
    return session.prepareGeometry(options);
  });
  const resize = new ResizeObserver(() => renderCanvas()); resize.observe(q('[data-ps-viewport]'));
  q('[data-ps-new]').onclick = () => {
    showDialog('New sprite', parent => {
      paragraph(parent, 'Create a blank sprite up to 256 pixels per axis. Applying replaces the current artwork and Undo history.');
      for (const [label, key] of [['Width', 'width'], ['Height', 'height']]) {
        const l = document.createElement('label'); l.textContent = label; const input = document.createElement('input'); input.type = 'number'; input.min = '1'; input.max = '256'; input.value = '32'; input.dataset.psNewDimension = key; l.append(input); parent.append(l);
      }
    }, 'Create sprite', () => { const next = createDocument(Number(body.querySelector('[data-ps-new-dimension="width"]').value), Number(body.querySelector('[data-ps-new-dimension="height"]').value)); session.applyReplacement(session.prepareReplacement(next)); render(); scheduleSave(); status('New sprite created.'); });
  };
  q('[data-ps-open]').onchange = async event => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    ready(); const job = ++loadJob, revision = session.revision;
    try {
      if (file.size > 24 * 1024 * 1024) throw Error('Project input exceeds 24 MiB.');
      const ext = file.name.split('.').at(-1).toLowerCase(); let document, warnings = [];
      if (ext === 'ezpix') document = decodeProject(await file.text());
      else if (ext === 'ase' || ext === 'aseprite') ({ document, warnings } = await decodeAseprite(new Uint8Array(await file.arrayBuffer()), file.name));
      else if (ext === 'piskel') ({ document, warnings } = await decodePiskel(await file.text()));
      else {
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (ext === 'png' && bytes[25] === 3) document = await decodeIndexedPngDocument(bytes, file.name);
        else {
          const raster = await readImage(file);
          if (raster.width > 256 || raster.height > 256) throw Error('Use Capture & convert to resize images larger than 256 pixels before editing.');
          document = createDocument(raster.width, raster.height, file.name); document.cel.pixels.set(raster.pixels);
          warnings.push('This image becomes one RGBA layer. Browser image decoding can change colour profiles and hidden transparent RGB.');
        }
      }
      if (disposed) return;
      if (job !== loadJob || revision !== session.revision) return status('Artwork changed while reading the file. Open it again to review.');
      review(document, 'Open ' + file.name, warnings);
    } catch (error) { if (job === loadJob) report(error); }
  };
  q('[data-ps-save]').onclick = () => {
    try { cancelGesture(); downloadFile(new Blob([session.project(false)], { type: 'application/json' }), fileName() + '.ezpix'); status('Project download requested. It preserves editable artwork; original conversion images and Undo history are excluded.'); }
    catch (error) { report(error); }
  };
  q('[data-ps-export]').onclick = () => {
    const revision = session.revision, snapshot = decodeProject(session.project(false)), name = fileName();
    showDialog('Export artwork', parent => {
      const label = document.createElement('label'); label.textContent = 'Format'; const select = document.createElement('select'); select.dataset.psExportFormat = '';
      [['png', 'PNG · selected frame'], ['apng', 'Animated PNG'], ['gif', 'GIF · up to 256 colours'], ['atlas', 'Sprite sheet + JSON (ZIP)'], ['frames', 'Frames + JSON (ZIP)'], ['aseprite', 'Aseprite · supported editable subset']].forEach(([value, title]) => { const option = document.createElement('option'); option.value = value; option.textContent = title; select.append(option); }); label.append(select); parent.append(label);
      paragraph(parent, 'PNG and animation exports render visible layers. GIF may quantize colours/alpha. Sheet and frame ZIPs include timing metadata. Exports omit source images, references and Undo history. Keep an EzPix project for full editability.');
      asepriteExportWarnings(snapshot).forEach(warning => paragraph(parent, 'Aseprite: ' + warning));
    }, 'Download export', async isCurrent => {
      if (exporting) return false; exporting = true;
      try {
        const format = body.querySelector('[data-ps-export-format]').value;
        let bytes, suffix;
        if (format === 'png') { bytes = await encodeNativePng(snapshot.width, snapshot.height, composite(snapshot)); suffix = '.png'; }
        else if (format === 'aseprite') { bytes = encodeAseprite(snapshot); suffix = '.aseprite'; }
        else {
          const files = await exportAssets(snapshot, { ...defaultAssetExport(), format, columns: Math.min(8, snapshot.frames.length) });
          if (format === 'apng' || format === 'gif') { bytes = files.get(format === 'apng' ? 'animation.png' : 'animation.gif'); suffix = format === 'apng' ? '.apng' : '.gif'; }
          else { const { writeNativeZip } = await import('../packages/core/dist/native-zip.js'); bytes = writeNativeZip(files); suffix = '-' + format + '.zip'; }
        }
        if (disposed || revision !== session.revision || !isCurrent()) throw Error('Artwork changed or export was cancelled. Prepare it again.');
        downloadFile(new Blob([new Uint8Array(bytes)], { type: 'application/octet-stream' }), name + suffix); status('Export download requested.');
      } finally { exporting = false; }
    });
  };
  q('[data-ps-handoff]').onclick = async () => { try { ready(); await onHandoff(doc()); } catch (error) { report(error); } };
  q('[data-ps-play]').onclick = () => {
    if (playing) { stopPlayback(); renderCanvas(); return; } cancelGesture(); playStart = performance.now(); q('[data-ps-play]').textContent = 'Stop';
    const tick = now => { if (disposed || host.hidden) { stopPlayback(); return; } renderCanvas(undefined, animationAtTime(doc(), now - playStart).frameId); playing = requestAnimationFrame(tick); }; playing = requestAnimationFrame(tick);
  };
  async function saveDraft() {
    const epoch = recoveryEpoch; if (!autosave || disposed) return;
    try {
      const project = session.project(false), id = draftId;
      await updateState('studioDrafts', current => epoch === recoveryEpoch && autosave ? retainStudioDraft(current, id, project) : current);
      if (epoch === recoveryEpoch) q('[data-ps-recovery-status]').textContent = 'Recovery saved on this device. Restore is always reviewed.';
    } catch (error) { if (epoch === recoveryEpoch) q('[data-ps-recovery-status]').textContent = error.message + ' Download a project backup.'; }
  }
  function scheduleSave() { clearTimeout(saveTimer); if (autosave) saveTimer = setTimeout(saveDraft, 400); }
  q('[data-ps-autosave]').onchange = async () => {
    autosave = q('[data-ps-autosave]').checked; recoveryEpoch++; clearTimeout(saveTimer);
    // Consent is per studio tab, never silently re-enabled in another tab.
    q('[data-ps-recovery-status]').textContent = autosave ? 'Saving this studio draft locally…' : 'Automatic recovery paused. Existing drafts remain until deleted or expired.';
    if (autosave) await saveDraft();
  };
  q('[data-ps-recover]').onclick = async () => {
    try {
      const items = studioDrafts(await state('studioDrafts'));
      showDialog('Saved studio drafts', parent => {
        paragraph(parent, items.length ? 'Choose a draft to review before replacing your artwork.' : 'No saved drafts. Enable local recovery to retain this studio artwork.');
        items.forEach(item => { const document = decodeProject(item.project); const b = button(`${document.name} · ${new Date(item.updated).toLocaleString()} · ${document.width} × ${document.height}`, () => { dialog.close(); review(document, 'Restore saved draft', ['Recovery excludes original conversion images and Undo history.']); }); parent.append(b); });
      }, 'Close', () => {});
    } catch (error) { report(error); }
  };
  q('[data-ps-forget]').onclick = () => showDialog('Delete saved studio drafts?', parent => paragraph(parent, 'This deletes all saved manual-studio drafts from this browser profile and pauses automatic recovery in this tab. Open artwork and downloaded files are retained.'), 'Delete saved drafts', async () => {
    recoveryEpoch++; autosave = false; q('[data-ps-autosave]').checked = false; clearTimeout(saveTimer); await state('studioDrafts', null); q('[data-ps-recovery-status]').textContent = 'Saved drafts deleted. Recovery is paused.';
  });
  function keydown(event) {
    if (host.hidden || dialog.open || event.target.closest('input,select,textarea,[contenteditable=true]')) return;
    if (event.key === 'Escape') { event.preventDefault(); cancelGesture(); stopPlayback(); return; }
    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      const key = event.key.toLowerCase(); if (['z', 'y', 's'].includes(key)) { event.preventDefault(); if (key === 's') q('[data-ps-save]').click(); else action(() => session.run(key === 'y' || event.shiftKey ? 'redo' : 'undo')); } return;
    }
    if (event.altKey) return;
    const keys = { b: 'pencil', e: 'eraser', f: 'fill', i: 'pick', l: 'Line', r: 'Rectangle', o: 'Ellipse', m: 'select' };
    if (keys[event.key.toLowerCase()]) { event.preventDefault(); chooseTool(keys[event.key.toLowerCase()]); }
    if (event.target === canvas && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) {
      event.preventDefault(); const x = q('[data-ps-x]'), y = q('[data-ps-y]');
      if (event.key === ' ') q('[data-ps-pixel]').click();
      else { x.value = Math.max(0, Math.min(doc().width - 1, Number(x.value) + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0))); y.value = Math.max(0, Math.min(doc().height - 1, Number(y.value) + (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0))); status(`Cursor ${x.value}, ${y.value}. Space uses ${tool}.`); }
    }
  }
  document.addEventListener('keydown', keydown);
  const beforeUnload = event => { if (session.dirty) { event.preventDefault(); event.returnValue = ''; } };
  addEventListener('beforeunload', beforeUnload);
  render();
  // Discover recovery without decoding or silently replacing the current document.
  state('studioDrafts').then(value => { if (disposed) return; const items = studioDrafts(value); if (items.length) q('[data-ps-recovery-status]').textContent = `${items.length} saved draft(s) available. Review saved drafts to restore.`; }).catch(() => { q('[data-ps-recovery-status]').textContent = 'Recovery is unavailable. Project downloads still work.'; });
  return {
    review,
    suspend() { ready(); },
    get dirty() { return session.dirty; },
    dispose() { disposed = true; ready(); clearTimeout(saveTimer); resize.disconnect(); document.removeEventListener('keydown', keydown); removeEventListener('beforeunload', beforeUnload); host.replaceChildren(); },
  };
}
