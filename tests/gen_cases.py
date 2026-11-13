"""Auto-generated test cases, in every supported language.

1. Mutation tests (deterministic, no model): plant random misreads / skips / extra words into real passages and
   require the scorer to find exactly the planted mistakes.
2. Model-generated cases (needs the server + API keys): Muse writes a story and quiz per language; a separate
   Muse call plays a child and writes correct and wrong answers to every open question; the grader must judge
   each one right. Also checks language, level and single-choice well-formedness.

    .venv/bin/python tests/gen_cases.py                 # both parts
    .venv/bin/python tests/gen_cases.py --offline       # mutation tests only
"""
import json, os, random, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from rb import lang as L  # noqa: E402
from rb.books import BUILTIN  # noqa: E402
from rb.scoring import _close, norm, score  # noqa: E402

LANGS = ["en", "es", "fr", "zh", "ar"]
EXTRA = {   # more passages per language for mutation tests (our own text)
    "en": ["Mia found a small blue egg under the old oak tree. She carried it home in her hat and kept it warm all night.",
           "The robot liked to dance when nobody was looking. One day the whole class saw him spin, and everyone clapped."],
    "es": ["Mía encontró un huevo azul debajo del viejo roble. Lo llevó a casa en su sombrero y lo cuidó toda la noche.",
           "Al robot le gustaba bailar cuando nadie miraba. Un día toda la clase lo vio girar y todos aplaudieron."],
    "fr": ["Mia trouva un petit œuf bleu sous le vieux chêne. Elle le porta à la maison dans son chapeau et le garda au chaud.",
           "Le robot aimait danser quand personne ne regardait. Un jour, toute la classe le vit tourner et tout le monde applaudit."],
    "zh": ["小美在老橡树下发现了一个蓝色的小蛋。她把蛋放在帽子里带回家，整晚都让它暖暖的。",
           "小机器人喜欢在没人看的时候跳舞。有一天，全班同学都看见它转圈，大家都拍手了。"],
    "ar": ["وجدت مريم بيضة زرقاء صغيرة تحت شجرة البلوط القديمة. حملتها إلى البيت في قبعتها وأبقتها دافئة طوال الليل.",
           "كان الروبوت يحب الرقص عندما لا ينظر إليه أحد. وفي يوم من الأيام رآه كل الصف وهو يدور، فصفق الجميع."],
}
DISTRACT = {
    "en": ["banana", "purple", "rocket", "pillow", "thunder", "giraffe", "pencil", "window"],
    "es": ["plátano", "morado", "cohete", "almohada", "trueno", "jirafa", "lápiz", "ventana"],
    "fr": ["banane", "violet", "fusée", "oreiller", "tonnerre", "girafe", "crayon", "fenêtre"],
    "zh": ["香", "蕉", "紫", "火", "箭", "枕", "雷", "笔"],
    "ar": ["موزة", "بنفسجي", "صاروخ", "وسادة", "رعد", "زرافة", "قلم", "نافذة"],
}
results = []


def check(lang, name, cond, detail=""):
    results.append({"lang": lang, "test": name, "ok": bool(cond), "detail": detail})
    if not cond:
        print(f"  FAIL [{lang}] {name}  {detail}")


# ---------------------------------------------------------------- 1. mutation tests
def mutation_tests(n_per_passage=50, seed=7):
    rng = random.Random(seed)
    for lang in LANGS:
        passages = [b["text"] for b in BUILTIN.values() if b.get("lang", "en") == lang] + EXTRA[lang]
        cases = 0
        for p in passages:
            toks = L.tokens(p, lang)
            words = [i for i, t in enumerate(toks) if norm(t)]
            # perfect read and stopping early
            s = score(p, p, 30, lang)
            check(lang, "perfect read = 100%, no miscues", s["accuracy"] == 1.0 and not s["miscues"], p[:30])
            cut = words[len(words) // 2]
            s = score(p, (" " if not L.is_cjk(lang) else "").join(toks[:cut]), 15, lang)
            check(lang, "stopping halfway is not errors", s["accuracy"] == 1.0 and not s["miscues"] and not s["finished"], p[:30])
            for _ in range(n_per_passage):
                # pick 1-3 mistake positions, spaced apart, whose token differs from both neighbours (unambiguous)
                cand = [i for k, i in enumerate(words[1:-1], 1)
                        if norm(toks[i]) not in (norm(toks[words[k - 1]]), norm(toks[words[k + 1]]))]
                pos = []
                for i in rng.sample(cand, min(len(cand), 3)):
                    if all(abs(i - j) >= 3 for j in pos):
                        pos.append(i)
                hyp, expect = list(toks), {}
                for i in sorted(pos, reverse=True):
                    kind = rng.choice(["misread", "skipped", "insert"])
                    if kind == "misread":
                        w = rng.choice([d for d in DISTRACT[lang] if not _close(norm(toks[i]), norm(d)) and norm(d) != norm(toks[i])])
                        hyp[i] = w
                        expect[i] = "misread"
                    elif kind == "skipped":
                        del hyp[i]
                        expect[i] = "skipped"
                    else:
                        hyp.insert(i, rng.choice(DISTRACT[lang]))     # extra word: not a reading error
                s = score(p, (" " if not L.is_cjk(lang) else "").join(hyp), 30, lang)
                got = {m["index"]: m["type"] for m in s["miscues"]}
                cases += 1
                check(lang, "planted mistakes found exactly", got == expect,
                      f"planted {expect} got {got} :: {''.join(hyp) if L.is_cjk(lang) else ' '.join(hyp)}"[:300])
        print(f"[{lang}] mutation cases: {cases} + {2 * len(passages)} base")


# ---------------------------------------------------------------- 2. model-generated cases
CHILD = {"type": "object", "additionalProperties": False, "required": ["correct", "wrong"], "properties": {
    "correct": {"type": "array", "minItems": 2, "maxItems": 2, "items": {"type": "string"},
                "description": "two different right answers, the way a 7-year-old would say them out loud"},
    "wrong": {"type": "array", "minItems": 2, "maxItems": 2, "items": {"type": "string"},
              "description": "two clearly wrong answers a 7-year-old might give (not 'I don't know')"}}}


def model_tests():
    import httpx
    from rb.meta_api import chat_json
    c = httpx.Client(base_url=os.environ.get("BASE", "http://127.0.0.1:8010"), timeout=240)
    ideas = {"en": "a little cloud who is afraid of thunder", "es": "una nube pequeña que tiene miedo de los truenos",
             "fr": "un petit nuage qui a peur du tonnerre", "zh": "一朵害怕打雷的小云朵",
             "ar": "غيمة صغيرة تخاف من الرعد"}
    for lang in LANGS:
        t = time.time()
        st = c.post("/api/story", data={"idea": ideas[lang], "learner_name": f"gen-{lang}", "lang": lang}).json()
        ck = st["check"]
        check(lang, "story written in the right language", ck["language_ok"], st["title"])
        check(lang, "story fits its level", ck["word_count_ok"] and ck["sentence_ok"], f"{ck['word_count']} {ck['unit']}")
        qj = c.post("/api/questions", json={"passage": st["text"], "lang": lang, "learner": "gen-l3"}).json()   # level 3: mixed formats
        qs = qj["questions"]
        check(lang, "exactly 3 questions", len(qs) == 3, str([q["kind"] for q in qs]))
        check(lang, "mixed formats (choice + open)", {q["format"] for q in qs} == {"choice", "open"}, str([q["format"] for q in qs]))
        for q in qs:
            check(lang, f"{q['kind']} question in the right language", L.detect_script_ok(q["question"] + " " + " ".join(q["choices"]), lang), q["question"])
            if q["format"] == "choice":
                check(lang, "choice: 3 distinct options, valid answer", len(set(q["choices"])) == 3 and 0 <= q["answer_index"] < 3, str(q["choices"]))
                continue
            kid = chat_json(f"You write test answers for a children's reading quiz, in {L.get(lang)['name']}.",
                            f"Story:\n{st['text']}\n\nQuestion: {q['question']}\nExpected answer: {q['expected_answer']}",
                            CHILD, "child_answers")
            for a in kid["correct"]:
                g = c.post("/api/grade", json={"passage": st["text"], "question": q, "answer": a, "lang": lang}).json()
                check(lang, "generated right answer graded correct", g["verdict"] == "correct", f"{a!r} -> {g['verdict']}")
                check(lang, "feedback in the right language", L.detect_script_ok(g["feedback"], lang), g["feedback"][:80])
            for a in kid["wrong"]:
                g = c.post("/api/grade", json={"passage": st["text"], "question": q, "answer": a, "lang": lang}).json()
                check(lang, "generated wrong answer not graded correct", g["verdict"] != "correct", f"{a!r} -> {g['verdict']}")
        sc = c.post("/api/score", json={"passage": st["text"], "transcript": st["text"], "seconds": 40, "lang": lang}).json()
        check(lang, "story read perfectly scores 100%", sc["accuracy"] == 1.0, f"{sc['wcpm']} {sc['unit']}/min")
        print(f"[{lang}] model-generated cases done in {round(time.time() - t)}s")
        (ROOT / "out" / "learners" / f"gen-{lang}{'' if lang == 'en' else '-' + lang}.json").unlink(missing_ok=True)


if __name__ == "__main__":
    mutation_tests()
    if "--offline" not in sys.argv:
        model_tests()
    by = {}
    for r in results:
        by.setdefault(r["lang"], [0, 0])[0 if r["ok"] else 1] += 1
    (ROOT / "out").mkdir(exist_ok=True)
    (ROOT / "out" / "gen_cases_results.json").write_text(json.dumps(results, indent=1, ensure_ascii=False))
    print("\n" + "  ".join(f"{k}: {p} passed, {f} failed" for k, (p, f) in by.items()))
    print(f"TOTAL {sum(p for p, _ in by.values())}/{len(results)} passed")
    sys.exit(1 if any(not r["ok"] for r in results) else 0)
