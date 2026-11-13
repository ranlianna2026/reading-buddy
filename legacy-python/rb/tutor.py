"""Comprehension tutor: Muse Spark writes questions and grades spoken answers; code checks every quote
really appears in the passage. Keenable adds kid-safe "learn more" background with sources."""
import random, re

from . import lang as L
from .books import ksearch
from .meta_api import chat_json, data_url
from .scoring import norm

SYSTEM = ("You are Reading Buddy, a warm, patient reading tutor for children aged {age}. Use short, simple "
          "sentences. Be encouraging and specific. Never shame. Ground everything in the passage. "
          "Write everything you say in {language}; quotes must be copied exactly from the passage.")


def sysmsg(age, lang):
    extra = " Use Simplified Chinese characters only; convert any Traditional characters from sources." if lang == "zh" else ""
    return SYSTEM.format(age=age, language=L.get(lang)["name"]) + extra


def quote_ok(quote, passage, lang="en"):
    q = " ".join(norm(w) for w in L.tokens(quote, lang) if norm(w))
    p = " ".join(norm(w) for w in L.tokens(passage, lang) if norm(w))
    return bool(q) and q in p


Q_SCHEMA = {"type": "object", "additionalProperties": False, "required": ["questions", "learn_topic"], "properties": {
    "learn_topic": {"type": "string", "description": "one concrete real-world thing from the story a child would enjoy learning a fact about, e.g. 'foxes' or 'velveteen fabric'"},
    "questions": {"type": "array", "minItems": 3, "maxItems": 3, "items": {
        "type": "object", "additionalProperties": False,
        "required": ["kind", "question", "expected_answer", "quote", "word", "choices", "answer_index"],
        "properties": {
            "kind": {"type": "string", "enum": ["recall", "inference", "vocabulary"]},
            "question": {"type": "string", "description": "the question only, no praise or preamble"},
            "expected_answer": {"type": "string", "description": "the main answer plus other answers the passage would also support"},
            "quote": {"type": "string", "description": "exact words copied from the passage that support the answer"},
            "word": {"type": "string", "description": "for vocabulary questions, the word asked about; else empty"},
            "choices": {"type": "array", "items": {"type": "string"},
                        "description": "exactly 3 short options (one right, two clearly wrong) when the format is single choice; else empty"},
            "answer_index": {"type": "integer", "description": "index of the right option in choices; -1 when open-ended"}}}}}}


# Question difficulty by reading level: format per question kind, max question length, max option length.
DIFFICULTY = {
    1: {"formats": {"recall": "choice", "inference": "choice", "vocabulary": "choice"}, "q_words": 8, "opt_words": 3,
        "style": "very easy: ask only about things said directly in one sentence; the feeling question uses simple "
                 "feeling options like 'happy', 'sad', 'scared'"},
    2: {"formats": {"recall": "choice", "inference": "choice", "vocabulary": "choice"}, "q_words": 10, "opt_words": 4,
        "style": "easy: literal recall; the why/feel question has 3 short options, one clearly right"},
    3: {"formats": {"recall": "choice", "inference": "open", "vocabulary": "choice"}, "q_words": 12, "opt_words": 5,
        "style": "gentle: the why/feel question is answered out loud in a few words"},
    4: {"formats": {"recall": "open", "inference": "open", "vocabulary": "choice"}, "q_words": 14, "opt_words": 6,
        "style": "moderate"},
    5: {"formats": {"recall": "open", "inference": "open", "vocabulary": "choice"}, "q_words": 16, "opt_words": 6,
        "style": "moderate, a little more thinking"},
}


def make_questions(passage, practice_words=(), age="6-10", focus=None, lang="en", level=2):
    d = DIFFICULTY.get(level, DIFFICULTY[2])
    unit = "characters" if L.is_cjk(lang) else "words"
    qmax, omax = (d["q_words"] * 2, d["opt_words"] * 2) if L.is_cjk(lang) else (d["q_words"], d["opt_words"])
    hint = ""
    if focus:
        hint += f"This child finds {focus} questions hard: make that one extra gentle. "
    fmt = "; ".join(f"{k}: {'single choice with 3 options' if v == 'choice' else 'open-ended (no options)'}" for k, v in d["formats"].items())
    ask = (f"{hint}Write exactly 3 questions in {L.get(lang)['name']} about this passage for a beginning reader at "
           f"reading level {level} of 5. Difficulty: {d['style']}.\n"
           f"Kinds and formats: one 'recall' (who / what happened), one 'inference' (why / how did someone feel), one "
           f"'vocabulary'. Formats -> {fmt}.\n"
           f"Every question at most {qmax} {unit}, using only easy everyday words. Every option at most {omax} {unit}; "
           "wrong options must be clearly wrong to a child who read the story (no trick options).\n"
           "Vocabulary: pick a word whose meaning the story itself makes clear, and put that clue in the question, "
           "e.g. 'The fox was famished, she wanted to eat! What does famished mean?' Options are very simple words.\n"
           "Each question needs an expected answer and a short exact quote from the passage that shows the answer."
           "\n\nPassage:\n" + passage)
    feedback = ""
    for _ in range(2):
        out = chat_json(sysmsg(age, lang), ask + feedback, Q_SCHEMA, "questions")
        qs = [_shape(q, d["formats"].get(q["kind"], "choice")) for q in
              ([q for q in out["questions"] if quote_ok(q["quote"], passage, lang)] or out["questions"])[:3]]
        too_long = [q["question"] for q in qs if L.length(q["question"], lang) > qmax + 2]
        long_opts = [c for q in qs for c in q["choices"] if L.length(c, lang) > omax + 1]
        if not too_long and not long_opts:
            break
        feedback = (f"\n\nToo hard: these are too long, make them shorter and simpler: {too_long + long_opts}")
    return qs, out.get("learn_topic", "")


def _shape(q, want="choice"):
    """Code checks single-choice questions (3 distinct options, a valid right answer) and shuffles them;
    open questions (or malformed choice ones) are answered out loud and graded by Muse."""
    ch = [c.strip() for c in q.get("choices") or [] if c.strip()]
    ai = q.get("answer_index", -1)
    if want == "open" or len(ch) != 3 or len({c.lower() for c in ch}) != 3 or not 0 <= ai < 3:
        return {**q, "format": "open", "choices": [], "answer_index": -1}
    right = ch[ai]
    random.shuffle(ch)
    return {**q, "format": "choice", "choices": ch, "answer_index": ch.index(right)}


G_SCHEMA = {"type": "object", "additionalProperties": False,
            "required": ["verdict", "next_action", "feedback", "hint", "quote"], "properties": {
                "next_action": {"type": "string", "enum": ["praise_move_on", "hint_retry", "reread_retry", "explain_move_on"],
                                "description": "the tutor's next move: praise_move_on if correct; hint_retry for a near miss; "
                                               "reread_retry if the child needs to look at the sentence again; "
                                               "explain_move_on if they are stuck"},
                "verdict": {"type": "string", "enum": ["correct", "partly", "not_yet"]},
                "feedback": {"type": "string", "description": "1-2 short sentences spoken to the child"},
                "hint": {"type": "string", "description": "a nudge toward the answer if not correct, else empty"},
                "quote": {"type": "string", "description": "exact words from the passage that show the answer"}}}


def grade(passage, q, answer, age="6-10", attempt=1, lang="en"):
    out = chat_json(sysmsg(age, lang),
                    f"Passage:\n{passage}\n\nQuestion ({q['kind']}): {q['question']}\nExpected answer: "
                    f"{q['expected_answer']}\nChild's spoken answer (speech-to-text, may have small errors): "
                    f"\"{answer}\"\nAttempt {attempt}. Judge meaning, not wording or spelling. Mark 'correct' for any "
                    "answer the passage supports, even if it differs from the expected answer. If not correct, "
                    "give a hint without revealing the answer"
                    + (" (this is the last try, so gently explain the answer)." if attempt >= 2 else "."),
                    G_SCHEMA, "grade")
    if not quote_ok(out.get("quote", ""), passage, lang):
        out["quote"] = q["quote"] if quote_ok(q["quote"], passage, lang) else ""
    # guardrails on the tutor's choice: correct always moves on; last try never asks for another retry
    if out["verdict"] == "correct":
        out["next_action"] = "praise_move_on"
    elif attempt >= 2 and out["next_action"] in ("hint_retry", "reread_retry"):
        out["next_action"] = "explain_move_on"
    return out


def regrade(passage, q, answer, verdict_before, age="6-10", lang="en"):
    """Second opinion when the child says "I think I was right!": re-read carefully and be fair."""
    out = chat_json(sysmsg(age, lang) + " You are giving a careful second opinion on a grade the child disagrees with.",
                    f"Passage:\n{passage}\n\nQuestion ({q['kind']}): {q['question']}\nExpected answer: {q['expected_answer']}\n"
                    f"Child's answer (speech-to-text, may have small errors): \"{answer}\"\nFirst grade: {verdict_before}.\n"
                    "The child thinks they were right. Re-read the passage. If the answer is supported by the passage in any "
                    "reasonable reading (including a different but valid reason), mark it correct and say sorry warmly. If it "
                    "is still not supported, explain kindly with the quote that shows the answer.",
                    G_SCHEMA, "regrade")
    if not quote_ok(out.get("quote", ""), passage, lang):
        out["quote"] = q["quote"] if quote_ok(q["quote"], passage, lang) else ""
    out["next_action"] = "praise_move_on" if out["verdict"] == "correct" else "explain_move_on"
    return out


L_SCHEMA = {"type": "object", "additionalProperties": False, "required": ["fact", "source_index"], "properties": {
    "fact": {"type": "string", "description": "one or two fun, kid-friendly sentences; start directly with the fact, no greeting or praise"},
    "source_index": {"type": "integer"}}}


KIDS = {"en": "facts for kids", "es": "datos para niños", "fr": "pour les enfants", "zh": "儿童 知识"}


def learn_more(topic, title, age="6-10", lang="en"):
    res = ksearch(f"{topic} {KIDS.get(lang, KIDS['en'])} -site:web.archive.org", max_results=5, snippet_max_length=600)
    if not res:
        return None
    ctx = "\n\n".join(f"[{i}] {r.title} ({r.url})\n{r.snippet or ''}" for i, r in enumerate(res))
    out = chat_json(sysmsg(age, lang),
                    f"A child just read '{title}' and met the word or topic '{topic}'. Write the fact in {L.get(lang)['name']}. Using ONLY these search "
                    f"results, write a fun fact about it and give the index of the result you used.\n\n{ctx}",
                    L_SCHEMA, "learn_more")
    i = out.get("source_index", 0)
    src = res[i] if 0 <= i < len(res) else res[0]
    return {"topic": topic, "fact": out["fact"], "source_title": src.title, "source_url": src.url}


PAGE_SCHEMA = {"type": "object", "additionalProperties": False, "required": ["title", "text"], "properties": {
    "title": {"type": "string", "description": "book title if visible, else empty"},
    "text": {"type": "string", "description": "the page's story text exactly as printed, in reading order"}}}


def read_page_photo(img_bytes, mime="image/jpeg"):
    out = chat_json("You transcribe pages of children's books exactly. Skip page numbers and headers.",
                    "Transcribe the story text on this page exactly as printed.", PAGE_SCHEMA, "page",
                    images=[data_url(img_bytes, mime)])
    out["text"] = re.sub(r"\s+", " ", out["text"]).strip()
    return out
