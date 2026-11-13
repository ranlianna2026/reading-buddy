import { gradeOf } from "~/lib/grades";
import { reading as compile } from "~/lib/report";

type Row = { wcpm: number; accuracy: number; comprehension: number };

// One number out of three measures. The dial shows the whole; the three bars show where it came from.
export function ReadingScore({ rows: all, grade, name }: { rows: Row[]; grade: string; name: string }) {
  const level = gradeOf(grade);
  const rows = all.filter((row) => row.accuracy > 0);
  if (!rows.length)
    return (
      <section className="card p-5">
        <h2 className="text-xl">Reading score</h2>
        <p className="mt-1 text-muted">
          One number for how {name} is reading — speed, accuracy and understanding together. It appears after the first
          story.
        </p>
      </section>
    );

  const mean = (pick: (row: Row) => number) => rows.reduce((sum, row) => sum + pick(row), 0) / rows.length;
  const now = compile({ wcpm: mean((r) => r.wcpm), accuracy: mean((r) => r.accuracy), comprehension: mean((r) => r.comprehension) }, grade);
  const older = rows.slice(Math.ceil(rows.length / 2));
  const before = older.length
    ? compile(
        {
          wcpm: older.reduce((s, r) => s + r.wcpm, 0) / older.length,
          accuracy: older.reduce((s, r) => s + r.accuracy, 0) / older.length,
          comprehension: older.reduce((s, r) => s + r.comprehension, 0) / older.length,
        },
        grade
      ).score
    : now.score;
  const move = now.score - before;
  const turn = 360 * (now.score / 100);

  return (
    <section className="card p-5">
      <div className="flex items-center gap-5">
        <div
          className="grid h-28 w-28 shrink-0 place-items-center rounded-full"
          style={{ background: `conic-gradient(var(--rb-leaf) ${turn}deg, var(--rb-locked) 0deg)` }}
          role="img"
          aria-label={`Reading score ${now.score} out of 100`}
        >
          <div className="grid h-[5.5rem] w-[5.5rem] place-items-center rounded-full bg-surface">
            <span className="text-4xl leading-none font-medium">{now.score}</span>
            <span className="mono text-muted">/ 100</span>
          </div>
        </div>
        <div className="min-w-0">
          <h2 className="text-xl">Reading score</h2>
          <p className="text-leaf-ink">{now.band.name}</p>
          <p className="text-sm text-muted">{now.band.note}</p>
          <p className="mono mt-1 text-muted">
            {level.label} · {move > 0 ? `up ${move}` : move < 0 ? `down ${-move}` : "steady"} over {rows.length}{" "}
            {rows.length === 1 ? "story" : "stories"}
          </p>
        </div>
      </div>

      <dl className="mt-5 grid gap-3">
        <Part label="Speed" value={`${Math.round(mean((r) => r.wcpm))} words a minute`} note={`${level.short} reads about ${level.wcpm}`} fill={now.speed} />
        <Part label="Fluency" value={`${Math.round(mean((r) => r.accuracy))}% read right`} note="98% is independent reading" fill={now.fluency} />
        <Part label="Understanding" value={`${Math.round(mean((r) => r.comprehension))}% of questions`} note="recall, why, and word meaning" fill={now.meaning} />
      </dl>
    </section>
  );
}

function Part({ label, value, note, fill }: { label: string; value: string; note: string; fill: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <dt className="font-medium">{label}</dt>
        <dd className="text-muted">{value}</dd>
      </div>
      <div className="bar mt-1.5">
        <span style={{ width: `${Math.round(fill * 100)}%` }} />
      </div>
      <p className="mono mt-1 text-muted">{note}</p>
    </div>
  );
}
