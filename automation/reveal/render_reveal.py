#!/usr/bin/env python3
"""
Render reveal carousels that RESEMBLE a dating-app profile card, so the viewer's
thumb itches to swipe — then slide 2 reveals the person is disabled.

De-identification already happened in prepare_library.py (an opaque strip is
baked over the eyes in the committed bases). This step lays on:
  - a generic dating-app swipe UI (rewind / nope ✕ / super-like ★ / like ♥ /
    boost ⚡ buttons) — deliberately NOT any real app's logo or wordmark,
  - a blunt binary prompt ("Smash or pass?", "Hot or not?"),
  - on slide 2, the reveal line + a small Able2Love CTA.

Plan JSON (one object or a list):
{
  "slides":[
    {"base":"sequins.jpg","stripY0":179,"stripY1":300,"num":"1 / 2",
     "prompt":"Smash or pass?"},
    {"base":"chair-cafe.jpg","stripY0":261,"stripY1":541,"num":"2 / 2",
     "prompt":"Smash or pass now?","sub":"They use a wheelchair. Same person.",
     "kicker":"swipe left. i dare you.","cta":"Able2Love · free on Google Play"}
  ],
  "out":"/abs/prefix"          # writes prefix_1.jpg, prefix_2.jpg
}
"""
import os
import sys
import json
import math
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


# ---------- dating-app swipe buttons (generic, not any real app's marks) ----
def _heart(d, cx, cy, s, col):
    pts = []
    for i in range(0, 361, 12):
        t = math.radians(i)
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((cx + x * s / 16, cy - y * s / 16))
    d.polygon(pts, fill=col)


def _star(d, cx, cy, s, col):
    pts = []
    for i in range(10):
        ang = math.radians(-90 + i * 36)
        r = s if i % 2 == 0 else s * 0.42
        pts.append((cx + r * math.cos(ang), cy + r * math.sin(ang)))
    d.polygon(pts, fill=col)


def _x(d, cx, cy, s, col):
    w = max(4, int(s * 0.34))
    d.line((cx - s, cy - s, cx + s, cy + s), fill=col, width=w)
    d.line((cx - s, cy + s, cx + s, cy - s), fill=col, width=w)


def _rewind(d, cx, cy, s, col):
    w = max(4, int(s * 0.32))
    bbox = (cx - s, cy - s, cx + s, cy + s)
    d.arc(bbox, 110, 20, fill=col, width=w)
    # arrowhead at the arc start (~110 deg)
    a = math.radians(110)
    ax, ay = cx + s * math.cos(a), cy + s * math.sin(a)
    d.polygon([(ax, ay - s * 0.5), (ax - s * 0.5, ay + s * 0.05), (ax + s * 0.35, ay + s * 0.4)], fill=col)


def _bolt(d, cx, cy, s, col):
    d.polygon([(cx + .1 * s, cy - s), (cx - .5 * s, cy + .15 * s), (cx - .02 * s, cy + .15 * s),
               (cx - .1 * s, cy + s), (cx + .5 * s, cy - .15 * s), (cx + .02 * s, cy - .15 * s)], fill=col)


def swipe_bar(img, y):
    """Generic dating-app action row centred at vertical y."""
    d = ImageDraw.Draw(img)
    # button specs: (offset_x_fraction, radius, icon, colour)
    specs = [
        (-0.34, 40, "rewind", (247, 181, 49)),
        (-0.17, 60, "x", (255, 74, 96)),
        (0.0, 46, "star", (32, 160, 243)),
        (0.17, 60, "heart", (67, 212, 119)),
        (0.34, 40, "bolt", (166, 77, 255)),
    ]
    for fx, r, icon, col in specs:
        cx = int(W / 2 + fx * W)
        # soft shadow + white disc
        d.ellipse((cx - r, y - r + 6, cx + r, y + r + 6), fill=(0, 0, 0))
        d.ellipse((cx - r, y - r, cx + r, y + r), fill=(255, 255, 255))
        s = r * 0.5
        if icon == "heart":
            _heart(d, cx, y, r * 0.62, col)
        elif icon == "star":
            _star(d, cx, y, r * 0.6, col)
        elif icon == "x":
            _x(d, cx, y, s, col)
        elif icon == "rewind":
            _rewind(d, cx, y, s, col)
        elif icon == "bolt":
            _bolt(d, cx, y, r * 0.6, col)


def eye_bar(img, y0, y1, label="able2love"):
    """Keep the identity strip, styled as a low-key brand bar."""
    y0, y1 = max(0, y0), min(H, y1)
    band = Image.new("RGB", (W, y1 - y0))
    px = band.load()
    for x in range(W):
        t = x / W
        px_col = (int(18 + 6 * t), 11, int(16 + 10 * t))
        for yy in range(y1 - y0):
            px[x, yy] = px_col
    img.paste(band, (0, y0))
    d = ImageDraw.Draw(img)
    d.rectangle((0, y0, W, y0 + 3), fill=(226, 51, 73))
    d.rectangle((0, y1 - 3, W, y1), fill=(226, 51, 73))
    f = font(24)
    tw = d.textlength(label, font=f)
    if y1 - y0 > 40:
        d.text(((W - tw) / 2, (y0 + y1) / 2 - 15), label, font=f, fill=(150, 120, 135))


def bottom_scrim(img):
    grad = Image.new("L", (1, H), 0)
    for y in range(H):
        t = (y / H - 0.42) / 0.58
        grad.putpixel((0, y), int(max(0, min(1, t)) ** 1.3 * 250))
    img.paste(Image.new("RGB", (W, H), (8, 4, 9)), (0, 0), grad.resize((W, H)))


def top_dots(img, num):
    # two segmented bars like a dating-app photo counter
    d = ImageDraw.Draw(img)
    g = Image.new("L", (1, H), 0)
    for y in range(H):
        g.putpixel((0, y), int(max(0, 1 - y / 150) * 120))
    img.paste(Image.new("RGB", (W, H), (0, 0, 0)), (0, 0), g.resize((W, H)))
    d = ImageDraw.Draw(img)
    active = 0 if str(num).strip().startswith("1") else 1
    seg_w = (W - 120) // 2
    for i in range(2):
        x0 = 60 + i * (seg_w + 12)
        col = (255, 255, 255) if i == active else (255, 255, 255, 90)
        d.rounded_rectangle((x0, 30, x0 + seg_w - 12, 38), radius=4,
                            fill=(255, 255, 255) if i == active else (120, 110, 118))


def render_slide(slide):
    img = Image.open(os.path.join(LIB, slide["base"])).convert("RGB")
    if img.size != (W, H):
        img = img.resize((W, H))
    top_dots(img, slide.get("num", "1"))
    eye_bar(img, slide["stripY0"], slide["stripY1"], slide.get("barlabel", "able2love"))
    bottom_scrim(img)
    d = ImageDraw.Draw(img)
    # text block sits ABOVE the swipe bar
    y = H - 372
    if slide.get("kicker"):
        d.text((60, y), str(slide["kicker"]).upper(), font=font(24), fill=(255, 200, 90)); y += 36
    for ln in wrap(d, slide["prompt"], font(72), W - 120):
        d.text((60, y), ln, font=font(72), fill=(255, 255, 255)); y += 78
    if slide.get("sub"):
        for ln in wrap(d, slide["sub"], font(34), W - 120):
            d.text((60, y + 2), ln, font=font(34), fill=(245, 210, 220)); y += 42
    if slide.get("cta"):
        d.text((60, y + 8), slide["cta"], font=font(28), fill=(255, 157, 176))
    # the generic swipe buttons
    swipe_bar(img, H - 128)
    return img


def render_plan(plan):
    out = plan["out"]
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    paths = []
    for i, slide in enumerate(plan["slides"], 1):
        render_slide(slide).save(f"{out}_{i}.jpg", quality=90)
        paths.append(f"{out}_{i}.jpg")
    return paths


def main():
    raw = open(sys.argv[1]).read() if len(sys.argv) > 1 else sys.stdin.read()
    plan = json.loads(raw)
    for pl in (plan if isinstance(plan, list) else [plan]):
        for p in render_plan(pl):
            print("wrote", p)


if __name__ == "__main__":
    main()
