#!/usr/bin/env python3
"""Build the Able2Love social photo library that backs the dashboard image-swap tool.

Reads the curated, licensed diverse-disabled cast (and, where it counts, Brogan's own
frames) from the design-lab, resizes each to a web-friendly card-background size, writes
web-optimised JPEGs into automation/social/photos/, and emits photos.json: a manifest that
tags every image by the 7-day theme role it may back. The dashboard reads photos.json to
show theme-matched alternatives for one-click swapping; the renderer reads it to pick a
background when a day names an image id.

Editorial rules baked in (see memory able2love-content-calendar / able2love-photo-rules):
  - reveal cast is SEPARATE from the stat/poll cast and never overlaps it,
  - Saturday poll (disabled community asking) must show a CLEARLY DISABLED person,
  - Sunday poll (able-bodied community asking) must show a CLEARLY ABLE-BODIED person,
  - two-men-selfie-boardwalk hides a wheelchair user, so it is NEVER a Sunday/able option.
Run: python automation/social/build_photo_library.py
"""
import os, json
from PIL import Image, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "photos")
SRC = r"C:\Users\broga\able-to-love\marketing\photos-source\store-diversity"
MAXW = 1280  # longest edge; plenty for a 1080x1350 card background

# id -> (source filename, [role tags], short human label, who-is-shown)
# roles map to the locked 7-day formula:
#   mon-feature | tue-stat | wed-testimony | thu-feature | fri-reveal
#   sat-poll-disabled | sun-poll-able
LIBRARY = {
    # --- clearly disabled cast: stat halves, features, Saturday poll ---
    "ds-man-redtie":        ("ds-man-redtie-6281432.jpg",        ["tue-stat","mon-feature","thu-feature","sat-poll-disabled"], "Man, red tie, confident", "disabled"),
    "ds-man-coffee":        ("ds-man-coffee-7162364.jpg",        ["tue-stat","thu-feature","sat-poll-disabled"], "Man with coffee, relaxed", "disabled"),
    "ds-woman-boxing":      ("ds-woman-boxing-4058374.jpg",      ["sat-poll-disabled","tue-stat","mon-feature"], "Woman boxing, strong", "disabled"),
    "ds-woman-seaside":     ("ds-woman-seaside-7403027.jpg",     ["thu-feature","mon-feature","tue-stat","sat-poll-disabled"], "Woman at the seaside", "disabled"),
    "ds-woman-warm":        ("ds-woman-warm-10187222.jpg",       ["wed-testimony","mon-feature","sat-poll-disabled"], "Woman, warm smile", "disabled"),
    "asian-man-whitecane":  ("asian-man-whitecane-7188729.jpg",  ["tue-stat","thu-feature","sat-poll-disabled"], "Man with white cane", "disabled"),
    "black-man-whitecane":  ("black-man-whitecane-8327699.jpg",  ["mon-feature","tue-stat","sat-poll-disabled"], "Man with white cane", "disabled"),
    "southasian-man-hearingaid": ("southasian-man-hearingaid-9623514.jpg", ["thu-feature","tue-stat","sat-poll-disabled"], "Man with hearing aid", "disabled"),
    "senior-asian-man-hearingaid": ("senior-asian-man-hearingaid-36670377.jpg", ["tue-stat","sat-poll-disabled"], "Senior man, hearing aid", "disabled"),
    "older-man-powerchair-reading": ("older-man-powerchair-reading-3023656.jpg", ["thu-feature","tue-stat","sat-poll-disabled"], "Man reading in a powerchair", "disabled"),
    "older-man-wheelchair-flowers": ("older-man-wheelchair-flowers-38152472.jpg", ["wed-testimony","tue-stat","sat-poll-disabled"], "Man with flowers", "disabled"),
    "older-woman-wheelchair": ("older-woman-wheelchair-16162279.jpg", ["tue-stat","sat-poll-disabled"], "Older woman, wheelchair", "disabled"),
    "senior-man-wheelchair-street": ("senior-man-wheelchair-street-5534875.jpg", ["tue-stat","sat-poll-disabled"], "Senior man on the street", "disabled"),
    "woman-wheelchair-phone-park": ("woman-wheelchair-phone-park-19881857.jpg", ["thu-feature","mon-feature","tue-stat","sat-poll-disabled"], "Woman on her phone, park", "disabled"),
    # --- reveal cast: Friday ONLY, kept apart from stat/poll ---
    "black-woman-wheelchair-red": ("black-woman-wheelchair-red-8524605.jpg", ["fri-reveal"], "Woman in red, wheelchair", "disabled"),
    "asian-woman-wheelchair-window": ("asian-woman-wheelchair-window-8127420.jpg", ["fri-reveal"], "Woman by a window", "disabled"),
    "man-wheelchair-phonecall-cafe": ("man-wheelchair-phonecall-cafe-6281457.jpg", ["fri-reveal"], "Man on a call, cafe", "disabled"),
    "older-blackman-wheelchair-market": ("older-blackman-wheelchair-market-20282712.jpg", ["fri-reveal"], "Man at a market", "disabled"),
    # --- connection / couples: Wednesday testimony ---
    "couple-bench-phone":   ("couple-bench-phone-8415842.jpg",   ["wed-testimony"], "Couple on a bench", "couple"),
    "couple-park-dandelion": ("couple-park-dandelion-8415711.jpg", ["wed-testimony"], "Couple in a park", "couple"),
    # --- clearly able-bodied: Sunday poll (the asker is able-bodied) ---
    "man-laughing-phone-park": ("man-laughing-phone-park-4908626.jpg", ["sun-poll-able"], "Man laughing at his phone", "able"),
    # two-men-selfie-boardwalk intentionally OMITTED: contains a wheelchair user,
    # so it can never stand in for an able-bodied asker on Sunday.
}


def cover(im, tw, th, fy=0.35):
    im = ImageOps.exif_transpose(im).convert("RGB")
    iw, ih = im.size
    s = max(tw / iw, th / ih)
    nw, nh = int(iw * s + .5), int(ih * s + .5)
    im = im.resize((nw, nh), Image.LANCZOS)
    x = int((nw - tw) * 0.5); y = int((nh - th) * fy)
    return im.crop((x, y, x + tw, y + th))


def main():
    os.makedirs(OUT, exist_ok=True)
    manifest = {"generated_from": "store-diversity (licensed, LICENCES.md)", "images": {}}
    for pid, (fn, roles, label, who) in LIBRARY.items():
        src = os.path.join(SRC, fn)
        if not os.path.exists(src):
            print("MISSING", fn); continue
        im = Image.open(src)
        # keep portrait orientation, cap the longest edge
        iw, ih = ImageOps.exif_transpose(im).size
        scale = min(1.0, MAXW / max(iw, ih))
        im = ImageOps.exif_transpose(im).convert("RGB")
        if scale < 1.0:
            im = im.resize((int(iw * scale), int(ih * scale)), Image.LANCZOS)
        outname = pid + ".jpg"
        im.save(os.path.join(OUT, outname), quality=82, optimize=True)
        manifest["images"][pid] = {"file": outname, "roles": roles, "label": label, "who": who}
        print("wrote", outname, im.size)
    with open(os.path.join(HERE, "photos.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"\n{len(manifest['images'])} images -> photos.json")


if __name__ == "__main__":
    main()
