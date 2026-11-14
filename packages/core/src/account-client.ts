import {appConfirm} from './dialogs.js';
import {PREF_KEYS,validatePreferences,mergePreferences,readLocalPreferences,applyLocalPreferences,type Preferences,type PreferenceKey} from './preferences.js';
export interface AccountStorage {read(key:string):Promise<unknown>;write(key:string,value:unknown):Promise<void>}
export const ACCOUNT_ORIGIN='https://glitchbong.com';
export async function preferenceStorage():Promise<AccountStorage>{
 const open=()=>new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('ezpix-preferences',1);r.onupgradeneeded=()=>r.result.createObjectStore('settings');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('Preference storage unavailable.'));});
 const run=async(key:string,value?:unknown)=>{const db=await open();try{return await new Promise<unknown>((resolve,reject)=>{const tx=db.transaction('settings',value===undefined?'readonly':'readwrite'),r=value===undefined?tx.objectStore('settings').get(key):tx.objectStore('settings').put(value,key);let result:unknown;r.onsuccess=()=>result=r.result;tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(Error('Could not save preferences.'));});}finally{db.close();}};
 return {read:key=>run(key),write:async(key,value)=>{await run(key,value);}};
}
function random(){const bytes=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
async function digest(value:string){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
export function mountAccount(host:HTMLElement,options:{platform:'android'|'extension'|'website';storage:AccountStorage;open?:(url:string)=>void;authorize?:()=>Promise<void>;readExtra?:()=>Promise<Partial<Record<PreferenceKey,unknown>>>;applyExtra?:(prefs:Preferences)=>Promise<void>}){
 const section=document.createElement('section');section.className='ez-account';section.innerHTML='<h3>Your EzPix account</h3><p>Continue with Google to sync appearance, tool preferences, palettes, collage layouts and Google Fonts across your devices. Artwork stays on this device. Imported fonts may download from Google on a new device.</p><div class="ez-account-actions"><button data-account-login>Continue with Google</button><button data-account-sync hidden>Sync now</button><button data-account-logout hidden>Disconnect this device</button><button data-account-delete hidden>Delete synced setup</button></div><a data-account-continue hidden target="_blank" rel="noopener noreferrer">Continue sign-in in your browser</a><p><a href="https://glitchbong.com/settings" target="_blank" rel="noopener noreferrer">Manage or request deletion of your GlitchBong account</a></p><p data-account-status role="status">Sign-in is optional. Editing works without an account.</p>';host.append(section);
 const q=<T extends HTMLElement>(selector:string)=>section.querySelector<T>(selector)!;
 let disposed=false,connected=false,busy=false,hydrated=false,token='',state:Preferences={},baseline:Partial<Record<PreferenceKey,unknown>>={},epoch=0,abort:AbortController|undefined;
 const status=(message:string)=>{if(!disposed)q('[data-account-status]').textContent=message;};
 const request=async(path:string,body?:unknown,method=body===undefined?'GET':'POST')=>{let response:Response;try{response=await fetch(ACCOUNT_ORIGIN+'/api/ezpix/'+path,{method,credentials:options.platform==='website'?'include':'omit',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000),cache:'no-store'});}catch(error){if(error instanceof TypeError||error instanceof Error&&/fetch/i.test(error.message))throw Error('Could not reach GlitchBong sign-in. Check your connection. If this continues, the EzPix account API and its Android origin access need to be deployed on glitchbong.com.');throw error;}if(response.status===404)throw Error('The EzPix account service is not deployed on glitchbong.com yet. Editing remains available offline.');const value=await response.json().catch(()=>({error:'Account service unavailable.'}));if(!response.ok)throw Error(value.error??'Account service unavailable.');return value;};
 const collect=async()=>({...readLocalPreferences(),...(await options.readExtra?.()??{})});
 const controls=()=>{q('[data-account-login]').hidden=connected;q('[data-account-sync]').hidden=q('[data-account-logout]').hidden=q('[data-account-delete]').hidden=!connected;};
 async function sync(first=!hydrated){
  if(disposed||busy||!connected)return;busy=true;const job=epoch;
  try{
   const local=await collect();
   // Record local changes before any network request so offline edits keep their original sync clock.
   if(!first){const dirty:Preferences={};for(const key of PREF_KEYS)if(key in local&&JSON.stringify(local[key])!==JSON.stringify(baseline[key]))dirty[key]={updated:Math.max(Date.now(),(state[key]?.updated??0)+1),value:local[key]};state=mergePreferences(state,validatePreferences(dirty));baseline=local;await options.storage.write('account-checkpoint',{state,baseline});}
   const remoteResponse=await request('preferences'),remote=validatePreferences(remoteResponse.preferences);
   if(disposed||job!==epoch)return;
   const changes:Preferences={};for(const key of PREF_KEYS)if(key in local&&JSON.stringify(local[key])!==JSON.stringify(baseline[key])){
    // Initial sign-in adopts existing account settings; missing account fields use this device's setup.
    if(first&&!remote[key])changes[key]={updated:Math.max(Date.now(),(state[key]?.updated??0)+1),value:local[key]};
   }
   state=mergePreferences(mergePreferences(state,remote),validatePreferences(changes));
   const saved=validatePreferences((await request('preferences',{preferences:state})).preferences);
   if(disposed||job!==epoch)return;
   // Do not overwrite changes made while the network requests were in flight.
   const latest=await collect(),duringRequest:Preferences={};for(const key of PREF_KEYS)if(key in latest&&JSON.stringify(latest[key])!==JSON.stringify(local[key]))duringRequest[key]={updated:Math.max(Date.now(),(saved[key]?.updated??0)+1),value:latest[key]};
   state=mergePreferences(mergePreferences(state,saved),validatePreferences(duringRequest));applyLocalPreferences(state);await options.applyExtra?.(state);
   if(disposed||job!==epoch)return;hydrated=true;baseline=await collect();await options.storage.write('account-checkpoint',{state,baseline});status('Preferences synced'+(remoteResponse.profile?.email?' as '+String(remoteResponse.profile.email):'')+'. Your photos and projects stay local.');
  }catch(error){status((error as Error).message+' Your local settings are kept.');}
  finally{busy=false;}
 }
 const start=async()=>{
  if(busy||disposed)return;busy=true;const job=++epoch;abort?.abort();abort=new AbortController();const signal=abort.signal;
  const loginWindow=options.platform==='website'?window.open('about:blank','_blank'):null;let navigated=false;if(loginWindow)loginWindow.opener=null;
  try{
   await options.authorize?.();const verifier=random(),challenge=await digest(verifier);const device=await request('devices',{challenge,platform:options.platform});
   if(disposed||job!==epoch)return;
   const url=ACCOUNT_ORIGIN+'/tools/ezpix/connect?code='+encodeURIComponent(device.code);
   const link=q<HTMLAnchorElement>('[data-account-continue]');link.href=url;link.hidden=false;
   if(loginWindow&&!loginWindow.closed){loginWindow.location.href=url;navigated=true;}else (options.open??(url=>window.open(url,'_blank','noopener,noreferrer')))(url);status('Finish Google sign-in and approve this device in your browser.');
   for(let attempt=0;attempt<120;attempt++){
    await new Promise<void>(resolve=>{const done=()=>{clearTimeout(id);signal.removeEventListener('abort',done);resolve();};const id=setTimeout(done,2500);signal.addEventListener('abort',done,{once:true});});
    if(disposed||job!==epoch||signal.aborted)return;
    const result=await request('devices/token',{code:device.code,verifier});
    if(result.status==='pending')continue;if(result.status!=='approved'||typeof result.token!=='string')throw Error('Sign-in expired or was declined.');
    token=result.token;state={};baseline={};hydrated=false;await options.storage.write('account-token',token);await options.storage.write('account-checkpoint',null);connected=true;controls();link.hidden=true;busy=false;await sync(true);return;
   }
   throw Error('Sign-in timed out. Try again when ready.');
  }catch(error){if(loginWindow&&!navigated)loginWindow.close();status((error as Error).message);}
  finally{busy=false;}
 };
 q<HTMLButtonElement>('[data-account-login]').onclick=()=>void start();q<HTMLButtonElement>('[data-account-sync]').onclick=()=>void sync();
 q<HTMLButtonElement>('[data-account-logout]').onclick=async()=>{epoch++;abort?.abort();try{await request('devices/revoke',{});}catch{/* Local disconnect must work offline. */}token='';connected=false;state={};baseline={};await options.storage.write('account-token','');await options.storage.write('account-checkpoint',null);controls();status('Disconnected. Local fonts, settings and artwork are kept.');};
 q<HTMLButtonElement>('[data-account-delete]').onclick=async()=>{if(!await appConfirm('Delete your synced EzPix settings and disconnect all linked devices? Local fonts, settings and artwork will be kept.'))return;try{await request('preferences',undefined,'DELETE');epoch++;abort?.abort();token='';connected=false;state={};baseline={};hydrated=false;await options.storage.write('account-token','');await options.storage.write('account-checkpoint',null);controls();status('Synced setup deleted and devices disconnected. Local work is kept.');}catch(error){status((error as Error).message);}};
 void options.storage.read('account-token').then(async value=>{if(disposed)return;if(typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value)){token=value;connected=true;controls();const checkpoint=await options.storage.read('account-checkpoint') as {state:Preferences;baseline:Partial<Record<PreferenceKey,unknown>>}|undefined;try{if(checkpoint){state=validatePreferences(checkpoint.state);baseline=checkpoint.baseline;hydrated=true;}}catch{state={};baseline={};}await sync(!hydrated);}}).catch(()=>status('Account storage unavailable. Local editing is still available.'));
 const timer=setInterval(()=>void sync(),30000);const online=()=>void sync();window.addEventListener('online',online);
 return {sync,dispose(){disposed=true;epoch++;abort?.abort();clearInterval(timer);window.removeEventListener('online',online);section.remove();}};
}
