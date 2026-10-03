/* THE ATELIER: the issue as a real book, in WebGL.
 *
 * Gilded edges that reflect a room, a lamp you can move and recolour, and
 * grabbing either the left or the right leaf all need real PBR and real
 * lights. CSS 3D cannot reflect anything, which is why this exists.
 *
 * Prior art surveyed: bandinopla/quick_flipbook and dsecik/BookReader3D both
 * deform pages on the CPU via geometry modifiers. This deforms on the GPU
 * instead, by injecting into MeshStandardMaterial's vertex shader, so the
 * curling page keeps full PBR and still takes the lamp and the environment.
 * The gutter-shadow idea near the spine is borrowed from quick_flipbook.
 *
 * The curl: the outer edge of a leaf LAGS the inner edge as it rotates about
 * the spine. That lag is the whole illusion: a rigid plank rotates uniformly,
 * paper does not.
 */
import * as THREE from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";

const PAGE_W = 1.32, PAGE_H = 1.84;
const LEAF_GAP = 0.0034;
const TURN_MS = 900;

let renderer, scene, camera, root, lamp, lampLight, lampBulb, lampShadeIn;
let leaves = [], blockL, blockR, pageGeo;
let issue = null, spread = 0, raf = 0, envReady = false;
let ATELIER_APP = "/";

const $ = (id) => document.getElementById(id);
const BB = (lvl, msg, extra) => { try { window.BB && window.BB[lvl](msg, extra); } catch (e) {} };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* ─── page material ─────────────────────────────────────────────────── */
function pageMaterial(map, back) {
  const m = new THREE.MeshStandardMaterial({
    map: map || null,
    color: map ? 0xffffff : 0xe9e1d2,
    roughness: 0.95,
    metalness: 0.0,
    side: back ? THREE.BackSide : THREE.FrontSide,
  });
  m.userData.u = {
    uTurn: { value: 0 },
    uLag: { value: 0.42 },
    uW: { value: PAGE_W },
    uBow: { value: 0.085 },
  };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, m.userData.u);

    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>
uniform float uTurn; uniform float uLag; uniform float uW; uniform float uBow;
varying float vGut;
float leafAngle(float x){
  float u = clamp(x / uW, 0.0, 1.0);
  return uTurn * PI * (1.0 + uLag * u) / (1.0 + uLag);
}`)
      // normal must be rotated by the SAME per-vertex angle or lighting shears
      .replace("#include <beginnormal_vertex>", `
float _a = leafAngle(position.x);
vec3 objectNormal = vec3(-sin(_a), cos(_a), 0.0);
#ifdef USE_TANGENT
  vec3 objectTangent = vec3(cos(_a), sin(_a), 0.0);
#endif`)
      .replace("#include <begin_vertex>", `
float a = leafAngle(position.x);
float u = clamp(position.x / uW, 0.0, 1.0);
vGut = u;
float bow = sin(uTurn * PI) * uBow * sin(u * PI);
vec3 transformed = vec3(position.x * cos(a), position.x * sin(a) + bow, position.z);`);

    // gutter shadow: paper darkens into the spine. Cheap, and it is most of
    // what makes a flat-lit page read as bound rather than printed.
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vGut;")
      .replace("#include <dithering_fragment>", `#include <dithering_fragment>
gl_FragColor.rgb *= mix(0.40, 1.0, smoothstep(0.0, 0.16, vGut));`);
  };
  return m;
}

const setTurn = (g, t) => {
  g.userData.turn = t;
  g.userData.fm.userData.u.uTurn.value = t;
  g.userData.bm.userData.u.uTurn.value = t;
};

/* ─── assets ────────────────────────────────────────────────────────── */
/* Pages are portrait. A photograph close to that shape fills its page; any
   other shape is printed on the page with paper round it, never stretched. */
function loadTex(url) {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => {
      const W = 1024, H = Math.round((W * PAGE_H) / PAGE_W);
      const c = document.createElement("canvas");
      c.width = W; c.height = H;
      const x = c.getContext("2d");
      const iw = im.naturalWidth, ih = im.naturalHeight;
      if (Math.abs(iw / ih / (W / H) - 1) < 0.12) {
        const s = Math.max(W / iw, H / ih);
        x.drawImage(im, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s);
      } else {
        x.fillStyle = "#efe9df"; x.fillRect(0, 0, W, H);
        const m = W * 0.08, s = Math.min((W - 2 * m) / iw, (H - 2 * m) / ih);
        x.drawImage(im, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s);
      }
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      res(t);
    };
    im.onerror = () => {
      BB("warn", "texture failed", { src: url });   // never silent again
      res(null);
    };
    im.src = url;
  });
}

async function buildBook(plates) {
  pageGeo = new THREE.PlaneGeometry(PAGE_W, PAGE_H, 44, 2)
    .rotateX(-Math.PI / 2)
    .translate(PAGE_W / 2, 0, 0);          // hinge at x = 0

  // back face samples its own image and must mirror in x so it reads correctly
  const backGeo = pageGeo.clone();
  const uv = backGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
  uv.needsUpdate = true;

  for (let i = 0; i < plates.length; i += 2) {
    const fTex = await loadTex(plates[i]);
    const bTex = plates[i + 1] ? await loadTex(plates[i + 1]) : null;
    const fm = pageMaterial(fTex, false);
    const bm = pageMaterial(bTex, true);

    const g = new THREE.Group();
    const f = new THREE.Mesh(pageGeo, fm);
    const b = new THREE.Mesh(backGeo, bm);
    f.castShadow = f.receiveShadow = true;
    b.castShadow = b.receiveShadow = true;
    g.add(f, b);
    g.userData = { fm, bm, turn: 0 };
    root.add(g);
    leaves.push(g);
  }

  const gold = new THREE.MeshPhysicalMaterial({
    color: 0xd7a13c, metalness: 1.0, roughness: 0.16,
    envMapIntensity: 2.6, clearcoat: 0.55, clearcoatRoughness: 0.2,
  });
  const mkBlock = () => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(PAGE_W, 1, PAGE_H), gold);
    m.castShadow = m.receiveShadow = true;
    root.add(m);
    return m;
  };
  blockR = mkBlock();
  blockL = mkBlock();

  const boardMat = new THREE.MeshPhysicalMaterial({
    color: 0x120d09, roughness: 0.58, metalness: 0.2,
    clearcoat: 0.35, clearcoatRoughness: 0.4, envMapIntensity: 0.9,
  });
  [-1, 1].forEach((s) => {
    const c = new THREE.Mesh(new THREE.BoxGeometry(PAGE_W + 0.06, 0.03, PAGE_H + 0.06), boardMat);
    c.position.set(s * (PAGE_W + 0.06) / 2, -0.055, 0);
    c.castShadow = c.receiveShadow = true;
    root.add(c);
  });

  relayout(true);
}

function relayout(instant) {
  leaves.forEach((g, i) => {
    const t = i < spread ? 1 : 0;
    if (instant) setTurn(g, t);
    // Stack order matters: whichever leaf sits HIGHEST is the one you see.
    // On the right that must be leaves[spread] (the next one to turn); on the
    // left it must be leaves[spread-1] (the one just turned). Getting this
    // backwards pins the visible spread to the first and last leaves, so every
    // turn appears to show the same page again.
    g.position.y = (i < spread ? i + 1 : leaves.length - i) * LEAF_GAP;
  });
  sizeBlocks();
}

function sizeBlocks() {
  const hL = clamp(spread * LEAF_GAP * 2.0, 0.010, 0.16);
  const hR = clamp((leaves.length - spread) * LEAF_GAP * 2.0, 0.010, 0.16);
  blockL.scale.y = hL; blockL.position.set(-PAGE_W / 2, hL / 2 - 0.038, 0);
  blockR.scale.y = hR; blockR.position.set(PAGE_W / 2, hR / 2 - 0.038, 0);
}

/* ─── turning: either leaf is grabbable ─────────────────────────────── */
let anim = null;
function glide(g, from, to, after) {
  const t0 = performance.now();
  anim = true;
  let done = false;

  // Finish exactly once, from any path.
  const finish = () => {
    if (done) return;
    done = true;
    setTurn(g, to);
    sizeBlocks();
    anim = null;
    after && after();
  };

  const step = () => {
    if (done) return;
    const p = clamp((performance.now() - t0) / TURN_MS, 0, 1);
    setTurn(g, from + (to - from) * easeIO(p));
    sizeBlocks();
    if (p < 1) schedule(); else finish();
  };

  // rAF is the smooth path, but a backgrounded tab never fires it. Race a
  // timer against it so a turn started before a tab switch still completes,
  // and take whichever arrives first so the two never compound.
  const schedule = () => {
    let fired = false;
    const go = () => { if (fired) return; fired = true; step(); };
    requestAnimationFrame(go);
    setTimeout(go, 40);
  };
  schedule();

  // Hard backstop: never leave the book locked because frames stopped.
  setTimeout(finish, TURN_MS + 400);
}

function commitForward() {
  if (spread >= leaves.length) return;
  const g = leaves[spread];
  glide(g, g.userData.turn, 1, () => { spread++; relayout(false); hud(); });
}
function commitBack() {
  if (spread <= 0) return;
  const g = leaves[spread - 1];
  glide(g, g.userData.turn, 0, () => { spread--; relayout(false); hud(); });
}

/* ─── lamp ──────────────────────────────────────────────────────────── */
function buildLamp() {
  lamp = new THREE.Group();
  const brass = new THREE.MeshPhysicalMaterial({
    color: 0xc09242, metalness: 1, roughness: 0.26, envMapIntensity: 1.8,
  });

  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.30, 0.32, 44, 1, true), brass);
  shade.rotation.x = Math.PI;
  shade.castShadow = true;

  lampShadeIn = new THREE.Mesh(
    new THREE.ConeGeometry(0.292, 0.312, 44, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x2a2119, roughness: 1, side: THREE.BackSide,
      emissive: 0xffd9a0, emissiveIntensity: 1.4,
    })
  );
  lampShadeIn.rotation.x = Math.PI;

  lampBulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 18, 18),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0 })
  );
  lampBulb.position.y = -0.10;

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.5, 14), brass);
  stem.position.y = -0.82; stem.castShadow = true;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.23, 0.04, 40), brass);
  base.position.y = -1.56; base.castShadow = base.receiveShadow = true;

  lampLight = new THREE.SpotLight(0xffd9a0, 26, 8.5, 0.66, 0.7, 1.6);
  lampLight.position.set(0, -0.08, 0);
  lampLight.castShadow = true;
  lampLight.shadow.mapSize.set(1024, 1024);
  lampLight.shadow.bias = -0.0016;
  lampLight.shadow.radius = 5;

  lamp.add(shade, lampShadeIn, lampBulb, stem, base, lampLight);
  lamp.position.set(-1.62, 1.72, 0.85);
  scene.add(lamp);
  scene.add(lampLight.target);        // target lives in world space
  aimLamp();
}

// Keep the beam pointed at the book no matter where the lamp is dragged.
function aimLamp() {
  lampLight.target.position.set(0, 0, 0);
  lampLight.target.updateMatrixWorld();
}

export function setLampColour(hex) {
  const c = new THREE.Color(hex);
  lampLight.color.copy(c);
  lampBulb.material.color.copy(c);
  lampShadeIn.material.emissive.copy(c);
  document.documentElement.style.setProperty("--beam", "#" + c.getHexString());
}
export function setLampPower(v) { lampLight.intensity = v; }
export function setExposure(v) { if (renderer) renderer.toneMappingExposure = v; }
export function setEnvironment(name) {
  // Accept either a bare name ("brown_photostudio_02") or any path. Anything
  // that already looks like a location is used as-is: appending .hdr to a
  // full path silently produced "x.hdr.hdr" and a dead swap.
  const looksLikePath = /^https?:|^\/|\.hdr$|\//i.test(name);
  const url = looksLikePath ? name : ATELIER_APP + "assets/env/" + name + ".hdr";
  // Swapping the HDRI changes what the gilt edges reflect, which is the whole
  // point of having one. Dispose the old PMREM target or it leaks GPU memory.
  const old = scene.environment;
  return loadHDR(url).then((ok) => {
    if (ok && old && old.dispose) old.dispose();
    BB(ok ? "note" : "fail", "environment " + (ok ? "swapped" : "swap FAILED"), { src: url });
    return ok;
  });
}

/* ─── scene ─────────────────────────────────────────────────────────── */
function initScene(canvas) {
  // No preserveDrawingBuffer: it keeps a second full framebuffer alive, and on
  // a dpr-3 phone that is the difference between comfortable and thrashing.
  // Antialiasing is dropped on small screens for the same reason.
  const small = Math.min(window.innerWidth || 0, window.innerHeight || 0) < 520;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !small });
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.75 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;   // PCFSoft deprecated in r185

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070609);
  scene.fog = new THREE.Fog(0x070609, 7, 16);

  // Position is not set here on purpose: frameBook() derives it from the book
  // size and the live aspect, so there is one source of truth for framing.
  camera = new THREE.PerspectiveCamera(33, 1, 0.1, 120);

  root = new THREE.Group();
  scene.add(root);

  const table = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 5, 0.3, 72),
    new THREE.MeshStandardMaterial({ color: 0x0f0b09, roughness: 0.85, metalness: 0.08 })
  );
  table.position.y = -0.2; table.receiveShadow = true;
  scene.add(table);

  scene.add(new THREE.AmbientLight(0xc9d6ff, 0.06));
  const rim = new THREE.DirectionalLight(0x8fa6ff, 0.30);
  rim.position.set(3.4, 3.0, -3.6);
  scene.add(rim);

  buildLamp();
  frameBook();                 // sane framing even before layout reports a size
  resize();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
  // Belt and braces: if the canvas had no box on the first pass, keep trying
  // briefly so the book is never left framed for an aspect of 1.
  let tries = 0;
  const settle = setInterval(() => {
    resize();
    if (++tries > 20 || renderer.domElement.clientWidth > 1) clearInterval(settle);
  }, 150);
}

function loadHDR(url) {
  const t0 = performance.now();
  BB("note", "hdr load start", { src: url });
  return new Promise((res) => {
    new HDRLoader().load(url, (tex) => {
      const pm = new THREE.PMREMGenerator(renderer);
      pm.compileEquirectangularShader();
      scene.environment = pm.fromEquirectangular(tex).texture;  // gilt reflects THIS
      scene.environmentIntensity = 0.85;
      tex.dispose(); pm.dispose();
      envReady = true;
      BB("note", "hdr ready in " + Math.round(performance.now() - t0) + "ms", { src: url });
      res(true);
    }, undefined, (err) => {
      BB("fail", "hdr failed to load", { src: url, stack: err && err.message });
      res(false);
    });
  });
}

/* Viewing angle above the table. On a landscape window the house three-quarter
   reads best. On a portrait phone the book is far wider than the frame, so a
   three-quarter view leaves it a thin band floating in dead space; tilting
   toward top-down makes its depth project taller and fills more of the screen. */
function viewAngle() {
  const a = camera ? camera.aspect : 1.5;
  const t = clamp((1.35 - a) / 0.75, 0, 1);      // 0 at wide, 1 at portrait
  return 0.77 + t * 0.38;                        // 44deg -> 66deg
}
// Breathing room. Needs to exceed the perspective gain on the NEAR corners:
// they sit closer to the camera than the book centre and project wider, which
// ate almost all of a 1.16 margin (corners landed at 0.987 of the frame edge).
const FIT_MARGIN = 1.30;

/* Frame the whole book at any window shape.
   A fixed camera distance only fits one aspect ratio: on a narrow or wide
   window the outer edges crop off. Solve for the distance that contains the
   book's bounding sphere within the TIGHTER of the two field-of-view axes,
   so it is always fully in frame. */
function frameBook() {
  const BOOK_W = (PAGE_W + 0.06) * 2;          // both boards, spine to fore-edge
  const BOOK_D = PAGE_H + 0.06;
  const THICK = 0.20;                          // block + lifted leaf

  // Fit the book's PROJECTED footprint, not its bounding sphere: seen from a
  // three-quarter angle the depth foreshortens, and fitting the full sphere
  // pushes the camera so far back the book only fills half the frame.
  const ang = viewAngle();
  // Width is the binding constraint on portrait, so spend less of it on air.
  const margin = camera.aspect < 1 ? 1.12 : FIT_MARGIN;

  const halfW = (BOOK_W / 2) * margin;
  const halfV = ((BOOK_D * Math.sin(ang) + THICK * Math.cos(ang)) / 2) * margin;

  const vFov = (camera.fov * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const dist = Math.max(halfW / Math.tan(hFov / 2), halfV / Math.tan(vFov / 2));

  camera.position.set(0, Math.sin(ang) * dist, Math.cos(ang) * dist);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}

function resize() {
  // Never trust window.innerWidth: an occluded or not-yet-laid-out container
  // reports 0 and three clamps the drawing buffer to 1x1, which renders a
  // perfectly valid scene into a single pixel.
  const cv = renderer.domElement;
  const w = cv.clientWidth || window.innerWidth || 0;
  const h = cv.clientHeight || window.innerHeight || 0;
  if (w < 2 || h < 2) return;            // wait for real layout
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  frameBook();
}

function tick() {
  raf = requestAnimationFrame(tick);
  renderer.render(scene, camera);
}

/* ─── input ─────────────────────────────────────────────────────────── */
function wire(canvas) {
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let mode = null, sx = 0, sy = 0, lamp0 = null, leaf = null, from = 0;
  let lastX = 0, lastT = 0, vel = 0;      // px/ms, for flick detection

  // How far you must drag for a full turn. Was innerWidth*0.42, which on a
  // 1400px window demanded a ~590px swipe and made most drags fall short and
  // snap back. Capped so a wide monitor does not make it worse.
  const TRAVEL = () => Math.max(150, Math.min(innerWidth * 0.20, 380));
  const COMMIT = 0.22;                    // fraction of travel that counts
  const FLICK = 0.32;                     // px/ms that counts as a throw

  const overLamp = (e) => {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObject(lamp, true).length > 0;
  };

  canvas.addEventListener("pointerdown", (e) => {
    if (anim) return;
    canvas.setPointerCapture(e.pointerId);
    sx = e.clientX; sy = e.clientY;
    lastX = e.clientX; lastT = performance.now(); vel = 0;

    if (overLamp(e)) { mode = "lamp"; lamp0 = lamp.position.clone(); return; }

    // right half grabs the next leaf forward, left half the last one back
    if (e.clientX >= innerWidth / 2 && spread < leaves.length) {
      mode = "fwd"; leaf = leaves[spread]; from = leaf.userData.turn;
    } else if (e.clientX < innerWidth / 2 && spread > 0) {
      mode = "back"; leaf = leaves[spread - 1]; from = leaf.userData.turn;
    }
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!mode) return;
    if (mode === "lamp") {
      lamp.position.x = clamp(lamp0.x + ((e.clientX - sx) / innerWidth) * 8, -3.2, 3.2);
      lamp.position.z = clamp(lamp0.z + ((e.clientY - sy) / innerHeight) * 4, -1.8, 2.6);
      aimLamp();
      return;
    }
    // running velocity so a quick flick can carry the page over even when the
    // drag itself was short
    const nt = performance.now(), dt = nt - lastT;
    if (dt > 0) vel = 0.7 * vel + 0.3 * ((e.clientX - lastX) / dt);
    lastX = e.clientX; lastT = nt;

    // drag across the book maps to turn progress, so the page follows the hand
    const d = (e.clientX - sx) / TRAVEL();
    setTurn(leaf, clamp(from - d, 0, 1));
    sizeBlocks();
  });

  const up = (e) => {
    if (!mode) return;
    if (mode === "lamp") { mode = null; return; }
    const moved = Math.abs(e.clientX - sx);
    const t = leaf.userData.turn;

    if (moved < 6) {                       // a tap, not a drag
      mode === "fwd" ? commitForward() : commitBack();
    } else if (mode === "fwd") {
      // committed if dragged past the threshold OR thrown leftwards
      (t > COMMIT || vel < -FLICK) ? commitForward() : glide(leaf, t, 0);
    } else {
      (t < 1 - COMMIT || vel > FLICK) ? commitBack() : glide(leaf, t, 1);
    }
    mode = null; leaf = null; vel = 0;
  };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", () => { mode = null; leaf = null; });

  addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") commitForward();
    if (e.key === "ArrowLeft") commitBack();
  });
  addEventListener("resize", resize);
}

function hud() {
  const p = Math.min(spread * 2, issue.pages);
  const el = $("aInd");
  if (el) el.textContent = ("0" + Math.max(1, p)).slice(-2) + " / " + ("0" + issue.pages).slice(-2);
  const w = $("toWardrobe");
  if (w) w.classList.toggle("show", spread >= leaves.length);
}

/* ─── boot ──────────────────────────────────────────────────────────── */
/* cleanUrls serves this at /<slug>/atelier with NO trailing slash, which
   changes what "../" resolves to: from /slug/atelier/ it means /slug/, but
   from /slug/atelier it means the site root. Relative paths are therefore not
   safe here. Derive the roots explicitly. */
function roots() {
  const p = location.pathname;
  const issue = p.replace(/\/atelier\/?$/, "") + "/";        // /slug/
  const app = issue.replace(/[^/]+\/$/, "");                  // /
  return { issue, app };
}

export async function start(opts) {
  opts = opts || {};
  const R = roots();
  const canvas = $("gl");
  initScene(canvas);
  wire(canvas);
  tick();

  const res = await fetch(R.issue + "issue.json", { cache: "no-cache" });
  if (!res.ok) {
    BB("fail", "issue.json " + res.status, { src: R.issue + "issue.json" });
    throw new Error("issue.json " + res.status + " at " + R.issue);
  }
  const d = await res.json();
  const plates = [R.issue + d.cover];
  d.stories.forEach((s) => s.plates.forEach((p) => plates.push(R.issue + p.img)));
  issue = { pages: plates.length };

  $("aMark").textContent = d.mark;
  $("aTitle").textContent = d.issue;
  if (d.theme && d.theme.acc) document.documentElement.style.setProperty("--acc", d.theme.acc);
  const wl = $("toWardrobe");
  if (wl) wl.href = R.app + "walk/";
  const bl = $("toBook");
  if (bl) bl.href = R.issue + "book/";

  ATELIER_APP = R.app;
  try {
    await loadHDR(opts.hdr || R.app + "assets/env/studio_small_09.hdr");
  } catch (e) {
    BB("fail", "hdr phase threw: " + (e && e.message), { stack: e && e.stack });
  }
  try {
    await buildBook(plates);
  } catch (e) {
    // Cross-origin modules report as a bare "Script error." to window.onerror,
    // so catch at the phase boundary where the real message still exists.
    BB("fail", "buildBook threw: " + (e && e.message), { stack: e && e.stack });
    throw e;
  }
  hud();
  setLampColour(opts.lamp || "#ffd9a0");
  $("boot").classList.add("gone");
  document.body.classList.add("ready");

  const gl = renderer.getContext();
  const dbg = gl.getExtension("WEBGL_debug_renderer_info");
  BB("note", "atelier ready", {
    src: leaves.length + " leaves, env=" + (!!scene.environment) +
         ", programs=" + renderer.info.programs.length +
         ", tris=" + renderer.info.render.triangles +
         ", buffer=" + renderer.domElement.width + "x" + renderer.domElement.height +
         ", pr=" + renderer.getPixelRatio() +
         ", maxTex=" + gl.getParameter(gl.MAX_TEXTURE_SIZE) +
         ", gpu=" + (dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "hidden"),
  });
  renderer.domElement.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    BB("fail", "WebGL context lost (usually memory pressure)");
  });
  renderer.domElement.addEventListener("webglcontextrestored", () => {
    BB("note", "WebGL context restored");
  });

  window.__atelier = {
    renderer, scene, camera, leaves, lamp, lampLight,
    get spread() { return spread; },
    get env() { return !!scene.environment; },
    programs: () => renderer.info.programs.length,
    calls: () => renderer.info.render.calls,
    turn: (i) => (leaves[i] ? leaves[i].userData.turn : null),
    fwd: commitForward, back: commitBack,
    shot: () => { renderer.render(scene, camera); return renderer.domElement.toDataURL("image/jpeg", 0.7); },
  };
}
