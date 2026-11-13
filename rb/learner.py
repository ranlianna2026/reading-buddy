"""Learner profile and adaptation, all in code: reading level, practice-word queue, skill stats, history.

After each session: level goes up when reading is accurate and understood, down when it is frustrating
(standard instructional-level bands: >=95% accuracy = independent, <90% = frustration). Missed words join a
practice queue that the next generated story must reuse; a word is mastered after it is read correctly again.
"""
import json, re, time
from pathlib import Path

DIR = Path(__file__).resolve().parents[1] / "out" / "learners"

# reading level -> story spec used by the story writer and checked by code
LEVELS = {
    1: {"words": (50, 80),   "max_sentence": 8,  "label": "Level 1 · first reader"},
    2: {"words": (80, 120),  "max_sentence": 10, "label": "Level 2 · early reader"},
    3: {"words": (120, 170), "max_sentence": 14, "label": "Level 3 · developing reader"},
    4: {"words": (170, 230), "max_sentence": 18, "label": "Level 4 · fluent reader"},
    5: {"words": (220, 300), "max_sentence": 24, "label": "Level 5 · advanced reader"},
}
KINDS = ("recall", "inference", "vocabulary")


def _path(name):
    return DIR / ((re.sub(r"[^a-z0-9_-]", "", name.lower()) or "reader") + ".json")


def load(name):
    p = _path(name)
    if p.exists():
        return json.loads(p.read_text())
    return {"name": name, "level": 2, "practice": [], "mastered": [], "skills": {k: [0, 0] for k in KINDS}, "history": []}


def save(prof):
    DIR.mkdir(parents=True, exist_ok=True)
    _path(prof["name"]).write_text(json.dumps(prof, indent=1))


def focus_skill(prof):
    """Weakest question type (lowest success rate, needing at least 2 tries to count)."""
    rates = {k: (c / t if t >= 2 else 1.0) for k, (c, t) in prof["skills"].items()}
    k = min(rates, key=rates.get)
    return k if rates[k] < 0.75 else None


def record_session(name, book_title, source, score, answers, read_words=()):
    """score: /api/score result; answers: [{kind, verdict}]. Returns the updated profile and what changed."""
    prof = load(name)
    acc, wcpm = score.get("accuracy", 0), score.get("wcpm", 0)
    right = sum(a["verdict"] == "correct" for a in answers)
    comp = right / len(answers) if answers else 0
    for a in answers:
        c, t = prof["skills"].setdefault(a["kind"], [0, 0])
        prof["skills"][a["kind"]] = [c + (a["verdict"] == "correct"), t + 1]

    # practice words: add misses (and missed vocabulary answers); master words read correctly this time
    missed = set(score.get("practice_words", [])) | {a["word"] for a in answers
                                                      if a.get("word") and a["verdict"] != "correct"}
    read_ok = {w.lower() for w in read_words}
    newly_mastered = [w for w in prof["practice"] if w in read_ok and w not in missed]
    prof["practice"] = [w for w in prof["practice"] if w not in newly_mastered]
    prof["practice"] += [w for w in sorted(missed) if w not in prof["practice"]]
    prof["practice"] = prof["practice"][-12:]
    prof["mastered"] = (prof["mastered"] + newly_mastered)[-50:]

    old = prof["level"]
    if acc >= 0.95 and comp >= 2 / 3 and score.get("finished", True):
        prof["level"] = min(5, old + 1)
        why = "accurate reading and good understanding"
    elif acc < 0.90 or (answers and comp < 1 / 3):
        prof["level"] = max(1, old - 1)
        why = "this one was hard, so the next story will be a little easier"
    else:
        why = "just right, so we'll stay here for more practice"
    prof["history"].append({"ts": int(time.time()), "title": book_title, "source": source, "wcpm": wcpm,
                            "accuracy": acc, "comprehension": round(comp, 2), "level": old})
    prof["history"] = prof["history"][-30:]
    save(prof)
    return prof, {"level_from": old, "level_to": prof["level"], "why": why, "mastered": newly_mastered,
                  "new_practice": [w for w in sorted(missed)]}


def check_story(text, level, practice_words):
    """Code check that a generated story fits its level and really uses the practice words."""
    spec = LEVELS[level]
    words = text.split()
    sents = [s for s in re.split(r"[.!?]+", text) if s.strip()]
    longest = max((len(s.split()) for s in sents), default=0)
    norm_text = " " + re.sub(r"[^a-z' ]", " ", text.lower()) + " "
    used = [w for w in practice_words if re.search(rf"\b{re.escape(w.lower())}", norm_text)]
    lo, hi = spec["words"]
    return {"word_count": len(words), "target_words": [lo, hi], "word_count_ok": lo * 0.85 <= len(words) <= hi * 1.15,
            "longest_sentence": longest, "sentence_ok": longest <= spec["max_sentence"] + 2,
            "practice_used": used, "practice_missing": [w for w in practice_words if w not in used]}
