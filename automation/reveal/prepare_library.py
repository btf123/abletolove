#!/usr/bin/env python3
"""
DEV-TIME TOOL (run by hand, not in CI).

Turns Brogan's raw source photos into the committed reveal library:
  - cover-fits each photo to the 1080x1350 carousel frame,
  - BAKES an opaque strip over the eyes at a hand-verified position, so the
    committed asset is already de-identified (eyes never appear in the repo or
    in a post) while the rest of the face — lips, jaw, expression, styling —
    stays visible, which is what makes the "is this person attractive?" hook
    work,
  - records each asset's baked strip position in reveal-library.json so the
    render step can drop the rotating caption exactly on the strip.

The raw source photos (which still show the eyes) are NEVER committed; only the
eyes-baked 1080x1350 bases go into marketing/brand-assets/reveal-library/.

Usage:  python3 automation/reveal/prepare_library.py /path/to/source/photos
"""
import os
import sys
import json
from PIL import Image, ImageDraw

W, H = 1080, 1350
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_DIR = os.path.join(ROOT, "marketing", "brand-assets", "reveal-library")

# source filename -> (kind, out name, eye band as SOURCE fractions (y0,y1))
# eye fractions were verified by zooming into each rendered head.
ASSETS = {
    "Shot3.jpg":    ("sexy",  "sequins.jpg",      (0.14, 0.215)),
    "live1.jpg":    ("sexy",  "stage.jpg",        (0.12, 0.26)),
    "44429804_321766475280726_2978850043601092608_n.jpg":
                    ("chair", "chair-cafe.jpg",   (0.22, 0.40)),
    "44359190_1619180541520899_4354854992830529536_n.jpg":
                    ("chair", "chair-headset.jpg", [(0.155, 0.285), (0.03, 0.075)]),
    # Same-picture reveals: chair fully visible in the full frame, but a tight
    # crop hides it (or leaves just an ordinary-chair hint). Eye bands are kept
    # TIGHT — the strip scales up with the slide-1 zoom, so extra height turns
    # into a huge bar across the face.
    "5.png":        ("chair", "pink-gig.jpg",     [(0.275, 0.325), (0.105, 0.16)]),
    "52326975_10218986247033688_2438881901834928128_o-sharpen-focus.png":
                    ("chair", "neon-studs.jpg",   (0.27, 0.35)),
    # Studio shoot (seamless white, open pink jacket, powerchair fully visible).
    # The flagship same-picture frame.
    "305A0467.jpg": ("chair", "studio-pink-0467.jpg", (0.265, 0.295)),
    # Black-outfit studio upright: boots up on the seat, legs over the armrest,
    # full powerchair on seamless white.
    "305A0312_result.jpg": ("chair", "studio-black-0312.jpg", (0.095, 0.135)),
    # Black lounge: legs over the armrest, chin lifted — the most conventionally
    # sexy frame of the black set.
    "305A0304.jpg": ("chair", "studio-black-0304.jpg", (0.263, 0.295)),
    # Pink jacket open, bare torso, direct gaze; joystick + both armrests
    # visible in the full frame.
    "305A0440.jpg": ("chair", "studio-pink-0440.jpg", (0.20, 0.24)),
    # OUT AND ABOUT WITH PEOPLE (consent confirmed by Brogan for all friends
    # shown; every face gets a worded bar). Gig night: him performing in the
    # powerchair, crowd at the tables.
    "2.png":        ("friends", "gig-crowd-1.jpg", [(0.295, 0.36), (0.10, 0.16)]),
    "SnapShot.png": ("friends", "gig-crowd-2.jpg", [(0.305, 0.375), (0.10, 0.16)]),
}

# For chair images where a tight head+torso crop hides the wheelchair (so
# slide 1 reads as an ordinary seated portrait, then slide 2 shows the full
# picture): the crop box in fractions of the finished 1080x1350 base.
# Verified against the base so the wheels/frame/footplate fall outside it.
CLOSECROP = {
    # (chair-headset dropped from same-picture duty: the head sits too high to
    # crop well, and the dim pub shot isn't a slide-1 "sexy" frame anyway.)
    # face centred, top of the seat back reads as a normal chair; joystick,
    # wheels and motor all fall below/left of the box.
    "pink-gig.jpg": [0.41, 0.16, 0.81, 0.58],
    # chest-up: fierce face + open jacket; both joysticks (y~0.49 of the base)
    # and all chair hardware fall below the box.
    "studio-pink-0467.jpg": [0.40, 0.06, 0.80, 0.46],
    # head + shoulders + top of the seat back (reads as an ordinary chair);
    # boots, wheels and frame all fall outside.
    "studio-black-0312.jpg": [0.50, 0.02, 0.90, 0.35],
    # face + shoulders + black tee; armrest/joystick (left, below y~0.40) out.
    "studio-black-0304.jpg": [0.55, 0.06, 0.99, 0.47],
    # face + open jacket chest; joystick and armrests (below y~0.5, sides) out.
    "studio-pink-0440.jpg": [0.29, 0.04, 0.75, 0.50],
    # (neon-studs pulled from rotation: the joystick is too subtle in the full
    # frame — Brogan: "you can't even see the wheelchair" — so the reveal
    # doesn't land. The base stays in the library for other card uses.)
}


def fit(path):
    im = Image.open(path).convert("RGB")
    iw, ih = im.size
    s = max(W / iw, H / ih)
    im = im.resize((int(iw * s + .5), int(ih * s + .5)), Image.LANCZOS)
    ox, oy = (im.width - W) // 2, (im.height - H) // 2
    return im.crop((ox, oy, ox + W, oy + H)), s, iw, ih, ox, oy


import numpy as np
from PIL import ImageFont, ImageChops
def _resolve_font():
    d = os.path.join(ROOT, "marketing", "brand-assets", "fonts")
    try:
        for f in sorted(os.listdir(d)):
            if f.lower().endswith((".ttf", ".otf")):
                return os.path.join(d, f)
    except Exception:
        pass
    return "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_PATH = _resolve_font()

# Studio shots on seamless WHITE. A multiply-blend brand gradient turns the
# white background into brand colour (white x colour = colour) while leaving the
# subject mostly intact (dark stays dark) — an on-brand look with NO cutout and
# no halo artifacts. Brogan: "cut out the background and replace with our
# beautiful colours."
STUDIO = {"studio-pink-0467.jpg", "studio-black-0312.jpg",
          "studio-black-0304.jpg", "studio-pink-0440.jpg"}

# Face x-range (fractions of the SOURCE) for the SHORT Cops-style eye bar — the
# bar only spans the face, not the whole image width.
EYEX = {
    "studio-pink-0467.jpg": (0.50, 0.69),
    "studio-black-0312.jpg": (0.63, 0.79),
    "studio-black-0304.jpg": (0.70, 0.85),
    "studio-pink-0440.jpg": (0.39, 0.65),
}


def brand_multiply(img):
    """Recolour a white studio background with the brand gradient (multiply)."""
    w, h = img.size
    xs = np.linspace(0, 1, w)[None, :]
    ys = np.linspace(0, 1, h)[:, None]
    r = (255 + (196 - 255) * xs) * np.ones((h, 1))
    g = (128 + (74 - 128) * ((xs + ys) / 2))
    b = (150 + (232 - 150) * xs) * np.ones((h, 1))
    grad = np.dstack([r, g, b]).astype(np.uint8)
    return ImageChops.multiply(img, Image.fromarray(grad, "RGB"))


def short_bar(img, x0, x1, y0, y1):
    """A SHORT brand-gradient eye bar (Cops-style) spanning only the face, with
    rounded ends and a gold hairline. No baked text — the render adds the
    rotating phrase. Returns (x0,x1,y0,y1) clamped, in canvas px."""
    x0, x1 = max(0, int(x0)), min(W, int(x1))
    y0, y1 = max(0, int(y0)), min(H, int(y1))
    bw, bh = x1 - x0, y1 - y0
    band = Image.new("RGB", (bw, bh))
    px = band.load()
    for x in range(bw):
        t = x / max(1, bw)
        col = (int(226 + (178 - 226) * t), int(51 + (58 - 51) * t), int(73 + (216 - 73) * t))
        for yy in range(bh):
            px[x, yy] = col
    # HARD-EDGED bar (Brogan: simple hard edges, no rounding), gold hairline
    img.paste(band, (x0, y0))
    d = ImageDraw.Draw(img)
    d.rectangle((x0, y0, x1 - 1, y1 - 1), outline=(255, 214, 90), width=3)
    return x0, x1, y0, y1


def bake_strip(img, y0, y1, text=None):
    """The eye bar — brand iconography, not a censor block (Brogan's rule).
    ALWAYS the brand gradient (red->magenta->purple) with a thin gold hairline,
    never black. Thin: only over the eyes. Carries words in two tiers when given
    a 'text' that contains ' | ' (post hook | app tag). Returns (y0,y1) clamped.
    A wordless bar (reveal primary band, gets render-time copy) is still the
    brand gradient so white copy pops on-brand."""
    y0, y1 = max(0, y0), min(H, y1)
    band = Image.new("RGB", (W, y1 - y0))
    px = band.load()
    for x in range(W):
        t = x / W
        # red (E23349) -> magenta (B23AD8) across the bar
        col = (int(226 + (178 - 226) * t), int(51 + (58 - 51) * t), int(73 + (216 - 73) * t))
        for yy in range(y1 - y0):
            px[x, yy] = col
    img.paste(band, (0, y0))
    d = ImageDraw.Draw(img)
    d.rectangle((0, y0, W, y0 + 3), fill=(255, 214, 90))
    d.rectangle((0, y1 - 3, W, y1), fill=(255, 214, 90))
    if text and y1 - y0 >= 30:
        hook, _, tag = str(text).partition(" | ")
        h = y1 - y0
        if tag:  # two tiers: bold hook + small app tag
            fh = ImageFont.truetype(FONT_PATH, min(30, int(h * 0.42)))
            while d.textlength(hook, font=fh) > W - 60 and fh.size > 13:
                fh = ImageFont.truetype(FONT_PATH, fh.size - 2)
            ft = ImageFont.truetype(FONT_PATH, max(12, int(fh.size * 0.6)))
            th = fh.size + ft.size + 4
            ty = (y0 + y1) / 2 - th / 2
            d.text(((W - d.textlength(hook, font=fh)) / 2, ty), hook, font=fh, fill=(255, 255, 255))
            d.text(((W - d.textlength(tag, font=ft)) / 2, ty + fh.size + 3), tag, font=ft, fill=(255, 226, 236))
        else:
            f = ImageFont.truetype(FONT_PATH, min(28, h - 12))
            while d.textlength(hook, font=f) > W - 60 and f.size > 13:
                f = ImageFont.truetype(FONT_PATH, f.size - 2)
            d.text(((W - d.textlength(hook, font=f)) / 2, (y0 + y1) / 2 - f.size * 0.6), hook,
                   font=f, fill=(255, 255, 255))
    return y0, y1


# Words baked into bars — the "test" (post hook | app tag), the two jobs Brogan
# wants in the eye box: the swipe hook, plus a line connecting it to the app.
BAR_WORDS = [
    "SMASH OR PASS? | swipe to meet them on Able2Love",
    "YES OR NO? | Able2Love · inclusive dating",
    "WOULD YOU? | find out on Able2Love",
    "HOT OR NOT? | Able2Love · first of its kind",
    "LEFT OR RIGHT? | your type is on Able2Love",
]


def main():
    src_dir = sys.argv[1] if len(sys.argv) > 1 else "."
    os.makedirs(OUT_DIR, exist_ok=True)
    manifest = {"sexy": [], "chair": [], "friends": []}
    MIN_STRIP = 52  # thin: just the eye line, with room for two-tier bar text
    for src, (kind, out, eye) in ASSETS.items():
        p = os.path.join(src_dir, src)
        if not os.path.exists(p):
            print("MISSING source:", p)
            continue
        img, s, iw, ih, ox, oy = fit(p)

        if out in STUDIO:
            # brand-gradient background + SHORT eye bar (the new reveal look)
            img = brand_multiply(img)
            band = eye if not isinstance(eye, list) else eye[0]
            ey0 = int(band[0] * ih * s - oy)
            ey1 = int(band[1] * ih * s - oy)
            if ey1 - ey0 < 46:
                c = (ey0 + ey1) // 2; ey0, ey1 = c - 23, c + 23
            fx0, fx1 = EYEX.get(out, (0.35, 0.65))
            ex0 = fx0 * iw * s - ox
            ex1 = fx1 * iw * s - ox
            pad = (ex1 - ex0) * 0.10
            bx0, bx1, by0, by1 = short_bar(img, ex0 - pad, ex1 + pad, ey0 - 16, ey1 + 16)
            img.save(os.path.join(OUT_DIR, out), quality=90)
            entry = {"file": out, "stripY0": by0, "stripY1": by1,
                     "eyeX0": bx0, "eyeX1": bx1}
            if out in CLOSECROP:
                entry["closeCrop"] = CLOSECROP[out]
            manifest[kind].append(entry)
            print(f"baked {out}  kind={kind} STUDIO  bar x{bx0}-{bx1} y{by0}-{by1}")
            continue

        # legacy full-width worded bars (non-studio backdrops / with-people)
        bands = eye if isinstance(eye, list) else [eye]
        baked = []
        for bi, band in enumerate(bands):
            words = BAR_WORDS[bi % len(BAR_WORDS)] if (kind == "friends" or bi > 0 or out not in CLOSECROP) else None
            ey0 = int(band[0] * ih * s - oy)
            ey1 = int(band[1] * ih * s - oy)
            if ey1 - ey0 < MIN_STRIP:
                c = (ey0 + ey1) // 2
                ey0, ey1 = c - MIN_STRIP // 2, c + MIN_STRIP // 2
            baked.append(bake_strip(img, ey0 - 7, ey1 + 7, text=words))
        y0, y1 = baked[0]
        img.save(os.path.join(OUT_DIR, out), quality=90)
        entry = {"file": out, "stripY0": y0, "stripY1": y1}
        if len(baked) > 1:
            entry["extraStrips"] = [[a, b] for a, b in baked[1:]]
        if out in CLOSECROP:
            entry["closeCrop"] = CLOSECROP[out]
        manifest[kind].append(entry)
        print(f"baked {out}  kind={kind}  strip={y0}-{y1}px")
    with open(os.path.join(OUT_DIR, "reveal-library.json"), "w") as f:
        json.dump(manifest, f, indent=2)
    print("wrote reveal-library.json:", {k: len(v) for k, v in manifest.items()})


if __name__ == "__main__":
    main()
