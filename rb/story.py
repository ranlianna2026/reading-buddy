"""Create a story from the child's pictures and spoken idea, at their reading level.

1. Muse Spark looks at the pictures + idea and plans the story (characters, setting, real-world topic).
2. If there is a real-world topic (octopus, volcano, ...), Keenable finds kid-safe facts so the story teaches
   something true, with sources.
3. Muse Spark writes the story to the level spec and weaves in the child's practice words.
4. Code checks length, sentence length and that the practice words are really there; one retry with the
   failures fed back (same loop as a design fix: the model proposes, code verifies).
"""
import re
from concurrent.futures import ThreadPoolExecutor

from . import lang as L
from .books import ksearch
from .learner import check_story, spec_for
from .meta_api import chat_json

PLAN = {"type": "object", "additionalProperties": False,
        "required": ["characters", "setting", "what_happens", "hook", "real_world_topic", "search_query"], "properties": {
            "characters": {"type": "string", "description": "a hero a child cares about (a kid or a lovable animal) plus a friend"},
            "setting": {"type": "string"},
            "hook": {"type": "string", "description": "what makes it exciting for a child: a mystery, a funny problem, a surprise, a goal"},
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

# what makes a story one a child wants to keep reading (used for every generated story)
ENGAGING = ("Make it a story a child can't wait to read: a hero they care about (a kid or a lovable animal) with a "
            "clear goal or puzzle, an opening line that grabs them, a funny or surprising moment, sounds and "
            "sense words that are fun to say aloud, a bit of dialogue, and a happy, satisfying ending. Every page "
            "should show something new happening (each page becomes a picture).")

# how the child's request shapes the story
KIND_NOTE = {
    "idea": "",
    "topic": ("The child wants to LEARN about this topic. Turn it into an adventure where the hero discovers how it "
              "really works: 2-3 TRUE facts from the search results drive the plot (a fact solves the problem, "
              "explains a surprise, ...). Never invent facts. Explain any new word inside the story."),
    "book": ("The child asked for this book, but it isn't one we can read here. Write a brand-new ORIGINAL story in "
             "the same spirit (its kind of world, mood and fun) with your own characters and title: do not copy the "
             "book's text, characters or plot. If the request is a topic rather than a title, treat it as one."),
}

# phrases that mean "teach me about X" or "a story about X" rather than a book title
_TOPIC = {
    "en": r"(?:^|\b)(?:learn|know|find out|teach me|tell me|show me)(?: more| all)? (?:about|on|how|why|what) (.+)|"
          r"\b(?:story|book|stories|books|tale) (?:about|on|where|with|of how|that teaches) (.+)|"
          r"^(?:i (?:want|wanna|like) |something )?about (.+)|"
          r"^(?:how|why) (.+)|^what (?:is|are|do|does|makes|happens) (.+)",
    "es": r"(?:aprender|saber|enséñame|cuéntame)(?: más)? (?:sobre|acerca de|de|cómo|por qué) (.+)|"
          r"\b(?:cuento|historia|libro) (?:sobre|acerca de|donde) (.+)|^(?:¿\s*)?(?:cómo|por qué) (.+)",
    "fr": r"(?:apprendre|savoir|découvrir|raconte-moi|explique-moi)(?: tout)? (?:sur|à propos de|des|du|de la|comment|pourquoi) (.+)|"
          r"\b(?:histoire|livre|conte) (?:sur|à propos de|où) (.+)|^(?:comment|pourquoi) (.+)",
    "ar": r"(?:أتعلم|اتعلم|أعرف|اعرف|علمني|علّمني|أخبرني|اخبرني|احك لي|احكي لي|قصة|قصه|كتاب|حكاية)\s*(?:عن|حول|عن كيف) (.+)|"
          r"^(?:لماذا|كيف|ما هو|ما هي|ماذا) (.+)",
    "zh": r"(?:关于|讲讲|讲一讲|了解|学习|想知道|告诉我)(.+)|^(?:为什么|怎么|什么是)(.*)",
}
_LEAD = re.compile(r"^(?:i'?m going to read|i want to read|i wanna read|let'?s read|i'?m reading|can we read|read)\s+", re.I)


def classify_request(text, lang="en"):
    """('topic', subject) for 'teach me / a story about X', else ('title', cleaned title). Code, no model call."""
    t = text.strip().rstrip("?!. ")
    low = t.lower()
    m = re.search(_TOPIC.get(lang, _TOPIC["en"]), low, re.I) or (lang != "en" and re.search(_TOPIC["en"], low, re.I))
    if m:
        subj = next((g for g in m.groups() if g), None) or t
        return "topic", subj.strip()
    return "title", _LEAD.sub("", t).strip() or t


FACTS = {"en": "facts for kids", "es": "datos para niños", "fr": "pour les enfants", "zh": "儿童 知识", "ar": "معلومات للأطفال"}


def create_story(images, idea, level, practice_words=(), lang="en", kind="idea", prefs=None):
    spec = spec_for(level, lang)
    lname = L.get(lang)["name"] + (" — Simplified characters only" if lang == "zh" else "")
    said = ({"topic": f"A child asked to learn about: \"{idea}\".",
             "book": f"A child asked to read: \"{idea}\"."}.get(kind)
            or f"A child made these pictures and said this idea out loud: \"{idea or '(no idea given)'}\".")
    plan = chat_json(SYSTEM, f"{said} Plan a story from it. {KIND_NOTE[kind]} {ENGAGING}", PLAN, "plan", images=images)
    # no drawing from the child: start the cover picture now, in parallel with writing the story (~15 s saved)
    cover = None
    if not images:
        from .illustrate import illustrate
        cast = f"{plan.get('characters', '')}. Setting: {plan.get('setting', '')}"
        cover = ThreadPoolExecutor(max_workers=1).submit(
            illustrate, f"The opening scene: {plan.get('what_happens') or idea}", None, idea or "a children's story", "new", cast)
    if kind == "topic" and not plan.get("search_query"):
        plan["real_world_topic"], plan["search_query"] = True, classify_request(idea, lang)[1]   # always real facts
    facts = []
    if plan.get("real_world_topic") and plan.get("search_query"):
        try:
            facts = ksearch(plan["search_query"] + " " + FACTS.get(lang, FACTS["en"]), max_results=4, snippet_max_length=400)
        except Exception:
            facts = []
    fact_txt = "\n".join(f"[{i}] {f.snippet}" for i, f in enumerate(facts)) or "(none)"
    lo, hi = spec["words"]
    unit = spec["unit"]
    ask = (f"Write the story in {lname} (title too).\nPlan: {plan}\n{said}\n{KIND_NOTE[kind]}\n{ENGAGING}\n"
           f"Reading level {level}: {lo}-{hi} {unit} in total, every sentence at most {spec['max_sentence']} {unit}, "
           "simple words a child at this level can decode, 2-4 short pages."
           + (" Use the child's pictures for the pages.\n" if images else "\n")
           + (f"Weave in each of these practice words naturally, at least once (any grammatical form is fine, e.g. "
              f"'whispered'; keep every sentence grammatical): {', '.join(practice_words)}.\n" if practice_words else "")
           + (f"The child enjoyed stories about: {', '.join(prefs['liked'])}. " if prefs and prefs.get("liked") else "")
           + (f"Avoid: {', '.join(prefs['avoid'])}. " if prefs and prefs.get("avoid") else "")
           + (f"Use 2-3 TRUE facts from these search results and list their indexes:\n{fact_txt}" if kind == "topic"
              else f"If they fit, include 1-2 TRUE facts from these search results and list their indexes:\n{fact_txt}"))
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
    cover_img = None
    if cover:
        try:
            cover_img = cover.result(timeout=40)
        except Exception:
            cover_img = None              # the page can still draw it later
    return {"cover": cover_img, "title": st["title"], "text": text, "pages": st["pages"], "via": "story", "part": 0, "parts": 1,
            "source": "story", "request": kind, "level": level, "check": check, "attempts": attempt + 1, "plan": plan, "lang": lang,
            "facts": [{"title": f.title, "url": f.url} for f in used]}
