/** Arrange the shared converter in the extension's bounded floating workspace. */
export function mountFloatingLayout(host, onMode) {
  const q = selector => host.querySelector(selector);
  const studio = q('.ez-focus-studio'), layout = q('.ez-focus-layout');
  const images = document.createElement('div'); images.className = 'sf-images';
  const coordinateListeners=[],coordinateLabels=[];
  const settings = document.createElement('aside'); settings.className = 'sf-settings'; settings.setAttribute('aria-label', 'Conversion settings');
  const setCollapsed=(section,closed)=>{section.dataset.collapsed=String(closed);section.querySelector('.sf-preview-toggle').setAttribute('aria-expanded',String(!closed));section.querySelector('.sf-image-surface').hidden=closed;};
  const stage = (title, canvas) => {
    const section = document.createElement('section'); section.className = 'sf-image-stage';
    const heading = document.createElement('h2');
    const toggle = document.createElement('button'); toggle.className = 'sf-preview-toggle'; toggle.type = 'button'; toggle.textContent = title;
    toggle.setAttribute('aria-expanded','true');
    const surface = document.createElement('div'); surface.className = 'sf-image-surface'; surface.append(canvas);
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
  sourceSurface.append(q('.ez-live-capture'));
  q('[data-focus-pick]').addEventListener('click',()=>setCollapsed(images.firstElementChild,false),{capture:true});
  const toolbar = q('.ez-focus-toolbar'), hint = q('[data-focus-hint]');
  const selection = document.createElement('div'); selection.append(toolbar, hint);
  const groups = [];
  const group = (title, content) => {
    let details;
    if (content.tagName === 'DETAILS') details = content;
    else {
      details = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = title;
      details.append(summary, content);
    }
    details.name = 'conversion-settings'; settings.append(details); groups.push(details);
    details.querySelector(':scope > summary').addEventListener('click', event => {event.preventDefault(); open(details);});
    details.addEventListener('toggle', () => {
      if (details.open) groups.forEach(other => {if (other !== details) other.open = false;});
      else queueMicrotask(() => {if (!groups.some(item => item.open)) details.open = true;});
    });
    return details;
  };
  const fields = [...q('.ez-focus-settings').children];
  group('Pixel grid', fields[0]); group('Style', fields[1]); group('Background', q('.ez-focus-cutout'));
  group('Selection', selection); group('Light, colour & finish', fields[2]);
  // Keep the converter's bounded defaults available without exposing these sections.
  fields[3].hidden=true;settings.append(fields[3]);
  q('.ez-focus-studio > details').remove();
  function open(selected) {
    if(selected.querySelector('.ez-focus-toolbar'))setCollapsed(images.firstElementChild,false);
    groups.forEach(details => {details.open = details === selected;});
    requestAnimationFrame(() => {
      const top = selected.offsetTop - settings.offsetTop;
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
  const canvasChanges = new MutationObserver(()=>{for(const [i,canvas] of [source,output].entries()){const previous=dimensions.get(canvas);if(previous[0]!==canvas.width||previous[1]!==canvas.height){coordinateLabels[i].textContent='X: —  Y: —';dimensions.set(canvas,[canvas.width,canvas.height]);}}scheduleFit();});
  for (const canvas of [source, output]) canvasChanges.observe(canvas, {attributes: true, attributeFilter: ['width', 'height', 'style']});
  function mode() {
    const current = hasMedia ? 'media' : !q('[data-focus-camera-view]').hidden ? 'live' : 'compact';
    document.body.dataset.studioMode = current;
    if (current !== lastMode) {lastMode = current; onMode(current);}
    scheduleFit();
  }
  const mediaChanges = new MutationObserver(mode); mediaChanges.observe(q('[data-focus-camera-view]'), {attributes: true, attributeFilter: ['hidden']});
  mode();
  return {loaded() {hasMedia = true; mode();},cleared(){hasMedia=false;for(const label of coordinateLabels)label.textContent='X: —  Y: —';for(const section of images.children)setCollapsed(section,false);open(groups[0]);mode();}, dispose() {resize.disconnect(); canvasChanges.disconnect(); mediaChanges.disconnect();coordinateListeners.forEach(remove=>remove()); if (frame !== undefined) cancelAnimationFrame(frame);}};
}
