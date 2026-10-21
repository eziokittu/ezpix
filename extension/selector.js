/** Serialized into the isolated content world. Keep this function self-contained. */
export function selectOnPage(mode, nonce) {
  globalThis.__ezpixSelectionCleanup?.();
  // Receive selection events above embedded frames too. Events inside a frame
  // never bubble to this window, even for a same-origin iframe.
  const root=document.createElement('div'); root.id='ezpix-capture-overlay'; root.style.cssText='all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:auto;';
  const shadow=root.attachShadow({mode:'closed'}), box=document.createElement('div'), label=document.createElement('div');
  box.style.cssText='position:fixed;border:2px solid #39ff14;background:#39ff1422;box-sizing:border-box;pointer-events:none;';
  label.style.cssText='position:fixed;top:12px;left:12px;padding:12px;background:#0a0008;color:#f0e6ff;font:14px system-ui;border:1px solid #a855f7;border-radius:8px;pointer-events:none;';
  label.textContent=mode==='element'?'EzPix: click an element · Esc cancels · visible pixels only':'EzPix: drag a region · Esc cancels';
  shadow.append(box,label); document.documentElement.append(root);
  let start=null, chosen=null, done=false;
  const metrics=()=>({viewportWidth:innerWidth,viewportHeight:innerHeight,scrollX,scrollY,dpr:devicePixelRatio});
  const clamp=(r)=>{const x=Math.max(0,r.x),y=Math.max(0,r.y); return {x,y,width:Math.max(0,Math.min(innerWidth,r.x+r.width)-x),height:Math.max(0,Math.min(innerHeight,r.y+r.height)-y)};};
  const draw=r=>{box.style.left=r.x+'px';box.style.top=r.y+'px';box.style.width=r.width+'px';box.style.height=r.height+'px';};
  const stop=e=>{e.preventDefault();e.stopImmediatePropagation();};
  function elementAt(x,y){root.style.pointerEvents='none';try{return document.elementFromPoint(x,y);}finally{root.style.pointerEvents='auto';}}
  function move(e) {
    if(mode==='element') { const target=elementAt(e.clientX,e.clientY); if(target && target!==root) { chosen=clamp(target.getBoundingClientRect()); draw(chosen); } }
    else if(start) { chosen=clamp({x:Math.min(start.x,e.clientX),y:Math.min(start.y,e.clientY),width:Math.abs(e.clientX-start.x),height:Math.abs(e.clientY-start.y)});draw(chosen); }
    stop(e);
  }
  function down(e) { if(e.button!==0)return; stop(e); if(mode==='region') {start={x:e.clientX,y:e.clientY};} else {const target=elementAt(e.clientX,e.clientY);if(target)chosen=clamp(target.getBoundingClientRect());} }
  async function up(e) {
    stop(e); if(done || !chosen || chosen.width<2 || chosen.height<2)return;
    done=true; const rect=chosen, bounds=metrics(); cleanup();
    window.addEventListener('click',stop,{capture:true,once:true});
    await Promise.race([new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))),new Promise(r=>setTimeout(r,250))]);
    chrome.runtime.sendMessage({type:'SELECTED',nonce,rect,...bounds}).catch(()=>{});
  }
  function key(e) { if(e.key==='Escape'){stop(e);done=true;cleanup();chrome.runtime.sendMessage({type:'CANCEL',nonce}).catch(()=>{});} }
  function cleanup(){root.remove();for(const [name,handler] of [['pointermove',move],['pointerdown',down],['pointerup',up],['keydown',key],['click',stop]])window.removeEventListener(name,handler,true); delete globalThis.__ezpixSelectionCleanup;}
  globalThis.__ezpixSelectionCleanup=cleanup;
  for(const [name,handler] of [['pointermove',move],['pointerdown',down],['pointerup',up],['keydown',key],['click',stop]])window.addEventListener(name,handler,{capture:true,passive:false});
  return metrics();
}
