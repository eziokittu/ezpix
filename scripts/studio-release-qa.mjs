import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createDocument, createIndexedDocument, encodeProject, decodeProject, composite } from '../packages/core/dist/index.js';

const out = resolve('artifacts/studio-release'); await mkdir(out, { recursive: true });
const ext = resolve('dist/extension');
const context = await chromium.launchPersistentContext(resolve(out, 'profile-' + Date.now()), {
  channel: 'chromium', executablePath: process.env.EZPIX_CHROMIUM_PATH, headless: true,
  acceptDownloads: true, viewport: { width: 1440, height: 1000 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--disable-gpu'],
});
const errors = [], checks = [], network = [];
context.on('page', p => { p.on('pageerror', e => errors.push(e.message)); p.on('request', r => { if (/^https?:/.test(r.url())) network.push(r.url()); }); p.on('dialog', dialog => dialog.accept()); });
let page;
const check = message => { checks.push(message); console.log('PASS', message); };
try {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker'), id = new URL(worker.url()).host;
  const url = `chrome-extension://${id}/app.html#studio`;
  page = await context.newPage(); page.setDefaultTimeout(15000); await page.goto(url); await page.locator('[data-ps-canvas]').waitFor();
  async function downloaded(selector, file) {
    const event = page.waitForEvent('download'); await page.locator(selector).click(); const download = await event; const path = resolve(out, file ?? download.suggestedFilename()); await download.saveAs(path); return path;
  }
  async function project(name = 'artwork.ezpix') { return decodeProject(await readFile(await downloaded('[data-ps-save]', name), 'utf8')); }
  async function pixel(x, y, tool = 'pencil') {
    await page.locator(`[data-ps-tool="${tool}"]`).click(); await page.locator('[data-ps-x]').fill(String(x)); await page.locator('[data-ps-y]').fill(String(y)); await page.locator('[data-ps-pixel]').click();
  }
  async function reviewFile(name, text) {
    await page.locator('[data-ps-open]').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(text) }); await page.locator('[data-ps-dialog][open]').waitFor();
  }
  await pixel(2, 3); let document = await project('single-pixel.ezpix'); assert.deepEqual([...composite(document).slice((3 * 32 + 2) * 4, (3 * 32 + 2) * 4 + 4)], [76, 224, 178, 255]);
  await page.locator('[data-ps-undo]').click(); assert.equal(composite(await project('undone.ezpix')).some(v => v !== 0), false); await page.locator('[data-ps-redo]').click();
  check('offline keyboard painting and exact downloadable Undo/Redo');

  const box = await page.locator('[data-ps-canvas]').boundingBox();
  await page.mouse.move(box.x + box.width * .2, box.y + box.height * .2); await page.mouse.down(); await page.mouse.move(box.x + box.width * .8, box.y + box.height * .8, { steps: 6 }); await page.keyboard.press('Escape'); await page.mouse.up();
  assert.deepEqual(composite(await project('cancelled-stroke.ezpix')), composite(document));
  check('Escape discards the live stroke preview without artwork/history loss');
  await page.mouse.move(box.x + box.width * .2, box.y + box.height * .5); await page.mouse.down(); await page.mouse.move(box.x + box.width * .8, box.y + box.height * .5, { steps: 6 }); await page.mouse.up();
  const stroked = await project('stroke.ezpix'); assert.equal(composite(stroked)[(16 * 32 + 16) * 4 + 3], 255);
  await page.locator('[data-ps-undo]').click(); assert.deepEqual(composite(await project('one-stroke-undo.ezpix')), composite(document));
  check('connected mouse stroke commits exactly one Undo');

  await page.locator('[data-ps-transform]').click(); await page.locator('[data-ps-field="flipX"]').check(); await page.locator('[data-ps-prepare]').click(); await page.locator('[data-ps-dialog-apply]').click();
  assert.equal(composite(await project('flipped.ezpix'))[(3 * 32 + 29) * 4], 76); await page.locator('[data-ps-undo]').click();
  await page.locator('[data-ps-geometry]').click(); await page.locator('[data-ps-field="width"]').fill('64'); await page.locator('[data-ps-field="height"]').fill('64'); await page.locator('[data-ps-prepare]').click();
  await page.locator('[data-ps-field="width"]').fill('48'); assert.equal(await page.locator('[data-ps-dialog-apply]').isDisabled(), true); await page.locator('[data-ps-prepare]').click(); await page.locator('[data-ps-dialog-apply]').click();
  assert.equal((await project('scaled.ezpix')).width, 48); await page.locator('[data-ps-undo]').click(); assert.equal((await project('geometry-undo.ezpix')).width, 32);
  check('selection flip and canvas scale use reviewed previews, stale-setting rejection and atomic Undo');

  await page.locator('[data-ps-new]').click(); await page.locator('[data-ps-new-dimension="width"]').fill('12'); await page.locator('[data-ps-new-dimension="height"]').fill('10'); await page.getByRole('button', { name: 'Cancel', exact: true }).click(); assert.equal((await project('new-cancel.ezpix')).width, 32);
  await page.locator('[data-ps-add-layer]').click(); await pixel(5, 6); await page.locator('[data-ps-copy-frame]').click(); await page.locator('[data-ps-duration]').fill('240'); await page.locator('[data-ps-duration]').dispatchEvent('change'); await pixel(7, 8);
  document = await project('layers-animation.ezpix'); assert.equal(document.layers.length, 2); assert.equal(document.frames.length, 2); assert.equal(document.frames[1].duration, 240); assert.equal(composite(document, document.frames[0].id)[(8 * 32 + 7) * 4 + 3], 0);
  await page.locator('[data-ps-play]').click(); await page.locator('[data-ps-play]').filter({ hasText: 'Stop' }).waitFor(); await page.locator('[data-ps-play]').click();
  check('reviewed new cancellation, layers, independent animation frames, timing and playback');

  for (const format of ['png', 'apng', 'gif', 'atlas', 'frames', 'aseprite']) {
    await page.locator('[data-ps-export]').click(); await page.locator('[data-ps-export-format]').selectOption(format);
    const path = await downloaded('[data-ps-dialog-apply]', 'export-' + format + (format === 'atlas' || format === 'frames' ? '.zip' : format === 'aseprite' ? '.aseprite' : format === 'gif' ? '.gif' : '.png'));
    assert.ok((await readFile(path)).length > 30); await page.locator('[data-ps-dialog][open]').waitFor({ state: 'hidden' });
  }
  check('actual PNG, APNG, GIF, Aseprite, atlas ZIP and timed-frame ZIP downloads');

  await page.locator('[data-ps-open]').setInputFiles({ name: 'bad.ezpix', mimeType: 'application/json', buffer: Buffer.from('{}') }); await page.locator('[data-ps-status]').filter({ hasText: /Unsupported/ }).waitFor(); assert.deepEqual(composite(await project('malformed-preserved.ezpix')), composite(document));
  await reviewFile('small.ezpix', encodeProject(createDocument(4, 4, 'Small'))); await page.getByRole('button', { name: 'Cancel', exact: true }).click(); assert.equal((await project('open-cancel.ezpix')).width, 32);
  check('malformed project and cancelled file replacement preserve editable artwork');

  await page.locator('.ps-recovery summary').click(); await page.locator('[data-ps-autosave]').check(); await page.locator('[data-ps-recovery-status]').filter({ hasText: 'Recovery saved' }).waitFor();
  await page.reload(); await page.locator('[data-ps-canvas]').waitFor(); assert.equal(composite(await project('fresh-after-reload.ezpix')).some(v => v !== 0), false);
  await page.locator('.ps-recovery summary').click(); await page.locator('[data-ps-recover]').click(); await page.locator('[data-ps-dialog-body] button').first().click(); await page.locator('[data-ps-dialog-apply]').click(); assert.deepEqual(composite(await project('restored.ezpix')), composite(document)); assert.equal(await page.locator('[data-ps-autosave]').isChecked(), false);
  check('opt-in recovery survives reload, restores only after review, and keeps new-tab consent off');
  await page.locator('[data-clear]').click(); assert.deepEqual(composite(await project('capture-clear-preserves-studio.ezpix')), composite(document));
  check('clearing capture never discards manual studio artwork or saved drafts');

  const indexed = createIndexedDocument({ width: 8, height: 8, palette: [[12, 13, 14, 0], [91, 32, 144, 255], [91, 32, 144, 255], [222, 111, 12, 128]], transparentIndex: 0, indices: new Uint8Array(64) }, 'Duplicate slots');
  await reviewFile('indexed.ezpix', encodeProject(indexed)); await page.locator('[data-ps-dialog-apply]').click(); await page.locator('[data-slot="2"]').click(); await pixel(1, 1);
  let exported = await project('indexed-slot.ezpix'); assert.equal(exported.indexed.cels[exported.activeLayerId][exported.activeFrameId][9], 2); assert.deepEqual(exported.indexed.palette, indexed.indexed.palette);
  await pixel(1, 1, 'eraser'); await page.locator('[data-ps-undo]').click(); exported = await project('indexed-undo.ezpix'); assert.equal(exported.indexed.cels[exported.activeLayerId][exported.activeFrameId][9], 2);
  check('indexed browser edits preserve duplicate/unused palette slots, raw IDs and clear role');

  await page.locator('[data-studio-view="capture"]').click(); await page.locator('[data-focus-file]').setInputFiles(resolve('../glitchbong/public/ezpix/starters/kenney-town.png')); await page.waitForFunction(() => document.querySelector('[data-focus-source]').width === 256); await page.locator('[data-focus-enabled]').uncheck(); await page.locator('[data-edit-focus]:not([disabled])').waitFor(); await page.locator('[data-edit-focus]').click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click(); assert.deepEqual((await project('conversion-cancel.ezpix')).indexed.palette, indexed.indexed.palette);
  await page.locator('[data-studio-view="capture"]').click(); await page.locator('[data-edit-focus]').click(); await page.locator('[data-ps-dialog-apply]').click(); const converted = await project('converted-to-studio.ezpix'); assert.ok(!converted.indexed); assert.equal(converted.frames.length, 1);
  check('conversion-to-manual studio uses explicit Apply/Cancel and preserves the previous artwork on cancel');

  await page.locator('[data-ps-tool="pencil"]').click(); await page.locator('[data-ps-name]').fill('Town sprite'); await page.locator('[data-ps-name]').dispatchEvent('change');
  await page.screenshot({ path: resolve(out, 'pixel-studio-desktop.png'), fullPage: true });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 900 }); await page.locator('[data-ps-canvas]').scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal page overflow at ' + width);
    await page.screenshot({ path: resolve(out, `pixel-studio-${width}.png`), fullPage: true });
    await page.locator('[data-ps-export]').click(); assert.ok(await page.locator('[data-ps-dialog-apply]').isVisible()); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
  check('desktop and 390/320px studio/export controls remain accessible');
  assert.deepEqual(network, [], 'manual studio, conversion and downloads require no HTTP requests'); assert.deepEqual(errors, []);
  await writeFile(resolve(out, 'result.json'), JSON.stringify({ version: '0.461.0', browser: context.browser().version(), checks, errors, network }, null, 2));
} catch (error) {
  console.error(errors); if (page) { console.error(await page.locator('[data-ps-status]').allTextContents()); await page.screenshot({ path: resolve(out, 'failure.png'), fullPage: true }).catch(() => {}); } throw error;
} finally { await context.close(); }
