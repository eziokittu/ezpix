import {hexColor,rgbToHsv,hsvToHex} from '../packages/core/dist/color.js';

/** In-popup colour controls: opening a system dialog can dismiss an action popup. */
export function mountColourPicker(host) {
  const key=host.querySelector('[data-focus-key]'),oldSwatch=host.querySelector('[data-focus-key-swatch]');
  const swatch=document.createElement('button');swatch.type='button';swatch.dataset.focusKeySwatch='';swatch.setAttribute('aria-label','Choose background colour');swatch.title='Choose any background colour';oldSwatch.replaceWith(swatch);
  const panel=document.createElement('div');panel.className='sf-colour-picker';panel.id='background-colour-picker';panel.hidden=true;panel.setAttribute('role','group');panel.setAttribute('aria-label','Background colour picker');
  panel.innerHTML='<div class="sf-colour-plane" aria-hidden="true"><span></span></div><label>Hue<input data-sf-colour-control data-colour-hue type="range" min="0" max="360" step="1" aria-label="Background hue"></label><label>Saturation<input data-sf-colour-control data-colour-saturation type="range" min="0" max="100" step="1" aria-label="Background saturation"></label><label>Brightness<input data-sf-colour-control data-colour-brightness type="range" min="0" max="100" step="1" aria-label="Background brightness"></label><label>Hex colour<input data-sf-colour-control data-colour-hex type="text" maxlength="7" spellcheck="false" aria-label="Background hex colour"></label><p data-colour-error hidden>Use a hex colour such as #3366ff.</p><button type="button" data-colour-done>Done</button>';
  host.querySelector('[data-focus-key-controls]').after(panel);
  const plane=panel.querySelector('.sf-colour-plane'),marker=plane.firstElementChild,hue=panel.querySelector('[data-colour-hue]'),saturation=panel.querySelector('[data-colour-saturation]'),brightness=panel.querySelector('[data-colour-brightness]'),hex=panel.querySelector('[data-colour-hex]'),error=panel.querySelector('[data-colour-error]');
  let h=120,s=1,v=1;
  function readColour(){
    const next=rgbToHsv(...hexColor(key.value).slice(0,3));h=next.h;s=next.s/100;v=next.v/100;
  }
  function colour(){
    return hsvToHex(h,s*100,v*100);
  }
  function paint(){
    plane.style.background=`linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,transparent),hsl(${h} 100% 50%)`;
    marker.style.left=s*100+'%';marker.style.top=(1-v)*100+'%';hue.value=String(h);saturation.value=String(s*100);brightness.value=String(v*100);hex.value=key.value;error.hidden=true;
  }
  function commit(){key.value=colour();key.dispatchEvent(new Event('change',{bubbles:true}));paint();}
  function close(){panel.hidden=true;swatch.setAttribute('aria-expanded','false');key.setAttribute('aria-expanded','false');}
  function toggle(){if(!panel.hidden){close();return;}readColour();paint();panel.hidden=false;swatch.setAttribute('aria-expanded','true');key.setAttribute('aria-expanded','true');requestAnimationFrame(()=>{const settings=panel.closest('.sf-settings');settings.scrollTop+=panel.getBoundingClientRect().top-settings.getBoundingClientRect().top-8;});}
  for(const button of [key,swatch]){button.setAttribute('aria-controls',panel.id);button.setAttribute('aria-expanded','false');button.addEventListener('click',toggle);}
  key.setAttribute('role','button');key.title='Choose any background colour';key.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}});
  swatch.style.background=key.value;
  const point=e=>{const r=plane.getBoundingClientRect();s=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));v=1-Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));commit();};
  plane.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();plane.setPointerCapture(e.pointerId);point(e);});
  plane.addEventListener('pointermove',e=>{if(plane.hasPointerCapture(e.pointerId))point(e);});
  plane.addEventListener('pointerup',e=>{if(plane.hasPointerCapture(e.pointerId)){point(e);plane.releasePointerCapture(e.pointerId);}});
  hue.oninput=()=>{h=Number(hue.value);commit();};saturation.oninput=()=>{s=Number(saturation.value)/100;commit();};brightness.oninput=()=>{v=Number(brightness.value)/100;commit();};
  hex.oninput=()=>{if(/^#[0-9a-f]{6}$/i.test(hex.value)){key.value=hex.value.toLowerCase();readColour();key.dispatchEvent(new Event('change',{bubbles:true}));paint();}else error.hidden=false;};
  panel.querySelector('[data-colour-done]').onclick=()=>{close();swatch.focus();};
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();swatch.focus();}});
  host.querySelector('[data-focus-pick]').addEventListener('click',close);host.querySelector('[data-focus-method]').addEventListener('change',close);
  return {close};
}
