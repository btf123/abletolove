#!/usr/bin/env python3
"""
Render reveal carousels from a plan JSON.

The heavy lifting (de-identifying the face) already happened in
prepare_library.py — the committed base images have the eye-strip baked in.
This step just lays the ROTATING copy on top: the tongue-in-cheek label on the
baked strip, and the engagement-bait question / dare / app CTA at the bottom.

Plan JSON:
{
  "slides": [
    {"base":"sequins.jpg","stripY0":179,"stripY1":300,"num":"1 / 2",
     "label":"RATE THEM. 1-10.","big":"How fit is this person? Give me a number.","swipe":true},
    {"base":"chair-cafe.jpg","stripY0":261,"stripY1":541,"num":"2 / 2",
     "label":"PLOT TWIST","kicker":"comment your number - i dare you to change it",
     "big":"Still a 10? Or did your thumb just hesitate?","pill":"Able2Love - Inclusive dating"}
  ],
  "out":"/abs/prefix"          # writes prefix_1.jpg, prefix_2.jpg
}

Usage: python3 render_reveal.py plan.json   (or pipe the JSON on stdin)
"""
import os
import sys
import json
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1350
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LIB = os.path.join(ROOT, "marketing", "brand-assets", "reveal-library")
FONTS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
]
FP = next((f for f in FONTS if os.path.exists(f)), None)


def font(s):
    return ImageFont.truetype(FP, s) if FP else ImageFont.load_default()


def wrap(d, text, f, maxw):
    out, cur = [], ""
    for wd in str(text).split():
        t = (cur + " " + wd).strip()
        if d.textlength(t, font=f) <= maxw:
            cur = t
        else:
            out.append(cur); cur = wd
    if cur:
        out.append(cur)
    return out


def label_on_strip(img, y0, y1, label):
    d = ImageDraw.Draw(img)
    f = font(40)
    # shrink to fit if the label is long
    while d.textlength(label, font=f) > W - 80 and f.size > 22:
        f = font(f.size - 2)
    tw = d.textlength(label, font=f)
    d.text(((W - tw) / 2, (y0 + y1) / 2 - f.size / 2 - 2), label, font=f, fill=(255, 255, 255))


def bottom(img, big, kicker=None, sub=None, pill=None, swipe=False):
    grad = Image.new("L", (1, H), 0)
    for y in range(H):
        t = (y / H - 0.5) / 0.5
        grad.putpixel((0, y), int(max(0, min(1, t)) ** 1.25 * 245))
    img.paste(Image.new("RGB", (W, H), (10, 5, 10)), (0, 0), grad.resize((W, H)))
    d = ImageDraw.Draw(img)
    y = H - 300
    if kicker:
        d.text((60, y), str(kicker).upper(), font=font(25), fill=(255, 200, 90)); y += 40
    for ln in wrap(d, big, font(64), W - 120):
        d.text((60, y), ln, font=font(64), fill=(255, 255, 255)); y += 72
    if sub:
        for ln in wrap(d, sub, font(34), W - 120):
            d.text((60, y + 6), ln, font=font(34), fill=(245, 210, 220)); y += 42
    if swipe:
        d.text((60, y + 10), "swipe  →", font=font(34), fill=(255, 200, 214))
    if pill:
        pf = font(26); tw = d.textlength(pill, font=pf)
        d.rounded_rectangle((60, y + 18, 60 + tw + 44, y + 18 + 52), radius=26, fill=(226, 51, 73))
        d.text((82, y + 31), pill, font=pf, fill=(255, 255, 255))
        d.text((60, y + 84), "Free on Google Play", font=font(26), fill=(255, 255, 255))


def top_num(img, txt):
    g = Image.new("L", (1, H), 0)
    for y in range(H):
        g.putpixel((0, y), int(max(0, 1 - y / 170) * 140))
    img.paste(Image.new("RGB", (W, H), (0, 0, 0)), (0, 0), g.resize((W, H)))
    ImageDraw.Draw(img).text((60, 48), txt, font=font(28), fill=(255, 255, 255))


def render_slide(slide):
    base = os.path.join(LIB, slide["base"])
    img = Image.open(base).convert("RGB")
    if img.size != (W, H):
        img = img.resize((W, H))
    top_num(img, slide.get("num", ""))
    label_on_strip(img, slide["stripY0"], slide["stripY1"], slide.get("label", ""))
    bottom(img, slide["big"], kicker=slide.get("kicker"), sub=slide.get("sub"),
           pill=slide.get("pill"), swipe=slide.get("swipe", False))
    return img


def render_plan(plan):
    out = plan["out"]
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    paths = []
    for i, slide in enumerate(plan["slides"], 1):
        img = render_slide(slide)
        p = f"{out}_{i}.jpg"
        img.save(p, quality=90)
        paths.append(p)
    return paths


def main():
    raw = open(sys.argv[1]).read() if len(sys.argv) > 1 else sys.stdin.read()
    plan = json.loads(raw)
    plans = plan if isinstance(plan, list) else [plan]
    for pl in plans:
        for p in render_plan(pl):
            print("wrote", p)


if __name__ == "__main__":
    main()
