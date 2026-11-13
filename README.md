# 📚 Reading Buddy

A reading buddy for kids. Pick a story, read it out loud to **Fig**, then talk about it.

React Router 8 on a Cloudflare Worker, with D1 for accounts and progress, two R2 buckets (one for the
project, one for the child's memory), cookie sessions, passkeys, Celeris for the words and ElevenLabs
for the voice. No domain to buy: the Worker's own `*.workers.dev` host is the passkey relying party.

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

Every story is a book: a real title, a cover drawn in pixel art seeded from that title, and the
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
| `app/components/scene.tsx` | The scene beside the story: one painted SVG, drawn from the book's seed |
| `app/components/cover.tsx` | A book: its painted scene, its title, and who it was read by |
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

## The scene

Every story is painted beside it, and again on its cover: `app/components/scene.tsx` draws one SVG —
no canvas, no wasm, no image to download. Six places (meadow, sea, space, forest, night, dawn) each
carry their own palette in OKLCH and their own weather: layered washes of sky, soft hills or water or
moon dust, pines or round trees, clouds, mist, stars, petals, birds, foam.

It is illustration, not sprites. Edges are pulled off true by a `feDisplacementMap` over fractal noise
so a hill looks brushed rather than plotted, a paper grain sits over the whole frame on `overlay`, and
a soft vignette closes the corners. Fig stands in the middle distance in the same line as everywhere
else in the app — the component imports `Buddy`, so he is never drawn twice.

The seed comes from the child and the book, so a story always looks like itself: it decides where the
sun sits, how the hills roll, where the trees stand and where the stars are. Motion is CSS — clouds
drift, trees sway, water rolls, fireflies float, Fig breathes — and `prefers-reduced-motion` or a book
cover's `still` stops all of it.

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
