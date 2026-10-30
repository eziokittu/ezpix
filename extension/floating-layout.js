/** Arrange the shared converter in the extension's bounded floating workspace. */
export function mountFloatingLayout(host, onMode) {
  const q = selector => host.querySelector(selector);
  const studio = q('.ez-focus-studio'), layout = q('.ez-focus-layout');
  const images = document.createElement('div'); images.className = 'sf-images';
  const settings = document.createElement('aside'); settings.className = 'sf-settings'; settings.setAttribute('aria-label', 'Conversion settings');
  const stage = (title, canvas) => {
    const section = document.createElement('section'); section.className = 'sf-image-stage';
    const heading = document.createElement('h2'); heading.textContent = title;
    const surface = document.createElement('div'); surface.className = 'sf-image-surface'; surface.append(canvas);
    section.append(heading, surface); images.append(section); return surface;
  };
  const source = q('[data-focus-source]'), output = q('[data-focus-result]');
  const sourceSurface = stage('Source image · drag to select', source);
  const outputSurface = stage('Pixel preview', output);
  sourceSurface.append(q('.ez-live-capture'));
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
  group('Selection', selection); group('Light, colour & finish', fields[2]); group('Animation', fields[3]);
  group('Capture limits', q('.ez-focus-studio > details'));
  function open(selected) {
    groups.forEach(details => {details.open = details === selected;});
    requestAnimationFrame(() => {
      const top = selected.offsetTop - settings.offsetTop;
      if (top < settings.scrollTop || top + selected.offsetHeight > settings.scrollTop + settings.clientHeight) settings.scrollTop = top;
    });
  }
  open(groups[0]);
  const actions = q('.ez-focus-actions');
  layout.replaceChildren(images, settings); studio.append(actions, q('[data-focus-status]'));
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
  const canvasChanges = new MutationObserver(scheduleFit);
  for (const canvas of [source, output]) canvasChanges.observe(canvas, {attributes: true, attributeFilter: ['width', 'height', 'style']});
  function mode() {
    const current = hasMedia ? 'media' : !q('[data-focus-camera-view]').hidden ? 'live' : 'compact';
    document.body.dataset.studioMode = current;
    if (current !== lastMode) {lastMode = current; onMode(current);}
    scheduleFit();
  }
  const mediaChanges = new MutationObserver(mode); mediaChanges.observe(q('[data-focus-camera-view]'), {attributes: true, attributeFilter: ['hidden']});
  q('[data-focus-clear]').addEventListener('click', () => {hasMedia = false; mode();});
  mode();
  return {loaded() {hasMedia = true; mode();}, dispose() {resize.disconnect(); canvasChanges.disconnect(); mediaChanges.disconnect(); if (frame !== undefined) cancelAnimationFrame(frame);}};
}
