"""Story movie: the book's pages as an MP4, made on this machine (no video model needed).

Each page = its picture with a slow pan-and-zoom + narration in the story's language (macOS voices) + big
captions timed sentence by sentence; a title card first and "The End" last. Built with ffmpeg; nothing uploaded.
"""
import base64, hashlib, io, json, os, re, shutil, subprocess, tempfile
from pathlib import Path

import httpx
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from . import lang as L

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "out" / "videos"
CLIPS = ROOT / "out" / "clips"
ANIM_URL = os.environ.get("RB_ANIM_URL", "http://127.0.0.1:8020")     # local LTX-Video service (~/IdeaProjects/local-video)


def anim_status():
    try:
        return httpx.get(ANIM_URL + "/health", timeout=1.5).json()
    except Exception:
        return None


def _clip(image, text, title):
    """Animate one page picture with the local video model (cached). Returns a ping-pong loopable mp4, or None."""
    key = hashlib.sha1(f"{image[:300]}|{len(image)}|{text}".encode()).hexdigest()[:16]
    CLIPS.mkdir(parents=True, exist_ok=True)
    pp = CLIPS / f"{key}_pp.mp4"
    if pp.exists():
        return pp
    try:
        r = httpx.post(ANIM_URL + "/animate", json={"image": image, "prompt": f"{title}: {text[:300]}"}, timeout=900)
        r.raise_for_status()
        raw = CLIPS / f"{key}.mp4"
        raw.write_bytes(base64.b64decode(r.json()["mp4"].split(",", 1)[1]))
        _run([FFMPEG, "-v", "error", "-y", "-i", str(raw), "-filter_complex",
              "[0:v]split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0[v]", "-map", "[v]", "-c:v", "libx264",
              "-preset", "veryfast", "-crf", "20", str(pp)])
        return pp
    except Exception:
        return None
# ffmpeg: RB_FFMPEG, else whatever is on PATH, else Homebrew's usual place
FFMPEG = os.environ.get("RB_FFMPEG") or shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg"
W, H, FPS = 1280, 720, 30
VOICES = {"en": "Samantha", "es": "Mónica", "fr": "Thomas", "zh": "Tingting"}
THE_END = {"en": "The End", "es": "Fin", "fr": "Fin", "zh": "完"}
LATIN = "/System/Library/Fonts/Avenir Next.ttc"
UNI = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"


def _font(size, lang, bold=True):
    if L.is_cjk(lang):
        return ImageFont.truetype(UNI, size)
    return ImageFont.truetype(LATIN, size, index=0 if bold else 5)


def _load(img):
    if not img:
        return None
    try:
        if img.startswith("/static/"):                                    # demo pictures stored in the repo
            raw = (ROOT / img.lstrip("/")).read_bytes()
        else:
            raw = base64.b64decode(img.split(",", 1)[1]) if img.startswith("data:") else httpx.get(img, timeout=20, follow_redirects=True).content
        return Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception:
        return None


def _frame(img):
    """Fit the picture on a 2x canvas over a blurred copy of itself (zoompan needs a large source)."""
    cw, ch = W * 2, H * 2
    if img is None:
        bg = Image.new("RGB", (cw, ch), (255, 246, 232))
        return bg
    bg = img.copy().resize((cw, ch)).filter(ImageFilter.GaussianBlur(40))
    fg = img.copy()
    fg.thumbnail((cw, ch))
    bg.paste(fg, ((cw - fg.width) // 2, (ch - fg.height) // 2))
    return bg


def _wrap(draw, text, font, width, lang):
    if L.is_cjk(lang):
        lines, cur = [], ""
        for ch in text:
            if draw.textlength(cur + ch, font=font) > width:
                lines.append(cur); cur = ch
            else:
                cur += ch
        return lines + ([cur] if cur else [])
    lines, cur = [], ""
    for w in text.split():
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=font) > width and cur:
            lines.append(cur); cur = w
        else:
            cur = t
    return lines + ([cur] if cur else [])


def _caption(text, lang):
    """Transparent PNG with a rounded caption band at the bottom."""
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    f = _font(40 if not L.is_cjk(lang) else 38, lang)
    lines = _wrap(d, text, f, W - 220, lang)[:3]
    lh = 54
    bh = lh * len(lines) + 36
    y0 = H - bh - 28
    d.rounded_rectangle((70, y0, W - 70, H - 28), 28, fill=(255, 255, 255, 235), outline=(108, 92, 231, 255), width=4)
    for i, ln in enumerate(lines):
        d.text((W / 2, y0 + 18 + i * lh + lh / 2), ln, font=f, fill=(42, 37, 80), anchor="mm")
    return im


def _card(title, sub, img, lang):
    base = _frame(img).resize((W, H)).convert("RGBA")
    shade = Image.new("RGBA", (W, H), (42, 37, 80, 120))
    base = Image.alpha_composite(base, shade)
    d = ImageDraw.Draw(base)
    f = _font(78 if not L.is_cjk(lang) else 72, lang)
    lines = _wrap(d, title, f, W - 200, lang)[:2]
    y = H / 2 - (len(lines) - 1) * 45 - (30 if sub else 0)
    for ln in lines:
        d.text((W / 2, y), ln, font=f, fill="white", anchor="mm", stroke_width=3, stroke_fill=(42, 37, 80))
        y += 92
    if sub:
        d.text((W / 2, y + 10), sub, font=_font(36, lang, bold=False), fill=(255, 228, 160), anchor="mm")
    return base.convert("RGB")


def _run(cmd):
    subprocess.run(cmd, check=True, capture_output=True)


def _dur(path):
    """Length in seconds: ffprobe when it's installed next to ffmpeg, else read from ffmpeg's own report."""
    probe = shutil.which("ffprobe") or FFMPEG.replace("ffmpeg", "ffprobe")
    if os.path.exists(probe):
        out = subprocess.run([probe, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                             check=True, capture_output=True, text=True).stdout
        return float(out)
    err = subprocess.run([FFMPEG, "-i", str(path)], capture_output=True, text=True).stderr
    h, m, sec = re.search(r"Duration: (\d+):(\d+):([\d.]+)", err).groups()
    return int(h) * 3600 + int(m) * 60 + float(sec)


def make_video(title, pages, lang="en", reader="", animate=False):
    """pages: [{text, image}] where image is a data URL or http URL (or empty). Returns the mp4 path."""
    key = hashlib.sha1(json.dumps([title, lang, bool(animate), [(p["text"], (p.get("image") or "")[:200], len(p.get("image") or ""))
                                                 for p in pages]]).encode()).hexdigest()[:16]
    OUT.mkdir(parents=True, exist_ok=True)
    final = OUT / f"{key}.mp4"
    if final.exists():
        return final
    voice = VOICES.get(lang, "Samantha")
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        segs = []
        imgs = [_load(p.get("image")) for p in pages]
        cover = next((i for i in imgs if i is not None), None)
        # title card (3 s, silent narration of the title)
        _card(title, reader or "", cover, lang).save(td / "title.png")
        _run(["say", "-v", voice, "-o", str(td / "title.aiff"), title])
        segs.append(_still(td, "title", td / "title.png", td / "title.aiff", hold=1.2))
        for i, (p, img) in enumerate(zip(pages, imgs)):
            _frame(img).save(td / f"p{i}.png")
            sents = []
            for snt in (L.sentences(p["text"], lang) or [p["text"]]):        # merge tiny fragments ("she said.")
                if sents and L.length(snt, lang) <= (4 if L.is_cjk(lang) else 3):
                    sents[-1] += (" " if not L.is_cjk(lang) else "") + snt
                else:
                    sents.append(snt)
            # narrate sentence by sentence so captions line up exactly
            auds = []
            for j, snt in enumerate(sents):
                a = td / f"p{i}_{j}.aiff"
                _run(["say", "-v", voice, "-r", "160" if lang == "en" else "170", "-o", str(a), snt])
                auds.append((snt, a, _dur(a)))
            clip = _clip(p.get("image") or "", p["text"], title) if animate and p.get("image") else None
            segs.append(_page(td, i, td / f"p{i}.png", auds, lang, clip))
        _card(THE_END.get(lang, "The End"), "", cover, lang).save(td / "end.png")
        _run(["say", "-v", voice, "-o", str(td / "end.aiff"), THE_END.get(lang, "The End")])
        segs.append(_still(td, "end", td / "end.png", td / "end.aiff", hold=1.5))
        (td / "list.txt").write_text("".join(f"file '{s}'\n" for s in segs))
        _run([FFMPEG, "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(td / "list.txt"), "-c", "copy",
              "-movflags", "+faststart", str(final)])
    return final


def _still(td, name, png, aiff, hold=1.0):
    dur = _dur(aiff) + hold
    out = td / f"{name}.mp4"
    _run([FFMPEG, "-v", "error", "-y", "-loop", "1", "-i", str(png), "-i", str(aiff),
          "-vf", f"scale={W}:{H},fps={FPS},format=yuv420p,fade=t=in:st=0:d=0.4",
          "-af", f"apad=pad_dur={hold}", "-t", f"{dur:.2f}", "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
          "-c:a", "aac", "-ar", "44100", "-ac", "2", str(out)])
    return out


def _page(td, i, png, auds, lang, clip=None):
    gap = 0.35
    total = sum(d for _, _, d in auds) + gap * len(auds) + 0.6
    frames = int(total * FPS)
    # audio: sentences with short gaps
    ins, filt, t, cues = [], [], 0.0, []
    for j, (snt, a, d) in enumerate(auds):
        ins += ["-i", str(a)]
        filt.append(f"[{j + 1}:a]apad=pad_dur={gap}[a{j}]")
        cues.append((t, t + d + gap, snt))
        t += d + gap
    filt.append("".join(f"[a{j}]" for j in range(len(auds))) + f"concat=n={len(auds)}:v=0:a=1,apad=pad_dur=0.6[aout]")
    # video: slow pan-and-zoom (alternating direction), captions overlaid per sentence
    zin = i % 2 == 0
    z = f"'min(1+0.12*on/{frames},1.12)'" if zin else f"'max(1.12-0.12*on/{frames},1.0)'"
    if clip:   # AI-animated page: loop the ping-pong clip for the length of the narration
        vf = [f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1,fps={FPS},format=yuva420p[v0]"]
    else:
        vf = [f"[0:v]zoompan=z={z}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={W}x{H}:fps={FPS},format=yuva420p[v0]"]
    last = "v0"
    cap_inputs = []
    for k, (s0, s1, snt) in enumerate(cues):
        cp = td / f"cap{i}_{k}.png"
        _caption(snt, lang).save(cp)
        cap_inputs += ["-i", str(cp)]
        idx = len(auds) + 1 + k
        vf.append(f"[{last}][{idx}:v]overlay=0:0:enable='between(t,{s0:.2f},{s1:.2f})'[c{k}]")
        last = f"c{k}"
    vf.append(f"[{last}]format=yuv420p,fade=t=in:st=0:d=0.35[vout]")
    out = td / f"p{i}.mp4"
    src = ["-stream_loop", "-1", "-i", str(clip)] if clip else ["-loop", "1", "-framerate", str(FPS), "-i", str(png)]
    _run([FFMPEG, "-v", "error", "-y", *src, *ins, *cap_inputs,
          "-filter_complex", ";".join(filt + vf), "-map", "[vout]", "-map", "[aout]", "-t", f"{total:.2f}",
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-c:a", "aac", "-ar", "44100", "-ac", "2", str(out)])
    return out
