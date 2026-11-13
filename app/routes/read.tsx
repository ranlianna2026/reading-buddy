import { useEffect, useRef, useState } from "react";
import { redirect, useNavigate, useSearchParams } from "react-router";

import { After, type Move, type Report } from "~/components/after";
import { Buddy } from "~/components/buddy";
import { ActionBar, BottomNav, Crumbs, Focus, Hearts, Meter, Screen, TopNav } from "~/components/chrome";
import { Mic } from "~/components/mic";
import { Cover } from "~/components/cover";
import { Passage } from "~/components/passage";
import { Quiz, type Answer } from "~/components/quiz";
import { post } from "~/lib/api";
import { userOf } from "~/lib/auth.server";
import { gradeOf } from "~/lib/grades";
import { heartsNow, levelFor } from "~/lib/kid";
import { kidOf } from "~/lib/kid.server";
import { readingPlace, score as grade, type Score } from "~/lib/scoring";
import { tongueOf } from "~/lib/languages";
import type { Question } from "~/lib/quiz";
import { reading as compile } from "~/lib/report";
import { hear, hush, say, sayAlong, speakIn } from "~/lib/talk";
import type { Route } from "./+types/read";

export const meta = () => [{ title: "Read · Reading Buddy" }];

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

function Speaker() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7" />
      <path d="M19.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

function Stop() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="2.5" />
    </svg>
  );
}

type Story = { title: string; passage: string; place: string; seed: number; by: string; topic: string; stretch: string[]; words: number; level: number };

export async function loader({ request }: Route.LoaderArgs) {
  const user = await userOf(request);
  if (!user) throw redirect("/hello");
  const kid = await kidOf(user.id);
  if (!kid) throw redirect("/hello?who=1");
  return { kid: { ...kid, hearts: heartsNow(kid) } };
}

export default function Read({ loaderData }: Route.ComponentProps) {
  const { kid } = loaderData;
  const go = useNavigate();
  const [params] = useSearchParams();
  const [stage, setStage] = useState<"pick" | "reading" | "talking" | "done">("pick");
  const [topic, setTopic] = useState(params.get("topic") ?? "");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [story, setStory] = useState<Story | null>(null);
  const [heard, setHeard] = useState("");
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState<Score | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [right, setRight] = useState(0);
  const [report, setReport] = useState<Report | null>(null);
  const [figAt, setFigAt] = useState<number | undefined>(undefined);
  const [drawn, setDrawn] = useState("");
  const mic = useRef<{ stop: () => void } | null>(null);
  const started = useRef(0);
  const asked = useRef(false);

  useEffect(() => speakIn(tongueOf(kid.language).tag), [kid.language]);
  useEffect(() => () => mic.current?.stop(), []);

  const fetchStory = async (want: string) => {
    setBusy("story");
    setError("");
    try {
      const made = await post<Story>("/api/story", { kidId: kid.id, topic: want, level: levelFor(kid) });
      setStory(made);
      setStage("reading");
      setHeard("");
      setResult(null);
      setQuestions([]);
      setRight(0);
      setReport(null);
      setFigAt(undefined);
      asked.current = false;
      setDrawn("");
      post<{ url: string }>("/api/picture", { title: made.title, page: made.passage, kind: "new" })
        .then((drew) => setDrawn(drew.url))
        .catch(() => setDrawn(""));
      post<{ questions: Question[] }>("/api/talk", {
        step: "questions",
        passage: made.passage,
        age: String(kid.age ?? gradeOf(kid.grade).age),
        language: kid.language,
        level: levelFor(kid),
      })
        .then((made) => setQuestions(made.questions))
        .catch(() => setQuestions([]));
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "That did not work.");
    }
    setBusy("");
  };

  const speakTopic = () => {
    if (listening) {
      mic.current?.stop();
      return;
    }
    hush();
    setError("");
    setTopic("");
    setListening(true);
    mic.current = hear(
      (said, settled) => {
        setTopic(said);
        if (settled && said.trim()) {
          setListening(false);
          fetchStory(said.trim());
        }
      },
      (why) => {
        setListening(false);
        if (why) setError(why);
      }
    );
  };

  const figReads = async () => {
    if (!story) return;
    setFigAt(0);
    await sayAlong(story.passage, setFigAt);
    setFigAt(undefined);
  };

  const startReading = () => {
    if (listening) return;
    hush();
    setFigAt(undefined);
    started.current = Date.now();
    setListening(true);
    mic.current = hear(
      (said) => setHeard(said),
      (why) => {
        setListening(false);
        if (why) setError(why);
      }
    );
  };

  const stopReading = () => {
    mic.current?.stop();
    setListening(false);
    if (!story) return;
    const seconds = Math.max(5, (Date.now() - started.current) / 1000);
    setResult(grade(story.passage, heard, seconds));
    setStage("talking");
  };

  const quizOnly = () => {
    mic.current?.stop();
    hush();
    setListening(false);
    setFigAt(undefined);
    if (!story) return;
    setResult(grade(story.passage, "", 0));
    setStage("talking");
  };

  const quizDone = (answers: Answer[]) => {
    const won = answers.filter((one) => one.verdict === "correct").length;
    setRight(won);
    void finish(won, answers.length);
  };

  const finish = async (won = right, asked_n = questions.length) => {
    if (!story || !result || asked.current) return;
    asked.current = true;
    setStage("done");
    setBusy("finish");
    try {
      const comprehension = asked_n ? Math.round((won / asked_n) * 100) : 0;
      const aloud = result.wordsAttempted > 0;
      const praise = await post<{ said: string; notes: unknown[] }>("/api/talk", {
        language: kid.language,
        step: "praise",
        passage: story.passage,
        title: story.title,
        wcpm: result.wcpm,
        accuracy: result.accuracy,
        right: won,
        practiceWords: result.practiceWords,
        age: String(kid.age ?? 7),
      });
      const kept = await post<{ stars: number; streak: number; stars_won: number; level: Move }>("/api/finish", {
        kidId: kid.id,
        title: story.title,
        words: story.words,
        wcpm: result.wcpm,
        accuracy: result.accuracy,
        comprehension,
        asked: asked_n,
        correct: won,
        seconds: Math.round(result.seconds),
        score: aloud ? compile({ wcpm: result.wcpm, accuracy: result.accuracy, comprehension }, kid.grade).score : 0,
        practiceWords: result.practiceWords,
        notes: praise.notes,
        picture: drawn,
        place: story.place,
        seed: story.seed,
        finished: result.finished,
        aloud,
        detail: { heard, miscues: result.miscues },
      });
      setReport({ said: praise.said, stars: kept.stars_won, streak: kept.streak, right: won, asked: asked_n, level: kept.level });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Your reading was saved without a note.");
    }
    setBusy("");
  };

  if (stage === "pick") {
    return (
      <Screen id="page-read">
        <TopNav left={<span className="text-lg font-medium">Hi {kid.name}</span>} right={<Crumbs kid={kid} />} />
        <Focus intro={stage}>
          <Buddy mood={busy ? "think" : "cheer"} size={120} className="breathe" />
          <h1 className="text-3xl">What shall we read today?</h1>
          <form
            className="flex w-full flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!busy) fetchStory(topic.trim());
            }}
          >
            <button className="btn btn-leaf w-full" disabled={Boolean(busy)}>
              {busy === "story" ? "Fig is writing…" : topic.trim() ? "Write it" : "Surprise me"}
            </button>
            <button
              type="button"
              onClick={speakTopic}
              disabled={Boolean(busy)}
              aria-pressed={listening}
              className={`btn w-full gap-3 ${listening ? "btn-sun listening" : "btn-quiet"}`}
            >
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <rect x="9" y="2.5" width="6" height="11" rx="3" fill="currentColor" stroke="none" />
                <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
                <path d="M12 17.5V21M9 21h6" />
              </svg>
              {listening ? "Listening… say what you want" : "Create story"}
            </button>
          </form>
          {error && <p className="text-berry-ink">{error}</p>}
        </Focus>
        <BottomNav />
      </Screen>
    );
  }

  if (!story) return null;
  const place = readingPlace(story.passage, heard);

  if (stage === "reading") {
    return (
      <Screen id="page-reading">
        <TopNav
          left={
            <button onClick={() => setStage("pick")} aria-label="Stop this story" className="text-3xl leading-none text-muted">
              ×
            </button>
          }
          middle={<Meter at={place} of={story.words} />}
          right={<Hearts n={kid.hearts} />}
        />
        <main className="mx-auto w-full max-w-4xl flex-1 px-5">
          <h1 className="mb-1 text-center text-2xl md:text-left">{story.title}</h1>
          <p className="mb-3 text-center text-sm text-muted md:text-left">by {story.by}</p>
          <div className="flex flex-col gap-4 md:flex-row md:items-start">
            <div className="min-w-0 flex-1">
              <div className="card p-6">
                <Passage text={story.passage} upTo={listening ? place : figAt} onWord={(word) => say(word, "read")} />
              </div>
              {error && <p className="mt-3 text-center text-berry-ink">{error}</p>}
            </div>
            <aside className="order-first w-full shrink-0 md:order-last md:sticky md:top-24 md:w-60">
              <div className="plate">
                {drawn ? (
                  <img src={drawn} alt={`${story.title}, illustrated`} className="block w-full rounded-lg" />
                ) : (
                  <div className="grid aspect-[4/5] w-full place-items-center rounded-lg bg-sunk">
                    <span className="mono text-muted">drawing…</span>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </main>
        <ActionBar>
          <Mic on={listening} onClick={listening ? stopReading : startReading} label={listening ? "I'm done" : "Read out-loud"} />
          {!listening && (
            <>
              <button
                className="btn btn-quiet px-5"
                onClick={figAt === undefined ? figReads : () => { hush(); setFigAt(undefined); }}
                aria-label={figAt === undefined ? "Read it to me out loud" : "Stop reading it to me"}
                title={figAt === undefined ? "Read it to me" : "Stop"}
              >
                {figAt === undefined ? <Speaker /> : <Stop />}
              </button>
              <button className="btn btn-sun px-5" onClick={quizOnly} aria-label="Finished reading — go to the questions">
                <Arrow />
              </button>
            </>
          )}
        </ActionBar>
      </Screen>
    );
  }

  if (stage === "talking") {
    return (
      <Screen id="page-talking">
        <TopNav left={<span className="font-medium text-muted">Questions</span>} right={<Crumbs kid={kid} />} />
        <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-8">
          <div className="card mb-5 max-h-56 overflow-y-auto p-5">
            <Passage text={story.passage} status={result?.status} />
          </div>
          {questions.length ? (
            <Quiz
              passage={story.passage}
              questions={questions}
              language={kid.language}
              age={String(kid.age ?? gradeOf(kid.grade).age)}
              onDone={quizDone}
            />
          ) : (
            <div className="flex items-center gap-4">
              <Buddy mood="think" size={110} className="breathe" />
              <p className="bubble text-lg">Fig is thinking of some questions…</p>
            </div>
          )}
          {error && <p className="mt-3 text-center text-berry-ink">{error}</p>}
        </main>
      </Screen>
    );
  }

  return (
    <Screen id="page-done">
      <TopNav left={<span className="text-lg font-medium">{kid.name}</span>} right={<Crumbs kid={kid} />} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6">
        <div className="mb-6 flex justify-center">
          <div className="w-60">
            <Cover title={story.title} by={story.by} picture={drawn} seed={story.seed} note="just read" />
          </div>
        </div>
        {result && <After title={story.title} score={result} report={report} grade={kid.grade} again={() => setStage("pick")} home={() => go("/me")} />}
        {busy === "finish" && <p className="mt-4 text-center text-muted">Fig is writing it down…</p>}
        {error && <p className="mt-3 text-center text-berry-ink">{error}</p>}
      </main>
      <BottomNav />
    </Screen>
  );
}

