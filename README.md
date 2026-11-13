# 📚 Reading Buddy

A reading buddy for kids. Pick a story, read it out loud to **Fig**, then talk about it.

React Router 8 on a Cloudflare Worker, with D1 for accounts and progress, two R2 buckets (one for the
project, one for the child's memory), cookie sessions, passkeys, Celeris for the words and ElevenLabs
for the voice. No domain to buy: the Worker's own `*.workers.dev` host is the passkey relying party.

## Two apps in here

This repository holds both halves of Reading Buddy, merged so nothing is lost.

| Where | What |
| --- | --- |
| `app/`, `workers/`, `migrations/`, `wrangler.json` | The React Router 8 app on a Cloudflare Worker. This is the one that runs with `npm run dev`. |
| `legacy-python/` | The original FastAPI app, at its newest: Muse Spark and Muse Image, the pop-up quiz and report card, the learner profile, the parent dashboard and feedback queue, its own `README.md` and `tests/`. |

The Worker app has taken the read-aloud scorer, the quiz, the learner's adaptive level and the Muse
Image illustration step across from `legacy-python/` and rebuilt them in TypeScript; the parent
dashboard, the feedback and review queue, Keenable "learn more" facts and storybook page-turning are
still only in `legacy-python/`.

## Run it

```sh
npm install
npx wrangler d1 migrations apply reading-buddy --local
npm run dev            # http://localhost:5320
```

Open it in **Chrome or Edge** and allow the microphone — reading aloud is recognised in the browser.

Both keys are checked in on purpose (`wrangler.json` → `vars`): `AI_API_KEY` for Celeris and
`ELEVENLABS_API_KEY` for the voice, so a clone runs and speaks with nothing to set up. If the voice
key is ever removed, Fig falls back to the browser's own speech synthesis and the app still works end
to end.

## The loop

1. **Pick.** The child says or taps a subject. Celeris (`celeris-1`) writes an original story at their
   reading band (age 5 → 11, 55 → 200 words), seeded with what Fig remembers about them.
2. **Read aloud.** Chrome's Web Speech API recognises the child's voice in the browser; audio never
   leaves the device. Words light up as they are read. Comprehension questions are written in the
   background while the child reads, so there is no wait at the end.
3. **Score, by code.** `app/lib/scoring.ts` aligns the transcript against the passage with an LCS
   diff — no model — and gives words correct per minute, accuracy, and every misread or skipped word
   marked on the page. Only the part the child reached is scored, so stopping early is not an error.
4. **Talk about it.** Three spoken questions (recall, inference, vocabulary — preferring a word the
   child stumbled on). Each answer is graded by meaning, with a hint and one retry. Every judgement
   cites a quote that **code verifies is really in the passage**, and that line lights up in the story.
5. **Remember.** The report, the words to practise and what Fig learned about the child go to D1 and
   to the memory bucket, so the next story is written knowing them.

Every story is a book: a real title, an illustration drawn for it, and the
child's name on it. The same art animates beside the passage while they read.

## Layout

| Path | What it does |
| --- | --- |
| `wrangler.json` | The Worker: D1, both R2 buckets, Workers AI, the rate limiter, the vars |
| `migrations/0001_init.sql` | users, sessions, credentials, challenges, kids, readings, memories |
| `workers/app.ts` | The whole Worker: hands every request to React Router |
| `app/routes.ts` | Pages (`/hello`, `/read`, `/library`, `/me`) and the `/api/*` endpoints |
| `app/lib/auth.server.ts` | PBKDF2 passwords, opaque session tokens hashed in D1, the cookie |
| `app/lib/passkey.server.ts` | WebAuthn register and sign-in, relying party taken from the request host |
| `app/lib/ai.server.ts` | Celeris, OpenAI-compatible: `ask`, `askJson`, the rate-limit guard |
| `app/lib/voice.server.ts` | ElevenLabs text-to-speech; speech-to-text via Celeris, then Workers AI Whisper |
| `app/lib/scoring.ts` | Transcript-to-passage alignment: WCPM, accuracy, miscues. Runs in the browser |
| `app/lib/memory.server.ts` | What Fig remembers: the D1 index and the R2 memory book |
| `app/lib/kid.server.ts` | The reader: hearts (5, one back every 20 minutes), streak, stars |
| `app/lib/talk.ts` | The browser side of voice: listen, speak, fall back to the browser voice |
| `app/lib/motion.ts` | GSAP: the entrance stagger behind every focused screen |
| `app/components/buddy.tsx` | Fig. One SVG, five moods: hi, listen, cheer, think, sad |
| `app/components/chrome.tsx` | Top nav, bottom nav, hearts, stars, streak, the meter, the action bar |
| `app/components/passage.tsx` | The story, word by word: read, missed, and the quote being cited |
| `app/lib/languages.ts` | Forty languages, their own names and their speech tags |
| `app/lib/grades.ts` | Pre-K to 6th grade: the age, the starting level, the words-a-minute norm |
| `app/lib/quiz.ts` | The quiz model: difficulty by level, code-checked options, answering by voice |
| `app/lib/report.ts` | The reading score: speed, fluency and understanding compiled into one number |
| `app/components/quiz.tsx` | The quiz: tap or say, two tries, a hint, the quote, and an appeal |
| `app/components/score.tsx` | The reading score on the profile: the dial and where it came from |
| `app/lib/picture.server.ts` | The picture model: Muse Image styles, prompts and reference edits, cached in R2 |
| `app/components/cover.tsx` | A book: spine, letterpress title, chapter rule, the art, the byline |
| `app/components/hero.tsx` | The opening: the illustrated scene behind the first screen |
| `app/components/voices.tsx` | Voice: female, male, every voice model and id, and cloning your own |
| `legacy-python/` | The first Reading Buddy, FastAPI and Gutenberg. Kept for its scoring and prompts |

## The look

One warm palette in OKLCH, in `app/app.css`, generated and contrast-checked with
[oklchemy](https://github.com/brandonmlicea/oklchemy) (`palette 145 --style=paper --dark`): every text
pair passes WCAG AA and APCA. Neutrals share one warm hue (84), the buddy's leaf green is hue 145, the
sun is 85 and the hearts are 25. Light and dark both come from the same tokens.

Type is two faces: **Fredoka** for the interface, rounded and friendly, and **Atkinson Hyperlegible**
for the story itself, at 24px with loose line height and open word spacing — it was drawn for low
vision and it is the most forgiving face a new reader can sound out.

The shape is from [otterspeak](https://github.com/brandonmlicea/otterspeak): a top nav that holds only
what matters right now (quit, the meter, the hearts), a bottom nav of three tabs, chunky buttons with a
hard shadow a child can hit, and one job centred on the screen at a time.

## The quiz

After a story Fig asks three questions — one `recall`, one `inference`, one `vocabulary` — and the
reading level decides how they are asked. At levels 1 and 2 every question is three big options a
child taps or says out loud; from level 3 the "why" question is answered aloud, and by level 5 only
vocabulary keeps its options. Code owns the format, not the model: a single-choice question must come
back with three distinct options and a real answer or it is downgraded to open, and for a Pre-K to
2nd-grade reader the server asks once more for options rather than hand a six-year-old an open
question. Options are shuffled server-side, and every quote is checked to appear in the passage.

Choice questions are graded instantly in code. Spoken answers go to the model, which must also choose
its next move — praise, hint and retry, re-read together, or explain and move on — bounded by code so
a correct answer always moves on and the last try never asks for another. Fig reads the options aloud
for children who cannot read them yet, two silent tries move the quiz along rather than stall, and a
child who disagrees can say **I think I was right** for a careful second opinion.

A child who only listened to Fig read can tap **I finished the book** to go straight to the questions.
That is scored as listening: no words a minute, no accuracy, the reading level held where it is, and
the session left out of the reading score rather than counted as a zero.

The level is not fixed to the grade. After every reading the standard instructional bands move it:
95% accuracy with two thirds of the questions understood goes up a level, under 90% accuracy (or under
a third understood) goes down, anything between stays for more practice. The grade sets where a reader
starts and the words-a-minute they are measured against; the level is where they are now, and the
report card says which way it moved and why.

## The reading score

Three measures, one number out of a hundred, on the profile — the third tab in the dock.

- **Speed** — words correct a minute against that grade's own norm (Hasbrouck & Tindal, 50th
  percentile), so a Pre-K reader is not judged like a sixth grader.
- **Fluency** — words read right, scored across the instructional band: 90% is frustration, 98% is
  independent reading.
- **Understanding** — the share of quiz questions answered correctly.

They weight 30 / 35 / 35 into a single score with a band (Getting started → Soaring), the grade's
label, and the move since the earlier half of the reader's history. The same number appears on the
report card at the end of a story, and is stored per reading in D1.

## Pictures

Every story is illustrated. `app/lib/picture.server.ts` is the Python
app's Muse Image step in TypeScript: the same four styles (`book`, `story`, `series`, `new`), the same
prompt, and the same reference-edit flow — with a reference it calls `/images/edits` so a book's pages
keep the same characters and look, without one it calls `/images/generations` and that first picture
becomes the reference. It draws with Muse Image when `MODEL_API_KEY` is set and with Workers AI
otherwise, so a picture always arrives. Results are cached in R2 by reference, text and kind, and
served back from `/api/picture`.

It is the art of the whole product: the page beside the story, the cover on the shelf, and the scene
behind the opening screen. A book that has not been written yet has no picture, so its cover carries
its own initial on a tinted panel rather than wait on the model.

## Languages

The language picker is forked from [otterspeak](https://github.com/brandonmlicea/otterspeak): forty
languages, each shown in its own script with the English name beside it, as `option` buttons that hold
their pressed state. It is not decoration — the choice runs through the whole product. The story is
written in that language, the questions and Fig's replies come back in it, ElevenLabs switches to
`eleven_multilingual_v2`, the browser listens with that BCP-47 tag, and the scorer normalises by
Unicode letter rather than ASCII so accents and non-Latin scripts align.

## Voices

Fig speaks with ElevenLabs. The progress panel offers female, male, or **clone my voice** — about
thirty seconds of reading goes to ElevenLabs instant voice cloning and comes back as a voice id saved
on the reader. A sheet lists every voice model and id on the account with a preview; picking one saves
and takes effect on the next thing Fig says. Cloning needs an ElevenLabs plan that allows it; without
one the app says so and keeps the voice it had.

## Cloudflare

Already made on the account:

| Thing | Name |
| --- | --- |
| D1 | `reading-buddy` (`8ed2e9e4-5513-4094-b0d7-55b538097d22`) |
| R2 | `reading-buddy` — the project's files |
| R2 | `reading-buddy-memory` — `kid/<id>/book.json` and `kid/<id>/reading/<id>.json` |

Before the first deploy (not done yet):

```sh
npx wrangler d1 migrations apply reading-buddy --remote
npm run deploy
```

`workers_dev` is on, so it lands on `reading-buddy.<your-subdomain>.workers.dev`. Passkeys bind to
whatever host serves the request, so that URL works as-is — no custom domain needed.

## Privacy

The child's voice is recognised in the browser and never uploaded. Only text reaches the Worker.
What Fig remembers is a short list of notes per child, visible and readable on `/me`.
