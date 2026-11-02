/** Arrange the shared converter in the extension's bounded floating workspace. */
export function mountFloatingLayout(host, onMode) {
  const q = selector => host.querySelector(selector);
  const studio = q('.ez-focus-studio'), layout = q('.ez-focus-layout');
  const images = document.createElement('div'); images.className = 'sf-images';
  const coordinateListeners=[],coordinateLabels=[];
  const settings = document.createElement('aside'); settings.className = 'sf-settings'; settings.setAttribute('aria-label', 'Conversion settings');
  const setCollapsed=(section,closed)=>{section.dataset.collapsed=String(closed);section.querySelector('.sf-preview-toggle').setAttribute('aria-expanded',String(!closed));const surface=section.querySelector('.sf-image-surface');if(surface)surface.hidden=closed;};
  const stage = (title, canvas) => {
    const section = document.createElement('section'); section.className = 'sf-image-stage';
    const heading = document.createElement('h2');
    const toggle = document.createElement('button'); toggle.className = 'sf-preview-toggle'; toggle.type = 'button'; toggle.textContent = title;
    toggle.setAttribute('aria-expanded','true');
    const surface = document.createElement('div'); surface.className = 'sf-image-surface'; surface.append(canvas);
    const expand=document.createElement('button');expand.type='button';expand.className='sf-expand-preview';expand.dataset.expandPreview=images.children.length?'output':'source';expand.textContent='⛶';expand.title=images.children.length?'Expand output image':'Expand input image';expand.setAttribute('aria-label',expand.title);expand.addEventListener('click',()=>showExpanded(canvas===source?'source':'output',expand));surface.append(expand);
    const coordinates=document.createElement('span');coordinates.className='sf-preview-coordinates';coordinates.dataset.previewCoordinates=images.children.length?'output':'source';coordinates.textContent='X: —  Y: —';surface.append(coordinates);coordinateLabels.push(coordinates);
    const reset=()=>{coordinates.textContent='X: —  Y: —';};
    const move=e=>{
      const r=canvas.getBoundingClientRect(),x=Math.floor((e.clientX-r.left)*canvas.width/r.width),y=Math.floor((e.clientY-r.top)*canvas.height/r.height);
      coordinates.textContent=x>=0&&y>=0&&x<canvas.width&&y<canvas.height?`X: ${x}  Y: ${y}`:'X: —  Y: —';
    };
    canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerleave',reset);
    coordinateListeners.push(()=>{canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerleave',reset);});
    surface.id = 'preview-' + images.children.length; toggle.setAttribute('aria-controls',surface.id); heading.append(toggle);
    toggle.addEventListener('click',()=>{
      const collapsed=section.dataset.collapsed!=='true';
      setCollapsed(section,collapsed);
      if(collapsed)for(const other of images.children)if(other!==section)setCollapsed(other,false);
    });
    section.append(heading, surface); images.append(section); return surface;
  };
  const source = q('[data-focus-source]'), output = q('[data-focus-result]');
  const sourceSurface = stage('Source image · drag to select', source);
  const outputSurface = stage('Pixel preview', output);
  const expanded=document.createElement('dialog');expanded.className='sf-expanded';expanded.setAttribute('aria-label','Expanded image workspace');
  expanded.innerHTML='<header class="sf-expanded-header"><div role="group" aria-label="Expanded preview"><button type="button" data-expanded-view="source" aria-pressed="true">Input</button><button type="button" data-expanded-view="output" aria-pressed="false">Output</button></div><button type="button" data-expanded-close aria-label="Exit expanded view" title="Exit expanded view (Escape)">Exit expanded view</button></header><div class="sf-expanded-body"></div><footer class="sf-expanded-status"></footer>';
  studio.append(expanded);
  const expandedBody=expanded.querySelector('.sf-expanded-body'),homes=new Map();let expandedView='source',expandedTrigger;
  function returnHome(element){const home=homes.get(element);if(home){home.replaceWith(element);homes.delete(element);}}
  function moveInto(element,target){if(!homes.has(element)){const home=document.createComment('expanded workspace return');element.before(home);homes.set(element,home);}target.append(element);}
  function expandedOrientation(){expanded.dataset.orientation=(expandedView==='source'?source:output).width>(expandedView==='source'?source:output).height?'landscape':'portrait';}
  function switchExpanded(view){
    expandedView=view;returnHome(sourceSurface);returnHome(outputSurface);
    const surface=view==='source'?sourceSurface:outputSurface;setCollapsed(surface.closest('.sf-image-stage'),false);moveInto(surface,expandedBody);expandedBody.prepend(surface);
    expanded.querySelectorAll('[data-expanded-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.expandedView===view)));
    expandedOrientation();scheduleFit();
  }
  function showExpanded(view,trigger){if(!hasMedia)return;expandedTrigger=trigger;moveInto(settings,expandedBody);moveInto(q('[data-focus-status]'),expanded.querySelector('.sf-expanded-status'));switchExpanded(view);if(!expanded.open)expanded.showModal();setTabMode(true);open(groups.find(d=>d.open)??groups[0],false);scheduleFit();}
  function closeExpanded(){if(expanded.open)expanded.close();setTabMode(false);returnHome(sourceSurface);returnHome(outputSurface);returnHome(settings);const status=q('[data-focus-status]');if(status)returnHome(status);scheduleFit();expandedTrigger?.focus();}
  expanded.querySelectorAll('[data-expanded-view]').forEach(button=>button.onclick=()=>switchExpanded(button.dataset.expandedView));
  expanded.querySelector('[data-expanded-close]').onclick=closeExpanded;expanded.addEventListener('cancel',event=>{event.preventDefault();closeExpanded();});
  sourceSurface.append(q('.ez-live-capture'));
  q('[data-focus-pick]').addEventListener('click',()=>{setCollapsed(images.firstElementChild,false);if(expanded.open)switchExpanded('source');},{capture:true});
  const toolbar = q('.ez-focus-toolbar'), hint = q('[data-focus-hint]');
  const shape=q('[data-focus-shape]'),shapeLabel=document.createElement('label');
  shape.before(shapeLabel);shapeLabel.append('Selection tool',shape);
  const selection = document.createElement('div'); selection.append(toolbar, hint);
  const groups = [];let selectedSetting;
  const tabs=document.createElement('div');tabs.className='sf-setting-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Conversion settings');tabs.hidden=true;settings.append(tabs);
  function syncTabs(){for(const [i,button]of [...tabs.children].entries()){const selected=groups[i].open;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;}}
  function setTabMode(active){tabs.hidden=!active;settings.dataset.tabbed=String(active);for(const details of groups){if(active){details.setAttribute('role','tabpanel');details.setAttribute('aria-labelledby',details.dataset.tabId);}else{details.removeAttribute('role');details.removeAttribute('aria-labelledby');}}syncTabs();}
  const group = (title, content) => {
    let details;
    if (content.tagName === 'DETAILS') {
      details=content;
      const fields=document.createElement('div');fields.className='sf-settings-fields';
      for(const child of [...details.children])if(child.tagName!=='SUMMARY')fields.append(child);
      details.append(fields);
    }
    else {
      details = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = title;
      details.append(summary, content);
    }
    const index=groups.length,tab=document.createElement('button');tab.type='button';tab.id='setting-tab-'+index;tab.dataset.settingsTab=title;tab.textContent=title;tab.setAttribute('role','tab');tab.setAttribute('aria-controls','setting-panel-'+index);details.id='setting-panel-'+index;details.dataset.tabId=tab.id;tab.addEventListener('click',()=>open(details));tab.addEventListener('keydown',event=>{const keys=['ArrowLeft','ArrowRight','Home','End'];if(!keys.includes(event.key))return;event.preventDefault();const buttons=[...tabs.children],next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[next].click();buttons[next].focus();});tabs.append(tab);
    details.name = 'conversion-settings'; settings.append(details); groups.push(details);
    details.querySelector(':scope > summary').addEventListener('click', event => {event.preventDefault();if(!expanded.open&&details.open){details.open=false;syncTabs();}else open(details);});
    details.addEventListener('toggle', () => {
      if (details.open) groups.forEach(other => {if (other !== details) other.open = false;});
      else if(expanded.open)queueMicrotask(()=>{if(expanded.open&&!groups.some(item=>item.open))open(selectedSetting??groups[0],false);});
      syncTabs();
    });
    return details;
  };
  const fields = [...q('.ez-focus-settings').children];
  group('Pixel grid', fields[0]); group('Style', fields[1]); group('Background', q('.ez-focus-cutout'));
  group('Selection', selection); group('Light, colour & finish', fields[2]);
  // Keep the converter's bounded defaults available without exposing these sections.
  fields[3].hidden=true;settings.append(fields[3]);
  // Keep captions, controls and readouts in explicit grid cells in every tab.
  settings.querySelectorAll('label').forEach(label=>{
    const control=label.querySelector('input,select');if(!control)return;
    label.classList.add('sf-control');label.dataset.control=control.tagName==='SELECT'?'select':control.type;
    const caption=document.createElement('span');caption.className='sf-control-caption';
    for(const node of [...label.childNodes])if(node.nodeType===Node.TEXT_NODE&&node.textContent.trim())caption.append(node);
    label.prepend(caption);
  });
  q('.ez-focus-studio > details').remove();
  function open(selected,revealSource=true) {
    selectedSetting=selected;
    if(revealSource&&selected.querySelector('.ez-focus-toolbar')){setCollapsed(images.firstElementChild,false);if(expanded.open)switchExpanded('source');}
    groups.forEach(details => {details.open = details === selected;});syncTabs();
    if(expanded.open){selected.scrollTop=0;return;}
    requestAnimationFrame(() => {
      const top = selected.offsetTop;
      if (top < settings.scrollTop || top + selected.offsetHeight > settings.scrollTop + settings.clientHeight) settings.scrollTop = top;
    });
  }
  open(groups[0]);
  const actions = q('.ez-focus-actions');
  q('[data-focus-cancel]').remove();
  const top=document.createElement('section'); top.className='sf-top';top.setAttribute('aria-label','Capture and input options');
  top.append(document.querySelector('.sf-app-header'),document.querySelector('.sf-page-capture'),q('.ez-focus-sources'),document.querySelector('[data-handoff-status]'));
  const bottom=document.createElement('section');bottom.className='sf-bottom';bottom.setAttribute('aria-label','Export and editor options');
  bottom.append(actions,q('[data-focus-status]'),document.querySelector('main > footer'));
  layout.replaceChildren(images, settings); studio.prepend(top);studio.append(bottom);
  let hasMedia = false, lastMode, frame;
  const expandButton=document.querySelector('[data-open-expanded]');
  expandButton.addEventListener('click',()=>showExpanded(expandedView,expandButton));
  const fit = () => {
    frame = undefined;
    for (const [canvas, surface] of [[source, sourceSurface], [output, outputSurface]]) {
      const scale = Math.min((surface.clientWidth - 12) / canvas.width, (surface.clientHeight - 12) / canvas.height);
      if (!(scale > 0)) continue;
      for (const [key, value] of [['width', Math.max(1, Math.floor(canvas.width * scale)) + 'px'], ['height', Math.max(1, Math.floor(canvas.height * scale)) + 'px']]) {
        if (canvas.style.getPropertyValue(key) !== value || canvas.style.getPropertyPriority(key) !== 'important') canvas.style.setProperty(key, value, 'important');
      }
    }
  };
  const scheduleFit = () => {if (frame === undefined) frame = requestAnimationFrame(fit);};
  const resize = new ResizeObserver(scheduleFit); resize.observe(sourceSurface); resize.observe(outputSurface);
  const dimensions=new Map([[source,[source.width,source.height]],[output,[output.width,output.height]]]);
  const canvasChanges = new MutationObserver(()=>{for(const [i,canvas] of [source,output].entries()){const previous=dimensions.get(canvas);if(previous[0]!==canvas.width||previous[1]!==canvas.height){coordinateLabels[i].textContent='X: —  Y: —';dimensions.set(canvas,[canvas.width,canvas.height]);}}if(expanded.open)expandedOrientation();scheduleFit();});
  for (const canvas of [source, output]) canvasChanges.observe(canvas, {attributes: true, attributeFilter: ['width', 'height', 'style']});
  function mode() {
    const current = hasMedia ? 'media' : !q('[data-focus-camera-view]').hidden ? 'live' : 'compact';
    document.body.dataset.studioMode = current;
    expandButton.disabled=!hasMedia;
    if (current !== lastMode) {lastMode = current; onMode(current);}
    scheduleFit();
  }
  const mediaChanges = new MutationObserver(mode); mediaChanges.observe(q('[data-focus-camera-view]'), {attributes: true, attributeFilter: ['hidden']});
  mode();
  return {loaded() {hasMedia = true; mode();},cleared(){closeExpanded();hasMedia=false;for(const label of coordinateLabels)label.textContent='X: —  Y: —';for(const section of images.children)setCollapsed(section,false);open(groups[0]);mode();}, dispose() {closeExpanded();expanded.remove();resize.disconnect(); canvasChanges.disconnect(); mediaChanges.disconnect();coordinateListeners.forEach(remove=>remove()); if (frame !== undefined) cancelAnimationFrame(frame);}};
}
