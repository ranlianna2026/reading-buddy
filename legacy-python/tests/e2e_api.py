"""End-to-end API test against a running server (real Muse Spark + Keenable calls).

    .venv/bin/uvicorn app:app --port 8010 &
    .venv/bin/python tests/e2e_api.py            # or BASE=http://host:port
"""
import io, json, os, sys, time

import httpx
from PIL import Image, ImageDraw, ImageFont

BASE = os.environ.get("BASE", "http://127.0.0.1:8010")
C = httpx.Client(base_url=BASE, timeout=180)
LEARNER = f"e2e-{int(time.time())}"
results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(f"{'PASS' if cond else 'FAIL'}  {name}  {detail}")


def timed(fn, *a, **k):
    t = time.time()
    r = fn(*a, **k)
    return r, round(time.time() - t, 1)


# 1. index
r = C.get("/")
check("index page serves", r.status_code == 200 and "Learning Buddy" in r.text)

# 2. books: built-in, Gutenberg via Keenable (with typography fix), collection fable, unknown title
r, s = timed(C.post, "/api/book", json={"title": "The Fox and the Grapes"})
b = r.json()
check("built-in fable", r.status_code == 200 and b["via"] == "built-in" and "famished" in b["text"].lower(), f"{s}s")

r, s = timed(C.post, "/api/book", json={"title": "The Velveteen Rabbit"})
vel = r.json()
check("Gutenberg book via Keenable", r.status_code == 200 and vel["via"] == "keenable", f"{s}s, {vel.get('parts')} parts")
check("drop cap fixed (There was once)", vel["text"].startswith("There was once"), vel["text"][:40])
check("cleaned text matches book >= 95%", vel.get("match", 0) >= 0.95, str(vel.get("match")))

r = C.post("/api/book", json={"title": "The Velveteen Rabbit", "part": 1})
check("next part differs", r.status_code == 200 and r.json()["text"][:30] != vel["text"][:30])

r, s = timed(C.post, "/api/book", json={"title": "The Tale of Peter Rabbit"})
pr = r.json()
check("picture book starts at story", pr["text"].startswith("Once upon a time"), pr["text"][:40])
check("title is not a URL", "/" not in pr["title"], pr["title"])

r = C.post("/api/book", json={"title": "The Lion and the Mouse"})
lm = r.json()
check("fable inside a collection", r.status_code == 200 and "lion" in lm["text"].lower() and len(lm["text"].split()) < 200,
      f"{len(lm['text'].split())} words")

r = C.post("/api/book", json={"title": "zzqx nonexistent book qwv"})
check("unknown book -> 404 not found", r.status_code == 404, str(r.status_code))

check("book pages carry original illustrations", vel.get("pictures", 0) >= 1 and all("image_url" in p for p in vel["pages"]),
      f"{vel.get('pictures')} of {len(vel.get('pages', []))} pages")
check("pages join back to the scored text", " ".join(p["text"] for p in vel["pages"]).split() == vel["text"].split())
r, s = timed(C.post, "/api/illustrate", json={"page_text": vel["pages"][1]["text"], "ref_image": vel["pages"][0]["image_url"],
                                               "title": vel["title"], "kind": "book"})
check("Muse Image draws a page in the original style", r.status_code == 200 and r.json().get("image", "").startswith("data:image/"), f"{s}s")

# 3. page photo (Muse vision transcription)
img = Image.new("RGB", (900, 420), "white")
d = ImageDraw.Draw(img)
try:
    f = ImageFont.truetype("/System/Library/Fonts/Supplemental/Georgia.ttf", 34)
except OSError:
    f = ImageFont.load_default()
page = "The little red hen found a grain of wheat.\nWho will help me plant this wheat? she asked.\nNot I, said the duck. Not I, said the cat."
d.multiline_text((40, 60), page, font=f, fill="black", spacing=22)
buf = io.BytesIO(); img.save(buf, format="JPEG")
r, s = timed(C.post, "/api/page_photo", files={"file": ("page.jpg", buf.getvalue(), "image/jpeg")})
ph = r.json()
want = set(page.lower().replace("?", "").replace(".", "").replace(",", "").split())
got = set(ph["text"].lower().replace("?", "").replace(".", "").replace(",", "").split())
check("page photo transcribed", r.status_code == 200 and len(want & got) / len(want) >= 0.9, f"{s}s: {ph['text'][:60]}")

# 4. scoring (code): perfect, misread+skip, partial read
p = b["text"]
r = C.post("/api/score", json={"passage": p, "transcript": p, "seconds": 30}).json()
check("perfect read = 100%", r["accuracy"] == 1.0 and not r["miscues"] and r["finished"], f"wcpm {r['wcpm']}")
w = p.split(); w[1] = "famous"; del w[5]
r = C.post("/api/score", json={"passage": p, "transcript": " ".join(w), "seconds": 30}).json()
kinds = sorted(m["type"] for m in r["miscues"])
check("misread + skip detected", kinds == ["misread", "skipped"], str(r["miscues"]))
r = C.post("/api/score", json={"passage": p, "transcript": " ".join(p.split()[:20]), "seconds": 10}).json()
check("stopping early is not errors", r["accuracy"] == 1.0 and not r["finished"] and r["words_attempted"] == 20,
      f"attempted {r['words_attempted']}")
r = C.post("/api/score", json={"passage": p, "transcript": "", "seconds": 5}).json()
check("empty transcript ok", r["words_attempted"] == 0)

# 5. questions, grading paths, learn more
r, s = timed(C.post, "/api/questions", json={"passage": p, "learner": LEARNER})
qj = r.json(); qs = qj["questions"]
check("3 questions (recall/inference/vocab)", sorted(q["kind"] for q in qs) == ["inference", "recall", "vocabulary"], f"{s}s")
check("learn topic chosen", bool(qj.get("learn_topic")), qj.get("learn_topic"))
rec = next(q for q in qs if q["kind"] == "recall")
g = C.post("/api/grade", json={"passage": p, "question": rec, "answer": rec["expected_answer"], "attempt": 1}).json()
check("right answer -> correct + move on", g["verdict"] == "correct" and g["next_action"] == "praise_move_on", g["feedback"][:60])
g = C.post("/api/grade", json={"passage": p, "question": rec, "answer": "a big purple elephant", "attempt": 1}).json()
check("wrong answer, try 1 -> retry", g["verdict"] != "correct" and g["next_action"] in ("hint_retry", "reread_retry"), g["next_action"])
g = C.post("/api/grade", json={"passage": p, "question": rec, "answer": "a big purple elephant", "attempt": 2}).json()
check("wrong answer, try 2 -> explain (guardrail)", g["next_action"] == "explain_move_on", g["next_action"])
r, s = timed(C.post, "/api/learn", json={"topic": qj["learn_topic"], "title": "The Fox and the Grapes"})
lj = r.json()
check("learn more fact with source", r.status_code == 200 and lj.get("source_url", "").startswith("http"), f"{s}s {lj.get('source_url')}")

# 6. learner profile + adaptation
prof = C.get(f"/api/profile/{LEARNER}").json()
check("new learner starts at level 2", prof["level"] == 2 and not prof["history"])
sc = C.post("/api/score", json={"passage": p, "transcript": p, "seconds": 30}).json()
ans = [{"kind": "recall", "verdict": "correct", "word": ""}, {"kind": "inference", "verdict": "correct", "word": ""},
       {"kind": "vocabulary", "verdict": "not_yet", "word": "trellised"}]
ses = C.post("/api/session", json={"learner": LEARNER, "title": "Fox", "source": "built-in", "score": sc, "answers": ans}).json()
check("good session -> level up", ses["change"]["level_to"] == 3, json.dumps(ses["change"]))
check("missed vocab word queued", "trellised" in ses["profile"]["practice"], str(ses["profile"]["practice"]))
w = p.split(); w[1] = "famous"; w[3] = "so"; w[8] = "hang"
sc2 = C.post("/api/score", json={"passage": p, "transcript": " ".join(w), "seconds": 40}).json()
ses2 = C.post("/api/session", json={"learner": LEARNER, "title": "Fox", "source": "built-in", "score": sc2,
                                    "answers": [{"kind": "inference", "verdict": "not_yet", "word": ""}] * 3}).json()
check("hard session -> level down", ses2["change"]["level_to"] == 2, json.dumps(ses2["change"]))
check("misread words queued", "famished" in ses2["profile"]["practice"], str(ses2["profile"]["practice"]))
check("weak skill becomes focus", ses2["profile"]["focus"] == "inference", str(ses2["profile"]["focus"]))
sc3 = C.post("/api/score", json={"passage": p, "transcript": p, "seconds": 30}).json()
ses3 = C.post("/api/session", json={"learner": LEARNER, "title": "Fox", "source": "built-in", "score": sc3, "answers": []}).json()
check("word read correctly later -> mastered", "famished" in ses3["change"]["mastered"], str(ses3["change"]["mastered"]))

# 7. create a story: picture + idea, practice words woven in, level checks
img = Image.new("RGB", (480, 360), (124, 195, 255)); d = ImageDraw.Draw(img)
d.ellipse((170, 80, 310, 220), fill=(255, 140, 40))
for x in range(185, 300, 22):
    d.rectangle((x, 200, x + 14, 310), fill=(255, 140, 40))
buf = io.BytesIO(); img.save(buf, format="PNG")
lvl = C.get(f"/api/profile/{LEARNER}").json()
r, s = timed(C.post, "/api/story", data={"idea": "an octopus who is shy and wants to make a friend", "learner_name": LEARNER},
             files=[("files", ("octo.png", buf.getvalue(), "image/png"))])
st = r.json()
check("story created", r.status_code == 200 and st["via"] == "story" and st["pages"], f"{s}s, {st.get('title')}, {st.get('attempts')} attempt(s)")
c = st.get("check", {})
check("story fits level (length + sentences)", c.get("word_count_ok") and c.get("sentence_ok"), json.dumps(c))
want_pw = lvl["practice"][:3]
check("practice words woven in", not c.get("practice_missing"), f"wanted {want_pw}, used {c.get('practice_used')}")
check("story text = joined pages", st["text"] == " ".join(pg["text"].strip() for pg in st["pages"]))
r = C.post("/api/story", data={"idea": "", "learner_name": LEARNER})
check("empty story request rejected (400)", r.status_code == 400, str(r.status_code))
r, s = timed(C.post, "/api/story", data={"idea": "a robot who learns to dance", "learner_name": LEARNER})
check("idea-only story (no picture)", r.status_code == 200 and r.json().get("pages"), f"{s}s")

# cleanup test learner
from pathlib import Path
(Path(__file__).resolve().parents[1] / "out" / "learners" / f"{LEARNER}.json").unlink(missing_ok=True)

failed = [n for n, ok, _ in results if not ok]
print(f"\n{len(results) - len(failed)}/{len(results)} passed" + (f"; FAILED: {failed}" if failed else ""))
sys.exit(1 if failed else 0)
