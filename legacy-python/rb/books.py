"""Find a book and pull a read-aloud passage from it.

Keenable searches Project Gutenberg (public domain) and fetches the book text. Code picks the story start
and a passage that ends on a sentence boundary. Muse Spark then fixes typography only (drop caps such as
"HERE was once" -> "There was once", stray captions); code checks the cleaned text still matches the
source word-for-word (>= 95%), so the answer key is always the real book.
"""
import os, re
from difflib import SequenceMatcher
from types import SimpleNamespace

import httpx
from keenable import Keenable

from .meta_api import chat_json
from .scoring import norm

_client = None


def kclient():
    global _client
    if _client is None:
        _client = Keenable(client_source="Reading Buddy")  # uses KEENABLE_API_KEY if set, else keyless
    return _client


BUILTIN = {
    "the fox and the grapes": {
        "title": "The Fox and the Grapes", "author": "Aesop (tr. George Fyler Townsend)",
        "source": "https://www.gutenberg.org/ebooks/21",
        "text": "A famished Fox saw some clusters of ripe black grapes hanging from a trellised vine. She "
                "resorted to all her tricks to get at them, but wearied herself in vain, for she could not "
                "reach them. At last she turned away, hiding her disappointment and saying: \"The Grapes are "
                "sour, and not ripe as I thought.\""},
}

_MD_IMG = re.compile(r"!\[\[?[^\]]*\]?\]\([^)]*\)")
_MD_LINK = re.compile(r"\[([^\]]*)\]\([^)]*\)")


def _plain(md):
    t = _MD_IMG.sub("", md)
    t = _MD_LINK.sub(r"\1", t)
    t = re.sub(r"[*_`#>]+", "", t)
    return t


def _body(md):
    s = re.search(r"\*\*\*\s*START OF.*?\*\*\*", md)
    e = re.search(r"\*\*\*\s*END OF", md)
    return md[s.end() if s else 0: e.start() if e else len(md)]


def _paragraphs(text):
    paras = [re.sub(r"\s+", " ", p).strip() for p in re.split(r"\n\s*\n", text)]
    return [p for p in paras if p]


def ksearch(query, **params):
    """Keenable search over REST (the 0.1.5 SDK lacks safety_mode). Kid app: always safety_mode=strict."""
    key = os.environ.get("KEENABLE_API_KEY")
    url = "https://api.keenable.ai/v1/search" + ("" if key else "/public")
    headers = {"X-Keenable-Title": "Reading Buddy", **({"X-API-Key": key} if key else {})}
    r = httpx.post(url, json={"query": query, "safety_mode": "strict", **params}, headers=headers, timeout=20)
    r.raise_for_status()
    return [SimpleNamespace(title=x.get("title", ""), url=x["url"], snippet=x.get("snippet", ""))
            for x in r.json().get("results", [])]


def search_book(title):
    """Keenable search restricted to Project Gutenberg. Returns (gutenberg_id, title, url) or None."""
    res = ksearch(f"{title} ebook", site="gutenberg.org", max_results=8)
    for r in res:
        m = re.search(r"/(?:ebooks|files|etext|cache/epub)/(\d+)", r.url)
        if m:
            return int(m.group(1)), r.title, r.url
    return None


def fetch_book(gid):
    for url in (f"https://www.gutenberg.org/files/{gid}/{gid}-h/{gid}-h.htm",
                f"https://www.gutenberg.org/cache/epub/{gid}/pg{gid}-images.html",
                f"https://gutenberg.org/ebooks/{gid}.txt.utf-8"):
        try:
            page = kclient().fetch(url, max_chars=400000)
            if page.content and len(page.content) > 2000:
                return page.content, page.url
        except Exception:
            continue
    raise RuntimeError(f"could not fetch Gutenberg book {gid}")


_FRONT = re.compile(r"printed|published|copyright|press|limited|\bco\.|illustrat|contents|transcriber|edition|"
                    r"rights reserved|gutenberg|ebook", re.I)


def _titlecase(p):
    ws = [w for w in p.split() if w[:1].isalpha()]
    return bool(ws) and sum(w[0].isupper() for w in ws) / len(ws) > 0.6


def _caption(p):
    return len(p.split()) <= 4 and _titlecase(p) and not re.search(r"[.!?][\"”’']?$", p)


def pick_passage(paras, title, part=0, target_words=170):
    """Story paragraphs -> the `part`-th passage of about `target_words`, ending at a sentence."""
    paras = [p for p in paras if p and not _caption(p)]
    # in a collection, jump to the paragraph after a heading that matches the requested title
    t = " ".join(norm(w) for w in title.split() if norm(w))
    start = None
    for i, p in enumerate(paras):
        if t and len(p.split()) <= len(t.split()) + 3 and t in " ".join(norm(w) for w in p.split()):
            if any(len(q.split()) >= 10 for q in paras[i + 1:i + 4]):
                start = i + 1
                end = next((k for k in range(start + 1, len(paras)) if len(paras[k].split()) <= 8
                            and paras[k][:1].isupper() and not re.search(r"[.!?,;:][\"”’']?$", paras[k])), None)
                paras = paras[:end]     # one story from a collection: stop at the next heading
                break
    if start is None:   # first prose paragraph with a real story following it (skips title page, dedication, TOC)
        cand = [i for i, p in enumerate(paras) if len(p.split()) >= 4 and not _FRONT.search(p) and not _titlecase(p)]
        for k, i in enumerate(cand):
            if sum(len(paras[c].split()) for c in cand[k:k + 5]) >= 60:
                start = i
                break
    start = start or 0
    while start < len(paras) - 1 and (_titlecase(paras[start]) or _FRONT.search(paras[start])):
        start += 1                      # drop a leading table of contents / heading
    story = paras[start:]
    text = " ".join(story)
    sents = re.findall(r".+?(?:[.!?][\"”’']?(?=\s|$)|$)", text)
    sents = [x.strip() for x in sents if x.strip()]
    chunks, cur = [], []
    for s in sents:
        cur.append(s)
        if sum(len(x.split()) for x in cur) >= target_words:
            chunks.append(" ".join(cur)); cur = []
    if cur:
        chunks.append(" ".join(cur))
    return chunks[min(part, len(chunks) - 1)], len(chunks)


CLEAN_SCHEMA = {"type": "object", "additionalProperties": False, "required": ["text"],
                "properties": {"text": {"type": "string"}}}


def clean_typography(raw):
    out = chat_json(
        "You fix typography in passages from scanned public-domain children's books. Fix ONLY: drop caps "
        "(e.g. 'HERE was once' -> 'There was once'), words broken by hyphenation, stray image captions or "
        "page artifacts, and all-caps opening words. Do not rephrase, modernize, shorten or add anything.",
        f"Passage:\n{raw}", CLEAN_SCHEMA, "clean_passage")
    text = out["text"].strip()
    a, b = [norm(w) for w in raw.split()], [norm(w) for w in text.split()]
    ratio = SequenceMatcher(None, a, b, autojunk=False).ratio()
    return (text, round(ratio, 3)) if ratio >= 0.95 else (raw, round(ratio, 3))


def get_passage(title, part=0):
    key = title.strip().lower()
    if key in BUILTIN:
        b = BUILTIN[key]
        return {**b, "part": 0, "parts": 1, "via": "built-in", "match": 1.0}
    hit = search_book(title)
    if not hit:
        raise LookupError(f"couldn't find '{title}' on Project Gutenberg")
    gid, found_title, found_url = hit
    md, url = fetch_book(gid)
    paras = _paragraphs(_plain(_body(md)))
    raw, parts = pick_passage(paras, title, part)
    text, ratio = clean_typography(raw)
    nice = re.sub(r"\s*(by .*|\| Project Gutenberg.*)$", "", found_title).strip()
    if not nice or "/" in nice or "gutenberg" in nice.lower():
        nice = title.strip() if title.strip() != title.strip().lower() else title.strip().title()
    return {"title": nice,
            "source": f"https://www.gutenberg.org/ebooks/{gid}", "text": text, "part": part, "parts": parts,
            "via": "keenable", "match": ratio}
