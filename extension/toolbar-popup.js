import {state,updateState} from './db.js';

export function matchesPopupReturn(record,source,now=Date.now()) {
  return !!record&&Number.isSafeInteger(record.expires)&&record.expires>now&&Number.isInteger(source?.tabId)&&Number.isInteger(source?.windowId)&&record.tabId===source.tabId&&record.windowId===source.windowId;
}
export async function consumePopupReturn(source) {
  let restore=false;
  await updateState('popupReturn',record=>{restore=matchesPopupReturn(record,source);return null;});
  return restore;
}
/** The action popup belongs to the focused browser window, just like Table Grabber. */
export async function captureSource(source) {
  if(!Number.isInteger(source?.tabId)||!Number.isInteger(source?.windowId))throw Error('Open the EzPIX toolbar popup on a webpage first.');
  const [tab] = await chrome.tabs.query({active: true, windowId: source.windowId});
  if (tab?.id!==source.tabId || !/^https?:/.test(tab.url ?? '')) throw Error('The source tab changed or cannot be captured. Open the toolbar popup on a normal HTTP or HTTPS webpage.');
  return tab;
}

export async function presentPopup(windowId,tabId) {
  // Never create a window or switch the user away from a different tab/window.
  try {
    const window = await chrome.windows.getLastFocused({windowTypes:['normal']});
    if (window.id !== windowId || !window.focused) return;
    if((await chrome.runtime.getContexts({contextTypes:['POPUP']})).length)return;
    const [active]=await chrome.tabs.query({active:true,windowId});
    if(active?.id!==tabId)return;
    // One return only: selecting a region/photo must not trigger a new full capture.
    await state('popupReturn',{tabId,windowId,expires:Date.now()+30000});
    await chrome.action.openPopup({windowId});
  }
  catch { /* Chrome can decline while another popup is open. Clicking the icon restores the capture. */ }
}
