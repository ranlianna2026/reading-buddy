"""Reading Buddy: voice reading tutor. Run: .venv/bin/uvicorn app:app --port 8010"""
import time
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from rb import books, feedback, learner, meta_api, scoring, story, tutor

app = FastAPI(title="Reading Buddy")
STATIC = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=STATIC), name="static")


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
    qs, topic = tutor.make_questions(req.passage, req.practice_words, req.age, focus, req.lang, prof["level"] if prof else 2)
    return {"questions": qs, "learn_topic": topic}


class GradeReq(BaseModel):
    passage: str
    question: dict
    answer: str
    attempt: int = 1
    age: str = "6-10"
    lang: str = "en"


@app.post("/api/grade")
def grade(req: GradeReq):
    return tutor.grade(req.passage, req.question, req.answer, req.age, req.attempt, req.lang)


class LearnReq(BaseModel):
    topic: str
    title: str = ""
    lang: str = "en"


@app.post("/api/learn")
def learn(req: LearnReq):
    out = tutor.learn_more(req.topic, req.title, lang=req.lang)
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
    st = story.create_story(imgs, idea, prof["level"], prof["practice"][:3], lang, prof.get("prefs"))
    return {**st, "seconds": round(time.time() - t0, 1), "level_label": learner.LEVELS[prof["level"]]["label"]}


def _profile_view(prof):
    return {**prof, "level_label": learner.LEVELS[prof["level"]]["label"], "focus": learner.focus_skill(prof)}


@app.get("/api/profile/{name}")
def profile(name: str, lang: str = "en"):
    return _profile_view(learner.load(name, lang))


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
    g = tutor.regrade(req.passage, req.question, req.answer, req.verdict_before, lang=req.lang)
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
