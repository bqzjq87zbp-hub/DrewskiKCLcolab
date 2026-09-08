/**
 * Static photographic canvas-wrap renderer. No asset pixels are rewritten.
 * Parent owns the native-2528×1684 scene scale, viewer, selection and navigation.
 * Each edge reuses a narrow mirrored strip of the same object-fit:cover DOM
 * photograph, clipped to the supplied canvas silhouette. Not a 3D scene.
 */
const FACE_SIZE = 1000;
const STRIP_SIZE = 28;
const set = (element, styles) => Object.assign(element.style, styles);

/** Map a rectangle to TL,TR,BR,BL screen-space corners with a CSS matrix3d. */
export function homography(quad, width = FACE_SIZE, height = width) {
  if (!Array.isArray(quad) || quad.length !== 4) throw new TypeError('Four canvas corners are required');
  const inputs = [[0, 0], [width, 0], [width, height], [0, height]], rows = [];
  inputs.forEach(([u, v], i) => {
    const [x, y] = quad[i];
    rows.push([u, v, 1, 0, 0, 0, -x * u, -x * v, x], [0, 0, 0, u, v, 1, -y * u, -y * v, y]);
  });
  for (let c = 0; c < 8; c++) {
    let pivot = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(rows[r][c]) > Math.abs(rows[pivot][c])) pivot = r;
    [rows[c], rows[pivot]] = [rows[pivot], rows[c]];
    const divisor = rows[c][c];
    if (Math.abs(divisor) < 1e-10) throw new RangeError('Degenerate canvas quadrilateral');
    for (let j = c; j < 9; j++) rows[c][j] /= divisor;
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const factor = rows[r][c];
      for (let j = c; j < 9; j++) rows[r][j] -= factor * rows[c][j];
    }
  }
  const [a, b, c, d, e, f, g, h] = rows.map(row => row[8]);
  return {css: `matrix3d(${[a,d,0,g,b,e,0,h,0,0,1,0,c,f,0,1].join(',')})`, values: [a,b,c,d,e,f,g,h]};
}

// Clip a measured outer silhouette to the outward half-plane of a front edge.
function outsideBand(polygon, point, normal) {
  const dot = p => (p[0] - point[0]) * normal[0] + (p[1] - point[1]) * normal[1];
  const output = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length], da = dot(a), db = dot(b);
    if (da >= -0.02) output.push(a);
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db);
      output.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return output;
}

function photograph(slot, decorative = false) {
  const img = document.createElement('img');
  img.src = slot.src;
  img.alt = decorative ? '' : slot.alt || slot.title || 'Photograph';
  img.decoding = 'async';
  if (decorative) img.setAttribute('aria-hidden', 'true');
  set(img, {position: 'absolute', width: FACE_SIZE+'px', height: FACE_SIZE+'px', maxWidth: 'none', objectFit: 'cover', objectPosition: slot.objectPosition || '50% 50%', display: 'block', border: '0', padding: '0', margin: '0'});
  return img;
}

function edgeLayer(slot, edgeIndex) {
  if (!slot.edge || slot.edge.length < 3) return null;
  const [a, b] = [slot.quad[edgeIndex], slot.quad[(edgeIndex + 1) % 4]];
  const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
  const normal = [dy / length, -dx / length]; // TL,TR,BR,BL clockwise in screen space.
  const distance = p => (p[0] - a[0]) * normal[0] + (p[1] - a[1]) * normal[1];
  const thickness = Math.max(...slot.edge.map(distance));
  const polygon = outsideBand(slot.edge, a, normal);
  if (thickness < 0.05 || polygon.length < 3) return null;
  // A small overdraw is clipped at the exact supplied outer silhouette. It
  // avoids a transparent antialias seam; it cannot spill onto the pier/wood.
  // Chamfered outer corners can extend a pixel beyond the front edge's end.
  // Cover that measured tangent extent too; clipping still owns the silhouette.
  const tangent = [dx/length,dy/length];
  const projections = polygon.map(p=>(p[0]-a[0])*tangent[0]+(p[1]-a[1])*tangent[1]);
  const start = Math.min(0,...projections)-.25, end = Math.max(length,...projections)+.25;
  const planeA = [a[0]+tangent[0]*start,a[1]+tangent[1]*start];
  const planeB = [a[0]+tangent[0]*end,a[1]+tangent[1]*end];
  const outerA = [planeA[0]+normal[0]*(thickness+.5), planeA[1]+normal[1]*(thickness+.5)];
  const outerB = [planeB[0]+normal[0]*(thickness+.5), planeB[1]+normal[1]*(thickness+.5)];
  const layer = document.createElement('div');
  layer.className = 'canvas-wrap-edge';
  layer.dataset.edge = ['top','right','bottom','left'][edgeIndex];
  layer.setAttribute('aria-hidden', 'true');
  set(layer, {position:'absolute', inset:'0', width:'2528px', height:'1684px', pointerEvents:'none', clipPath:'polygon('+polygon.map(p=>`${p[0]}px ${p[1]}px`).join(',')+')'});
  const strip = document.createElement('div');
  const horizontal = edgeIndex === 0 || edgeIndex === 2;
  const width = horizontal ? FACE_SIZE : STRIP_SIZE, height = horizontal ? STRIP_SIZE : FACE_SIZE;
  // The edge sample touches the identical source boundary as the front, then
  // mirrors around the canvas fold. This is a mirrored gallery wrap, not a
  // fabricated extra photograph or a stretched duplicate of the whole image.
  const quads = [
    [planeA,planeB,outerB,outerA],     // top: sample y=0 at the front fold
    [outerA,planeA,planeB,outerB],     // right: sample x=1000 at the fold
    [outerB,outerA,planeA,planeB],     // bottom: sample y=1000 at the fold
    [planeB,outerB,outerA,planeA]      // left: sample x=0 at the fold
  ];
  set(strip, {position:'absolute', left:'0', top:'0', width:width+'px', height:height+'px', overflow:'hidden', transformOrigin:'0 0', transform:homography(quads[edgeIndex],width,height).css, background:'transparent'});
  const img = photograph(slot, true);
  img.style.left = edgeIndex === 1 ? -(FACE_SIZE-STRIP_SIZE)+'px' : '0';
  img.style.top = edgeIndex === 2 ? -(FACE_SIZE-STRIP_SIZE)+'px' : '0';
  const shade = document.createElement('span');
  set(shade, {position:'absolute', inset:'0', pointerEvents:'none', background:edgeIndex===0?'rgba(255,255,255,.09)':edgeIndex===2?'rgba(0,8,12,.30)':'rgba(0,8,12,.23)'});
  strip.append(img, shade);
  layer.append(strip);
  return layer;
}

/**
 * @param {object} slot Existing {id,title,alt,src,full,quad,edge,side,depth}.
 * Optional objectPosition controls the intentionally cropped front and every
 * edge consistently. Full-resolution enlargement stays the parent's concern.
 * @param {number} index Actual photo index (never inferred from scene position).
 * @param {object} options onSelect(index, frontAnchor, slot, clickEvent).
 * @returns {HTMLDivElement} Append directly to the native-resolution #layers.
 */
export function createWrappedCanvas(slot, index, {onSelect} = {}) {
  const container = document.createElement('div');
  container.className = 'canvas-wrap';
  container.dataset.canvasId = slot.id;
  set(container, {position:'absolute', left:'0', top:'0', width:'2528px', height:'1684px', pointerEvents:'none', zIndex:String(10-(slot.depth||1))});
  for (let edgeIndex = 0; edgeIndex < 4; edgeIndex++) {
    const edge = edgeLayer(slot, edgeIndex);
    if (edge) container.append(edge);
  }
  const front = document.createElement('a');
  front.className = 'print canvas-wrap-front';
  front.dataset.slot = slot.id;
  front.href = slot.full || slot.src;
  front.setAttribute('aria-label', 'Enlarge photograph: '+(slot.title||slot.id));
  set(front, {position:'absolute', left:'0', top:'0', width:FACE_SIZE+'px', height:FACE_SIZE+'px', padding:'0', margin:'0', border:'0', borderRadius:'0', background:'transparent', overflow:'hidden', pointerEvents:'auto', display:'block', transformOrigin:'0 0', transform:homography(slot.quad).css, zIndex:'1'});
  front.append(photograph(slot));
  front.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || typeof onSelect !== 'function') return;
    event.preventDefault();
    onSelect(index, front, slot, event);
  });
  container.append(front);
  return container;
}
