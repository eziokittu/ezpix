import {
  PixelEditor, createDocument, encodeProject, decodeProject, composite,
  prepareDrawing, defaultDrawingOptions, prepareAuthored, defaultIndexedBrush,
  captureSelection, prepareCanvasGeometry,
} from '../packages/core/dist/index.js';

const plans = new WeakMap();
const copy = doc => decodeProject(encodeProject(doc, true));
const baseline = doc => encodeProject(doc, false);

/** Local studio controller. All pixel, indexed-slot and history algorithms are core APIs. */
export class StudioSession {
  constructor(doc = createDocument(32, 32, 'Untitled')) {
    this.editor = new PixelEditor(copy(doc));
    this.revision = 0;
    this.dirty = false;
  }
  get document() { return this.editor.document; }
  prepareReplacement(doc, label = 'Open artwork') {
    const document = copy(doc);
    const plan = Object.freeze({ label, width: document.width, height: document.height,
      layers: document.layers.length, frames: document.frames.length,
      indexed: Boolean(document.indexed), preview: composite(document) });
    plans.set(plan, { owner: this, revision: this.revision, baseline: baseline(this.document), document });
    return plan;
  }
  applyReplacement(plan) {
    const stored = this.checked(plan);
    if (!stored.document) throw Error('Invalid artwork review.');
    this.editor = new PixelEditor(stored.document);
    plans.delete(plan);
    this.changed();
  }
  checked(plan) {
    const stored = plans.get(plan);
    if (!stored || stored.owner !== this || stored.revision !== this.revision || stored.baseline !== baseline(this.document))
      throw Error('Artwork changed. Prepare the preview again.');
    return stored;
  }
  changed() { this.revision++; this.dirty = true; }
  run(method, ...args) {
    // Indexed structure must update raw planes and caches together through core authored plans.
    if (this.document.indexed) {
      const actions = { addLayer: args[0] ? 'duplicate-layer' : 'new-layer', deleteLayer: 'delete-layer', addFrame: args[0] ? 'duplicate-frame' : 'new-frame', deleteFrame: 'delete-frame', clearCel: 'clear', unlinkCel: 'unlink' };
      if (method === 'setFrameDuration') return this.authored({ kind: 'indexed-document', action: 'duration', duration: args[0] });
      if (Object.hasOwn(actions, method)) return this.authored({ kind: 'indexed-document', action: actions[method] });
    }
    const allowed = ['addLayer', 'deleteLayer', 'renameLayer', 'toggleLayer', 'toggleLayerLock', 'setLayerOpacity', 'moveLayer', 'addFrame', 'deleteFrame', 'setFrameDuration', 'clearCel', 'unlinkCel', 'undo', 'redo'];
    if (!allowed.includes(method)) throw Error('Unsupported studio command.');
    const changed = this.editor[method](...args);
    if (changed) this.changed();
    return changed;
  }
  authored(operation) {
    const changed = this.editor.applyAuthored(prepareAuthored(this.document, operation, this.editor.historyBudget));
    if (changed) this.changed();
    return changed;
  }
  select(kind, id) {
    if (!['Layer', 'Frame'].includes(kind)) throw Error('Invalid studio selection.');
    this.editor['select' + kind](id);
    this.revision++;
  }
  rename(name) {
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) throw Error('Use a project name of 1–80 characters.');
    if (name.trim() === this.document.name) return false;
    this.document.name = name.trim(); this.changed(); return true;
  }
  prepareGesture(input) {
    input = structuredClone(input);
    const doc = this.document;
    const { tool, points, color, size = 1, tip = 'square', mirrorX = false, mirrorY = false, filled = false, slot = 0 } = input;
    if (!['pencil', 'eraser', 'fill', 'Line', 'Rectangle', 'Ellipse'].includes(tool) || !Array.isArray(points) || !points.length || points.length > 4096)
      throw Error('Invalid drawing gesture.');
    if (!Array.isArray(color) || color.length !== 4 || !color.every(n => Number.isInteger(n) && n >= 0 && n <= 255) || !Number.isInteger(size) || size < 1 || size > 32 || !['square', 'circle'].includes(tip) || ![mirrorX, mirrorY, filled].every(v => typeof v === 'boolean')
      || !points.every(p => p && Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.y >= 0 && p.x < doc.width && p.y < doc.height)) throw Error('Use valid pixel coordinates, RGBA bytes and brush size 1–32.');
    let corePlan, apply;
    if (doc.indexed) {
      const brush = { ...defaultIndexedBrush(slot), size, shape: tip, mirrorX, mirrorY };
      const operation = tool === 'fill' ? { kind: 'indexed-tool', action: 'flood', point: points[0], slot }
        : ['pencil', 'eraser'].includes(tool) ? { kind: 'indexed-tool', action: 'stroke', points, brush, erase: tool === 'eraser' }
        : { kind: 'indexed-tool', action: 'shape', shape: tool, a: points[0], b: points.at(-1), filled, slot, size, tip };
      corePlan = prepareAuthored(doc, operation, this.editor.historyBudget);
      apply = () => this.editor.applyAuthored(corePlan);
    } else if (['pencil', 'eraser'].includes(tool)) {
      corePlan = prepareDrawing(doc, points, { ...defaultDrawingOptions(tool === 'eraser' ? [0, 0, 0, 0] : color), size, shape: tip, mirrorX, mirrorY });
      apply = () => this.editor.applyDrawing(corePlan);
    } else {
      // Core shape/fill commands run on a private document for a cancellation-safe preview.
      const execute = editor => {
        if (tool === 'fill') editor.fill(points[0].x, points[0].y, color);
        else editor.shape(tool, points[0], points.at(-1), color, filled, { size, shape: tip });
        return editor.commit();
      };
      const draft = new PixelEditor(copy(doc)); execute(draft);
      corePlan = { preview: composite(draft.document) };
      apply = () => execute(this.editor);
    }
    const preview = corePlan.displayPreview ?? corePlan.preview;
    const plan = Object.freeze({ preview: preview.slice() });
    plans.set(plan, { owner: this, revision: this.revision, baseline: baseline(doc), apply });
    return plan;
  }
  applyGesture(plan) {
    const stored = this.checked(plan);
    if (!stored.apply) throw Error('Invalid drawing review.');
    const changed = stored.apply(); plans.delete(plan);
    if (changed) this.changed();
    return changed;
  }
  prepareSelection(rect, options) {
    const selection = captureSelection(this.document, structuredClone(rect));
    options = structuredClone(options);
    const draft = new PixelEditor(copy(this.document));
    draft.applySelection(captureSelection(draft.document, rect), options);
    const plan = Object.freeze({ width: this.document.width, height: this.document.height, preview: composite(draft.document) });
    plans.set(plan, { owner: this, revision: this.revision, baseline: baseline(this.document), apply: () => this.editor.applySelection(selection, options) });
    return plan;
  }
  prepareGeometry(options) {
    const corePlan = prepareCanvasGeometry(this.document, options, this.editor.historyBudget);
    const plan = Object.freeze({ width: corePlan.width, height: corePlan.height, preview: corePlan.preview.slice() });
    plans.set(plan, { owner: this, revision: this.revision, baseline: baseline(this.document), apply: () => this.editor.applyCanvasGeometry(corePlan) });
    return plan;
  }
  project(includeSource = false) { return encodeProject(this.document, includeSource); }
}

export const DRAFT_LIMIT = 8 * 1024 * 1024;
export const DRAFT_AGE = 7 * 24 * 60 * 60 * 1000;
/** Exact bounded local-only recovery envelope; project decoding is repeated before restore. */
export function studioDrafts(value, now = Date.now()) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 4) throw Error('Invalid studio recovery list.');
  let bytes = 0;
  const ids = new Set();
  const result = [];
  for (const item of value) {
    if (!item || Object.keys(item).sort().join() !== 'id,project,updated' || typeof item.id !== 'string' || !/^[a-f0-9-]{36}$/.test(item.id) || ids.has(item.id)
      || typeof item.project !== 'string' || !Number.isSafeInteger(item.updated) || item.updated < 0 || item.updated > now + 60000)
      throw Error('Invalid studio recovery record.');
    ids.add(item.id); bytes += new TextEncoder().encode(item.project).length;
    if (bytes > DRAFT_LIMIT) throw Error('Studio recovery exceeds 8 MiB. Download individual projects.');
    if (now - item.updated <= DRAFT_AGE) result.push({ ...item });
  }
  return result;
}
export function retainStudioDraft(value, id, project, now = Date.now()) {
  // Decode before storing, and never retain original conversion images in recovery.
  const doc = decodeProject(project);
  const safe = encodeProject(doc, false);
  if (new TextEncoder().encode(safe).length > DRAFT_LIMIT) throw Error('This project is too large for local recovery. Download a project backup.');
  const items = studioDrafts(value, now).filter(item => item.id !== id);
  items.push({ id, project: safe, updated: now });
  items.sort((a, b) => b.updated - a.updated);
  while (items.length > 4 || items.reduce((n, item) => n + new TextEncoder().encode(item.project).length, 0) > DRAFT_LIMIT) items.pop();
  return studioDrafts(items, now);
}
