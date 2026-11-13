import { useEffect, useRef, useState } from "react";
import { redirect, useNavigate, useSearchParams } from "react-router";

import { After, type Report } from "~/components/after";
import { Buddy } from "~/components/buddy";
import { ActionBar, BottomNav, Crumbs, Focus, Hearts, Meter, Screen, TopNav } from "~/components/chrome";
import { Mic } from "~/components/mic";
import { Cover } from "~/components/cover";
import { Passage } from "~/components/passage";
import { Quiz, type Answer } from "~/components/quiz";
import { Scene, type Place } from "~/components/scene";
import { post } from "~/lib/api";
import { userOf } from "~/lib/auth.server";
import { gradeOf } from "~/lib/grades";
import { heartsNow } from "~/lib/kid";
import { kidOf } from "~/lib/kid.server";
import { readingPlace, score as grade, type Score } from "~/lib/scoring";
import { tongueOf } from "~/lib/languages";
import type { Question } from "~/lib/quiz";
import { reading as compile } from "~/lib/report";
import { hear, hush, say, sayAlong, speakIn } from "~/lib/talk";
import type { Route } from "./+types/read";

export const meta = () => [{ title: "Read · Reading Buddy" }];

type Story = { title: string; passage: string; place: Place; seed: number; by: string; topic: string; stretch: string[]; words: number; level: number };

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
  const mic = useRef<{ stop: () => void } | null>(null);
  const started = useRef(0);
  const asked = useRef(false);

  useEffect(() => speakIn(tongueOf(kid.language).tag), [kid.language]);
  useEffect(() => () => mic.current?.stop(), []);

  const fetchStory = async (want: string) => {
    setBusy("story");
    setError("");
    try {
      const made = await post<Story>("/api/story", { kidId: kid.id, topic: want, level: gradeOf(kid.grade).level });
      setStory(made);
      setStage("reading");
      setHeard("");
      setResult(null);
      setQuestions([]);
      setRight(0);
      setReport(null);
      setFigAt(undefined);
      asked.current = false;
      post<{ questions: Question[] }>("/api/talk", {
        step: "questions",
        passage: made.passage,
        age: String(kid.age ?? gradeOf(kid.grade).age),
        language: kid.language,
        level: gradeOf(kid.grade).level,
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
      const kept = await post<{ stars: number; streak: number; stars_won: number }>("/api/finish", {
        kidId: kid.id,
        title: story.title,
        words: story.words,
        wcpm: result.wcpm,
        accuracy: result.accuracy,
        comprehension,
        asked: asked_n,
        correct: won,
        seconds: Math.round(result.seconds),
        score: compile({ wcpm: result.wcpm, accuracy: result.accuracy, comprehension }, kid.grade).score,
        practiceWords: result.practiceWords,
        notes: praise.notes,
        place: story.place,
        seed: story.seed,
        detail: { heard, miscues: result.miscues },
      });
      setReport({ said: praise.said, stars: kept.stars_won, streak: kept.streak, right: won, asked: asked_n });
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
          <Buddy mood={busy ? "think" : "hi"} size={170} className="breathe" />
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
              {listening ? "Listening… say what you want" : "Voice create story"}
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
        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-5 md:flex-row md:items-start">
          <div className="min-w-0 flex-1">
            <h1 className="mb-1 text-center text-2xl md:text-left">{story.title}</h1>
            <p className="mb-3 text-center text-sm text-muted md:text-left">by {story.by}</p>
            <div className="card p-6">
              <Passage text={story.passage} upTo={listening ? place : figAt} onWord={(word) => say(word, "read")} />
            </div>
            {error && <p className="mt-3 text-center text-berry-ink">{error}</p>}
          </div>
          <aside className="order-first w-full shrink-0 md:order-last md:sticky md:top-24 md:w-60">
            <div className="plate">
              <Scene seed={story.seed} place={story.place} w={150} h={190} className="rounded-lg" alt={`${story.title}, drawn`} />
            </div>
            <p className="mono mt-2 text-center text-muted">{story.place}</p>
          </aside>
        </main>
        <ActionBar>
          <Mic on={listening} onClick={listening ? stopReading : startReading} label={listening ? "I'm done" : "Read to Fig"} />
          {!listening && (
            <button className="btn btn-quiet" onClick={figAt === undefined ? figReads : () => { hush(); setFigAt(undefined); }}>
              {figAt === undefined ? "Fig reads first" : "Stop Fig"}
            </button>
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
            <Cover title={story.title} by={story.by} seed={story.seed} place={story.place} note="just read" />
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

