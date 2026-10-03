// Astronomy behind the live readouts, checked against published almanac values.
import test from "node:test";
import assert from "node:assert/strict";
import { sunTimes, sunPhase, solarElevation, moon, nextSeason, seasonInstant, fmtDur } from "../../public/assets/x/core/live-math.js";

const LA = [34.0522, -118.2437];
const near = (actual, expected, minutes, label) =>
  assert.ok(Math.abs(actual - expected) <= minutes * 60000, `${label}: off by ${((actual - expected) / 60000).toFixed(1)} min`);

test("Los Angeles sunset on the solstices matches the almanac", () => {
  // USNO: 2026-06-21 sunset 20:08 PDT (03:08Z next day); 2026-12-21 sunset 16:47 PST (00:47Z next day)
  near(sunTimes(Date.parse("2026-06-21T07:00:00Z"), ...LA).sunset, Date.parse("2026-06-22T03:08:00Z"), 4, "June sunset");
  near(sunTimes(Date.parse("2026-12-21T08:00:00Z"), ...LA).sunset, Date.parse("2026-12-22T00:47:00Z"), 4, "December sunset");
  near(sunTimes(Date.parse("2026-12-21T08:00:00Z"), ...LA).sunrise, Date.parse("2026-12-21T14:55:00Z"), 4, "December sunrise");
});

test("solar elevation is high at local noon and negative at midnight", () => {
  assert.ok(solarElevation(Date.parse("2026-06-21T19:55:00Z"), ...LA) > 75);
  assert.ok(solarElevation(Date.parse("2026-06-21T07:55:00Z"), ...LA) < -20);
});

test("sunPhase walks day -> golden -> blue -> night with a future next change", () => {
  const day = sunPhase(Date.parse("2026-09-29T20:00:00Z"), ...LA);
  assert.equal(day.phase, "day");
  assert.equal(day.nextName, "golden");
  assert.ok(day.next > Date.parse("2026-09-29T20:00:00Z"));
  const golden = sunPhase(Date.parse("2026-09-30T01:30:00Z"), ...LA); // 18:30 PDT, sunset 18:38
  assert.equal(golden.phase, "golden");
  assert.equal(golden.rising, false);
  const night = sunPhase(Date.parse("2026-09-30T08:00:00Z"), ...LA);
  assert.equal(night.phase, "night");
  assert.equal(night.nextName, "blue");
});

test("moon phase: full on 2026-09-26, new on 2026-10-10", () => {
  const full = moon(Date.parse("2026-09-26T16:49:00Z"));
  assert.ok(full.illum > 0.99, "full moon illumination " + full.illum);
  assert.equal(full.name, "Full moon");
  const nw = moon(Date.parse("2026-10-10T15:50:00Z"));
  assert.ok(nw.illum < 0.02, "new moon illumination " + nw.illum);
});

test("seasons: 2026 June solstice and the next one after late September", () => {
  near(seasonInstant(2026, 1), Date.parse("2026-06-21T08:24:00Z"), 30, "June solstice");
  const next = nextSeason(Date.parse("2026-09-29T12:00:00Z"));
  assert.equal(next.name, "December solstice");
  near(next.at, Date.parse("2026-12-21T20:50:00Z"), 30, "December solstice");
});

test("fmtDur", () => {
  assert.equal(fmtDur(65 * 60000), "1h 05m");
  assert.equal(fmtDur(9 * 60000), "9m");
  assert.equal(fmtDur(null), "a while");
});
