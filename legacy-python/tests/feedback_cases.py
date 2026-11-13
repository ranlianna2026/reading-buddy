"""Feedback-loop tests.

Part 1 (loop mechanics, isolated log): every kind of feedback is captured, acted on, adapts the learner,
lands in the parent's review queue, and confirmed items turn into gold regression cases.
Part 2 (regression): every parent-confirmed item in the real feedback log (out/feedback.jsonl) is replayed
against the current grader / scorer, so a fix never regresses.

    .venv/bin/python tests/feedback_cases.py
"""
import json, os, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REAL_LOG = ROOT / "out" / "feedback.jsonl"
tmp = Path(tempfile.mkdtemp()) / "feedback.jsonl"
os.environ["RB_FEEDBACK_LOG"] = str(tmp)            # isolate the mechanics test from real feedback
sys.path.insert(0, str(ROOT))
from fastapi.testclient import TestClient  # noqa: E402
import app as appmod  # noqa: E402
from rb import feedback, learner  # noqa: E402

c = TestClient(appmod.app)
results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond)))
    print(f"{'PASS' if cond else 'FAIL'}  {name}  {detail}")


L = "fb-test"
P = "A famished Fox saw some clusters of ripe black grapes hanging from a trellised vine. She could not reach them. " \
    "At last she turned away and said: \"The Grapes are sour.\""

# --- story feedback adapts the learner
lvl0 = c.get(f"/api/profile/{L}").json()["level"]
r = c.post("/api/feedback", json={"kind": "story", "learner": L, "title": "Fox", "data": {"rating": "down", "reasons": ["too_hard", "scary"], "topic": "foxes"}}).json()
check("too hard -> level down", r["profile"]["level"] == max(1, lvl0 - 1), f"{lvl0} -> {r['profile']['level']}")
check("scary -> avoided in future stories", "scary things" in r["profile"]["prefs"]["avoid"])
r = c.post("/api/feedback", json={"kind": "story", "learner": L, "data": {"rating": "up", "reasons": ["loved_it"], "topic": "octopus"}}).json()
check("loved topic remembered", "octopus" in r["profile"]["prefs"]["liked"])
r = c.post("/api/feedback", json={"kind": "nonsense", "learner": L}).status_code
check("unknown feedback kind rejected", r == 400)

# --- "I read that right": the child's pronunciation is accepted from now on
s1 = c.post("/api/score", json={"passage": P, "transcript": P.replace("famished", "famish"), "seconds": 20, "learner": L}).json()
check("speech confusion first counted as a miscue", any(m["expected"] == "famished" for m in s1["miscues"]))
c.post("/api/feedback", json={"kind": "word", "learner": L, "title": "Fox", "data": {"expected": "famished", "said": "famish"}})
s2 = c.post("/api/score", json={"passage": P, "transcript": P.replace("famished", "famish"), "seconds": 20, "learner": L}).json()
check("same confusion accepted next time", not any(m["expected"] == "famished" for m in s2["miscues"]), f"accuracy {s2['accuracy']}")
s3 = c.post("/api/score", json={"passage": P, "transcript": P.replace("famished", "famish"), "seconds": 20, "learner": "someone-else"}).json()
check("acceptance is per child", any(m["expected"] == "famished" for m in s3["miscues"]))

# --- appeal: careful second opinion (real Muse call)
q = {"kind": "inference", "question": "Why did the Fox say the grapes were sour?", "format": "open",
     "expected_answer": "She was disappointed she could not reach them", "quote": "She could not reach them", "choices": [], "answer_index": -1}
g = c.post("/api/appeal", json={"passage": P, "question": q, "answer": "because she couldnt get them so she pretended they were yucky",
                                "verdict_before": "partly", "learner": L, "title": "Fox"}).json()
check("valid appeal is overturned to correct", g["verdict"] == "correct", g["feedback"][:70])
g = c.post("/api/appeal", json={"passage": P, "question": q, "answer": "because she ate too many grapes", "verdict_before": "not_yet",
                                "learner": L, "title": "Fox"}).json()
check("invalid appeal stays not correct", g["verdict"] != "correct", g["feedback"][:70])

# --- picture + mood feedback captured; summary
c.post("/api/feedback", json={"kind": "picture", "learner": L, "data": {"page": 1, "reasons": ["looks_different"]}})
c.post("/api/feedback", json={"kind": "session", "learner": L, "data": {"mood": "happy"}})
sm = c.get("/api/feedback/summary").json()
check("summary counts everything", sm["by_kind"].get("story") == 2 and sm["appeals"]["total"] == 2 and sm["words"] == 1
      and sm["picture_reasons"].get("looks_different") == 1 and sm["moods"].get("happy") == 1, json.dumps(sm["by_kind"]))

# --- parent review -> gold cases
queue = c.get("/api/review").json()
check("appeals + word fixes wait for a parent", len(queue) == 3, f"{len(queue)} pending")
for e in queue:
    lab = "correct" if (e["kind"] == "word" or "pretended" in e.get("answer", "")) else "incorrect"
    c.post("/api/review", json={"id_ref": e["id"], "label": lab})
check("queue empty after review", c.get("/api/review").json() == [])
gold = feedback.gold_cases()
check("confirmed items became gold cases", len(gold) == 3 and {g["type"] for g in gold} == {"grade", "word"}, str([g["type"] for g in gold]))


def replay(cases, tag):
    for k in cases:
        if k["type"] == "grade":
            g = c.post("/api/grade", json={"passage": k["passage"], "question": k["question"], "answer": k["answer"], "lang": k["lang"]}).json()
            ok = (g["verdict"] == "correct") == k["expect_correct"]
            check(f"[{tag}] gold grade case {k['source']}", ok or g["verdict"] == "partly" and k["expect_correct"],
                  f"{k['answer'][:40]!r} expect {'correct' if k['expect_correct'] else 'not'} got {g['verdict']}")
        else:
            acc = learner.load(k["learner"], k["lang"]).get("accepted", {}) if k["expect_ok"] else {}
            from rb.scoring import norm
            check(f"[{tag}] gold word case {k['source']}", (norm(k["said"]) in acc.get(norm(k["expected"]), [])) == k["expect_ok"])


replay(gold, "loop")
(ROOT / "out" / "learners" / f"{L}.json").unlink(missing_ok=True)

# --- part 2: replay real parent-confirmed feedback as regression tests
os.environ["RB_FEEDBACK_LOG"] = str(REAL_LOG)
feedback.LOG = REAL_LOG
real = feedback.gold_cases()
print(f"\nreal feedback log: {len(real)} parent-confirmed regression case(s)")
replay(real, "real")

failed = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(failed)}/{len(results)} passed" + (f"; FAILED: {failed}" if failed else ""))
sys.exit(1 if failed else 0)
