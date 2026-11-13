# 📚 Learning Buddy

A voice reading tutor for kids. Pick a book, read it aloud, then talk about it.

1. **"What are you reading today?"** Say a title, type it, tap a quick pick, or snap a photo of the page.
   - **Keenable** searches Project Gutenberg (public domain) and fetches the real book text, which becomes the answer key.
   - **Muse Spark** fixes typography only (drop caps, captions); code checks the cleaned text still matches the book ≥ 95% word-for-word.
   - A page photo is transcribed by **Muse Spark** vision.
2. **Read aloud.** Words light up as the child reads (Chrome Web Speech API). When they finish, **code, not a model**, aligns the transcript with the text: words correct per minute (WCPM), accuracy, misread and skipped words marked on the page.
3. **Talk about it.** Muse Spark asks 3 spoken questions (recall, inference, vocabulary, preferring a word the child stumbled on), grades each spoken answer by meaning, and gives a hint and one retry. Every judgment cites a quote that code verifies is really in the passage, and that line lights up in the story. Questions are generated while the child reads, so there is no wait.
4. **Report + learn more.** Reading speed, accuracy, comprehension score, words to practice (tap to hear), and a kid-safe fun fact found with **Keenable** search (`safety_mode: strict`) with its source.

## Run

```bash
uv venv -p 3.12 .venv && VIRTUAL_ENV=.venv uv pip install fastapi "uvicorn[standard]" httpx keenable python-multipart pillow
cp .env.example .env   # add MODEL_API_KEY (Meta Model API) and KEENABLE_API_KEY
.venv/bin/uvicorn app:app --port 8010
```

Open http://127.0.0.1:8010 in **Chrome** (speech recognition) and allow the microphone.
Without `KEENABLE_API_KEY` the app uses Keenable's keyless public pool.

## Layout

| File | What it does |
|---|---|
| `rb/books.py` | Keenable search/fetch of Gutenberg books, story-start detection, passage selection, verified typography cleanup |
| `rb/scoring.py` | Transcript-to-text alignment: WCPM, accuracy, miscues (no model) |
| `rb/tutor.py` | Muse Spark questions, answer grading with verified quotes, page-photo reading, Keenable "learn more" |
| `rb/meta_api.py` | Minimal Meta Model API client (Muse Spark, JSON schema, vision) |
| `app.py` | FastAPI endpoints |
| `static/index.html` | Voice UI (Web Speech recognition + speech synthesis) |

Privacy: audio never leaves the browser (speech is recognized locally by Chrome's API); only text is sent to the server, and nothing is stored. Books are public domain.
