"""Create a story from the child's pictures and spoken idea, at their reading level.

1. Muse Spark looks at the pictures + idea and plans the story (characters, setting, real-world topic).
2. If there is a real-world topic (octopus, volcano, ...), Keenable finds kid-safe facts so the story teaches
   something true, with sources.
3. Muse Spark writes the story to the level spec and weaves in the child's practice words.
4. Code checks length, sentence length and that the practice words are really there; one retry with the
   failures fed back (same loop as a design fix: the model proposes, code verifies).
"""
from . import lang as L
from .books import ksearch
from .learner import check_story, spec_for
from .meta_api import chat_json

PLAN = {"type": "object", "additionalProperties": False,
        "required": ["characters", "setting", "what_happens", "real_world_topic", "search_query"], "properties": {
            "characters": {"type": "string"}, "setting": {"type": "string"},
            "what_happens": {"type": "string", "description": "the child's idea, from the voice note and pictures"},
            "real_world_topic": {"type": "boolean", "description": "true if the story is about a real animal, place, science idea, etc."},
            "search_query": {"type": "string", "description": "a short web search for kid-friendly facts about that topic, or empty"}}}

STORY = {"type": "object", "additionalProperties": False, "required": ["title", "pages", "facts_used"], "properties": {
    "title": {"type": "string"},
    "pages": {"type": "array", "minItems": 1, "maxItems": 4, "items": {
        "type": "object", "additionalProperties": False, "required": ["text", "image_index"], "properties": {
            "text": {"type": "string"},
            "image_index": {"type": "integer", "description": "which of the child's pictures fits this page, -1 for none"}}}},
    "facts_used": {"type": "array", "items": {"type": "integer"}, "description": "indexes of the facts used"}}}

SYSTEM = ("You are a children's author who writes warm, funny, age-appropriate stories that are fun to read "
          "aloud. Stories are safe for young children: no violence, scary content or brand names.")


FACTS = {"en": "facts for kids", "es": "datos para niños", "fr": "pour les enfants", "zh": "儿童 知识"}


def create_story(images, idea, level, practice_words=(), lang="en"):
    spec = spec_for(level, lang)
    lname = L.get(lang)["name"] + (" — Simplified characters only" if lang == "zh" else "")
    plan = chat_json(SYSTEM, f"A child made these pictures and said this idea out loud: \"{idea or '(no idea given)'}\". "
                     "Plan a story from them.", PLAN, "plan", images=images)
    facts = []
    if plan.get("real_world_topic") and plan.get("search_query"):
        try:
            facts = ksearch(plan["search_query"] + " " + FACTS.get(lang, FACTS["en"]), max_results=4, snippet_max_length=400)
        except Exception:
            facts = []
    fact_txt = "\n".join(f"[{i}] {f.snippet}" for i, f in enumerate(facts)) or "(none)"
    lo, hi = spec["words"]
    unit = spec["unit"]
    ask = (f"Write the story in {lname} (title too).\nPlan: {plan}\nChild's idea: \"{idea}\"\n"
           f"Reading level {level}: {lo}-{hi} {unit} in total, every sentence at most {spec['max_sentence']} {unit}, "
           "simple words a child at this level can decode, 2-4 short pages. Use the child's pictures for the pages.\n"
           + (f"Weave in each of these practice words naturally, at least once (any grammatical form is fine, e.g. "
              f"'whispered'; keep every sentence grammatical): {', '.join(practice_words)}.\n" if practice_words else "")
           + f"If they fit, include 1-2 TRUE facts from these search results and list their indexes:\n{fact_txt}")
    feedback = ""
    for attempt in range(2):
        st = chat_json(SYSTEM, ask + feedback, STORY, "story", images=images)
        text = " ".join(p["text"].strip() for p in st["pages"])
        check = check_story(text, level, list(practice_words), lang)
        if check["word_count_ok"] and check["sentence_ok"] and check["language_ok"] and not check["practice_missing"]:
            break
        feedback = ("\n\nYour last draft failed these checks, fix them: "
                    + (f"it must be written in {lname}. " if not check["language_ok"] else "")
                    + (f"it had {check['word_count']} {unit}, needs {lo}-{hi}. " if not check["word_count_ok"] else "")
                    + (f"its longest sentence had {check['longest_sentence']} {unit}, max is {spec['max_sentence']}. " if not check["sentence_ok"] else "")
                    + (f"it is missing these practice words: {', '.join(check['practice_missing'])}." if check["practice_missing"] else ""))
    used = [facts[i] for i in st.get("facts_used", []) if 0 <= i < len(facts)]
    return {"title": st["title"], "text": text, "pages": st["pages"], "via": "story", "part": 0, "parts": 1,
            "source": "story", "level": level, "check": check, "attempts": attempt + 1, "plan": plan, "lang": lang,
            "facts": [{"title": f.title, "url": f.url} for f in used]}
