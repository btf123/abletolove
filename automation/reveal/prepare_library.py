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
                    ("chair", "chair-headset.jpg", (0.155, 0.285)),
    # Same-picture reveals: chair fully visible in the full frame, but a tight
    # crop hides it (or leaves just an ordinary-chair hint). Eye bands are kept
    # TIGHT — the strip scales up with the slide-1 zoom, so extra height turns
    # into a huge bar across the face.
    "5.png":        ("chair", "pink-gig.jpg",     (0.275, 0.325)),
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
    "studio-black-0304.jpg": [0.455, 0.10, 0.795, 0.44],
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
    return im.crop((ox, oy, ox + W, oy + H)), s, ih, oy


def bake_strip(img, y0, y1):
    """Opaque near-black strip with brand-red edges. Returns (y0,y1) clamped."""
    y0, y1 = max(0, y0), min(H, y1)
    band = Image.new("RGB", (W, y1 - y0))
    px = band.load()
    for x in range(W):
        t = x / W
        col = (int(20 + 6 * t), 12, int(18 + 10 * t))
        for yy in range(y1 - y0):
            px[x, yy] = col
    img.paste(band, (0, y0))
    d = ImageDraw.Draw(img)
    d.rectangle((0, y0, W, y0 + 4), fill=(226, 51, 73))
    d.rectangle((0, y1 - 4, W, y1), fill=(226, 51, 73))
    return y0, y1


def main():
    src_dir = sys.argv[1] if len(sys.argv) > 1 else "."
    os.makedirs(OUT_DIR, exist_ok=True)
    manifest = {"sexy": [], "chair": []}
    MIN_STRIP = 56  # just enough to kill the eye line; big text no longer sits on the strip
    for src, (kind, out, eye) in ASSETS.items():
        p = os.path.join(src_dir, src)
        if not os.path.exists(p):
            print("MISSING source:", p)
            continue
        img, s, ih, oy = fit(p)
        # `eye` is one (y0,y1) band, or a LIST of bands for photos with other
        # (explicitly consenting) people in them — every face gets a bar, same
        # treatment as Brogan's. The FIRST band is his and carries the copy.
        bands = eye if isinstance(eye, list) else [eye]
        baked = []
        for band in bands:
            ey0 = int(band[0] * ih * s - oy)
            ey1 = int(band[1] * ih * s - oy)
            if ey1 - ey0 < MIN_STRIP:
                c = (ey0 + ey1) // 2
                ey0, ey1 = c - MIN_STRIP // 2, c + MIN_STRIP // 2
            baked.append(bake_strip(img, ey0 - 10, ey1 + 10))
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
