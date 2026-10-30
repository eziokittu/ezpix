import {state, updateState} from './db.js';

const PAGE = 'app.html';
let opening;
async function existing() {
  const record = await state('floatingStudio');
  if (!record) return null;
  try {
    // Tab URLs are withheld without the broad tabs permission, including our own popup.
    // Extension contexts identify our document without requesting browsing-history access.
    const [window, contexts] = await Promise.all([chrome.windows.get(record.windowId), chrome.runtime.getContexts({documentUrls: [chrome.runtime.getURL(PAGE)], windowIds: [record.windowId]})]);
    if (window.type === 'popup' && contexts.some(context => context.tabId === record.tabId && context.frameId === 0)) return record;
  } catch { /* Closed windows and records from a previous browser session are discarded. */ }
  await state('floatingStudio', null);
  return null;
}
export async function openFloatingStudio(source) {
  if (opening) await opening;
  opening = (async () => {
    let record = await existing();
    const binding = {sourceTabId: source.id, sourceWindowId: source.windowId};
    if (record) {
      record = {...record, ...binding};
      await state('floatingStudio', record);
      await chrome.windows.update(record.windowId, {focused: true});
      return;
    }
    const parent = await chrome.windows.get(source.windowId);
    const window = await chrome.windows.create({url: chrome.runtime.getURL(PAGE), type: 'popup', width: 460, height: 360,
      left: (parent.left ?? 0) + Math.max(0, Math.floor(((parent.width ?? 1100) - 460) / 2)), top: (parent.top ?? 0) + 60, focused: true});
    const tab = window.tabs?.[0] ?? (await chrome.tabs.query({windowId: window.id}))[0];
    await state('floatingStudio', {windowId: window.id, tabId: tab.id, ...binding});
  })();
  try { await opening; } finally { opening = null; }
}
export async function captureSource() {
  const record = await existing();
  if (!record) throw Error('Click the EzPIX Insta toolbar icon on the webpage to choose a capture source.');
  const [tab] = await chrome.tabs.query({active: true, windowId: record.sourceWindowId});
  if (tab?.id !== record.sourceTabId || !/^https?:/.test(tab.url ?? '')) throw Error('Source tab changed or cannot be captured. Click the toolbar icon on the webpage you want to capture.');
  await chrome.windows.update(record.sourceWindowId, {focused: true});
  return tab;
}
export async function presentFloatingStudio() {
  const record = await existing();
  if (record) await chrome.windows.update(record.windowId, {focused: true});
}
export async function resizeFloatingStudio(mode, area) {
  if (!['compact', 'media', 'live'].includes(mode)) throw Error('Invalid studio layout.');
  const record = await existing();
  if (!record) return {status: 'not-floating'};
  const widthLimit = Number.isFinite(area?.width) && area.width >= 300 ? Math.floor(area.width) : 1280;
  const heightLimit = Number.isFinite(area?.height) && area.height >= 300 ? Math.floor(area.height) : 900;
  const width = Math.min(mode === 'media' ? 1060 : 460, widthLimit - 24);
  const height = Math.min(mode === 'media' ? 760 : mode === 'live' ? 540 : 360, heightLimit - 40);
  const window = await chrome.windows.get(record.windowId);
  const leftEdge = Number.isFinite(area?.left) ? Math.floor(area.left) : 0;
  const topEdge = Number.isFinite(area?.top) ? Math.floor(area.top) : 0;
  const left = Math.max(leftEdge, Math.min(window.left ?? leftEdge, leftEdge + widthLimit - width));
  const top = Math.max(topEdge, Math.min(window.top ?? topEdge, topEdge + heightLimit - height));
  await chrome.windows.update(record.windowId, {width, height, left, top});
  return {width, height};
}
chrome.windows.onRemoved.addListener(id => {
  void updateState('floatingStudio', record => record?.windowId === id ? null : record);
});
