"""Reading Buddy: voice reading tutor. Run: .venv/bin/uvicorn app:app --port 8010"""
import time
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from rb import books, scoring, tutor

app = FastAPI(title="Reading Buddy")
STATIC = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=STATIC), name="static")


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")


class FindReq(BaseModel):
    title: str
    part: int = 0


@app.post("/api/book")
def find_book(req: FindReq):
    t0 = time.time()
    try:
        b = books.get_passage(req.title, req.part)
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


@app.post("/api/score")
def score(req: ScoreReq):
    return scoring.score(req.passage, req.transcript, req.seconds)


class QReq(BaseModel):
    passage: str
    practice_words: list[str] = []
    age: str = "6-10"


@app.post("/api/questions")
def questions(req: QReq):
    qs, topic = tutor.make_questions(req.passage, req.practice_words, req.age)
    return {"questions": qs, "learn_topic": topic}


class GradeReq(BaseModel):
    passage: str
    question: dict
    answer: str
    attempt: int = 1
    age: str = "6-10"


@app.post("/api/grade")
def grade(req: GradeReq):
    return tutor.grade(req.passage, req.question, req.answer, req.age, req.attempt)


class LearnReq(BaseModel):
    topic: str
    title: str = ""


@app.post("/api/learn")
def learn(req: LearnReq):
    out = tutor.learn_more(req.topic, req.title)
    if not out:
        raise HTTPException(404, "nothing found")
    return out
