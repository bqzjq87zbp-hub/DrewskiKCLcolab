/* /iw-live-data-forms: numbers that are genuinely live.
 *
 * Every figure here is computed on the visitor's device from the clock and
 * real astronomy; nothing is faked or fetched. An issue with a place reads
 * its local time and light ("Los Angeles 17:12 · golden hour in 1h 04m"),
 * one without reads the visitor's own time against the almanac.
 */
import { sunPhase, moon, nextSeason, fmtDur } from "./live-math.js";

const PHASE_NOW = { day: "Daylight", golden: "Golden hour now", blue: "Blue hour now", night: "Night" };
const PHASE_NEXT = { golden: "golden hour", blue: "blue hour", night: "nightfall", day: "full daylight" };

export function readout(cfg, now = Date.now()) {
  const tz = cfg.place && cfg.place.tz;
  let time;
  try {
    time = new Intl.DateTimeFormat("en-GB", { timeZone: tz || undefined, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(now);
  } catch (e) { time = new Date(now).toTimeString().slice(0, 8); }
  const out = { time, place: cfg.place ? cfg.place.name : "Your time", line: "", phase: null };
  if (cfg.almanac === "sun" && cfg.place) {
    const p = sunPhase(now, cfg.place.lat, cfg.place.lon);
    out.phase = p.phase;
    const inT = p.next ? fmtDur(p.next - now) : "";
    out.line = p.phase === "day" ? `Golden hour in ${inT}` : `${PHASE_NOW[p.phase]} · ${PHASE_NEXT[p.nextName]} in ${inT}`;
  } else {
    const m = moon(now);
    const s = nextSeason(now);
    const days = s ? Math.ceil((s.at - now) / 86400000) : null;
    out.line = `${m.name} · ${Math.round(m.illum * 100)}% lit` + (s ? ` · ${days} days to the ${s.name.split(" ")[1]}` : "");
    out.phase = m.waxing ? "waxing" : "waning";
  }
  return out;
}

/** Keep every [data-live] element in `scope` ticking. Returns a stop function. */
export function startLive(scope, cfg) {
  const els = () => scope.querySelectorAll("[data-live]");
  const tick = () => {
    const r = readout(cfg);
    els().forEach((el) => {
      const k = el.getAttribute("data-live");
      const v = k === "time" ? r.time : k === "place" ? r.place : k === "line" ? r.line : k === "all" ? `${r.place} ${r.time} · ${r.line}` : "";
      if (el.textContent !== v) el.textContent = v;
      if (r.phase) el.setAttribute("data-phase", r.phase);
    });
  };
  tick();
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}
