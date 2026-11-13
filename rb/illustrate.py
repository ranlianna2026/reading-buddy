"""New page illustrations in the style of an original picture, with Muse Image (muse-image-1.0).

The reference image (a book's own public-domain illustration, or the child's drawing) steers characters and
art style; the page text sets the scene. $0.01 per image. Results are cached on disk by (reference, text).
"""
import base64, hashlib, os
from pathlib import Path

import httpx

from . import meta_api  # loads .env

CACHE = Path(__file__).resolve().parents[1] / "out" / "pictures"
MODEL = os.environ.get("RB_IMAGE_MODEL", "muse-image-1.0")


def illustrate(page_text, ref_image, title="", kind="book"):
    """ref_image: public URL or data URL. Returns a data URL (jpeg)."""
    key = hashlib.sha1(f"{ref_image[:4000]}|{page_text}|{kind}".encode()).hexdigest()[:20]
    path = CACHE / f"{key}.jpg"
    if path.exists():
        return "data:image/jpeg;base64," + base64.b64encode(path.read_bytes()).decode()
    style = ("the same hand-drawn art style, colors and characters as the reference illustration from this "
             "classic public-domain picture book" if kind == "book"
             else "the same style as the child's drawing in the reference: same characters, colors and crayon/marker look, "
                  "a little more finished but still clearly the child's art")
    prompt = (f"A new illustration for one page of the children's story \"{title}\", in {style}. "
              f"Show this moment: {page_text[:600]} "
              "Gentle and friendly for young children. No words, letters or captions in the image.")
    r = httpx.post(meta_api.BASE_URL + "/images/edits",
                   headers={"Authorization": f"Bearer {os.environ['MODEL_API_KEY']}"},
                   json={"model": MODEL, "prompt": prompt, "images": [{"image_url": ref_image}], "n": 1,
                         "size": "1536x1024", "output_format": "jpeg", "reasoning_strength": "low"},
                   timeout=180)
    if r.status_code >= 400:
        raise meta_api.APIError(f"{r.status_code}: {r.text[:300]}")
    data = base64.b64decode(r.json()["data"][0]["b64_json"])
    CACHE.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return "data:image/jpeg;base64," + base64.b64encode(data).decode()
