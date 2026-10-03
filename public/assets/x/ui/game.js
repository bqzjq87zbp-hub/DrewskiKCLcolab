/* /iw-playable-fiction: the hidden reward, operable, with an exit.
 *
 * One mechanic per issue, taken far enough to be worth a minute:
 *
 *   hop   (unused here)  a lowrider on a night street. Hold to pump the
 *         hydraulics, let go at the top of the meter, and the front end
 *         leaves the ground. Measured in inches, like a real hop contest.
 *         Big hops throw sparks when the bumper comes down.
 *   skip  (the exhibitions)  a stone off the beach by the pier at dusk, under
 *         the moon as it actually is tonight. Hold for power, let go, count
 *         the skips.
 *
 * Three tries a round, best score kept on this device. Scores, tries and the
 * best read as pips (a pip a skip, or ten inches of hop), never digits; the
 * figure itself is only in the aria-label. Space, Enter, mouse or touch;
 * Escape or the exit button leaves. Only runs while open.
 */
import { $, h, clamp, lerp, pad } from "../util.js";
import { moon } from "../core/live-math.js";
import { sound } from "../core/sound.js";
import { scroll } from "../core/scroll.js";
import * as prefs from "../core/prefs.js";

export function initGame(ctx) {
  const mode = ctx.ex.game === "skip" ? "skip" : "hop";
  const title = mode === "hop" ? "Hit the switches" : "Skip a stone";
  const unit = mode === "hop" ? "in" : "skips";
  const root = h("div", { class: "gm", role: "dialog", "aria-modal": "true", "aria-label": title }, `
    <canvas></canvas>
    <div class="gm-ui">
      <div class="gm-top"><span class="gm-t">${title}</span><button type="button" class="gm-x">Exit</button></div>
      <div></div>
      <div class="gm-bot">
        <div><div class="lbl gm-msg" aria-live="polite">Hold, then let go</div><div class="gm-score gm-pips" role="img" aria-live="polite"></div></div>
        <div class="lbl" style="text-align:right">Tries <span class="gm-try gm-pips" role="img"></span><br>Best <span class="gm-best gm-pips" role="img"></span></div>
      </div>
    </div>`);
  document.body.appendChild(root);
  const cv = $("canvas", root), g = cv.getContext("2d");
  const KEY = "x.game." + mode;
  let best = +(localStorage.getItem(KEY) || 0);
  const per = mode === "hop" ? 10 : 1;
  /** `n` pips, the first `lit` of them lit; the figure goes to screen readers only. */
  const pips = (sel, n, lit, label) => {
    const el = $(sel, root);
    el.innerHTML = '<i class="on"></i>'.repeat(lit) + "<i></i>".repeat(Math.max(0, n - lit));
    el.setAttribute("aria-label", label);
  };
  const say = (v) => `${v} ${v === 1 ? unit.replace(/s$/, "") : unit}`;
  const scorePips = (v) => { const k = Math.round(v / per); pips(".gm-score", k, k, say(v)); };
  // no best yet reads as one empty pip
  const bestPips = () => { const k = Math.round(best / per); pips(".gm-best", Math.max(1, k), k, `Best ${say(best)}`); };
  const tryPips = (k) => pips(".gm-try", 3, k, `Try ${k} of 3`);
  bestPips();

  let W = 0, H = 0, dpr = 1, open = false, raf = 0, last = 0, t = 0;
  let state = "ready", charge = 0, holdT = 0, tries = 0, roundBest = 0, score = 0;
  const parts = [], ripples = [];
  const acc = ctx.ex.acc || "#c98a0b";

  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
  }

  /* ── hop ────────────────────────────────────────────────────────────── */
  const car = { lift: 0, vy: 0, y: 0, vyb: 0, air: false, peak: 0 };
  function drawStreet() {
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#0a0c18"); sky.addColorStop(0.62, "#24162a"); sky.addColorStop(1, "#130d10");
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    const road = H * 0.74;
    // city lights far away
    for (let i = 0; i < 90; i++) {
      const x = ((i * 137.5) % 1) * W + ((i * 53) % W), y = road - 40 - ((i * 29) % 60);
      g.fillStyle = `rgba(255,${190 + (i % 50)},${120 + (i % 80)},${0.25 + (i % 5) * 0.08})`;
      g.fillRect(x % W, y, 2, 2);
    }
    // palms
    g.strokeStyle = "#05060c"; g.fillStyle = "#05060c"; g.lineWidth = 5;
    for (const [px, ph] of [[W * 0.12, 0.62], [W * 0.2, 0.5], [W * 0.83, 0.58], [W * 0.9, 0.7]]) {
      const top = road - H * ph;
      g.beginPath(); g.moveTo(px, road); g.quadraticCurveTo(px + 14, (road + top) / 2, px + 6, top); g.stroke();
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2 + Math.sin(t * 0.6 + k) * 0.05;
        g.beginPath(); g.moveTo(px + 6, top);
        g.quadraticCurveTo(px + 6 + Math.cos(a) * 30, top + Math.sin(a) * 10 - 16, px + 6 + Math.cos(a) * 58, top + Math.abs(Math.sin(a)) * 30 + 6);
        g.lineWidth = 4; g.stroke();
      }
    }
    // streetlight
    const lx = W * 0.68;
    g.fillStyle = "#07080d"; g.fillRect(lx, road - H * 0.46, 4, H * 0.46);
    g.fillRect(lx - 40, road - H * 0.46, 44, 4);
    const glow = g.createRadialGradient(lx - 38, road - H * 0.44, 2, lx - 38, road - H * 0.44, H * 0.5);
    glow.addColorStop(0, "rgba(255,196,120,.55)"); glow.addColorStop(1, "rgba(255,196,120,0)");
    g.fillStyle = glow; g.fillRect(0, 0, W, H);
    g.fillStyle = "#141112"; g.fillRect(0, road, W, H - road);
    g.fillStyle = "rgba(255,210,140,.35)";
    for (let x = (-(t * 0) % 80); x < W; x += 80) g.fillRect(x, road + (H - road) * 0.45, 40, 3);
    return road;
  }
  function drawCar(road) {
    const L = Math.min(W * 0.62, 620), cx = W / 2, rearX = cx - L * 0.32, frontX = cx + L * 0.32;
    const wr = L * 0.075, ground = road - car.y;
    const ang = -Math.atan2(car.lift, frontX - rearX);
    g.save();
    g.translate(rearX, ground - wr);
    g.rotate(ang);
    g.translate(-rearX, -(ground - wr));
    const by = ground - wr * 1.05;
    // body
    g.fillStyle = acc;
    g.beginPath();
    g.moveTo(cx - L / 2, by); g.lineTo(cx - L / 2, by - L * 0.1); g.quadraticCurveTo(cx - L * 0.45, by - L * 0.13, cx - L * 0.3, by - L * 0.13);
    g.lineTo(cx - L * 0.2, by - L * 0.215); g.lineTo(cx + L * 0.12, by - L * 0.215); g.lineTo(cx + L * 0.2, by - L * 0.13);
    g.lineTo(cx + L * 0.47, by - L * 0.12); g.quadraticCurveTo(cx + L * 0.5, by - L * 0.1, cx + L * 0.5, by - L * 0.04); g.lineTo(cx + L * 0.5, by);
    g.closePath(); g.fill();
    // chrome strip, windows, bumpers
    g.fillStyle = "rgba(255,255,255,.55)"; g.fillRect(cx - L * 0.48, by - L * 0.06, L * 0.96, 2);
    g.fillStyle = "#0c0d14";
    g.beginPath(); g.moveTo(cx - L * 0.17, by - L * 0.135); g.lineTo(cx - L * 0.12, by - L * 0.2); g.lineTo(cx - L * 0.02, by - L * 0.2); g.lineTo(cx - L * 0.02, by - L * 0.135); g.fill();
    g.beginPath(); g.moveTo(cx + L * 0.01, by - L * 0.135); g.lineTo(cx + L * 0.01, by - L * 0.2); g.lineTo(cx + L * 0.1, by - L * 0.2); g.lineTo(cx + L * 0.16, by - L * 0.135); g.fill();
    g.fillStyle = "#d9d6cf"; g.fillRect(cx - L * 0.51, by - L * 0.02, L * 0.05, L * 0.025); g.fillRect(cx + L * 0.47, by - L * 0.02, L * 0.05, L * 0.025);
    // wire wheels
    for (const wx of [rearX, frontX]) {
      g.fillStyle = "#050507"; g.beginPath(); g.arc(wx, ground - wr, wr, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#e3c26b"; g.lineWidth = 1;
      for (let k = 0; k < 18; k++) { const a = (k / 18) * Math.PI * 2 + t * 0.2; g.beginPath(); g.moveTo(wx, ground - wr); g.lineTo(wx + Math.cos(a) * wr * 0.68, ground - wr + Math.sin(a) * wr * 0.68); g.stroke(); }
      g.fillStyle = "#f1dd98"; g.beginPath(); g.arc(wx, ground - wr, wr * 0.14, 0, Math.PI * 2); g.fill();
    }
    g.restore();
    return { frontX, ground, L };
  }

  /* ── skip ───────────────────────────────────────────────────────────── */
  const stone = { x: 0, y: 0, vx: 0, vy: 0, live: false, skips: 0 };
  function drawRiver() {
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#152238"); sky.addColorStop(0.45, "#4c5a78"); sky.addColorStop(0.6, "#e2a77f");
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    // tonight's moon
    const m = moon(Date.now());
    const mx = W * 0.78, my = H * 0.17, mr = Math.min(W, H) * 0.045;
    g.fillStyle = "rgba(246,238,220,.95)"; g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#1f2c44";
    const k = Math.cos(m.illum * Math.PI) * mr;
    g.beginPath();
    if (m.waxing) { g.arc(mx, my, mr, Math.PI / 2, -Math.PI / 2, false); g.ellipse(mx, my, Math.abs(k), mr, 0, -Math.PI / 2, Math.PI / 2, k > 0); }
    else { g.arc(mx, my, mr, -Math.PI / 2, Math.PI / 2, false); g.ellipse(mx, my, Math.abs(k), mr, 0, Math.PI / 2, -Math.PI / 2, k > 0); }
    g.fill();
    const water = H * 0.6;
    // the pier in silhouette: a deck and its railing on pilings, lamps along it
    const deck = water - H * 0.12, end = W * 0.74;
    g.fillStyle = "#0c1420";
    g.fillRect(-10, deck, end + 10, Math.max(6, H * 0.02));
    g.fillRect(-10, deck - 10, end + 10, 2);
    for (let x = 4; x < end; x += 34) g.fillRect(x, deck, 5, water - deck + 4);
    for (let x = 24; x < end; x += 136) { g.fillRect(x, deck - 30, 2, 30); g.fillRect(x - 4, deck - 32, 10, 3); }
    const wg = g.createLinearGradient(0, water, 0, H);
    wg.addColorStop(0, "#5d7184"); wg.addColorStop(0.2, "#2a3a4c"); wg.addColorStop(1, "#0f1722");
    g.fillStyle = wg; g.fillRect(0, water, W, H - water);
    g.strokeStyle = "rgba(230,220,200,.08)";
    for (let y = water + 8; y < H; y += 14) { g.beginPath(); g.moveTo(0, y + Math.sin(t + y) * 1.5); g.lineTo(W, y + Math.cos(t * 0.8 + y) * 1.5); g.stroke(); }
    // moon on the water
    g.fillStyle = "rgba(246,238,220,.12)";
    for (let i = 0; i < 12; i++) g.fillRect(mx - 30 + Math.sin(t * 2 + i) * 8, water + 10 + i * 12, 60 - i * 3, 2);
    return water;
  }

  /* ── loop ───────────────────────────────────────────────────────────── */
  function meter() {
    const x = W - 46, y = H * 0.3, hh = H * 0.36;
    g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(x, y, 10, hh);
    g.fillStyle = charge > 0.92 ? "#fff" : acc; g.fillRect(x, y + hh * (1 - charge), 10, hh * charge);
    g.fillStyle = "rgba(255,255,255,.6)"; g.fillRect(x - 4, y, 18, 1);
  }
  function spark(x, y, n, col) {
    for (let i = 0; i < n; i++) parts.push({ x, y, vx: (Math.random() - 0.3) * 520, vy: -Math.random() * 380, life: 0.5 + Math.random() * 0.5, col });
  }
  function frame(now) {
    if (!open) return;
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016); last = now; t += dt;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (state === "charge") { holdT += dt; charge = Math.abs(Math.sin(holdT * Math.PI / 1.15)); }
    if (mode === "hop") {
      const road = drawStreet();
      const GRAV = 2600;
      if (car.air) {
        car.vy -= GRAV * dt; car.lift += car.vy * dt;
        car.vyb -= GRAV * dt; car.y = Math.max(0, car.y + car.vyb * dt);
        car.peak = Math.max(car.peak, car.lift);
        if (car.lift <= 0) {
          car.lift = 0; car.air = false; car.y = 0;
          const inches = Math.round(car.peak / 3.2);
          sound.play("thump", { gain: 0.45 });
          // the front bumper scrapes on a big hop
          const L = Math.min(W * 0.62, 620);
          if (inches > 40) spark(W / 2 + L * 0.5, road - 4, Math.min(80, inches), "255,190,90");
          land(inches);
        }
      }
      drawCar(road);
    } else {
      const water = drawRiver();
      if (stone.live) {
        stone.vy += 1500 * dt; stone.x += stone.vx * dt; stone.y += stone.vy * dt;
        if (stone.y >= water && stone.vy > 0) {
          if (stone.vx > 190 && stone.vy < 900) {
            stone.skips++; stone.y = water; stone.vy = -stone.vy * 0.52 - 60; stone.vx *= 0.8;
            ripples.push({ x: stone.x, y: water, r: 2, a: 0.8 });
            sound.play("plink", { i: stone.skips });
            score = stone.skips; scorePips(score);
          } else {
            stone.live = false;
            ripples.push({ x: stone.x, y: water, r: 4, a: 1, big: true });
            sound.play("thump", { gain: 0.15 });
            land(stone.skips);
          }
        }
        if (stone.x > W + 20) { stone.live = false; land(stone.skips); }
        g.fillStyle = "#cfc6b6"; g.beginPath(); g.ellipse(stone.x, stone.y, 7, 4, stone.x * 0.05, 0, Math.PI * 2); g.fill();
      } else if (state !== "done") {
        g.fillStyle = "#cfc6b6"; g.beginPath(); g.ellipse(70, water - 60 - charge * 20, 7, 4, 0, 0, Math.PI * 2); g.fill();
      }
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.r += dt * (r.big ? 60 : 45); r.a -= dt * 0.5;
        if (r.a <= 0) { ripples.splice(i, 1); continue; }
        g.strokeStyle = `rgba(235,228,212,${r.a})`; g.lineWidth = 1.2;
        g.beginPath(); g.ellipse(r.x, r.y, r.r * 2.2, r.r * 0.45, 0, 0, Math.PI * 2); g.stroke();
      }
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt; p.vy += 1400 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      g.fillStyle = `rgba(${p.col},${p.life})`; g.fillRect(p.x, p.y, 2, 2);
    }
    if (state === "charge" || state === "ready") meter();
    raf = requestAnimationFrame(frame);
  }

  function press() {
    if (state !== "ready") return;
    state = "charge"; holdT = 0; charge = 0;
    $(".gm-msg", root).textContent = "Let go at the top";
    if (mode === "hop") sound.play("hiss", { dur: 0.3 });
  }
  function release() {
    if (state !== "charge") return;
    const p = Math.pow(charge, 1.4);
    state = "fly";
    $(".gm-msg", root).textContent = mode === "hop" ? "Up..." : "Go on...";
    if (mode === "hop") {
      car.air = true; car.peak = 0; car.lift = 0;
      car.vy = Math.sqrt(2 * 2600 * (30 + p * 300));
      car.vyb = p > 0.8 ? 420 * p : 0;
      sound.play("hiss", { dur: 0.5 });
    } else {
      Object.assign(stone, { live: true, skips: 0, x: 70, y: H * 0.6 - 70, vx: 380 + p * 1100, vy: -120 - p * 80 });
      score = 0; scorePips(0);
    }
    charge = 0;
  }
  function land(v) {
    score = v;
    scorePips(v);
    tries++;
    roundBest = Math.max(roundBest, v);
    if (v > best) { best = v; try { localStorage.setItem(KEY, String(best)); } catch (e) {} bestPips(); sound.play("chime"); }
    if (tries >= 3) {
      state = "done";
      // the big pips now hold the round's best throw, right under this line
      scorePips(roundBest);
      $(".gm-msg", root).textContent = "Round over. Press to go again. Your best this round:";
    } else {
      state = "wait";
      $(".gm-msg", root).textContent = mode === "hop" ? (v > 60 ? "That's a hop." : "More pump.") : v > 5 ? "Lovely." : "Flatter and faster.";
      setTimeout(() => { if (open && state === "wait") { state = "ready"; $(".gm-msg", root).textContent = "Hold, then let go"; } }, 1100);
    }
    tryPips(Math.min(3, tries + 1));
  }
  function reset() { tries = 0; roundBest = 0; score = 0; state = "ready"; tryPips(1); scorePips(0); $(".gm-msg", root).textContent = "Hold, then let go"; }

  cv.addEventListener("pointerdown", (e) => { e.preventDefault(); if (state === "done") { reset(); return; } press(); });
  addEventListener("pointerup", () => open && release());
  addEventListener("keydown", (e) => {
    if (!open) return;
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); if (state === "done") reset(); else press(); }
  });
  addEventListener("keyup", (e) => { if (open && (e.key === " " || e.key === "Enter")) release(); });
  $(".gm-x", root).addEventListener("click", () => close());
  addEventListener("resize", () => open && size());

  function show() {
    if (open) return;
    open = true;
    scroll.lock();
    size(); reset();
    root.classList.add("open");
    document.documentElement.classList.add("gm-open");
    last = performance.now();
    raf = requestAnimationFrame(frame);
    $(".gm-x", root).focus({ preventScroll: true });
  }
  function close() {
    if (!open) return;
    open = false;
    cancelAnimationFrame(raf);
    root.classList.remove("open");
    document.documentElement.classList.remove("gm-open");
    scroll.unlock();
  }
  return { open: show, close };
}
