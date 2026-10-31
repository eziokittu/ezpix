export function mediaError(error,mode){
 const camera=mode==='camera';
 if(error?.name==='NotAllowedError')return camera?'Camera access was blocked by Chrome or Windows. Allow camera access in Chrome and Windows Settings, then try again.':'Screen sharing was cancelled or blocked. Choose a screen, window or tab in the browser chooser and select Share.';
 if(error?.name==='NotFoundError')return 'No camera was found. Connect a camera, then try again.';
 if(error?.name==='NotReadableError')return camera?'The camera is busy or blocked by Windows. Close other camera apps and check Windows camera access.':'Chrome could not read that screen. Try sharing a different screen, window or tab.';
 if(error?.name==='OverconstrainedError')return 'That camera is no longer available. Select another camera or reconnect it.';
 if(error?.name==='AbortError')return 'Capture was interrupted. Try again.';
 return error?.message||'Capture could not start. Try again or open a local image.';
}
