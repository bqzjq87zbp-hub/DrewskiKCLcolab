/* Pure astronomy for the live readouts. No DOM, no dependencies, unit-tested.
 *
 *   solarElevation  NOAA solar position algorithm (the spreadsheet method),
 *                   good to well under a degree for the next few centuries
 *   sunPhase        which light it is now and when the next change comes
 *   moon            phase age, illumination and name from the synodic month
 *   seasons         Meeus mean equinox/solstice instants (years 2000-3000)
 */

const RAD = Math.PI / 180, DEG = 180 / Math.PI;
const DAY = 86400000;

export const julian = (ms) => ms / DAY + 2440587.5;

export function solarElevation(ms, lat, lon) {
  const jd = julian(ms);
  const T = (jd - 2451545.0) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = Math.sin(M * RAD) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
            Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * T) + Math.sin(3 * M * RAD) * 0.000289;
  const omega = 125.04 - 1934.136 * T;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * RAD);
  const decl = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD));
  const y = Math.pow(Math.tan((eps / 2) * RAD), 2);
  const eot = 4 * DEG * (y * Math.sin(2 * L0 * RAD) - 2 * e * Math.sin(M * RAD) +
    4 * e * y * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD) -
    0.5 * y * y * Math.sin(4 * L0 * RAD) - 1.25 * e * e * Math.sin(2 * M * RAD));
  const d = new Date(ms);
  const utcMin = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60 + d.getUTCMilliseconds() / 60000;
  let tst = (utcMin + eot + 4 * lon) % 1440;
  if (tst < 0) tst += 1440;
  const ha = tst / 4 - 180;
  const cz = Math.sin(lat * RAD) * Math.sin(decl) + Math.cos(lat * RAD) * Math.cos(decl) * Math.cos(ha * RAD);
  const zen = Math.acos(Math.max(-1, Math.min(1, cz))) * DEG;
  return 90 - zen;
}

/** First instant after `from` (within `span` ms) where elevation crosses `deg`
 *  in the given direction (+1 rising, -1 setting). Coarse scan, then bisect. */
export function nextCrossing(from, lat, lon, deg, dir, span = 2 * DAY) {
  const step = 4 * 60000;
  let t0 = from, e0 = solarElevation(t0, lat, lon) - deg;
  for (let t = from + step; t <= from + span; t += step) {
    const e1 = solarElevation(t, lat, lon) - deg;
    const crossed = dir > 0 ? e0 < 0 && e1 >= 0 : e0 > 0 && e1 <= 0;
    if (crossed) {
      let a = t0, b = t;
      for (let i = 0; i < 22; i++) {
        const m = (a + b) / 2, em = solarElevation(m, lat, lon) - deg;
        if ((dir > 0 && em < 0) || (dir < 0 && em > 0)) a = m; else b = m;
      }
      return (a + b) / 2;
    }
    t0 = t; e0 = e1;
  }
  return null;
}

export const SUNSET_DEG = -0.833;
export const GOLDEN_HI = 6, GOLDEN_LO = -4, BLUE_LO = -6;

export function sunTimes(dayStartMs, lat, lon) {
  return {
    sunrise: nextCrossing(dayStartMs, lat, lon, SUNSET_DEG, +1, DAY),
    sunset: nextCrossing(dayStartMs, lat, lon, SUNSET_DEG, -1, DAY),
  };
}

/**
 * What light it is and what comes next.
 *   day     sun above 6°        next: golden hour (sun falls to 6°)
 *   golden  between 6° and -4°  next: blue hour (evening) or day (morning)
 *   blue    between -4° and -6° next: night (evening) or golden (morning)
 *   night   below -6°           next: blue hour (sun rises to -6°)
 */
export function sunPhase(now, lat, lon) {
  const el = solarElevation(now, lat, lon);
  const rising = solarElevation(now + 60000, lat, lon) > el;
  let phase, next, nextName;
  if (el > GOLDEN_HI) {
    phase = "day"; nextName = "golden"; next = nextCrossing(now, lat, lon, GOLDEN_HI, -1);
  } else if (el > GOLDEN_LO) {
    phase = "golden";
    if (rising) { nextName = "day"; next = nextCrossing(now, lat, lon, GOLDEN_HI, +1); }
    else { nextName = "blue"; next = nextCrossing(now, lat, lon, GOLDEN_LO, -1); }
  } else if (el > BLUE_LO) {
    phase = "blue";
    if (rising) { nextName = "golden"; next = nextCrossing(now, lat, lon, GOLDEN_LO, +1); }
    else { nextName = "night"; next = nextCrossing(now, lat, lon, BLUE_LO, -1); }
  } else {
    phase = "night"; nextName = "blue"; next = nextCrossing(now, lat, lon, BLUE_LO, +1);
  }
  return { phase, elevation: el, rising, next, nextName };
}

export const SYNODIC = 29.530588853;
export function moon(ms) {
  const age = (((julian(ms) - 2451550.1) % SYNODIC) + SYNODIC) % SYNODIC;
  const illum = (1 - Math.cos((2 * Math.PI * age) / SYNODIC)) / 2;
  const names = ["New moon", "Waxing crescent", "First quarter", "Waxing gibbous", "Full moon",
                 "Waning gibbous", "Last quarter", "Waning crescent", "New moon"];
  const idx = Math.floor((age / SYNODIC) * 8 + 0.5);
  return { age, illum, name: names[idx], waxing: age < SYNODIC / 2 };
}

const SEASONS = [
  ["March equinox", [2451623.80984, 365242.37404, 0.05169, -0.00411, -0.00057]],
  ["June solstice", [2451716.56767, 365241.62603, 0.00325, 0.00888, -0.00030]],
  ["September equinox", [2451810.21715, 365242.01767, -0.11575, 0.00337, 0.00078]],
  ["December solstice", [2451900.05952, 365242.74049, -0.06223, -0.00823, 0.00032]],
];
export function seasonInstant(year, i) {
  const Y = (year - 2000) / 1000;
  const c = SEASONS[i][1];
  const jde = c[0] + c[1] * Y + c[2] * Y * Y + c[3] * Y ** 3 + c[4] * Y ** 4;
  return (jde - 2440587.5) * DAY;
}
export function nextSeason(ms) {
  const y = new Date(ms).getUTCFullYear();
  for (const yy of [y, y + 1]) for (let i = 0; i < 4; i++) {
    const at = seasonInstant(yy, i);
    if (at > ms) return { name: SEASONS[i][0], at };
  }
  return null;
}

export function fmtDur(ms) {
  if (ms == null || !isFinite(ms)) return "a while";
  const m = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(m / 60), mm = m % 60;
  return h ? `${h}h ${String(mm).padStart(2, "0")}m` : `${mm}m`;
}
