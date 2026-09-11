// The earlier KCL optical-glass treatment used a quiet, diagonal reflection.
// Track real scroll distance here so fixed controls move and reversal is continuous.
export const GLASS_SURFACES = [
  '#menu > button', '#menu-panel', '#menu select',
  '.glass-control', '.category-sign', '.collection-header',
  '.aisle-progress', '.walk-step', '.aisle-video-toggle',
  '.aisle-video-status', '.aisle-start-walk', '.aisle-look-controls button',
  '#viewer button', '[data-kcl-glass-surface]'
].join(',');

export function installGlassSheen() {
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('./glass-sheen.css', import.meta.url).href;
  document.head.append(stylesheet);

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const transparency = matchMedia('(prefers-reduced-transparency: reduce)');
  const contrast = matchMedia('(forced-colors: active)');
  const increasedContrast = matchMedia('(prefers-contrast: more)');
  const viewer = document.querySelector('#viewer');
  const surfaces = new Map(), visible = new Set(), scrollPositions = new WeakMap();
  let scrollDistance = scrollY, renderedDistance = scrollY, zoomOffset = 0;
  let frame = 0, lastTime = 0, activeUntil = 0, opacity = 0.07;
  let direction = 'down', enabled = false, lastBroadcast = 0, frames = 0;
  let parentOrigin = '';
  try {
    const origin = new URL(document.referrer).origin;
    if (origin === 'https://kiyonocreativelab.com' || origin === 'https://www.kiyonocreativelab.com') parentOrigin = origin;
  } catch {}

  const intersection = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) visible.add(entry.target);
      else visible.delete(entry.target);
    }
    requestFrame();
  });

  function register() {
    for (const [element, layer] of surfaces) {
      if (!element.isConnected) {
        intersection.unobserve(element); visible.delete(element); surfaces.delete(element);
      } else if (layer && !layer.isConnected) {
        element.append(layer);
      }
    }
    for (const element of document.querySelectorAll(GLASS_SURFACES)) {
      if (surfaces.has(element) || element.closest('[data-kcl-no-sheen],.collection-photo,.canvas-wrap-front,.room-art')) continue;
      element.dataset.kclSheenSurface = '';
      if (getComputedStyle(element).position === 'static') element.classList.add('kcl-sheen-position');
      let layer = null;
      // Native selects cannot contain a layer. Keep :empty status behavior intact.
      if (!element.matches('select,.aisle-video-status')) {
        layer = document.createElement('span');
        layer.className = 'kcl-glass-sheen-layer';
        layer.setAttribute('aria-hidden', 'true');
        const reflection = document.createElement('span');
        reflection.className = 'kcl-glass-sheen-reflection';
        layer.append(reflection); element.append(layer);
      }
      surfaces.set(element, layer); intersection.observe(element);
    }
    requestFrame();
  }

  function phase() {
    // The band is fully outside the glass at both wrap boundaries.
    return (((renderedDistance / 1800) % 1 + 1) % 1) * 240 - 120;
  }
  function broadcast(x, force = false) {
    if (parent === window || !parentOrigin || (!force && performance.now() - lastBroadcast < 50)) return;
    lastBroadcast = performance.now();
    parent.postMessage({type:'kcl-glass-sheen-v1', x, opacity, enabled, direction}, parentOrigin);
  }
  function paint(now) {
    frame = 0; frames++;
    if (!enabled || document.hidden) return;
    const elapsed = Math.min(50, lastTime ? now - lastTime : 16); lastTime = now;
    const target = scrollDistance + zoomOffset;
    const blend = 1 - Math.exp(-elapsed / 55);
    renderedDistance += (target - renderedDistance) * blend;
    const targetOpacity = now < activeUntil ? 0.36 : 0.07;
    opacity += (targetOpacity - opacity) * (1 - Math.exp(-elapsed / 140));
    const x = phase().toFixed(3) + '%';
    for (const element of visible) {
      // Animate only the owned reflection; inherited variables restyle menu contents.
      const reflection = surfaces.get(element)?.firstElementChild;
      if (reflection) {
        reflection.style.transform = `translate3d(${x},0,0) skewX(-12deg)`;
        reflection.style.opacity = opacity.toFixed(3);
      } else element.style.setProperty('--kcl-sheen-x', x);
    }
    broadcast(Number.parseFloat(x));
    if (Math.abs(target - renderedDistance) > .1 || Math.abs(targetOpacity - opacity) > .002 || now < activeUntil) requestFrame();
  }
  function requestFrame() {
    if (enabled && !document.hidden && !frame) frame = requestAnimationFrame(paint);
  }
  function activate(delta) {
    if (!enabled || Math.abs(delta) < .25) return;
    direction = delta > 0 ? 'down' : 'up';
    document.body.dataset.kclSheenDirection = direction;
    activeUntil = performance.now() + 150;
    requestFrame();
  }
  function onScroll(event) {
    const scroller = event.target === document ? document.scrollingElement : event.target;
    if (!(scroller instanceof Element)) return;
    const current = scroller.scrollTop;
    const previous = scrollPositions.get(scroller) ?? current;
    scrollPositions.set(scroller, current);
    const delta = current - previous;
    scrollDistance += delta;
    activate(delta);
  }
  function syncPreferences() {
    enabled = !motion.matches && !transparency.matches && !contrast.matches && !increasedContrast.matches && document.body.dataset.appearance !== 'solid';
    document.body.dataset.kclSheen = enabled ? 'enabled' : 'disabled';
    lastTime = 0;
    renderedDistance = scrollDistance + zoomOffset;
    if (!enabled) {
      cancelAnimationFrame(frame); frame = 0; opacity = 0.07;
      renderedDistance = scrollDistance + zoomOffset;
      broadcast(phase(), true);
    } else requestFrame();
  }
  function syncViewer() {
    const next = viewer?.open ? 450 : 0;
    const delta = next - zoomOffset;
    zoomOffset = next;
    activate(delta);
  }
  const mutation = new MutationObserver(records => {
    if (records.some(r =>
      (surfaces.has(r.target) && [...r.removedNodes].some(n => n === surfaces.get(r.target))) ||
      [...r.addedNodes, ...r.removedNodes].some(n => n.nodeType === 1 && !n.classList.contains('kcl-glass-sheen-layer'))
    )) register();
  });
  const preferences = new MutationObserver(syncPreferences);
  const enlargement = new MutationObserver(syncViewer);
  scrollPositions.set(document.scrollingElement, scrollY);
  for (const element of document.querySelectorAll('#menu-panel')) scrollPositions.set(element, element.scrollTop);
  mutation.observe(document.body, {childList:true, subtree:true});
  preferences.observe(document.body, {attributes:true, attributeFilter:['data-appearance']});
  if (viewer) enlargement.observe(viewer, {attributes:true, attributeFilter:['open']});
  document.addEventListener('scroll', onScroll, {capture:true, passive:true});
  document.addEventListener('visibilitychange', syncPreferences);
  for (const preference of [motion, transparency, contrast, increasedContrast]) preference.addEventListener('change', syncPreferences);
  register(); syncPreferences(); syncViewer();
  return {
    getState: () => ({enabled, direction, phase:phase(), opacity, surfaces:surfaces.size, visible:visible.size, scheduled:Boolean(frame), frames}),
    destroy() {
      enabled = false; broadcast(phase(), true);
      cancelAnimationFrame(frame); mutation.disconnect(); preferences.disconnect(); enlargement.disconnect(); intersection.disconnect();
      document.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('visibilitychange', syncPreferences);
      for (const preference of [motion, transparency, contrast, increasedContrast]) preference.removeEventListener('change', syncPreferences);
      for (const [element, layer] of surfaces) {
        layer?.remove(); delete element.dataset.kclSheenSurface;
        element.classList.remove('kcl-sheen-position');
        element.style.removeProperty('--kcl-sheen-x'); element.style.removeProperty('--kcl-sheen-opacity');
      }
      delete document.body.dataset.kclSheen; delete document.body.dataset.kclSheenDirection; stylesheet.remove();
    }
  };
}
