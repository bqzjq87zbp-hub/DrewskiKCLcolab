/* The finder's brain: a local intent engine over the exhibition's own data.
 *
 * Not a language model, and it says so. It reads the question for things it
 * can act on (a chapter, a colour, a place, a setting, a destination) and
 * answers from issue.json, with an action the page runs. It also runs the
 * session planner: three questions, then the closest photographs already on
 * the walls and a booking email that carries the answers in its subject.
 * Pure: no DOM, unit-tested.
 *
 * reply(text) -> { text, cards?, chips?, action? }
 *   cards   [{ plate: i }]
 *   action  { type: "chapter"|"canvas"|"section"|"go"|"pref"|"play"|"highlight"|"book", ... }
 */

const STOP = new Set("a an the and or of in on at to for with me my i you your is are was be it this that show find want some any please can could would do does what where which who how get see look like one".split(" "));

export const tokens = (s) => String(s || "").toLowerCase().replace(/[’']/g, "").split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t));
const has = (text, words) => words.some((w) => new RegExp(`\\b${w}\\b`, "i").test(text));

/** The kinds of session, and the exhibition that shows each one. */
export const SESSIONS = [
  { slug: "branding", label: "Branding", words: /brand|product|business|campaign|apparel|commercial/ },
  { slug: "families", label: "Family", words: /famil|kid|child|baby|newborn|couple|maternity|parent/ },
  { slug: "headshots", label: "Headshots", words: /headshot|portrait|professional|linkedin|corporate|team/ },
  { slug: "coastal", label: "Coastal", words: /coast|beach|ocean|pier|surf|sea\b/ },
];
const PLACES = [
  { label: "The beach and the pier", words: /beach|pier|sand|shore|surf|ocean|water|coast|bodyboard|gull/ },
  { label: "Outdoors, under trees or in the hills", words: /tree|hill|grass|park|outdoor|outside|field|open sky/ },
  { label: "In a studio", words: /studio|backdrop|background|brick|timber panel|graphic wall/ },
  { label: "Where you work", words: /work|office|shop|location|environment|event|scrubs|hospitality|retail/ },
];
const LIGHT = [
  { label: "Golden hour", words: /evening|dusk|golden|sunset/ },
  { label: "Blue hour", words: /dusk|evening|silhouett|neon/ },
  { label: "Daylight", words: /sky|sun|bright|daylight|shoreline/ },
  { label: "No preference", words: null },
];
/** Plain colour words, mapped to the families the build script measured. */
const FAMILY = {
  red: "red", crimson: "red", scarlet: "red", orange: "orange", yellow: "yellow", gold: "yellow", green: "green",
  olive: "green", blue: "blue", navy: "blue", teal: "blue", purple: "purple", violet: "purple", pink: "pink",
  brown: "brown", tan: "brown", black: "black", white: "white", grey: "grey", gray: "grey",
};

const pick = (list, text) => {
  const t = String(text || "").toLowerCase();
  const byLabel = list.findIndex((x) => t.includes(x.label.toLowerCase()));
  return byLabel >= 0 ? byLabel : list.findIndex((x) => x.words && x.words.test(t));
};

export function makeBrain(d) {
  const state = { flow: null, step: 0, answers: {}, booking: null };
  const P = d.plates, S = d.stories, C = d.palette || [];
  const here = Math.max(0, SESSIONS.findIndex((s) => s.slug === d.slug));
  const subject = () => state.booking || `Booking enquiry: ${d.mark}`;

  const intro = () => ({
    text: `I'm this exhibition, answering from its own walls. Ask for a place, a colour or a chapter, or plan a session and I'll write the booking email for you.`,
    chips: ["Plan a session", S[0] ? `Take me to ${S[0].title}` : "Show me everything", C[0] ? `Something ${C[0].name.toLowerCase()}` : "Show me everything", "Dark mode", "Play"],
  });

  function planFlow(text) {
    if (state.step === 0) {
      state.flow = "plan"; state.step = 1; state.answers = {};
      return { text: "Three questions. First: what kind of session?", chips: SESSIONS.map((s) => s.label) };
    }
    if (state.step === 1) {
      const si = pick(SESSIONS, text);
      state.answers.session = si >= 0 ? si : here;
      state.step = 2;
      return { text: `${SESSIONS[state.answers.session].label}. Good. Where would you like it?`, chips: PLACES.map((p) => p.label) };
    }
    if (state.step === 2) {
      const pi = pick(PLACES, text);
      state.answers.place = pi >= 0 ? pi : 0;
      state.step = 3;
      return { text: "Last one. What light?", chips: LIGHT.map((l) => l.label) };
    }
    const li = pick(LIGHT, text);
    state.answers.light = li >= 0 ? li : LIGHT.length - 1;
    state.flow = null; state.step = 0;
    return plan(state.answers);
  }

  function plan(a) {
    const s = SESSIONS[a.session], place = PLACES[a.place], light = LIGHT[a.light];
    const lightText = light.words ? `at ${light.label.toLowerCase()}` : "in whatever light the day brings";
    state.booking = `Booking enquiry: ${s.label} session, ${place.label.toLowerCase()}, ${light.words ? light.label.toLowerCase() : "any light"}`;
    // photographs on these walls made in that place, whichever exhibition this is
    const cards = P.map((p) => {
      const hay = `${p.kicker} ${p.caption} ${p.storyTitle}`.toLowerCase();
      return { p, sc: place.words.test(hay) ? 2 + (light.words && light.words.test(hay) ? 1 : 0) : 0 };
    }).filter((x) => x.sc > 0).sort((x, y) => y.sc - x.sc || x.p.i - y.p.i).slice(0, 3).map((x) => ({ plate: x.p.i }));
    const other = s.slug !== d.slug ? (d.other || []).find((o) => o.slug === s.slug) : null;
    const seen = cards.length ? `Here is what that has looked like on these walls${other ? `, and the ${other.mark} exhibition has more` : ""}.`
      : other ? `The ${other.mark} exhibition shows that kind of work.` : "Nothing on these walls matches all three, so the session will be a first.";
    return {
      text: `A ${s.label.toLowerCase()} session, ${place.label.toLowerCase()}, ${lightText}. ${seen} When you're ready I'll start the email, with your answers already in the subject line.`,
      cards,
      chips: ["Email the booking"].concat(other ? [`Take me to ${other.mark}`] : [], ["Plan another"]),
      action: cards.length ? { type: "highlight", plates: cards.map((c) => c.plate) } : null,
    };
  }

  function reply(raw) {
    const text = String(raw || "").trim();
    const t = text.toLowerCase();
    if (!text) return intro();
    if (state.flow === "plan") return planFlow(text);

    // settings the site can change for you
    if (has(t, ["dark mode", "dark", "night mode"]) && !has(t, ["after dark"])) return { text: "Lights down.", action: { type: "pref", key: "theme", value: "dark" } };
    if (has(t, ["light mode", "day mode"]) || (has(t, ["light"]) && !/hour|light (through|on)|neon|clean light|what light/.test(t))) return { text: "Lights up.", action: { type: "pref", key: "theme", value: "light" } };
    if (has(t, ["mute", "quiet", "silence", "sound off"])) return { text: "Quiet it is.", action: { type: "pref", key: "sound", value: "off" } };
    if (has(t, ["sound on", "sound", "music", "audio", "unmute"])) return { text: "Sound on. It follows the walls: darker chapters, darker sound.", action: { type: "pref", key: "sound", value: "on" } };
    if (has(t, ["calm", "reduce motion", "less motion", "stop animations", "motion sick"])) return { text: "Calmer now. Everything still works, it just moves less.", action: { type: "pref", key: "motion", value: "calm" } };
    if (has(t, ["full motion", "more motion", "animations on"])) return { text: "Full motion.", action: { type: "pref", key: "motion", value: "full" } };
    if (has(t, ["low power", "battery", "effects off", "no webgl"])) return { text: "Low power: the paper effects and the hall step aside.", action: { type: "pref", key: "effects", value: "off" } };

    // the session planner and the booking email
    if (/plan (a |my |another )?(session|shoot)|plan another|help me (choose|pick|plan)|what (session|kind)/.test(t)) { state.step = 0; return planFlow(text); }
    if (/price|pricing|cost|rates?\b|quote|how much/.test(t)) {
      return { text: "Rates aren't hung on these walls. Tell the studio what you have in mind and they'll come back with one.", chips: ["Plan a session", "Email the booking"] };
    }
    if (/email the booking|book (a |me |us |my )?(session|shoot|time|in)|booking|^book$|contact|get in touch|hire|reach (you|the studio)/.test(t)) {
      return { text: "Opening an email to the studio.", action: { type: "book", subject: subject() } };
    }

    // destinations
    if (has(t, ["play", "game", "skip", "stone", "bored"])) return { text: "Skip a stone off the pier. Hold, then let go.", action: { type: "play" } };
    if (/\bthe book\b|flipbook|flat edition|turn the pages/.test(t)) return { text: "The flat edition, page by page.", action: { type: "go", to: "book" } };
    if (has(t, ["atelier", "3d", "real book"])) return { text: "The atelier: the exhibition as a real book, under a lamp.", action: { type: "go", to: "atelier" } };
    for (const o of d.other || []) if (t.includes(o.mark.toLowerCase()) || t.includes(o.slug)) return { text: `Over to ${o.mark}.`, action: { type: "go", to: "issue", slug: o.slug } };
    if (has(t, ["home", "front door", "all exhibitions", "other exhibitions", "back"])) return { text: "Back to the front door.", action: { type: "go", to: "home" } };
    if (has(t, ["everything", "all photos", "all the photos", "wall", "canvas", "overview"])) return { text: "Every photograph, on a wall with no edges. Drag around.", action: { type: "canvas" } };
    if (has(t, ["hall", "gallery"])) return { text: "Walk the hall. Scroll is your feet.", action: { type: "section", id: "hall" } };
    if (has(t, ["contents", "chapters", "index", "table of contents"])) return { text: "The chapters, wall to wall.", action: { type: "section", id: "contents" }, chips: S.map((s) => s.title) };
    if (has(t, ["palette", "colours", "colors", "swatches"])) return { text: "The palette: every colour measured from these photographs. You can throw the swatches.", action: { type: "section", id: "palette" } };

    // a chapter named outright wins over any colour in its title ("The Red Room")
    const named = S.findIndex((s) => t.includes(s.title.toLowerCase()));
    if (named >= 0) {
      const s = S[named];
      return { text: `${s.title}. ${s.deck}`, action: { type: "chapter", si: named }, cards: s.plates.slice(0, 3).map((i) => ({ plate: i })) };
    }

    // colours, from what the build script measured in the photographs
    const qt = tokens(t);
    const hits = C.filter((c) => qt.some((w) => c.name.toLowerCase() === w || FAMILY[w] === c.family));
    if (hits.length) {
      const plates = [...new Set(hits.flatMap((c) => c.plates))].sort((a, b) => a - b);
      if (plates.length) {
        const names = hits.map((c) => c.name.toLowerCase()).join(" and ");
        return {
          text: `${plates.length > 1 ? "These photographs carry" : "This photograph carries"} ${names}, measured from the pixels. ${plates.length > 1 ? "They're" : "It's"} picked out on the wall.`,
          cards: plates.slice(0, 3).map((i) => ({ plate: i })),
          action: { type: "highlight", plates },
          chips: ["Plan a session", "Show me the palette"],
        };
      }
    }

    // chapters by name or by their words
    let bestS = -1, bestScore = 0;
    S.forEach((s, si) => {
      const title = tokens(s.title), deck = tokens(s.deck);
      let sc = 0;
      for (const w of qt) { if (title.includes(w)) sc += 3; else if (deck.includes(w)) sc += 1; }
      if (t.includes(s.title.toLowerCase())) sc += 5;
      if (sc > bestScore) { bestScore = sc; bestS = si; }
    });

    // plates by place, time or detail
    const scored = P.map((p) => {
      const kt = tokens(p.kicker), ct = tokens(p.caption);
      let sc = 0;
      for (const w of qt) { if (kt.includes(w)) sc += 3; else if (ct.some((c) => c === w || (w.length > 3 && c.startsWith(w)))) sc += 1; }
      return { p, sc };
    }).filter((x) => x.sc > 0).sort((a, b) => b.sc - a.sc);

    if (bestS >= 0 && bestScore >= 3 && (!scored.length || bestScore >= scored[0].sc)) {
      const s = S[bestS];
      return { text: `${s.title}. ${s.deck}`, action: { type: "chapter", si: bestS }, cards: s.plates.slice(0, 3).map((i) => ({ plate: i })) };
    }
    if (scored.length) {
      const top = scored.slice(0, 3);
      const p = top[0].p;
      return {
        text: top.length === 1 ? `${p.kicker}. ${p.caption}` : `The frames that match are picked out on the wall. The closest is ${p.kicker}: ${p.caption}`,
        cards: top.map((x) => ({ plate: x.p.i })),
        action: { type: "highlight", plates: scored.map((x) => x.p.i) },
      };
    }
    if (bestS >= 0 && bestScore > 0) {
      const s = S[bestS];
      return { text: `Closest is ${s.title}. ${s.deck}`, action: { type: "chapter", si: bestS } };
    }
    if (has(t, ["hi", "hello", "hey", "help", "what can you do", "who are you"])) return intro();
    return { text: `I only know what's on these walls, and I couldn't find that here. Try a place, a colour or a chapter, or plan a session.`, chips: ["Plan a session", ...S.slice(0, 3).map((s) => s.title)] };
  }

  return { reply, intro, state };
}
