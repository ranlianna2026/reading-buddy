"""Page illustrations with Muse Image (muse-image-1.0).

- With a reference (a book's own public-domain illustration, the child's drawing, or this story's first
  generated picture): /images/edits draws the page's moment in the reference's style and characters.
- Without one (a story told only by voice): /images/generations draws the first picture from scratch; the
  page then becomes the reference for the rest of the book, so characters stay consistent.
- If drawing from the reference fails (an unreachable book image, a rejected upload), the page is drawn from
  scratch instead, so every page still gets a picture.
Pictures are resized to ~1024px wide JPEG before sending. $0.01 per image. Cached on disk by (reference, text, kind).
"""
import base64, hashlib, os, time, uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import httpx

from . import meta_api  # loads .env

CACHE = Path(__file__).resolve().parents[1] / "out" / "pictures"
MODEL = os.environ.get("RB_IMAGE_MODEL", "muse-image-1.0")
STYLES = {
    "book": "the same hand-drawn art style, colors and characters as the reference illustration from this classic "
            "public-domain picture book",
    "story": "the same style as the child's drawing in the reference: same characters, colors and crayon/marker look, "
             "a little more finished but still clearly the child's art",
    "series": "exactly the same art style, characters (same faces, colors, clothes) and world as the reference picture, "
              "which is an earlier page of this same book",
    "new": "a warm, cozy watercolor-and-ink children's picture-book style with soft colors and friendly, expressive characters",
}


SHRINK_WIDTH = int(os.environ.get("RB_IMAGE_WIDTH", "1024"))


def shrink(data, width=SHRINK_WIDTH, quality=82):
    """Smaller JPEG for the page: much less to send to the browser, and to upload again when this picture is the
    reference for the next pages. (The API's `size` only sets the aspect ratio, so it can't be asked for smaller.)"""
    try:
        import io
        from PIL import Image
        im = Image.open(io.BytesIO(data)).convert("RGB")
        if im.width > width:
            im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        out = io.BytesIO()
        im.save(out, "JPEG", quality=quality, optimize=True, progressive=True)
        return out.getvalue() if out.tell() < len(data) else data
    except Exception:
        return data                                 # never lose a picture over resizing


# pictures started early (e.g. a story's first picture, begun as soon as the story is planned, while the text is
# still being written); the page picks the result up by id instead of waiting for a fresh drawing
_POOL = ThreadPoolExecutor(max_workers=8)
_EARLY = {}


def start(page_text, ref_image=None, title="", kind="new", cast=""):
    """Begin drawing in the background; returns an id for wait()."""
    now = time.time()
    for k in [k for k, (t, _) in _EARLY.items() if now - t > 600]:
        _EARLY.pop(k, None)                         # forget pictures nobody collected
    pid = uuid.uuid4().hex[:12]
    _EARLY[pid] = (now, _POOL.submit(illustrate, page_text, ref_image, title, kind, cast))
    return pid


def wait(pid, timeout=90):
    """The early picture's data URL. Raises KeyError for an unknown id, or the drawing's error."""
    return _EARLY[pid][1].result(timeout=timeout)


def illustrate(page_text, ref_image=None, title="", kind="book", cast=""):
    """Returns a data URL (jpeg). Falls back to a from-scratch drawing when the reference can't be used."""
    if ref_image:
        try:
            return _draw(page_text, ref_image, title, kind, cast)
        except Exception:
            pass                                    # bad or unreachable reference: draw it fresh below
    return _draw(page_text, None, title, "new", cast)


def _draw(page_text, ref_image=None, title="", kind="book", cast=""):
    key = hashlib.sha1(f"{(ref_image or '')[:4000]}|{page_text}|{kind}|{cast}".encode()).hexdigest()[:20]
    path = CACHE / f"{key}.jpg"
    if path.exists():
        return "data:image/jpeg;base64," + base64.b64encode(path.read_bytes()).decode()
    if not ref_image:
        kind = "new"
    prompt = (f"An illustration for one page of the children's story \"{title}\", in {STYLES.get(kind, STYLES['book'])}. "
              + (f"Characters and setting: {cast[:400]}. " if cast else "")
              + f"Show this moment: {page_text[:600]} "
              "Gentle and friendly for young children. No words, letters or captions in the image.")
    body = {"model": MODEL, "prompt": prompt, "n": 1, "size": "1536x1024", "output_format": "jpeg", "reasoning_strength": "low"}
    endpoint = "/images/generations"
    if ref_image:
        body["images"] = [{"image_url": ref_image}]
        endpoint = "/images/edits"
    r = httpx.post(meta_api.BASE_URL + endpoint, headers={"Authorization": f"Bearer {os.environ['MODEL_API_KEY']}"},
                   json=body, timeout=httpx.Timeout(55, connect=10))
    if r.status_code >= 400:
        raise meta_api.APIError(f"{r.status_code}: {r.text[:300]}")
    data = shrink(base64.b64decode(r.json()["data"][0]["b64_json"]))
    CACHE.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return "data:image/jpeg;base64," + base64.b64encode(data).decode()
