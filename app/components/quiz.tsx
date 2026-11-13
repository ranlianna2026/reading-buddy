import { useEffect, useRef, useState } from "react";

import { post } from "~/lib/api";
import { KIND_LABEL, pickByVoice, type Question, type Verdict } from "~/lib/quiz";
import { hush, listenOnce, say } from "~/lib/talk";
import { Buddy, type Mood } from "./buddy";

export type Answer = { kind: Question["kind"]; verdict: string; word: string };

const rest = (ms: number) => new Promise((done) => setTimeout(done, ms));
const CJK = ["Chinese", "Japanese", "Korean"];
const CHEER = ["Yes! That's right.", "You got it!", "Great job!"];

export function Quiz({
  passage,
  questions,
  language,
  age,
  onDone,
}: {
  passage: string;
  questions: Question[];
  language: string;
  age: string;
  onDone: (answers: Answer[]) => void;
}) {
  const [at, setAt] = useState(0);
  const [marks, setMarks] = useState<string[]>([]);
  const [picked, setPicked] = useState<Record<number, "right" | "wrong">>({});
  const [reading, setReading] = useState(-1);
  const [label, setLabel] = useState("");
  const [heard, setHeard] = useState("");
  const [says, setSays] = useState<{ text: string; mood: Mood } | null>(null);
  const [proof, setProof] = useState("");
  const [appeal, setAppeal] = useState<{ ask: () => void } | null>(null);
  const [busy, setBusy] = useState(false);
  const answer = useRef<((pick: number | "skip") => void) | null>(null);
  const alive = useRef(true);
  const going = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      hush();
    };
  }, []);

  useEffect(() => {
    if (!questions.length || going.current) return;
    going.current = true;
    void run();
  }, [questions.length]);

  // Tap an option or say it, whichever lands first. -1 means nobody answered.
  const choose = (q: Question) =>
    new Promise<number | "skip">((done) => {
      let over = false;
      const settle = (pick: number | "skip") => {
        if (over) return;
        over = true;
        answer.current = null;
        done(pick);
      };
      answer.current = settle;
      setLabel("Tap an answer, or say it");
      void listenOnce(12000).then((said) => {
        if (over) return;
        const pick = said ? pickByVoice(said, q.choices, CJK.includes(language)) : -1;
        if (pick >= 0 || !said) settle(pick);
        else setLabel("Tap the answer you mean");
      });
    });

  const speak = async (words: string, mood: Mood, tone: "ask" | "cheer" = "ask") => {
    setSays({ text: words, mood });
    await say(words, tone);
  };

  async function run() {
    const got: Answer[] = [];
    for (let i = 0; i < questions.length && alive.current; i++) {
      const q = questions[i];
      setAt(i);
      setPicked({});
      setProof("");
      setSays(null);
      setHeard("");
      let verdict = "not_yet";
      let quiet = 0;

      for (let tries = 1; tries <= 2 && alive.current; tries++) {
        if (tries > 1) await speak("Let's try again.", "hi");
        setSays(null);
        await say(q.question, "ask");
        if (!alive.current) break;
        if (q.format === "choice" && tries === 1)
          for (let k = 0; k < q.choices.length && alive.current; k++) {
            setReading(k);
            await say(`${"ABC"[k]}. ${q.choices[k]}`, "ask");
          }
        setReading(-1);
        if (!alive.current) break;

        if (q.format === "choice") {
          const pick = await choose(q);
          setLabel("");
          if (pick === "skip") break;
          if (pick < 0) {
            quiet += 1;
            if (quiet >= 2) {
              await speak("That's okay. Let's go to the next one.", "hi");
              break;
            }
            await speak("I didn't catch that. Tap your answer.", "hi");
            tries -= 1;
            continue;
          }
          if (pick === q.right) {
            verdict = "correct";
            setPicked({ [pick]: "right" });
            setProof(q.quote);
            await speak(CHEER[i % CHEER.length], "cheer", "cheer");
            await rest(700);
            break;
          }
          setPicked({ [pick]: "wrong" });
          if (tries === 1) {
            setProof(q.quote);
            await speak("Not quite. Let's look at the story again, then pick another one.", "think");
            continue;
          }
          setPicked({ [pick]: "wrong", [q.right]: "right" });
          await speak(`The answer is ${q.choices[q.right]}. You'll get it next time!`, "hi");
          await rest(900);
          break;
        }

        setLabel("I'm listening — say your answer");
        const said = await listenOnce();
        setLabel("");
        setHeard(said);
        if (!said) {
          quiet += 1;
          if (quiet >= 2) {
            await speak("That's okay. Let's go to the next one.", "hi");
            break;
          }
          await speak("I didn't catch that. Have another go.", "hi");
          tries -= 1;
          continue;
        }

        setBusy(true);
        setSays({ text: "Let me check the story…", mood: "think" });
        let judged: Verdict;
        try {
          judged = await post<Verdict>("/api/talk", {
            step: "grade",
            language,
            age,
            passage,
            question: q.question,
            answer: q.answer,
            quote: q.quote,
            said,
            attempt: tries,
          });
        } catch {
          judged = { verdict: "partly", feedback: "Let's keep going.", hint: "", quote: q.quote, next: "explain_move_on" };
        }
        setBusy(false);
        verdict = judged.verdict;
        const next = judged.next ?? (verdict === "correct" ? "praise_move_on" : tries >= 2 ? "explain_move_on" : "hint_retry");
        const words = `${judged.feedback}${judged.hint && next === "hint_retry" ? ` ${judged.hint}` : ""}`;
        setProof(next === "hint_retry" ? "" : judged.quote);
        await speak(words, verdict === "correct" ? "cheer" : next === "reread_retry" ? "think" : "hi", verdict === "correct" ? "cheer" : "ask");

        if (next === "explain_move_on" && verdict !== "correct" && alive.current) {
          const wanted = await new Promise<"appeal" | "next">((done) => {
            setAppeal({ ask: () => done("appeal") });
            setTimeout(() => done("next"), 9000);
          });
          setAppeal(null);
          if (wanted === "appeal") {
            setBusy(true);
            setSays({ text: "Okay, let me read the story again carefully…", mood: "think" });
            try {
              const again = await post<Verdict>("/api/talk", {
                step: "appeal",
                language,
                age,
                passage,
                question: q.question,
                answer: q.answer,
                quote: q.quote,
                said,
                before: verdict,
              });
              setBusy(false);
              if (again.verdict === "correct") verdict = "correct";
              setProof(again.quote);
              await speak(again.feedback, again.verdict === "correct" ? "cheer" : "hi", again.verdict === "correct" ? "cheer" : "ask");
              await rest(700);
            } catch {
              setBusy(false);
            }
          }
          break;
        }
        if (next === "praise_move_on") {
          await rest(700);
          break;
        }
      }

      got.push({ kind: q.kind, verdict, word: q.word });
      setMarks(got.map((one) => one.verdict));
    }
    if (alive.current) onDone(got);
  }

  const q = questions[at];
  if (!q) return <p className="text-center text-muted">Fig is thinking of a question…</p>;

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="flex gap-1.5" aria-label={`Question ${at + 1} of ${questions.length}`}>
          {questions.map((_, i) => (
            <span
              key={i}
              className={`h-2.5 w-2.5 rounded-full ${
                marks[i] === "correct" ? "bg-leaf" : marks[i] ? "bg-berry" : i === at ? "bg-sun" : "bg-locked"
              }`}
            />
          ))}
        </span>
        <span className="mono text-muted">
          Question {at + 1} of {questions.length}
        </span>
        <span className="mono ml-auto rounded-full bg-leaf-soft px-3 py-1 text-leaf-ink">{KIND_LABEL[q.kind]}</span>
      </div>

      <div className="flex items-start gap-4">
        <Buddy mood={says?.mood ?? "hi"} size={96} className="shrink-0" />
        <p className="bubble text-lg">{says?.text ?? q.question}</p>
      </div>

      {q.format === "choice" && (
        <ul className="grid gap-2.5">
          {q.choices.map((choice, k) => (
            <li key={choice}>
              <button
                className={`option flex w-full items-center gap-3 text-lg ${
                  picked[k] === "right" ? "border-leaf bg-leaf-soft text-leaf-ink" : ""
                } ${picked[k] === "wrong" ? "border-berry bg-berry-soft text-berry-ink" : ""} ${reading === k ? "border-sun" : ""}`}
                disabled={picked[k] === "wrong" || busy}
                onClick={() => answer.current?.(k)}
              >
                <span className="mono grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sunk">{"ABC"[k]}</span>
                {choice}
              </button>
            </li>
          ))}
        </ul>
      )}

      {label && <p className="text-center text-muted">{label}</p>}
      {heard && <p className="text-center text-muted italic">“{heard}”</p>}

      {proof && (
        <figure className="plate">
          <blockquote className="story rounded-lg bg-sunk px-4 py-3 text-[1.05rem] leading-relaxed">{proof}</blockquote>
          <figcaption className="mono mt-2 px-1 text-muted">from the story</figcaption>
        </figure>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-quiet h-12 px-4 text-base" onClick={() => say(q.question, "ask")}>
          Hear it again
        </button>
        <button className="btn btn-quiet h-12 px-4 text-base" onClick={() => setProof(q.quote)}>
          Hint
        </button>
        {appeal && (
          <button className="btn btn-sun h-12 px-4 text-base" onClick={appeal.ask}>
            I think I was right
          </button>
        )}
        <button className="btn btn-quiet ml-auto h-12 px-4 text-base" onClick={() => answer.current?.("skip")}>
          Skip
        </button>
      </div>
    </div>
  );
}
