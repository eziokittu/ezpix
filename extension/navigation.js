/** Wait for a real initialized tab before navigating it away from our holding page. */
export function waitForTabReady(tabId,tabs=chrome.tabs,timeoutMs=5000){
  return new Promise((resolve,reject)=>{
    let done=false;
    const finish=error=>{if(done)return;done=true;clearTimeout(timer);tabs.onUpdated.removeListener(updated);tabs.onRemoved.removeListener(removed);error?reject(error):resolve();};
    const updated=(id,change)=>{if(id===tabId&&change.status==='complete')finish();};
    const removed=id=>{if(id===tabId)finish(new Error('Destination tab closed. Download the project or try again.'));};
    const timer=setTimeout(()=>finish(new Error('Destination tab did not initialize. Download the project or try again.')),timeoutMs);
    tabs.onUpdated.addListener(updated);tabs.onRemoved.addListener(removed);
    tabs.get(tabId).then(tab=>{if(tab.status==='complete')finish();},finish);
  });
}
