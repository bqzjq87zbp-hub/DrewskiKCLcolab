"""Build the exhibitions from tools/exhibitions.json.

    python tools/build_exhibitions.py

Writes, for every exhibition in that file:

    public/<slug>/img/<file>.jpg   web copies, 1600 px on the long edge. The ICC
                                   profile is kept and nothing else, matching the
                                   repository's metadata policy. Originals in
                                   public/media/ are only ever read.
    public/<slug>/issue.json       the page model the exhibition, the book and
                                   the atelier all read
and public/catalog.json, which the front door reads.

Colours are measured from the photographs (median cut on a small copy), so the
palette room and the finder's colour answers are facts about the pixels, not
descriptions. Unchanged inputs give byte-identical outputs.
"""
import colorsys
import json
import math
from html import escape
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUB = ROOT / "public"
LONG_EDGE = 1600
QUALITY = 82

# Names for measured colours. The nearest one (in Lab) labels a swatch.
NAMES = {
    "Ink": "#16171a", "Charcoal": "#3a3a3c", "Slate": "#5d6a73", "Stone": "#8e8b84", "Fog": "#c9ccc8",
    "Bone": "#e9e2d4", "Cream": "#f2ead6", "White": "#f6f6f3", "Sand": "#d7c19c", "Tan": "#b08a62",
    "Brown": "#6b4a33", "Umber": "#3f2a1f", "Gold": "#d9a441", "Sun": "#f2c94c", "Orange": "#e07b39",
    "Coral": "#e86f5a", "Red": "#c0392b", "Wine": "#7b2d36", "Rose": "#e3a1a8", "Blush": "#e9c5bd",
    "Plum": "#5e3a5f", "Lilac": "#b49fcc", "Sky": "#8fb4d4", "Ocean": "#2f6f86", "Navy": "#1f2b45",
    "Teal": "#2f7f7a", "Sage": "#9aa98a", "Leaf": "#5f7f3e", "Olive": "#6b6a3a", "Moss": "#4a5a32",
}


def hex_of(rgb):
    return "#%02x%02x%02x" % tuple(int(round(c)) for c in rgb)


def rgb_of(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def lab(rgb):
    def lin(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (lin(c) for c in rgb)
    x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047
    y = r * 0.2126 + g * 0.7152 + b * 0.0722
    z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883

    def f(t):
        return t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    fx, fy, fz = f(x), f(y), f(z)
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))


def de(a, b):
    return math.dist(lab(a), lab(b))


def family(rgb):
    """A plain-language colour family, for questions like 'something red'."""
    h, l, s = colorsys.rgb_to_hls(*(c / 255 for c in rgb))
    if s < 0.18 or l < 0.12 or l > 0.92:
        return "black" if l < 0.2 else "white" if l > 0.85 else "grey"
    deg = h * 360
    if l < 0.42 and 15 <= deg < 50:
        return "brown"
    if l < 0.4 and 50 <= deg < 75:
        return "green"    # dark yellows read as olive, not yellow
    for top, name in ((15, "red"), (45, "orange"), (68, "yellow"), (165, "green"), (255, "blue"), (290, "purple"), (335, "pink"), (361, "red")):
        if deg < top:
            return name
    return "red"


def name_of(rgb, taken=()):
    """Nearest colour name not already on the tray, so no two swatches share one."""
    return min((n for n in NAMES if n not in taken), key=lambda n: de(rgb, rgb_of(NAMES[n])))


def measure(im):
    """The photograph's main colours: up to three, distinct, biggest first."""
    small = im.copy()
    small.thumbnail((96, 96))
    q = small.convert("RGB").quantize(colors=8, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()
    counts = sorted(q.getcolors(), reverse=True)
    total = sum(c for c, _ in counts)
    picked = []
    for count, idx in counts:
        rgb = tuple(pal[idx * 3:idx * 3 + 3])
        if all(de(rgb, p[0]) > 14 for p in picked):
            picked.append((rgb, count / total))
        if len(picked) == 3:
            break
    return picked


def web_copy(src, dst):
    im = Image.open(src)
    icc = im.info.get("icc_profile")
    im = im.convert("RGB")
    im.thumbnail((LONG_EDGE, LONG_EDGE), Image.Resampling.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    kw = {"quality": QUALITY, "optimize": True, "progressive": True}
    if icc:
        kw["icc_profile"] = icc
    im.save(dst, "JPEG", **kw)
    return im


def exhibition_palette(plates):
    """Swatches for the palette room: the most characterful distinct colours
    across the exhibition, each with the plates that carry it."""
    pool = []
    for i, p in enumerate(plates):
        for rgb, share in p["_colours"]:
            _, l, s = colorsys.rgb_to_hls(*(c / 255 for c in rgb))
            pool.append((share * (0.35 + s) * (0.6 if l < 0.12 or l > 0.92 else 1), rgb, i))
    pool.sort(key=lambda t: -t[0])
    swatches = []
    for _, rgb, _i in pool:
        if all(de(rgb, rgb_of(s["hex"])) > 24 for s in swatches):
            swatches.append({"hex": hex_of(rgb), "name": name_of(rgb, {s["name"] for s in swatches}), "family": family(rgb)})
        if len(swatches) == 7:
            break
    for s in swatches:
        target = rgb_of(s["hex"])
        s["plates"] = [i for i, p in enumerate(plates) if any(de(target, rgb_of(c)) < 18 for c in p["palette"])]
    return swatches


FONTS = ("https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,100..900,0..100,0..1;"
         "1,9..144,100..900,0..100,0..1&amp;family=Instrument+Sans:ital,wdth,wght@0,75..100,400..700;1,75..100,400..700"
         "&amp;family=Pinyon+Script&amp;display=swap")
HEAD = """<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<link rel="icon" href="data:,">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{fonts}">""".replace("{fonts}", FONTS)
RING = ('<div class="pre-meta"><svg class="pre-ring" viewBox="0 0 26 26" aria-hidden="true"><circle class="bg" cx="13" cy="13" r="11"/>'
        '<circle cx="13" cy="13" r="11"/></svg><span class="pre-num">000</span></div>')
GSAP = "".join(f'<script src="{{up}}assets/vendor/{f}"></script>\n' for f in
               ("gsap.min.js", "ScrollTrigger.min.js", "SplitText.min.js", "Flip.min.js", "lenis.min.js"))


def a(s):
    return escape(str(s), quote=True)


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def front_door(site, issues):
    noscript = " ".join(f'<a style="color:#fff" href="/{i["slug"]}/book/">{a(i["mark"])}</a>' for i in issues)
    return f"""<!doctype html>
<html lang="en">
<head>
{HEAD}
<title>{a(site["title"])} · {a(site["studio"])}</title>
<meta name="description" content="{a(site["note"])}. Walk the pier, open an exhibition, turn the pages.">
<meta name="theme-color" content="#070707">
<meta property="og:title" content="{a(site["title"])} · {a(site["studio"])}">
<meta property="og:description" content="{a(site["note"])}">
<meta property="og:type" content="website">
<script src="assets/x/head.js"></script>
<link rel="stylesheet" href="assets/x/x.css">
</head>
<body class="ld">
<!-- Built from catalog.json by assets/x/landing.js. A new exhibition is a new
     entry in tools/exhibitions.json; this page grows a cover for it. -->
<div class="pre ld-pre" id="pre" role="status" aria-live="polite" aria-label="Loading the exhibitions">
  <div class="lock">
    <div class="lock-the">THE</div>
    <div class="lock-a">Kiyono</div>
    <div class="lock-and">creative lab</div>
    <div class="lock-c">EXHIBITIONS</div>
    {RING}
    <div class="ld-note">{a(site["note"])}</div>
  </div>
</div>
<div class="ld-bg" aria-hidden="true"></div>
<main class="ld-main" id="ld-main" hidden>
  <div class="ld-top">
    <a class="hd-wm ld-wm" href="/">EXHIBITIONS</a>
    <p class="ld-q">Choose which exhibition you want to explore</p>
    <div class="r">
      <button type="button" class="hd-btn snd-btn" aria-pressed="false" aria-label="Sound" data-magnetic="0.3"><span class="snd" aria-hidden="true"><i></i><i></i><i></i><i></i></span>Sound</button>
      <button type="button" class="hd-btn menu-btn" aria-haspopup="dialog" aria-controls="menu" data-magnetic="0.3">Menu</button>
    </div>
  </div>
  <div class="ld-pick"></div>
  <nav class="ld-more" aria-label="More ways in">
    <a href="/walk/" data-go="#061522" data-go-label="The Walk" data-preview="/video/walk-scrub.mp4" data-cursor="label" data-cursor-label="Walk">Walk the pier</a>
    <a href="mailto:{a(site["booking"])}?subject=Booking%20enquiry" data-cursor="label" data-cursor-label="Email">Book a session</a>
  </nav>
  <div class="ld-bot lbl">
    <span class="ld-count">&nbsp;</span>
    <span>{a(site["season"])}</span>
    <span class="r"><span data-live="place"></span> <span class="num" data-live="time"></span><br><span data-live="line"></span></span>
  </div>
</main>
<noscript><p style="padding:40px;color:#eee;font:16px/1.5 Georgia,serif">The exhibitions need JavaScript. The flat editions: {noscript}. Or <a style="color:#fff" href="/walk/">walk the pier</a>.</p></noscript>
<div class="grain" aria-hidden="true"></div>
{GSAP.replace("{up}", "")}<script type="module" src="assets/x/landing.js"></script>
</body>
</html>
"""


def exhibit_shell(ex, issue):
    var = f";--wm-var:{a(ex['variation'])}" if ex["variation"] else ""
    return f"""<!doctype html>
<html lang="en">
<head>
{HEAD}
<title>{a(ex["mark"])} · {a(ex["issue"])} · Kiyono Creative Lab</title>
<meta name="description" content="{a(ex["standfirst"])}">
<meta name="theme-color" content="{ex["hero"]}">
<meta property="og:title" content="{a(ex["mark"])} · {a(ex["issue"])}">
<meta property="og:description" content="{a(ex["standfirst"])}">
<meta property="og:type" content="website">
<script src="../assets/x/head.js"></script>
<link rel="stylesheet" href="../assets/x/x.css">
</head>
<body class="ex" style="--hero-base:{ex["hero"]};--hero-ink-base:{ex["heroInk"]};--acc:{ex["acc"]};--wm:{a(ex["font"])};--wm-weight:{ex["weight"]}{var}">
<!-- The exhibition is built at runtime from issue.json and /catalog.json by
     assets/x/exhibit.js. This shell is generated by tools/build_exhibitions.py
     and differs per exhibition only in the colours above, which are here so
     the very first paint (the preloader) is already in the exhibition's colour. -->
<div class="pre" id="pre" role="status" aria-live="polite" aria-label="Loading the exhibition">
  <div class="pre-lock">
    <div class="pre-wm">{a(ex["mark"])}</div>
    {RING}
  </div>
</div>
<div id="app"></div>
<noscript><p style="padding:40px;font:16px/1.5 Georgia,serif">This exhibition needs JavaScript to hang its photographs. <a href="book/">Read the flat edition</a> or <a href="/">go back to the front door</a>.</p></noscript>
{GSAP.replace("{up}", "../")}<script type="module" src="../assets/x/exhibit.js"></script>
</body>
</html>
"""


def book_shell(ex):
    return f"""<!doctype html><html lang="en"><head>
{HEAD}
<title>{a(ex["mark"])} · {a(ex["issue"])} · The Book</title>
<link rel="stylesheet" href="../../assets/flipbook.css">
</head><body data-root="../">
<div id="loading">Binding the exhibition</div>
<a id="home" href="../">The exhibition</a>
<a id="atelier" href="../atelier/">The Atelier</a>
<div id="stage"><div id="book"></div></div>
<div id="hint">drag a page corner to turn</div>
<div id="bar"><button id="prev" aria-label="Previous page">&lsaquo;</button>
<div id="ind">&nbsp;</div><button id="next" aria-label="Next page">&rsaquo;</button></div>
<script src="../../assets/stpageflip.js"></script>
<script src="../../assets/flipbook.js"></script>
</body></html>
"""


def atelier_shell(ex):
    return f"""<!doctype html><html lang="en"><head>
{HEAD}
<title>{a(ex["mark"])} · The Atelier</title>
<link rel="stylesheet" href="../../assets/atelier.css">
</head><body>
<canvas id="gl"></canvas>
<div id="vig"></div><div id="grain"></div>

<div id="hud">
  <div class="tl"><div class="kick" id="aMark">&nbsp;</div><div class="ttl" id="aTitle">&nbsp;</div></div>
  <div class="tr"><div class="ind" id="aInd">&nbsp;</div></div>
  <div class="hint">drag the left or right page to turn it &middot; drag the lamp to move the light</div>
  <a class="pill" id="toWardrobe" href="/walk/">Walk the pier</a>
  <div style="position:absolute;top:26px;left:50%;transform:translateX(-50%)">
    <a class="pill" id="toBook" href="../book/">The Book</a>
  </div>
</div>

<div id="desk">
  <h3>Lamp</h3>
  <div class="swatches" id="sw"></div>
  <div class="row"><label for="pw">Power</label><input id="pw" type="range" min="0" max="60" step="1" value="26"></div>
  <div class="row"><label for="ex">Exposure</label><input id="ex" type="range" min="40" max="180" step="1" value="100"></div>
  <div class="envs" id="envs">
    <div class="env on" data-h="studio_small_09">Studio</div>
    <div class="env" data-h="brown_photostudio_02">Warm</div>
  </div>
</div>

<div id="boot"><div>Binding the volume</div><div class="bar"><i></i></div></div>

<script type="importmap">
{{"imports":{{
  "three":"https://unpkg.com/three@0.185.1/build/three.module.js",
  "three/addons/":"https://unpkg.com/three@0.185.1/examples/jsm/"
}}}}
</script>
<script type="module">
import {{ start, setLampColour, setLampPower, setExposure, setEnvironment }} from "../../assets/atelier.js";

// A book that cannot render is worse than a fast one: fall back to the flat
// edition rather than showing a black screen.
function webgl(){{ try{{ const c=document.createElement("canvas");
  return !!(window.WebGLRenderingContext && (c.getContext("webgl2")||c.getContext("webgl"))); }}
  catch(e){{ return false; }} }}
if(!webgl()){{ location.replace(location.pathname.replace(/\\/atelier\\/?$/, "") + "/book/?nogl=1"); }}

const COLOURS = ["#ffd9a0","#fff3e2","{ex["acc"]}","#e0533d","#4f7fd6","#4fd6a8","#c86bd6","#f2c94c"];
const sw = document.getElementById("sw");
COLOURS.forEach(function(c,i){{
  const d=document.createElement("div");
  d.className="sw"+(i===0?" on":""); d.style.background=c; d.title=c;
  d.onclick=function(){{ setLampColour(c);
    sw.querySelectorAll(".sw").forEach(function(x){{x.classList.remove("on")}});
    d.classList.add("on"); }};
  sw.appendChild(d);
}});
document.getElementById("pw").oninput = function(e){{ setLampPower(+e.target.value); }};
document.getElementById("ex").oninput = function(e){{ setExposure(+e.target.value/100); }};
document.getElementById("envs").onclick = function(e){{
  const t=e.target.closest(".env"); if(!t) return;
  document.querySelectorAll(".env").forEach(function(x){{x.classList.remove("on")}});
  t.classList.add("on");
  setEnvironment(t.dataset.h);
}};

start({{}}).catch(function(err){{
  const b=document.getElementById("boot");
  b.className="err"; b.textContent="The Atelier could not start: "+err.message;
}});
</script>
</body></html>
"""


def main():
    src = json.loads((ROOT / "tools" / "exhibitions.json").read_text(encoding="utf-8"))
    cats = json.loads((PUB / "categories.json").read_text(encoding="utf-8"))
    items = {c["id"]: {i["id"]: i for i in c["items"]} for c in cats["categories"]}
    site = src["site"]
    catalog = {"site": {k: v for k, v in site.items()}, "issues": []}

    for ex in src["exhibitions"]:
        slug, pool = ex["slug"], items[ex["category"]]
        plates, stories, cover = [], [], None
        for st in ex["stories"]:
            out = {"title": st["title"], "deck": st["deck"], "mood": st["mood"], "plates": []}
            for p in st["plates"]:
                item = pool[p["id"]]
                source = PUB / item["full"].lstrip("/")
                name = Path(item["full"]).name
                im = web_copy(source, PUB / slug / "img" / name)
                colours = measure(im)
                plate = {
                    "id": p["id"], "img": "img/" + name, "kicker": p["kicker"], "caption": p["caption"],
                    "w": im.width, "h": im.height, "palette": [hex_of(c) for c, _ in colours], "_colours": colours,
                }
                if p["id"] == ex["cover"]:
                    cover = plate["img"]
                plates.append(plate)
                out["plates"].append(plate)
            stories.append(out)
        assert cover, f"{slug}: cover {ex['cover']} is not one of its plates"
        palette = exhibition_palette(plates)
        for p in plates:
            del p["_colours"]

        acc = ex["acc"]
        issue = {
            "title": f"{ex['mark']} · {ex['issue']}",
            "issue": ex["issue"], "mark": ex["mark"], "cover": cover,
            "standfirst": ex["standfirst"], "footer": ex["footer"], "backline": ex["backline"],
            "theme": {"mark": ex["mark"], "paper": "#f3eee4", "ink": "#1d1913", "acc": acc, "acc2": ex["heroInk"],
                      "edge": "#d8d0c2", "deep": "#0d0c0b", "display": "'Fraunces', Georgia, serif",
                      "mono": "'Instrument Sans', 'Helvetica Neue', Arial, sans-serif"},
            "stories": stories,
            "palette": palette,
            "exhibit": {
                "wordmark": ex["mark"], "font": ex["font"], "weight": ex["weight"], "variation": ex["variation"],
                "hero": ex["hero"], "heroInk": ex["heroInk"], "acc": acc, "intro": ex["intro"],
                "place": site["place"], "almanac": "sun", "sound": ex["sound"], "game": "skip",
                "booking": site["booking"],
            },
        }
        write(PUB / slug / "issue.json", json.dumps(issue, ensure_ascii=False, indent=2) + "\n")
        write(PUB / slug / "index.html", exhibit_shell(ex, issue))
        write(PUB / slug / "book" / "index.html", book_shell(ex))
        write(PUB / slug / "atelier" / "index.html", atelier_shell(ex))
        catalog["issues"].append({
            "slug": slug, "title": issue["title"], "issue": ex["issue"], "mark": ex["mark"],
            "plates": len(plates), "cover": f"{slug}/{cover}", "font": ex["font"], "weight": ex["weight"],
            "variation": ex["variation"], "hero": ex["hero"], "heroInk": ex["heroInk"], "acc": acc, "blurb": ex["blurb"],
        })
        print(f"{slug}: {len(plates)} plates, {len(stories)} chapters, swatches {[s['name'] for s in palette]}")

    write(PUB / "catalog.json", json.dumps(catalog, ensure_ascii=False, indent=2) + "\n")
    write(PUB / "index.html", front_door(site, catalog["issues"]))


if __name__ == "__main__":
    main()
