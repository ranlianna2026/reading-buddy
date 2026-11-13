"""Learning Buddy: voice reading tutor. Run: .venv/bin/uvicorn app:app --port 8010"""
import time
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from rb import books, feedback, learner, meta_api, scoring, story, tutor

app = FastAPI(title="Learning Buddy")
STATIC = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=STATIC), name="static")
(Path(__file__).parent / "out" / "videos").mkdir(parents=True, exist_ok=True)
app.mount("/videos", StaticFiles(directory=Path(__file__).parent / "out" / "videos"), name="videos")


@app.get("/api/langs")
def langs():
    from rb import lang as L
    return L.LANGS


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")


class FindReq(BaseModel):
    title: str
    part: int = 0
    lang: str = "en"


@app.post("/api/book")
def find_book(req: FindReq):
    t0 = time.time()
    try:
        b = books.get_passage(req.title, req.part, req.lang)
    except LookupError as e:
        raise HTTPException(404, str(e))
    return {**b, "seconds": round(time.time() - t0, 1)}


class AskReq(BaseModel):
    text: str               # whatever the child said or typed: a title, "a story about...", "teach me about..."
    learner: str = "Reader"
    lang: str = "en"


def _story_for(learner_name, idea, lang, kind):
    prof = learner.load(learner_name, lang)
    st = story.create_story([], idea, prof["level"], prof["practice"][:3], lang, kind, prof.get("prefs"), prof.get("age"))
    return {**st, "level_label": learner.LEVELS[prof["level"]]["label"]}


@app.post("/api/ask")
def ask(req: AskReq):
    """One door for every request. A topic or idea becomes a story at the child's level; a title is looked up as a
    real book, and if there's no such book we can read, Buddy writes an original story in its spirit."""
    if not req.text.strip():
        raise HTTPException(400, "tell me what you'd like to read")
    t0 = time.time()
    kind, subject = story.classify_request(req.text, req.lang)
    if kind == "topic":
        out = _story_for(req.learner, req.text.strip(), req.lang, "topic")
    else:
        try:
            out = books.get_passage(subject, 0, req.lang)
        except Exception:               # not on Project Gutenberg (or search is down): write it instead
            out = _story_for(req.learner, subject, req.lang, "book")
    return {**out, "asked": req.text, "seconds": round(time.time() - t0, 1)}


@app.post("/api/page_photo")
async def page_photo(file: UploadFile = File(...)):
    data = await file.read()
    out = tutor.read_page_photo(data, file.content_type or "image/jpeg")
    return {"title": out["title"] or "Your book", "text": out["text"], "source": "photo", "via": "muse-vision",
            "part": 0, "parts": 1}


class ScoreReq(BaseModel):
    passage: str
    transcript: str
    seconds: float
    lang: str = "en"
    learner: str = ""


@app.post("/api/score")
def score(req: ScoreReq):
    acc = feedback.accepted(req.learner, req.lang) if req.learner else {}
    return scoring.score(req.passage, req.transcript, req.seconds, req.lang, acc)


class QReq(BaseModel):
    passage: str
    practice_words: list[str] = []
    age: str = "6-10"
    learner: str = ""
    lang: str = "en"


@app.post("/api/questions")
def questions(req: QReq):
    prof = learner.load(req.learner, req.lang) if req.learner else None
    focus = learner.focus_skill(prof) if prof else None
    age = learner.age_words(prof["age"]) if prof and prof.get("age") else req.age
    qs, topic = tutor.make_questions(req.passage, req.practice_words, age, focus, req.lang, prof["level"] if prof else 2)
    return {"questions": qs, "learn_topic": topic}


class GradeReq(BaseModel):
    passage: str
    question: dict
    answer: str
    attempt: int = 1
    age: str = "6-10"
    learner: str = ""
    lang: str = "en"


def _age(learner_name, fallback):
    a = learner.get_age(learner_name) if learner_name else None
    return learner.age_words(a) if a else fallback


@app.post("/api/grade")
def grade(req: GradeReq):
    return tutor.grade(req.passage, req.question, req.answer, _age(req.learner, req.age), req.attempt, req.lang)


class LearnReq(BaseModel):
    topic: str
    title: str = ""
    learner: str = ""
    lang: str = "en"


@app.post("/api/learn")
def learn(req: LearnReq):
    out = tutor.learn_more(req.topic, req.title, age=_age(req.learner, "6-10"), lang=req.lang)
    if not out:
        raise HTTPException(404, "nothing found")
    return out


@app.post("/api/story")
async def make_story(idea: str = Form(""), learner_name: str = Form("Reader"), lang: str = Form("en"),
                     files: list[UploadFile] = File(default=[])):
    imgs = [meta_api.data_url(await f.read(), f.content_type or "image/jpeg") for f in files[:4]]
    if not imgs and not idea.strip():
        raise HTTPException(400, "add a picture or tell me your idea")
    prof = learner.load(learner_name, lang)
    t0 = time.time()
    kind = "topic" if not imgs and story.classify_request(idea, lang)[0] == "topic" else "idea"   # "teach me about..."
    st = story.create_story(imgs, idea, prof["level"], prof["practice"][:3], lang, kind, prof.get("prefs"), prof.get("age"))
    return {**st, "seconds": round(time.time() - t0, 1), "level_label": learner.LEVELS[prof["level"]]["label"]}


def _profile_view(prof):
    return {**prof, "level_label": learner.LEVELS[prof["level"]]["label"], "focus": learner.focus_skill(prof)}


@app.get("/api/profile/{name}")
def profile(name: str, lang: str = "en"):
    return _profile_view(learner.load(name, lang))


class AgeReq(BaseModel):
    age: int
    lang: str = "en"


@app.post("/api/profile/{name}/age")
def set_age(name: str, req: AgeReq):
    """The child's age: sets the starting reading level (until they've read aloud) and how stories and
    questions are pitched."""
    try:
        learner.set_age(name, req.age)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return _profile_view(learner.load(name, req.lang))


class SessionReq(BaseModel):
    learner: str
    title: str
    source: str = ""
    score: dict
    answers: list[dict] = []
    lang: str = "en"


@app.post("/api/session")
def session(req: SessionReq):
    read_ok = [scoring.norm(t) for t, s in zip(req.score.get("tokens", []), req.score.get("status", [])) if s == "correct"]
    prof, change = learner.record_session(req.learner, req.title, req.source, req.score, req.answers, read_ok, req.lang)
    return {"profile": _profile_view(prof), "change": change}


class IllustrateReq(BaseModel):
    page_text: str
    ref_image: str = ""     # book illustration URL, child's drawing, or this story's first picture; "" = draw from scratch
    title: str = ""
    kind: str = "book"      # "book", "story" (child's drawing), "series" (earlier page of this story), "new"
    cast: str = ""          # characters and setting, for consistent pictures
    variant: str = ""       # set on "redraw" to bypass the cache
    avoid: str = ""         # what was wrong with the previous picture (feedback)


@app.post("/api/illustrate")
def make_picture(req: IllustrateReq):
    from rb import illustrate
    try:
        return {"image": illustrate.illustrate(req.page_text, req.ref_image or None, req.title, req.kind, req.cast,
                                               req.variant, req.avoid)}
    except Exception as e:  # a missing picture should never break reading
        raise HTTPException(502, f"could not draw a picture: {str(e)[:200]}")


# ---------------- feedback loop ----------------
class FeedbackReq(BaseModel):
    kind: str
    data: dict = {}
    learner: str = "Reader"
    lang: str = "en"
    title: str = ""


@app.post("/api/feedback")
def give_feedback(req: FeedbackReq):
    try:
        ev = feedback.log(req.kind, req.data, req.learner, req.lang, req.title)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True, "id": ev["id"], "profile": _profile_view(learner.load(req.learner, req.lang))}


class AppealReq(BaseModel):
    passage: str
    question: dict
    answer: str
    verdict_before: str
    learner: str = "Reader"
    lang: str = "en"
    title: str = ""


@app.post("/api/appeal")
def appeal(req: AppealReq):
    g = tutor.regrade(req.passage, req.question, req.answer, req.verdict_before, age=_age(req.learner, "6-10"), lang=req.lang)
    feedback.log("appeal", {"question": req.question, "answer": req.answer, "passage": req.passage,
                            "verdict_before": req.verdict_before, "verdict_after": g["verdict"]},
                 req.learner, req.lang, req.title)
    return g


@app.get("/api/feedback/summary")
def feedback_summary():
    return feedback.summary()


@app.get("/api/review")
def review_queue():
    return feedback.pending_review()


class ReviewReq(BaseModel):
    id_ref: str
    label: str            # "correct" or "incorrect"


@app.post("/api/review")
def review(req: ReviewReq):
    if req.label not in ("correct", "incorrect"):
        raise HTTPException(400, "label must be correct or incorrect")
    feedback.log("review", {"id_ref": req.id_ref, "label": req.label}, "parent")
    return {"ok": True, "pending": len(feedback.pending_review())}


@app.get("/api/parent")
def parent_dashboard():
    return {"children": learner.all_children(), "feedback": feedback.summary(), "review": feedback.pending_review()}


@app.post("/api/parent/sample")
def parent_sample():
    learner.make_samples()
    return parent_dashboard()


class VideoReq(BaseModel):
    title: str
    pages: list[dict]       # [{text, image}] image = data URL or http URL
    lang: str = "en"
    reader: str = ""
    animate: bool = False   # use the local AI video model (LTX-Video) when it is running


@app.post("/api/video")
def make_movie(req: VideoReq):
    from rb import video
    t0 = time.time()
    try:
        path = video.make_video(req.title, req.pages, req.lang, req.reader, req.animate)
    except Exception as e:
        raise HTTPException(500, f"could not make the movie: {str(e)[:200]}")
    return {"url": f"/videos/{path.name}", "seconds": round(time.time() - t0, 1)}


@app.get("/api/anim")
def anim_status():
    from rb import video
    st = video.anim_status()
    return {"available": bool(st), **(st or {})}


# ---------------- instant demo stories (saved story + pictures, so a live demo never waits on AI) ----------------
DEMO = STATIC / "demo"


class DemoSave(BaseModel):
    slug: str
    book: dict
    images: list[str]       # data URLs, one per page


@app.post("/api/demo/save")
def demo_save(req: DemoSave):
    import base64, json, re as _re
    slug = _re.sub(r"[^a-z0-9-]", "", req.slug.lower()) or "demo"
    d = DEMO / slug
    d.mkdir(parents=True, exist_ok=True)
    urls = []
    for i, img in enumerate(req.images):
        if img and img.startswith("data:"):
            (d / f"p{i}.jpg").write_bytes(base64.b64decode(img.split(",", 1)[1]))
            urls.append(f"/static/demo/{slug}/p{i}.jpg")
        else:
            urls.append(img or "")
    book = {k: v for k, v in req.book.items() if k not in ("cover",)}
    book.update({"page_images": urls, "demo": slug})
    (d / "story.json").write_text(json.dumps(book, ensure_ascii=False, indent=1))
    return {"ok": True, "slug": slug, "pictures": sum(1 for u in urls if u)}


@app.get("/api/demo/{slug}")
def demo_load(slug: str):
    import json
    f = DEMO / slug / "story.json"
    if not f.exists():
        raise HTTPException(404, "no such demo")
    return json.loads(f.read_text())
