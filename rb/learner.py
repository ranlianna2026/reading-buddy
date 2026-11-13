"""Learner profile and adaptation, all in code: reading level, practice-word queue, skill stats, history.

After each session: level goes up when reading is accurate and understood, down when it is frustrating
(standard instructional-level bands: >=95% accuracy = independent, <90% = frustration). Missed words join a
practice queue that the next generated story must reuse; a word is mastered after it is read correctly again.
"""
import json, re, time
from pathlib import Path

from . import lang as L

DIR = Path(__file__).resolve().parents[1] / "out" / "learners"
# names used by automated tests: kept out of the parent dashboard, review queue and gold cases
TEST_PREFIXES = ("e2e", "gen-", "fb-", "fbui", "test", "uitest", "speedtest", "ideatest", "langtest")


def is_test(name):
    return (name or "").lower().startswith(TEST_PREFIXES)

# reading level -> story spec used by the story writer and checked by code
LEVELS = {
    1: {"words": (50, 80),   "max_sentence": 8,  "label": "Level 1 · first reader"},
    2: {"words": (80, 120),  "max_sentence": 10, "label": "Level 2 · early reader"},
    3: {"words": (120, 170), "max_sentence": 14, "label": "Level 3 · developing reader"},
    4: {"words": (170, 230), "max_sentence": 18, "label": "Level 4 · fluent reader"},
    5: {"words": (220, 300), "max_sentence": 24, "label": "Level 5 · advanced reader"},
}
KINDS = ("recall", "inference", "vocabulary")

# the child's age sets the starting reading level (typical decoding by age; reading then moves it up or down)
AGES = range(4, 13)
AGE_LEVEL = {4: 1, 5: 1, 6: 1, 7: 2, 8: 3, 9: 4, 10: 5, 11: 5, 12: 5}
DEFAULT_AGE = "6-10"      # wording for the tutor when the age isn't known


def _path(name, lang="en"):
    base = re.sub(r"[^a-z0-9_-]", "", name.lower()) or "reader"
    return DIR / (base + ("" if lang == "en" else f"-{lang}") + ".json")      # one profile per language


def _ages_path():
    return DIR / "_ages.json"


def get_age(name):
    """The child's age (one per child, shared by every language), or None if nobody set it."""
    try:
        return json.loads(_ages_path().read_text()).get(_path(name).stem)
    except (OSError, ValueError):
        return None


def level_for_age(age):
    return AGE_LEVEL.get(age, 2) if age else 2


def age_words(age):
    """How the tutor and story writer describe the reader."""
    return str(age) if age else DEFAULT_AGE


def set_age(name, age):
    """Save the age. In every language where the child hasn't read aloud yet, the level starts at the age's
    level; once they have, the level they earned by reading is kept."""
    if age not in AGES:
        raise ValueError(f"age must be {AGES.start}-{AGES.stop - 1}")
    DIR.mkdir(parents=True, exist_ok=True)
    try:
        ages = json.loads(_ages_path().read_text())
    except (OSError, ValueError):
        ages = {}
    ages[_path(name).stem] = age
    _ages_path().write_text(json.dumps(ages, indent=1))
    for lang in L.LANGS:
        if _path(name, lang).exists():
            prof = load(name, lang)
            if not any(h.get("accuracy") is not None and h.get("wcpm") for h in prof["history"]):
                prof["level"] = level_for_age(age)
                save(prof)


def load(name, lang="en"):
    p = _path(name, lang)
    age = get_age(name)
    if p.exists():
        prof = json.loads(p.read_text())
    else:
        prof = {"name": name, "lang": lang, "level": level_for_age(age), "practice": [], "mastered": [],
                "skills": {k: [0, 0] for k in KINDS}, "history": []}
    prof["age"] = age
    return prof


def save(prof):
    DIR.mkdir(parents=True, exist_ok=True)
    prof = {k: v for k, v in prof.items() if k != "age"}       # the age lives in _ages.json, one per child
    _path(prof["name"], prof.get("lang", "en")).write_text(json.dumps(prof, indent=1, ensure_ascii=False))


def focus_skill(prof):
    """Weakest question type (lowest success rate, needing at least 2 tries to count)."""
    rates = {k: (c / t if t >= 2 else 1.0) for k, (c, t) in prof["skills"].items()}
    k = min(rates, key=rates.get)
    return k if rates[k] < 0.75 else None


def record_session(name, book_title, source, score, answers, read_words=(), lang="en"):
    """score: /api/score result; answers: [{kind, verdict}]. Returns the updated profile and what changed."""
    prof = load(name, lang)
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
    read_aloud = bool(score.get("words_attempted"))
    if not read_aloud:                      # only listened + answered: reading level is not judged
        why = "listening practice, so your reading level stays the same"
    elif acc >= 0.95 and comp >= 2 / 3 and score.get("finished", True):
        prof["level"] = min(5, old + 1)
        why = "accurate reading and good understanding"
    elif acc < 0.90 or (answers and comp < 1 / 3):
        prof["level"] = max(1, old - 1)
        why = "this one was hard, so the next story will be a little easier"
    else:
        why = "just right, so we'll stay here for more practice"
    prof["history"].append({"ts": int(time.time()), "title": book_title, "source": source, "wcpm": wcpm if read_aloud else None,
                            "accuracy": acc if read_aloud else None, "comprehension": round(comp, 2), "level": old,
                            "seconds": score.get("seconds", 0), "words_read": score.get("words_correct", 0),
                            "questions": len(answers), "right": right, "read_aloud": read_aloud,
                            "unit": score.get("unit", "words"), "mastered": newly_mastered})
    prof["history"] = prof["history"][-200:]
    save(prof)
    return prof, {"level_from": old, "level_to": prof["level"], "why": why, "mastered": newly_mastered,
                  "new_practice": [w for w in sorted(missed)]}


def spec_for(level, lang="en"):
    """Level spec in the language's unit: words, or Han characters for Chinese (about 1.6 per English word)."""
    s = LEVELS[level]
    if L.is_cjk(lang):
        return {"words": (int(s["words"][0] * 1.6), int(s["words"][1] * 1.6)), "max_sentence": int(s["max_sentence"] * 1.8),
                "unit": "characters", "label": s["label"]}
    return {**s, "unit": "words"}


def check_story(text, level, practice_words, lang="en"):
    """Code check that a generated story fits its level, is in the right language, and uses the practice words."""
    spec = spec_for(level, lang)
    n = L.length(text, lang)
    longest = max((L.length(s, lang) for s in L.sentences(text, lang)), default=0)
    toks = [L.norm(t) for t in L.tokens(text, lang)]
    joined = "".join(toks) if L.is_cjk(lang) else " " + " ".join(toks) + " "
    used = [w for w in practice_words if (L.norm(w) in joined if L.is_cjk(lang) else f" {L.norm(w)}" in joined)]
    lo, hi = spec["words"]
    return {"word_count": n, "unit": spec["unit"], "target_words": [lo, hi], "word_count_ok": lo * 0.85 <= n <= hi * 1.15,
            "longest_sentence": longest, "sentence_ok": longest <= spec["max_sentence"] + 2,
            "language_ok": L.detect_script_ok(text, lang),
            "practice_used": used, "practice_missing": [w for w in practice_words if w not in used]}


def all_children():
    """Parent dashboard: every child, every language, with a day-by-day rollup of their sessions."""
    import datetime as dt
    kids = {}
    for p in sorted(DIR.glob("*.json")):
        if p.name.startswith("_"):
            continue                                                     # _ages.json etc. are not profiles
        prof = json.loads(p.read_text())
        name, lang = prof.get("name", p.stem), prof.get("lang", "en")
        if is_test(name):
            continue                                                     # skip automated-test learners
        kid = kids.setdefault(name.lower(), {"name": name, "age": get_age(name), "langs": {}, "days": {}, "totals": {
            "sessions": 0, "minutes": 0.0, "books": set(), "mastered": 0}})
        kid["langs"][lang] = {"level": prof["level"], "label": LEVELS[prof["level"]]["label"], "practice": prof["practice"][:6],
                              "skills": prof["skills"], "mastered": len(prof.get("mastered", [])),
                              "likes": prof.get("prefs", {}).get("liked", [])}
        for h in prof["history"]:
            day = dt.datetime.fromtimestamp(h["ts"]).strftime("%Y-%m-%d")
            d = kid["days"].setdefault(day, {"day": day, "sessions": 0, "minutes": 0.0, "books": [], "wcpm": [], "accuracy": [],
                                             "comprehension": [], "mastered": [], "langs": set()})
            d["sessions"] += 1
            d["minutes"] += (h.get("seconds") or 0) / 60
            if h["title"] not in d["books"]:
                d["books"].append(h["title"])
            if h.get("wcpm") is not None:
                d["wcpm"].append(h["wcpm"]); d["accuracy"].append(h["accuracy"])
            d["comprehension"].append(h.get("comprehension", 0))
            d["mastered"] += h.get("mastered", [])
            d["langs"].add(lang)
            t = kid["totals"]; t["sessions"] += 1; t["minutes"] += (h.get("seconds") or 0) / 60; t["books"].add(h["title"])
        kid["totals"]["mastered"] += len(prof.get("mastered", []))
    avg = lambda xs: round(sum(xs) / len(xs), 2) if xs else None
    out = []
    for kid in kids.values():
        days = []
        for d in sorted(kid["days"].values(), key=lambda d: d["day"]):
            days.append({"day": d["day"], "sessions": d["sessions"], "minutes": round(d["minutes"], 1), "books": d["books"],
                         "wcpm": round(avg(d["wcpm"])) if d["wcpm"] else None, "accuracy": avg(d["accuracy"]),
                         "comprehension": avg(d["comprehension"]), "mastered": d["mastered"], "langs": sorted(d["langs"])})
        t = kid["totals"]
        streak, today = 0, dt.date.today()
        have = {d["day"] for d in days}
        while (today - dt.timedelta(days=streak)).strftime("%Y-%m-%d") in have:
            streak += 1
        out.append({"name": kid["name"], "age": kid["age"], "langs": kid["langs"], "days": days,
                    "totals": {"sessions": t["sessions"], "minutes": round(t["minutes"], 1), "books": len(t["books"]),
                               "mastered": t["mastered"], "streak": streak}})
    return out


def make_samples():
    """Two sample kids (clearly named 'Sample ...') for demoing the parent dashboard."""
    make_sample("Sample Mia", seed=4)
    make_sample("Sample Leo", seed=9, base=48, level=2)
    make_sample("Sample Leo", seed=11, base=40, level=1, lang="es",
                books=["La zorra y las uvas", "Nubecita y el Trueno", "Tuga quiere volar"])


def make_sample(name="Sample Kid", seed=4, base=62, level=3, lang="en", books=None):
    """Two weeks of made-up practice for demoing the parent dashboard (clearly named 'Sample Kid')."""
    import random
    rng = random.Random(seed)
    books = books or ["The Tale of Peter Rabbit", "Tilly Wants to Fly", "The Velveteen Rabbit", "Ollie Swims Down", "La zorra y las uvas",
             "The Fox and the Grapes", "Pip Hears the Rumble", "Shy Ollie Says Hi"]
    prof = {"name": name, "lang": lang, "level": level, "practice": ["whisper", "bravely", "garden"], "mastered": ["octopus", "scared",
            "breath", "famished", "trellised", "parsley"], "skills": {"recall": [17, 19], "inference": [11, 17], "vocabulary": [14, 18]},
            "history": [], "prefs": {"liked": ["octopus", "space"], "avoid": [], "level_nudge": 0}, "sample": True}
    now = int(time.time())
    for d in range(13, -1, -1):
        if d in (9, 4):
            continue                                            # a couple of days off
        for k in range(rng.choice([1, 1, 2])):
            if lang != "en" and d % 3:
                continue                                        # second language: fewer sessions
            wcpm = int(base + (13 - d) * 2.4 + rng.uniform(-5, 5))
            prof["history"].append({"ts": now - d * 86400 - k * 3600, "title": rng.choice(books), "source": "story",
                                    "wcpm": wcpm, "accuracy": round(min(0.99, 0.86 + (13 - d) * 0.008 + rng.uniform(-0.02, 0.02)), 3),
                                    "comprehension": rng.choice([0.67, 1.0, 1.0, 0.67, 0.33]), "level": max(1, level - 1) if d > 7 else level,
                                    "seconds": rng.randint(150, 420), "words_read": rng.randint(80, 160), "questions": 3,
                                    "right": 2, "read_aloud": True, "unit": "words",
                                    "mastered": [rng.choice(prof["mastered"])] if rng.random() < 0.3 else []})
    save(prof)
    return prof
