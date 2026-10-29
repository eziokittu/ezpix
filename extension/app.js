import { mountConverter } from '../packages/core/dist/converter.js';
import { encodeProject } from '../packages/core/dist/index.js';
import { readImage } from '../packages/core/dist/browser.js';
import { state, purgeExpired } from './db.js';
import {WEBSITE_HANDOFF_ENABLED} from './config.js';
import { mountTheme } from './theme.js';
import { mountPixelStudio } from './pixel-studio.js';

mountTheme();
const status = document.querySelector('[data-handoff-status]');
const host = document.querySelector('[data-converter]'), studioHost = document.querySelector('[data-pixel-studio]');
let ui, studio, handingOff = false;
async function handoff(doc, retain = false) {
  if (!WEBSITE_HANDOFF_ENABLED) throw Error('This release works locally. Download your project to keep editing.');
  if (handingOff) throw Error('A handoff is already being prepared.');
  handingOff = true; document.querySelector('[data-clear]').disabled = true;
  try {
    status.textContent = 'Preparing a local handoff?';
    const result = await chrome.runtime.sendMessage({ type: 'HANDOFF', project: encodeProject(doc, retain) });
    if (result?.error) throw Error(result.error);
    if (result?.status !== 'opened') throw Error('The editor did not open. Download a project as a fallback.');
    status.textContent = 'Website opened. Choose Receive extension artwork, then Import received artwork. Project download is always available as a fallback.';
  } catch (error) { status.textContent = error.message ?? 'Could not transfer. Download a project and open it in the website.'; }
  finally { handingOff = false; document.querySelector('[data-clear]').disabled = false; }
}
function show(view) {
  if (view === 'studio' && !studio) studio = mountPixelStudio(studioHost, { onHandoff: WEBSITE_HANDOFF_ENABLED ? handoff : undefined });
  if (view === 'studio') ui?.suspend(); else studio?.suspend();
  host.hidden = view !== 'capture'; studioHost.hidden = view !== 'studio';
  document.querySelectorAll('[data-studio-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.studioView === view)));
}
function mount() {
  ui = mountConverter(host, {
    createWorker: () => new Worker(new URL('worker.js', location.href), { type: 'module' }),
    applyLabel: 'Open in EzPIX website',
    showApply: WEBSITE_HANDOFF_ENABLED,
    onApply: doc => handoff(doc, Boolean(host.querySelector('[data-retain]')?.checked)),
    onEdit: doc => { show('studio'); studio.review(doc, 'Edit converted artwork', ['The prepared conversion is copied into this offline studio. Existing studio artwork is replaced only after Apply.']); },
  });
}
mount();
document.querySelectorAll('[data-studio-view]').forEach(button => button.onclick = () => show(button.dataset.studioView));
document.querySelector('a.sf-brand').onclick = event => { event.preventDefault(); show('studio'); };
show(location.hash === '#studio' ? 'studio' : 'capture');
try {
  await purgeExpired(); const captured = await state('capture');
  if (captured?.error) status.textContent = captured.error;
  else if (captured?.blob) { ui.load(await readImage(captured.blob)); status.textContent = 'Capture ready. Convert and download, or choose Edit in Pixel studio for manual cleanup.'; }
  else status.textContent = 'Create pixel artwork in Pixel studio, or open media and capture a page in Capture & convert. All processing stays on this device.';
} catch { status.textContent = 'Could not reopen the capture. Choose an image or capture again.'; }
document.querySelector('[data-clear]').onclick = async () => {
  if (handingOff) return;
  try { ui.dispose(); await Promise.all(['capture', 'transfer', 'selection'].map(key => state(key, null))); mount(); status.textContent = 'Capture and pending handoff cleared. Manual studio artwork and saved drafts are retained.'; }
  catch { mount(); status.textContent = 'Could not clear extension storage. Try removing the extension data through Chrome settings.'; }
};
