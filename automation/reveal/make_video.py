#!/usr/bin/env python3
"""
Make the Twitter/X version of a reveal: a short auto-playing MP4 that recreates
the swipe. Shows slide 1 (the bait) with the fun eye-bar question, then does a
swipe-left transition to slide 2 (the full-frame reveal + wheelchair), and holds.

X has no carousel/swipe, but portrait video auto-plays in-feed — so the reveal
still lands as the clip plays.

Usage: python3 make_video.py slide1.jpg slide2.jpg out.mp4
"""
import os
import sys
import subprocess

def _ffmpeg():
    e = os.environ.get("FFMPEG")
    if e and os.path.exists(e):
        return e
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return "ffmpeg"
FF = _ffmpeg()


def make_video(s1, s2, out, hold1=2.4, trans=0.55, hold2=3.2):
    total1 = hold1 + trans
    total2 = trans + hold2
    off = hold1  # transition starts after the bait hold
    vf = (
        f"[0:v]scale=1080:1350:force_original_aspect_ratio=increase,"
        f"crop=1080:1350,setsar=1,fps=30[a];"
        f"[1:v]scale=1080:1350:force_original_aspect_ratio=increase,"
        f"crop=1080:1350,setsar=1,fps=30[b];"
        f"[a][b]xfade=transition=slideleft:duration={trans}:offset={off},"
        f"format=yuv420p[v]"
    )
    cmd = [
        FF, "-y",
        "-loop", "1", "-t", f"{total1}", "-i", s1,
        "-loop", "1", "-t", f"{total2}", "-i", s2,
        "-filter_complex", vf,
        "-map", "[v]",
        "-c:v", "libx264", "-preset", "medium", "-crf", "20",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        out,
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    return out


if __name__ == "__main__":
    s1, s2, out = sys.argv[1], sys.argv[2], sys.argv[3]
    print("wrote", make_video(s1, s2, out))
