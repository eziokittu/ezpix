import test from 'node:test';
import assert from 'node:assert/strict';
import { StudioSession, studioDrafts, retainStudioDraft, DRAFT_AGE, DRAFT_LIMIT } from '../studio-model.js';
import { createDocument, createIndexedDocument, decodeProject, composite, defaultRecipe } from '../../packages/core/dist/index.js';

const draw = (s, points = [{ x: 1, y: 1 }], tool = 'pencil', extra = {}) => s.prepareGesture({ tool, points, color: [91, 32, 144, 255], ...extra });
test('studio stages strokes without changing artwork, commits one Undo, and retains Redo after a no-op', () => {
  const s = new StudioSession(createDocument(8, 8)); const before = s.project();
  const plan = draw(s, [{ x: 0, y: 0 }, { x: 7, y: 7 }]); assert.equal(s.project(), before);
  assert.equal(s.applyGesture(plan), true); assert.equal(s.editor.canUndo, true);
  assert.equal(composite(s.document)[(4 * 8 + 4) * 4], 91);
  s.run('undo'); assert.equal(s.project(), before); assert.equal(s.editor.canUndo, false);
  const empty = draw(s, [{ x: 0, y: 0 }], 'eraser'); assert.equal(s.applyGesture(empty), false); assert.equal(s.editor.canRedo, true);
  s.run('redo'); assert.equal(composite(s.document)[0], 91);
});
test('cancelled, stale, foreign, forged and reused studio plans cannot apply', () => {
  const s = new StudioSession(), other = new StudioSession(); const plan = draw(s);
  assert.throws(() => other.applyGesture(plan), /changed/); assert.throws(() => s.applyGesture({ preview: plan.preview }), /changed/);
  s.rename('Changed'); assert.throws(() => s.applyGesture(plan), /changed/);
  const current = draw(s); s.applyGesture(current); assert.throws(() => s.applyGesture(current), /changed/);
  const staged = s.prepareReplacement(createDocument(4, 4)); s.select('Frame', s.document.activeFrameId);
  assert.throws(() => s.applyReplacement(staged), /changed/);
});
test('studio replacement is private and preserves old artwork until explicit apply', () => {
  const s = new StudioSession(); s.applyGesture(draw(s)); const before = s.project();
  const next = createDocument(3, 2, '<script>untrusted</script>'); next.cel.pixels.set([1, 2, 3, 255]);
  const review = s.prepareReplacement(next); next.cel.pixels[0] = 99; review.preview[0] = 88;
  assert.equal(s.project(), before); s.applyReplacement(review);
  assert.equal(s.document.width, 3); assert.equal(s.document.cel.pixels[0], 1); assert.equal(s.editor.canUndo, false);
});
test('stroke inputs are private and shapes/fill use reversible shared core commands', () => {
  const s = new StudioSession(createDocument(8, 8)); const points = [{ x: 1, y: 1 }, { x: 6, y: 6 }];
  const plan = draw(s, points, 'Rectangle'); points[0].x = 7; s.applyGesture(plan);
  assert.equal(composite(s.document)[(1 * 8 + 1) * 4], 91); assert.equal(composite(s.document)[(3 * 8 + 3) * 4 + 3], 0);
  s.applyGesture(draw(s, [{ x: 3, y: 3 }], 'fill', { color: [1, 2, 3, 255] }));
  assert.equal(composite(s.document)[(3 * 8 + 3) * 4], 1); s.run('undo'); assert.equal(composite(s.document)[(3 * 8 + 3) * 4 + 3], 0);
});
test('studio layers, independent duplicated frames, timing and project reopen preserve editable art', () => {
  const s = new StudioSession(createDocument(8, 8)); s.applyGesture(draw(s)); s.run('addLayer');
  s.applyGesture(draw(s, [{ x: 3, y: 2 }], 'pencil', { color: [7, 8, 9, 111] })); s.run('addFrame', true); s.run('setFrameDuration', 240);
  s.applyGesture(draw(s, [{ x: 5, y: 5 }])); const reopened = decodeProject(s.project());
  assert.equal(reopened.layers.length, 2); assert.equal(reopened.frames.length, 2); assert.equal(reopened.frames[1].duration, 240);
  assert.equal(composite(reopened, reopened.frames[0].id)[(5 * 8 + 5) * 4 + 3], 0);
  assert.equal(composite(reopened, reopened.frames[1].id)[(5 * 8 + 5) * 4 + 3], 255);
});
test('indexed studio keeps duplicate/unused slot identity, erases to clear role and undoes structure and art', () => {
  const indexed = createIndexedDocument({ width: 4, height: 4, palette: [[11, 22, 33, 0], [91, 32, 144, 255], [91, 32, 144, 255], [8, 9, 10, 128]], transparentIndex: 0, indices: new Uint8Array(16) });
  const s = new StudioSession(indexed); s.applyGesture(draw(s, [{ x: 1, y: 1 }], 'pencil', { slot: 2 }));
  const indices = () => s.document.indexed.cels[s.document.activeLayerId][s.document.activeFrameId];
  assert.equal(indices()[5], 2); s.run('addFrame', true); s.run('addLayer', true);
  assert.equal(indices()[5], 2); s.run('deleteLayer'); assert.equal(s.document.layers.length, 1); assert.equal(Object.keys(s.document.indexed.cels).length, 1); s.run('undo'); assert.equal(s.document.layers.length, 2); assert.equal(indices()[5], 2); s.run('undo'); s.run('undo'); assert.equal(s.document.frames.length, 1); assert.equal(s.document.layers.length, 1);
  s.applyGesture(draw(s, [{ x: 1, y: 1 }], 'eraser')); assert.equal(indices()[5], 0); s.run('undo'); assert.equal(indices()[5], 2);
  const reopened = decodeProject(s.project()); assert.deepEqual(reopened.indexed.palette, indexed.indexed.palette); assert.equal(reopened.indexed.transparentIndex, 0);
});
test('reviewed restore snapshots retain raw indexed cels and linked identity', () => {
  const s = new StudioSession(createIndexedDocument({ width: 2, height: 2, palette: [[0, 0, 0, 0], [5, 6, 7, 255]], transparentIndex: 0, indices: Uint8Array.of(1, 0, 0, 1) }));
  s.authored({ kind: 'indexed-document', action: 'duplicate-frame' });
  const first = s.document.frames[0].id; s.authored({ kind: 'indexed-document', action: 'link', frameId: first });
  const next = new StudioSession(); next.applyReplacement(next.prepareReplacement(s.document));
  const cels = next.document.indexed.cels[next.document.activeLayerId]; assert.equal(cels[first], cels[next.document.activeFrameId]);
});
test('recovery expires, caps four drafts/bytes, omits source pixels, and validates before storing', () => {
  const now = 1900000000000; const s = new StudioSession(); const doc = s.document;
  const source = { width: 2, height: 2, pixels: new Uint8ClampedArray(16) }; doc.conversion = { source, recipe: { ...defaultRecipe(source), width: doc.width, height: doc.height } };
  let items;
  for (let i = 0; i < 6; i++) items = retainStudioDraft(items, `00000000-0000-0000-0000-00000000000${i}`, s.project(true), now + i);
  assert.equal(items.length, 4); assert.equal(decodeProject(items[0].project).conversion.source, undefined);
  assert.deepEqual(studioDrafts(items, now + DRAFT_AGE + 1000), []);
  const previous = structuredClone(items); assert.throws(() => retainStudioDraft(items, crypto.randomUUID(), '{}', now + 10), /Unsupported/); assert.deepEqual(items, previous);
  assert.throws(() => studioDrafts([{ id: crypto.randomUUID(), project: 'x'.repeat(DRAFT_LIMIT + 1), updated: now }], now), /8 MiB/);
  assert.throws(() => studioDrafts([{ ...items[0], extra: 1 }], now + 10), /Invalid/);
});
test('reviewed selection copy/flip and all-frame canvas geometry are atomic and stale-safe', () => {
  const s = new StudioSession(createDocument(8, 8)); s.applyGesture(draw(s, [{ x: 1, y: 1 }]));
  const before = s.project(); const plan = s.prepareSelection({ x: 0, y: 0, width: 3, height: 3 }, { x: 4, y: 4, width: 3, height: 3, copy: true, flipX: true, flipY: false, rotation: 0 });
  assert.equal(s.project(), before); s.applyGesture(plan); assert.equal(composite(s.document)[(5 * 8 + 5) * 4], 91); s.run('undo'); assert.equal(s.project(), before);
  s.run('addFrame', true); const geometry = s.prepareGeometry({ kind: 'scale', width: 16, height: 16 }); s.applyGesture(geometry); assert.equal(s.document.width, 16); assert.equal(s.document.frames.length, 2); s.run('undo'); assert.equal(s.document.width, 8);
  const stale = s.prepareGeometry({ kind: 'flip', axis: 'horizontal' }); s.rename('Stale'); assert.throws(() => s.applyGesture(stale), /changed/);
});
