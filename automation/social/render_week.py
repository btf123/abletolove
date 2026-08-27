#!/usr/bin/env python3
"""Render a week of Able2Love social cards in the V3 look (real person, full-bleed, brand
tint, bold white text, wordmark). Self-contained: fonts, wordmark and the photo library all
live next to this file, so it runs the same here and in CI.

Reads a week.json whose days carry a `kind` (feature|testimony|poll|stat) and a `bg` image id
from photos.json, plus the on-card copy. Writes card-0N.png next to the week.json.

Usage:
  python render_week.py <week-dir>                 # render every day into that folder
  python render_week.py <week-dir> --day 1 --bg ds-man-redtie   # re-render one day on a new bg
  python render_week.py <week-dir> --alts 1        # render swap alternatives for day 1

The --alts / --bg modes back the dashboard image-swap tool: alternatives are pre-rendered so
a swap is an instant switch between existing PNGs, never a live re-render.
"""
import sys, os, json, argparse
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, "fonts")
WORD = os.path.join(HERE, "wordmark_white.png")
PHOTOS = os.path.join(HERE, "photos")
MANIFEST = json.load(open(os.path.join(HERE, "photos.json"), encoding="utf-8"))["images"]

W, H = 1080, 1350
AUB=(24,13,28); CRIM=(196,42,70); GOLD=(245,201,92); WHITE=(255,255,255); MUTE=(214,196,208)

def F(w,s):
    fn={"black":"Montserrat-Black.ttf","bold":"Montserrat-Bold.ttf","semibold":"Montserrat-SemiBold.ttf"}[w]
    return ImageFont.truetype(os.path.join(FONTS,fn),s)

def bg_path(image_id):
    if image_id in MANIFEST:
        return os.path.join(PHOTOS, MANIFEST[image_id]["file"])
    # allow a raw filename too
    p=os.path.join(PHOTOS,image_id)
    if os.path.exists(p): return p
    raise SystemExit(f"unknown bg image id: {image_id}")

def cover(im,tw,th,fx=0.5,fy=0.35):
    iw,ih=im.size; s=max(tw/iw,th/ih); nw,nh=int(iw*s+.5),int(ih*s+.5)
    im=im.resize((nw,nh),Image.LANCZOS); x=int((nw-tw)*fx); y=int((nh-th)*fy)
    return im.crop((x,y,x+tw,y+th))

_G=None
def brand_grad():
    global _G
    if _G: return _G
    b=Image.new("RGB",(W,H),AUB); px=b.load()
    for y in range(H):
        for x in range(0,W,2):
            d=(x/W)*0.6+(1-y/H)*0.4
            px[x,y]=(int(AUB[0]+(CRIM[0]-AUB[0])*d*0.9),int(AUB[1]+(CRIM[1]-AUB[1])*d*0.5),int(AUB[2]+(CRIM[2]-AUB[2])*d*0.6))
            px[min(x+1,W-1),y]=px[x,y]
    _G=b; return b

def person_bg(path,fy=0.3):
    im=cover(ImageOps.exif_transpose(Image.open(path)).convert("RGB"),W,H,fy=fy)
    im=ImageEnhance.Brightness(im).enhance(0.84); im=Image.blend(im,brand_grad(),0.2)
    ov=Image.new("RGBA",(W,H),(0,0,0,0)); px=ov.load()
    for y in range(H):
        a=int(235*max(0,(y-H*0.24)/(H*0.76))**1.2); a=max(a,int(130*max(0,1-y/(H*0.16))))
        for x in range(0,W,2): px[x,y]=(20,8,20,a); px[min(x+1,W-1),y]=(20,8,20,a)
    im=im.convert("RGBA"); im.alpha_composite(ov); return im

def faint_bg(path,fy=0.3,dim=0.66,blend=0.40,scrim=96,scrim_to=0.50):
    im=cover(ImageOps.exif_transpose(Image.open(path)).convert("RGB"),W,H,fy=fy)
    im=ImageEnhance.Brightness(im).enhance(dim); im=Image.blend(im,brand_grad(),blend)
    ov=Image.new("RGBA",(W,H),(0,0,0,0)); px=ov.load()
    for y in range(H):
        if y<H*scrim_to: a=scrim
        else: a=int(scrim*max(0,1-(y-H*scrim_to)/(H*(1-scrim_to))))
        a=max(a,int(120*max(0,(y-H*0.82)/(H*0.18))))
        for x in range(0,W,3):
            for k in range(3): px[min(x+k,W-1),y]=(18,7,20,a)
    im=im.convert("RGBA"); im.alpha_composite(ov); return im

def wrap(d,t,f,mw):
    out=[]; cur=""
    for w in t.split():
        s=(cur+" "+w).strip()
        if d.textlength(s,font=f)<=mw: cur=s
        else: out.append(cur); cur=w
    if cur: out.append(cur)
    return out

def block(d,x,y,t,f,fill,mw,lh,sh=True):
    for ln in wrap(d,t,f,mw):
        if sh: d.text((x+2,y+3),ln,font=f,fill=(0,0,0,190))
        d.text((x,y),ln,font=f,fill=fill); y+=lh
    return y

def wm(c,x,y,h):
    w=Image.open(WORD).convert("RGBA"); s=h/w.height; w=w.resize((int(w.width*s),h),Image.LANCZOS); c.alpha_composite(w,(x,y))

def pill(card,x,y,w,h,text):
    layer=Image.new("RGBA",(W,H),(0,0,0,0)); ld=ImageDraw.Draw(layer)
    ld.rounded_rectangle([x,y,x+w,y+h],radius=h//2,fill=(255,255,255,40),outline=(255,255,255,235),width=4)
    ld.text((x+44,y+h/2-30),text,font=F("bold",46),fill=(255,255,255,255))
    card.alpha_composite(layer)

def render_card(day, bg_id=None):
    """Return a rendered PIL RGB image for one day dict, optionally overriding the bg."""
    kind=day.get("kind","feature")
    bid=bg_id or day.get("bg")
    path=bg_path(bid)
    fy=day.get("fy",0.3)
    if kind=="poll":
        c=faint_bg(path,fy=fy); d=ImageDraw.Draw(c); wm(c,64,58,54)
        y=block(d,64,250,day["q"],F("black",64),WHITE,W-128,78); y+=40
        for opt in day.get("options",["Yes","No","A little"]):
            pill(c,64,y,W-128,96,opt); y+=120
        d.text((66,y+16),day.get("invite","Vote, and tell us why below."),font=F("semibold",34),fill=GOLD)
    elif kind=="stat":
        # single hook-stat card (slide 1 of the Tuesday carousel; full carousel is a follow-up)
        c=person_bg(path,fy=fy); d=ImageDraw.Draw(c); wm(c,64,58,54)
        hs=day.get("hsize",72)
        lines=wrap(d,day["headline"],F("black",hs),W-128); hh=len(lines)*int(hs*1.12)
        srch=54 if day.get("source") else 0
        y=H-120-hh-srch
        y=block(d,64,y,day["headline"],F("black",hs),WHITE,W-128,int(hs*1.12))
        if day.get("source"): d.text((66,y+20),day["source"],font=F("semibold",30),fill=GOLD)
    else:  # feature / testimony
        c=person_bg(path,fy=fy); d=ImageDraw.Draw(c); wm(c,64,58,54)
        hs=day.get("hsize",66)
        lines=wrap(d,day["headline"],F("black",hs),W-128); hh=len(lines)*int(hs*1.12)
        sub=day.get("sub"); subh=0
        if sub: subh=len(wrap(d,sub,F("semibold",38),W-128))*50+18
        extra=70 if (day.get("cta") or day.get("attrib")) else 0
        y=H-120-hh-subh-extra
        y=block(d,64,y,day["headline"],F("black",hs),WHITE,W-128,int(hs*1.12))
        if sub: y=block(d,64,y+18,sub,F("semibold",38),MUTE,W-128,50)
        if day.get("attrib"): d.text((66,y+22),day["attrib"],font=F("bold",36),fill=GOLD)
        if day.get("cta"): d.text((66,y+22),"Free on Google Play",font=F("bold",40),fill=WHITE)
    return c.convert("RGB")

def load_week(week_dir):
    return json.load(open(os.path.join(week_dir,"week.json"),encoding="utf-8"))

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("week_dir")
    ap.add_argument("--day",type=int)
    ap.add_argument("--bg")
    ap.add_argument("--alts",type=int)
    a=ap.parse_args()
    wk=load_week(a.week_dir); days={d["day"]:d for d in wk["days"]}

    if a.alts:
        d=days[a.alts]; role=d.get("theme"); n=0; CAP=3
        for pid,meta in MANIFEST.items():
            if n>=CAP: break
            if role in meta["roles"] and pid!=d.get("bg"):
                render_card(d,bg_id=pid).save(os.path.join(a.week_dir,f"alt-{a.alts:02d}-{pid}.jpg"),quality=82,optimize=True)
                n+=1; print("alt",pid)
        print(f"{n} alternatives for day {a.alts} ({role})"); return

    if a.day and a.bg:
        d=days[a.day]; d["bg"]=a.bg
        render_card(d).save(os.path.join(a.week_dir,d.get("card",f"card-{a.day:02d}.jpg")),quality=82,optimize=True)
        print("re-rendered day",a.day,"on",a.bg); return

    for d in wk["days"]:
        if d.get("kind")=="reveal":  # reveal cards are built by build_reveal.py (carousel)
            print("skip reveal day",d["day"],"(built separately)"); continue
        out=d.get("card",f"card-{d['day']:02d}.jpg")
        render_card(d).save(os.path.join(a.week_dir,out),quality=82,optimize=True)
        print("wrote",out,"on",d.get("bg"))

if __name__=="__main__":
    main()
