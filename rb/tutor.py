"""Comprehension tutor: Muse Spark writes questions and grades spoken answers; code checks every quote
really appears in the passage. Keenable adds kid-safe "learn more" background with sources."""
import re

from .books import ksearch
from .meta_api import chat_json, data_url
from .scoring import norm

SYSTEM = ("You are Reading Buddy, a warm, patient reading tutor for children aged {age}. Use short, simple "
          "sentences. Be encouraging and specific. Never shame. Ground everything in the passage.")


def quote_ok(quote, passage):
    q = " ".join(norm(w) for w in quote.split() if norm(w))
    p = " ".join(norm(w) for w in passage.split() if norm(w))
    return bool(q) and q in p


Q_SCHEMA = {"type": "object", "additionalProperties": False, "required": ["questions", "learn_topic"], "properties": {
    "learn_topic": {"type": "string", "description": "one concrete real-world thing from the story a child would enjoy learning a fact about, e.g. 'foxes' or 'velveteen fabric'"},
    "questions": {"type": "array", "minItems": 3, "maxItems": 3, "items": {
        "type": "object", "additionalProperties": False,
        "required": ["kind", "question", "expected_answer", "quote"],
        "properties": {
            "kind": {"type": "string", "enum": ["recall", "inference", "vocabulary"]},
            "question": {"type": "string", "description": "the question only, no praise or preamble"},
            "expected_answer": {"type": "string", "description": "the main answer plus other answers the passage would also support"},
            "quote": {"type": "string", "description": "exact words copied from the passage that support the answer"}}}}}}


def make_questions(passage, practice_words=(), age="6-10"):
    hint = f"Words the child stumbled on: {', '.join(practice_words)}. " if practice_words else ""
    out = chat_json(SYSTEM.format(age=age),
                    f"{hint}Write exactly 3 questions about this passage: one 'recall' (what happened / who), "
                    "one 'inference' (why / how did a character feel), one 'vocabulary' (meaning of a word "
                    "from the passage, preferably one the child stumbled on). Each needs an expected answer "
                    "and a short exact quote from the passage that supports it.\n\nPassage:\n" + passage,
                    Q_SCHEMA, "questions")
    qs = [q for q in out["questions"] if quote_ok(q["quote"], passage)]
    return qs or out["questions"][:3], out.get("learn_topic", "")


G_SCHEMA = {"type": "object", "additionalProperties": False,
            "required": ["verdict", "feedback", "hint", "quote"], "properties": {
                "verdict": {"type": "string", "enum": ["correct", "partly", "not_yet"]},
                "feedback": {"type": "string", "description": "1-2 short sentences spoken to the child"},
                "hint": {"type": "string", "description": "a nudge toward the answer if not correct, else empty"},
                "quote": {"type": "string", "description": "exact words from the passage that show the answer"}}}


def grade(passage, q, answer, age="6-10", attempt=1):
    out = chat_json(SYSTEM.format(age=age),
                    f"Passage:\n{passage}\n\nQuestion ({q['kind']}): {q['question']}\nExpected answer: "
                    f"{q['expected_answer']}\nChild's spoken answer (speech-to-text, may have small errors): "
                    f"\"{answer}\"\nAttempt {attempt}. Judge meaning, not wording or spelling. Mark 'correct' for any "
                    "answer the passage supports, even if it differs from the expected answer. If not correct, "
                    "give a hint without revealing the answer"
                    + (" (this is the last try, so gently explain the answer)." if attempt >= 2 else "."),
                    G_SCHEMA, "grade")
    if not quote_ok(out.get("quote", ""), passage):
        out["quote"] = q["quote"] if quote_ok(q["quote"], passage) else ""
    return out


L_SCHEMA = {"type": "object", "additionalProperties": False, "required": ["fact", "source_index"], "properties": {
    "fact": {"type": "string", "description": "one or two fun, kid-friendly sentences; start directly with the fact, no greeting or praise"},
    "source_index": {"type": "integer"}}}


def learn_more(topic, title, age="6-10"):
    res = ksearch(f"{topic} facts for kids -site:web.archive.org", max_results=5, snippet_max_length=600)
    if not res:
        return None
    ctx = "\n\n".join(f"[{i}] {r.title} ({r.url})\n{r.snippet or ''}" for i, r in enumerate(res))
    out = chat_json(SYSTEM.format(age=age),
                    f"A child just read '{title}' and met the word or topic '{topic}'. Using ONLY these search "
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
