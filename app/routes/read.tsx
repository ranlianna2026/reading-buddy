import { useEffect, useRef, useState } from "react";
import { redirect, useNavigate, useSearchParams } from "react-router";

import { After, type Report } from "~/components/after";
import { Buddy } from "~/components/buddy";
import { ActionBar, BottomNav, Crumbs, Focus, Hearts, Meter, Screen, TopNav } from "~/components/chrome";
import { Mic } from "~/components/mic";
import { Passage } from "~/components/passage";
import { Idea, IDEAS } from "~/components/picks";
import { post } from "~/lib/api";
import { userOf } from "~/lib/auth.server";
import { heartsNow, kidOf } from "~/lib/kid.server";
import { readingPlace, score as grade, type Score } from "~/lib/scoring";
import { hear, hush, say, sayAlong } from "~/lib/talk";
import type { Route } from "./+types/read";

export const meta = () => [{ title: "Read · Reading Buddy" }];

type Story = { title: string; passage: string; topic: string; stretch: string[]; words: number; level: number };
type Question = { kind: string; question: string; answer: string; quote: string };
type Verdict = { verdict: string; feedback: string; hint: string; quote: string };

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
  const [at, setAt] = useState(0);
  const [tries, setTries] = useState(1);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [right, setRight] = useState(0);
  const [report, setReport] = useState<Report | null>(null);
  const [figAt, setFigAt] = useState<number | undefined>(undefined);
  const mic = useRef<{ stop: () => void } | null>(null);
  const started = useRef(0);
  const asked = useRef(false);

  useEffect(() => () => mic.current?.stop(), []);

  const fetchStory = async (want: string) => {
    setBusy("story");
    setError("");
    try {
      const made = await post<Story>("/api/story", { kidId: kid.id, topic: want, level: band(kid.age) });
      setStory(made);
      setStage("reading");
      setHeard("");
      setResult(null);
      setQuestions([]);
      setAt(0);
      setRight(0);
      setReport(null);
      setFigAt(undefined);
      asked.current = false;
      post<{ questions: Question[] }>("/api/talk", { step: "questions", passage: made.passage, age: String(kid.age ?? 7) })
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
    const scored = grade(story.passage, heard, seconds);
    setResult(scored);
    setStage("talking");
    setAt(0);
    setTries(1);
    setVerdict(null);
  };

  const askNow = async (question: Question) => {
    await say(question.question, "ask");
  };

  useEffect(() => {
    if (stage === "talking" && questions[at] && !verdict) askNow(questions[at]);
  }, [stage, at, questions.length, verdict]);

  const answer = () => {
    if (listening) {
      mic.current?.stop();
      return;
    }
    hush();
    setHeard("");
    setListening(true);
    mic.current = hear(
      (said, settled) => {
        setHeard(said);
        if (settled) judge(said);
      },
      () => setListening(false)
    );
  };

  const judge = async (said: string) => {
    const question = questions[at];
    if (!story || !question) return;
    setBusy("judge");
    try {
      const made = await post<Verdict>("/api/talk", {
        step: "grade",
        passage: story.passage,
        question: question.question,
        answer: question.answer,
        quote: question.quote,
        said,
        attempt: tries,
        age: String(kid.age ?? 7),
      });
      setVerdict(made);
      if (made.verdict === "correct") setRight((count) => count + 1);
      say(made.feedback + (made.hint ? ` ${made.hint}` : ""), made.verdict === "correct" ? "cheer" : "ask");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "That did not work.");
    }
    setBusy("");
  };

  const onwards = () => {
    if (verdict && verdict.verdict !== "correct" && tries < 2) {
      setTries(2);
      setVerdict(null);
      setHeard("");
      return;
    }
    if (at + 1 < questions.length) {
      setAt(at + 1);
      setTries(1);
      setVerdict(null);
      setHeard("");
      return;
    }
    finish();
  };

  const finish = async () => {
    if (!story || !result || asked.current) return;
    asked.current = true;
    setStage("done");
    setBusy("finish");
    try {
      const comprehension = questions.length ? Math.round((right / questions.length) * 100) : 0;
      const praise = await post<{ said: string; notes: unknown[] }>("/api/talk", {
        step: "praise",
        passage: story.passage,
        title: story.title,
        wcpm: result.wcpm,
        accuracy: result.accuracy,
        right,
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
        practiceWords: result.practiceWords,
        notes: praise.notes,
        detail: { heard, miscues: result.miscues },
      });
      setReport({ said: praise.said, stars: kept.stars_won, streak: kept.streak, right, asked: questions.length });
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
            <input
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              maxLength={70}
              placeholder="a brave snail, outer space, my dog…"
              className="h-16 rounded-2xl border-2 border-line bg-surface px-5 text-center text-lg outline-none focus:border-leaf"
            />
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {IDEAS.map(({ word, Art }) => (
                <li key={word}>
                  <button
                    type="button"
                    className="btn btn-quiet h-16 w-full justify-start gap-3 px-4 text-[15px]"
                    onClick={() => setTopic(word)}
                    aria-pressed={topic === word}
                  >
                    <Idea Art={Art} />
                    {word}
                  </button>
                </li>
              ))}
            </ul>
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
        <main className="mx-auto w-full max-w-2xl flex-1 px-5">
          <h1 className="mb-3 text-center text-2xl">{story.title}</h1>
          <div className="card p-6">
            <Passage text={story.passage} upTo={listening ? place : figAt} onWord={(word) => say(word, "read")} />
          </div>
          {error && <p className="mt-3 text-center text-berry-ink">{error}</p>}
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
    const question = questions[at];
    return (
      <Screen id="page-talking">
        <TopNav
          left={<span className="font-medium text-muted">{questions.length ? `Question ${at + 1} of ${questions.length}` : "Talking"}</span>}
          right={<Crumbs kid={kid} />}
        />
        <main className="mx-auto w-full max-w-2xl flex-1 px-5">
          <div className="card mb-4 p-6">
            <Passage text={story.passage} status={result?.status} quote={verdict?.quote || undefined} />
          </div>
          {!question ? (
            <p className="text-center text-muted">Fig is thinking of a question…</p>
          ) : (
            <div className="flex flex-col items-start gap-4">
              <div className="flex items-center gap-4">
                <Buddy mood={verdict ? (verdict.verdict === "correct" ? "cheer" : "think") : listening ? "listen" : "hi"} size={110} />
                <div className="bubble text-lg">{verdict ? `${verdict.feedback} ${verdict.hint}`.trim() : question.question}</div>
              </div>
              {heard && !verdict && <p className="w-full text-center text-muted italic">“{heard}”</p>}
            </div>
          )}
          {error && <p className="mt-3 text-center text-berry-ink">{error}</p>}
        </main>
        <ActionBar tone={verdict ? (verdict.verdict === "correct" ? "good" : "bad") : "plain"}>
          {verdict ? (
            <button className="btn btn-leaf w-full" onClick={onwards} autoFocus>
              {verdict.verdict !== "correct" && tries < 2 ? "Try again" : at + 1 < questions.length ? "Next question" : "See how I did"}
            </button>
          ) : (
            <>
              <Mic on={listening} onClick={answer} label={listening ? "Done" : busy === "judge" ? "Thinking…" : "Say your answer"} />
              {question && (
                <button className="btn btn-quiet" onClick={() => say(question.question, "ask")}>
                  Say it again
                </button>
              )}
            </>
          )}
        </ActionBar>
      </Screen>
    );
  }

  return (
    <Screen id="page-done">
      <TopNav left={<span className="text-lg font-medium">{kid.name}</span>} right={<Crumbs kid={kid} />} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6">
        {result && <After title={story.title} score={result} report={report} again={() => setStage("pick")} home={() => go("/me")} />}
        {busy === "finish" && <p className="mt-4 text-center text-muted">Fig is writing it down…</p>}
        {error && <p className="mt-3 text-center text-berry-ink">{error}</p>}
      </main>
      <BottomNav />
    </Screen>
  );
}

const band = (age: number | null) => (!age ? 2 : age <= 5 ? 1 : age <= 6 ? 2 : age <= 7 ? 3 : age <= 8 ? 4 : 5);
