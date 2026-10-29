export async function database() {
  return new Promise((resolve,reject) => {
    const request=indexedDB.open('ezpix-local',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('state');
    request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(new Error('Local storage is unavailable.'));
  });
}
export async function state(key, value = undefined) {
  const db=await database();
  try { return await new Promise((resolve,reject) => {
    const tx=db.transaction('state',value===undefined?'readonly':'readwrite'), store=tx.objectStore('state');
    const request=value===undefined?store.get(key):value===null?store.delete(key):store.put(value,key);
    let result; request.onsuccess=()=>{result=request.result;};
    tx.oncomplete=()=>resolve(result); tx.onerror=()=>reject(new Error('Local storage failed.')); tx.onabort=()=>reject(new Error('Local storage was interrupted.'));
  }); } finally { db.close(); }
}
export async function purgeExpired(now=Date.now()) {
  for (const key of ['capture','transfer','selection']) await updateState(key,item=>item&&item.expires<=now?null:item);
  // Manual-studio recovery is a separate, opt-in seven-day policy. Purge on wake,
  // without decoding artwork or allowing damaged recovery to block page capture.
  await updateState('studioDrafts',items=>{
    if(!Array.isArray(items))return items;
    const retained=items.filter(item=>item&&Number.isSafeInteger(item.updated)&&now-item.updated<=7*24*60*60*1000);
    return retained.length===items.length?items:retained.length?retained:null;
  });
}
/** Conditional mutation inside one transaction prevents old ACK/expiry races. */
export async function updateState(key, update) {
  const db=await database();
  try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction('state','readwrite'),store=tx.objectStore('state'),request=store.get(key);let result,error;
    request.onsuccess=()=>{try{result=update(request.result);if(result===null)store.delete(key);else if(result!==undefined&&result!==request.result)store.put(result,key);}catch(e){error=e;tx.abort();}};
    tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(error??new Error('Local storage failed.'));tx.onabort=()=>reject(error??new Error('Local storage was interrupted.'));
  });}finally{db.close();}
}
