import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, PixelEditor, hexColor, encodeProject, decodeProject, MAX_PROJECT_BYTES } from '../dist/index.js';
const red = hexColor('#ff0022');
test('continuous mirrored gesture undoes and redoes atomically', () => {
  const editor = new PixelEditor(createDocument(8, 8));
  editor.line(0, 0, 3, 3, red, true, true);
  assert.equal(editor.commit(), true);
  const result = [...editor.document.cel.pixels];
  assert.equal(result.filter((_, i) => i % 4 === 3 && result[i] === 255).length, 16);
  assert.equal(editor.undo(), true);
  assert.ok(editor.document.cel.pixels.every(v => v === 0));
  editor.redo(); assert.deepEqual([...editor.document.cel.pixels], result);
});
test('fill respects boundaries and eraser preserves transparent round trip', () => {
  const editor = new PixelEditor(createDocument(4, 4, 'Original'));
  editor.line(1, 0, 1, 3, red); editor.commit();
  editor.fill(0, 0, hexColor('#39ff14')); editor.commit();
  assert.equal(editor.document.cel.pixels[(3 * 4 + 2) * 4 + 3], 0);
  editor.paint(1, 1, [0, 0, 0, 0]); editor.commit();
  assert.deepEqual(decodeProject(encodeProject(editor.document)), editor.document);
});
test('limits and hostile files fail before cel allocation', () => {
  for (const size of [0, -1, 257, 1.5, NaN]) assert.throws(() => createDocument(size, 8));
  for (const payload of ['null', '{}', '{', 'x'.repeat(MAX_PROJECT_BYTES + 1), JSON.stringify({ format: 'ezpix', version: 7 })]) assert.throws(() => decodeProject(payload));
  const valid = JSON.parse(encodeProject(createDocument(1, 1)));
  assert.throws(() => decodeProject(JSON.stringify({ ...valid, width: undefined })));
  for (const pixels of [[0], [0,0,0,256], [0,0,0,1.1], ['0',0,0,0]]) assert.throws(() => decodeProject(JSON.stringify({ ...valid, version:2, pixels })));
});
test('history eviction, no-op gestures and branching keep current artwork', () => {
  const editor = new PixelEditor(createDocument(4, 4), 640);
  editor.paint(0, 0, red); editor.commit();
  editor.paint(1, 0, red); editor.commit();
  assert.equal(editor.evicted, true); assert.equal(editor.historyBytes, 640);
  editor.undo(); assert.equal(editor.document.cel.pixels[3], 255);
  editor.paint(2, 0, red); editor.commit(); assert.equal(editor.canRedo, false);
  editor.paint(2, 0, red); assert.equal(editor.commit(), false);
});
