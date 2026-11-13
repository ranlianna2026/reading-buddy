"""Feedback loop: capture -> act now -> adapt the learner -> human review -> regression test cases.

Events (out/feedback.jsonl, one JSON object per line):
  story        {rating: up|down, reasons: [too_hard, too_easy, boring, scary, wrong_language, loved_it]}
  picture      {page, reasons: [doesnt_match, looks_different, scary, has_text]}
  word         {expected, said}                      child says a word marked wrong was read right
  appeal       {question, answer, verdict_before, verdict_after}   "I think I was right!"
  session      {mood: happy|ok|sad}
  review       {id, label}                           parent confirms/overturns an item -> gold label
Every event carries learner, lang, title and a timestamp; each gets an id.
"""
import json, os, time, uuid
from pathlib import Path

from . import learner as LR
from . import lang as L

ROOT = Path(__file__).resolve().parents[1]
LOG = Path(os.environ.get("RB_FEEDBACK_LOG", ROOT / "out" / "feedback.jsonl"))
KINDS = {"story", "picture", "word", "appeal", "session", "review"}


def _read(include_tests=False):
    if not LOG.exists():
        return []
    evs = [json.loads(l) for l in LOG.read_text().splitlines() if l.strip()]
    if include_tests or os.environ.get("RB_FEEDBACK_LOG"):          # isolated test logs keep everything
        return evs
    test_ids = {e["id"] for e in evs if LR.is_test(e.get("learner"))}
    return [e for e in evs if e["id"] not in test_ids and e.get("id_ref") not in test_ids]


def log(kind, data, learner="Reader", lang="en", title=""):
    if kind not in KINDS:
        raise ValueError(f"unknown feedback kind {kind}")
    ev = {"id": uuid.uuid4().hex[:10], "ts": int(time.time()), "kind": kind, "learner": learner, "lang": lang,
          "title": title, **data}
    LOG.parent.mkdir(exist_ok=True)
    with LOG.open("a") as fh:
        fh.write(json.dumps(ev, ensure_ascii=False) + "\n")
    adapt(ev)
    return ev


def adapt(ev):
    """Feedback that changes what the learner gets next time."""
    if ev["kind"] not in ("story", "word"):
        return
    prof = LR.load(ev["learner"], ev["lang"])
    prefs = prof.setdefault("prefs", {"liked": [], "avoid": [], "level_nudge": 0})
    if ev["kind"] == "story":
        r = set(ev.get("reasons", []))
        if "too_hard" in r:
            prof["level"] = max(1, prof["level"] - 1)
        if "too_easy" in r:
            prof["level"] = min(5, prof["level"] + 1)
        if "scary" in r and "scary things" not in prefs["avoid"]:
            prefs["avoid"].append("scary things")
        topic = ev.get("topic", "")
        if topic and (ev.get("rating") == "up" or "loved_it" in r) and topic not in prefs["liked"]:
            prefs["liked"] = (prefs["liked"] + [topic])[-6:]
        if topic and ("boring" in r) and topic not in prefs["avoid"]:
            prefs["avoid"] = (prefs["avoid"] + [topic])[-6:]
    if ev["kind"] == "word" and ev.get("expected") and ev.get("said"):
        acc = prof.setdefault("accepted", {})                       # speech-recognition confusions for this child
        e, s = L.norm(ev["expected"]), L.norm(ev["said"])
        acc[e] = sorted(set(acc.get(e, [])) | {s})
        prof["practice"] = [w for w in prof["practice"] if w != e]
    LR.save(prof)


def accepted(learner, lang):
    return LR.load(learner, lang).get("accepted", {})


def pending_review():
    """Items a parent should confirm: disputed answers and 'I read that right' words not yet reviewed."""
    evs = _read()
    reviewed = {e["id_ref"] for e in evs if e["kind"] == "review"}
    return [e for e in evs if e["kind"] in ("appeal", "word") and e["id"] not in reviewed]


def summary():
    evs = _read()
    out = {"total": len(evs), "by_kind": {}, "story": {"up": 0, "down": 0, "reasons": {}}, "picture_reasons": {},
           "appeals": {"total": 0, "overturned": 0}, "words": 0, "moods": {}, "gold_labels": 0,
           "pending_review": len(pending_review())}
    for e in evs:
        out["by_kind"][e["kind"]] = out["by_kind"].get(e["kind"], 0) + 1
        if e["kind"] == "story":
            out["story"][e.get("rating", "down")] = out["story"].get(e.get("rating", "down"), 0) + 1
            for r in e.get("reasons", []):
                out["story"]["reasons"][r] = out["story"]["reasons"].get(r, 0) + 1
        elif e["kind"] == "picture":
            for r in e.get("reasons", []):
                out["picture_reasons"][r] = out["picture_reasons"].get(r, 0) + 1
        elif e["kind"] == "appeal":
            out["appeals"]["total"] += 1
            out["appeals"]["overturned"] += e.get("verdict_after") == "correct"
        elif e["kind"] == "word":
            out["words"] += 1
        elif e["kind"] == "session":
            out["moods"][e.get("mood")] = out["moods"].get(e.get("mood"), 0) + 1
        elif e["kind"] == "review":
            out["gold_labels"] += 1
    return out


def gold_cases():
    """Parent-confirmed items -> regression test cases (used by tests/feedback_cases.py)."""
    evs = _read()
    by_id = {e["id"]: e for e in evs}
    cases = []
    for r in (e for e in evs if e["kind"] == "review"):
        src = by_id.get(r["id_ref"])
        if not src:
            continue
        if src["kind"] == "appeal":
            cases.append({"type": "grade", "lang": src["lang"], "passage": src.get("passage", ""),
                          "question": src["question"], "answer": src["answer"],
                          "expect_correct": r["label"] == "correct", "source": src["id"]})
        elif src["kind"] == "word":
            cases.append({"type": "word", "lang": src["lang"], "learner": src["learner"], "expected": src["expected"],
                          "said": src["said"], "expect_ok": r["label"] == "correct", "source": src["id"]})
    return cases
