// The four exhibitions, run through the real page model and the real finder.
// Adding a photograph or an exhibition wrongly fails here instead of on the page.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { model, shape } from "../../public/assets/x/exhibit/model.js";
import { makeBrain } from "../../public/assets/x/ui/finder-brain.js";

const PUB = new URL("../../public/", import.meta.url);
const path = (p) => new URL(p, PUB);
const json = (p) => JSON.parse(readFileSync(path(p), "utf8"));
const HEX = /^#[0-9a-f]{6}$/i;
const catalog = json("catalog.json");

function brainFor(slug) {
  const issue = json(`${slug}/issue.json`);
  const m = model(issue, catalog, `/${slug}/`, slug);
  const b = makeBrain({ plates: m.plates, stories: m.stories, palette: m.palette, mark: issue.mark, slug,
    other: m.others.map((o) => ({ mark: o.mark, slug: o.slug })) });
  return { b, m, issue };
}

test("the front door lists four exhibitions with covers, colours and true plate counts", () => {
  assert.deepEqual(catalog.issues.map((i) => i.slug), ["branding", "families", "headshots", "coastal"]);
  for (const i of catalog.issues) {
    assert.ok(existsSync(path(i.cover)), i.cover);
    for (const k of ["hero", "heroInk", "acc"]) assert.match(i[k], HEX, `${i.slug}.${k}`);
    const n = json(`${i.slug}/issue.json`).stories.reduce((a, s) => a + s.plates.length, 0);
    assert.equal(i.plates, n, `${i.slug}: catalog says ${i.plates}, the exhibition hangs ${n}`);
  }
  assert.ok(catalog.site.booking, "booking address");
  assert.ok(!catalog.site.place, "no studio location or clock: the studio is not in Newport");
  assert.ok(!/Newport Beach/.test(readFileSync(path("index.html"), "utf8")), "the front door names no studio location");
});

for (const { slug } of catalog.issues) {
  test(`${slug}: every page, plate and colour exists, and the shell paints its own colour first`, () => {
    for (const f of ["index.html", "book/index.html", "atelier/index.html", "issue.json"]) assert.ok(existsSync(path(`${slug}/${f}`)), `${slug}/${f}`);
    const issue = json(`${slug}/issue.json`), ex = issue.exhibit;
    assert.ok(existsSync(path(`${slug}/${issue.cover}`)), "cover");
    for (const s of issue.stories) {
      assert.match(s.mood.bg, HEX, s.title); assert.match(s.mood.ink, HEX, s.title);
      for (const p of s.plates) {
        assert.ok(existsSync(path(`${slug}/${p.img}`)), p.img);
        assert.ok(p.kicker && p.caption && p.w > 0 && p.h > 0, p.img);
        assert.ok(p.palette.length >= 1 && p.palette.every((c) => HEX.test(c)), `${p.img} palette`);
      }
    }
    for (const c of issue.palette) assert.ok(HEX.test(c.hex) && c.name && c.plates.length >= 1, `swatch ${c.name}`);
    assert.equal(new Set(issue.palette.map((c) => c.name)).size, issue.palette.length, "swatch names are unique");
    assert.ok(ex.wordmark && ex.font && ex.booking && !ex.place, "no live clock for a place");
    assert.ok(["cruise", "river"].includes(ex.sound) && ex.game === "skip");
    const shell = readFileSync(path(`${slug}/index.html`), "utf8");
    assert.match(shell, /assets\/x\/exhibit\.js/);
    assert.ok(shell.includes(`--hero-base:${ex.hero}`), "the preloader is already in the exhibition's colour");
    assert.ok(!/\u2014/.test(shell + JSON.stringify(issue)), "no em dashes in the copy");
  });
}

test("print formats are named from real proportions", () => {
  assert.equal(shape(1067, 1600), "Portrait, 2:3");
  assert.equal(shape(1600, 1067), "Landscape, 3:2");
  assert.equal(shape(1000, 1400), "Portrait, 5:7");
  assert.equal(shape(1400, 1336), "Square");
  assert.equal(shape(1600, 900), "Landscape, 16:9");
});

test("the model keeps shapes and hangs one lead print per chapter", () => {
  const { m, issue } = brainFor("families");
  assert.equal(m.plates.length, 21);
  assert.equal(m.prints.length, issue.stories.length);
  m.prints.forEach((g) => assert.equal(m.plates[g.plate].story, g.story));
  const wide = m.plates.find((p) => p.w > p.h);
  assert.ok(wide.ar > 1 && /^Landscape/.test(wide.shape));
  assert.deepEqual(m.others.map((o) => o.slug), ["branding", "headshots", "coastal"]);
});

test("the session planner asks three questions and writes the booking subject", () => {
  const { b, m } = brainFor("families");
  const q1 = b.reply("plan a session");
  assert.deepEqual(q1.chips, ["Branding", "Family", "Headshots", "Coastal"]);
  assert.ok(b.reply("Family").chips.includes("The beach and the pier"));
  assert.ok(b.reply("The beach and the pier").chips.includes("Golden hour"));
  const plan = b.reply("Golden hour");
  assert.ok(plan.cards.length >= 1, "shows what that has looked like");
  assert.ok(plan.cards.every((c) => /beach|pier|shore|water|ocean/i.test(m.plates[c.plate].caption)));
  assert.equal(plan.action.type, "highlight");
  const mail = b.reply("Email the booking");
  assert.equal(mail.action.type, "book");
  assert.equal(mail.action.subject, "Booking enquiry: Family session, the beach and the pier, golden hour");
});

test("a session from another exhibition points there instead of inventing photographs", () => {
  const { b } = brainFor("coastal");
  b.reply("plan a session"); b.reply("Headshots"); b.reply("In a studio");
  const plan = b.reply("No preference");
  assert.deepEqual(plan.cards, []);
  assert.ok(plan.chips.includes("Take me to Headshots"));
  assert.deepEqual(b.reply("Take me to Headshots").action, { type: "go", to: "issue", slug: "headshots" });
  // a family session by the water does have photographs on these walls: show them, and point to Families
  b.reply("plan a session"); b.reply("Family"); b.reply("The beach and the pier");
  const beach = b.reply("Golden hour");
  assert.ok(beach.cards.length >= 1 && beach.chips.includes("Take me to Families"));
  assert.match(beach.text, /Families exhibition has more/);
});

test("colours come from the measured palette, and prices are not made up", () => {
  const { b, m, issue } = brainFor("headshots");
  const red = b.reply("something red");
  assert.equal(red.action.type, "highlight");
  const reds = new Set(issue.palette.filter((c) => c.family === "red" || c.name === "Red").flatMap((c) => c.plates));
  assert.ok(red.action.plates.every((i) => reds.has(i)) && red.action.plates.length === reds.size);
  assert.ok(m.plates.length === 31);
  const price = b.reply("how much does it cost?");
  assert.match(price.text, /Rates aren't hung/);
  assert.equal(price.action, undefined);
});

test("navigation, settings and destinations", () => {
  const { b } = brainFor("headshots");
  assert.deepEqual(b.reply("take me to The Red Room").action, { type: "chapter", si: 0 });
  assert.deepEqual(b.reply("dark mode").action, { type: "pref", key: "theme", value: "dark" });
  assert.equal(b.reply("let me play").action.type, "play");
  assert.equal(b.reply("open the flipbook").action.to, "book");
  assert.equal(b.reply("walk the pier").action.to, "walk");
  assert.equal(b.reply("show me everything").action.type, "canvas");
  assert.equal(b.reply("book a session").action.type, "book");
  assert.match(b.reply("quantum chromodynamics").text, /only know what's on these walls/);
});
