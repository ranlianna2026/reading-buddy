import { useEffect, useRef } from "react";

import { reading as compile } from "~/lib/report";
import { say } from "~/lib/talk";
import type { Score } from "~/lib/scoring";
import { Buddy } from "./buddy";
import { Star } from "./chrome";

export type Report = { said: string; stars: number; streak: number; right: number; asked: number };

export function After({
  title,
  score,
  report,
  grade,
  again,
  home,
}: {
  title: string;
  score: Score;
  report: Report | null;
  grade: string;
  again: () => void;
  home: () => void;
}) {
  const comprehension = report && report.asked ? Math.round((report.right / report.asked) * 100) : 0;
  const whole = compile({ wcpm: score.wcpm, accuracy: score.accuracy, comprehension }, grade);
  const spoken = useRef(false);
  useEffect(() => {
    if (report && !spoken.current) {
      spoken.current = true;
      say(report.said, "cheer");
    }
  }, [report]);

  return (
    <div className="pop flex w-full flex-col items-center gap-6">
      <Buddy mood="cheer" size={150} />
      <h1 className="text-3xl">You read {title}!</h1>
      {report && (
        <>
          <p className="flex items-center gap-1" aria-label={`${report.stars} stars won`}>
            {Array.from({ length: report.stars }, (_, i) => (
              <Star key={i} size={40} />
            ))}
          </p>
          <p className="bubble text-lg">{report.said}</p>
        </>
      )}

      <div className="card flex w-full items-center gap-4 p-5">
        <div
          className="grid h-20 w-20 shrink-0 place-items-center rounded-full"
          style={{ background: `conic-gradient(var(--rb-leaf) ${(whole.score / 100) * 360}deg, var(--rb-locked) 0deg)` }}
          role="img"
          aria-label={`Reading score ${whole.score} out of 100`}
        >
          <div className="grid h-16 w-16 place-items-center rounded-full bg-surface">
            <span className="text-2xl leading-none font-medium">{whole.score}</span>
          </div>
        </div>
        <div className="text-left">
          <p className="font-medium">Reading score</p>
          <p className="text-leaf-ink">{whole.band.name}</p>
          <p className="mono text-muted">speed · fluency · understanding, together</p>
        </div>
      </div>

      <dl className="grid w-full grid-cols-3 gap-3">
        <Tile label="Words a minute" value={score.wcpm} />
        <Tile label="Read right" value={`${score.accuracy}%`} />
        <Tile label="Questions" value={report ? `${report.right}/${report.asked}` : "—"} />
      </dl>

      {score.practiceWords.length > 0 && (
        <section className="card w-full p-5 text-left">
          <h2 className="text-lg">Words to practise</h2>
          <p className="text-sm text-muted">Tap one and Fig will say it.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {score.practiceWords.map((word) => (
              <li key={word}>
                <button className="btn btn-quiet h-12 px-4 text-base" onClick={() => say(word, "read")}>
                  {word}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <button className="btn btn-leaf flex-1" onClick={again}>
          Another story
        </button>
        <button className="btn btn-quiet flex-1" onClick={home}>
          Not now
        </button>
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card flex flex-col items-center gap-1 px-2 py-4">
      <dd className="text-3xl font-medium text-leaf-ink">{value}</dd>
      <dt className="text-center text-xs text-muted">{label}</dt>
    </div>
  );
}
