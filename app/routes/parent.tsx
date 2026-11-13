import { useState } from "react";
import { Link, redirect } from "react-router";

import { BottomNav, PAGE, Screen, TopNav } from "~/components/chrome";
import { userOf } from "~/lib/auth.server";
import { gradeOf } from "~/lib/grades";
import { SKILLS } from "~/lib/levels";
import { reading } from "~/lib/kid.server";
import { dashboard, type Day } from "~/lib/parent.server";
import { average } from "~/lib/report";
import type { Route } from "./+types/parent";

export const meta = () => [{ title: "Parent dashboard · Learning Buddy" }];

export async function loader({ request }: Route.LoaderArgs) {
  const user = await userOf(request);
  if (!user) throw redirect("/hello");
  const children = await dashboard(user.id);
  if (!children.length) throw redirect("/hello?who=1");
  const now = await reading(request, user.id);
  return { email: user.email, children, start: Math.max(0, children.findIndex((one) => one.id === now?.id)) };
}

const PCT = (one: number | null) => (one == null ? "—" : `${Math.round(one)}%`);
const WHEN = (day: string) =>
  new Date(`${day}T12:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

export default function Parent({ loaderData }: Route.ComponentProps) {
  const { email, children, start } = loaderData;
  const [at, setAt] = useState(start);
  const kid = children[Math.min(at, children.length - 1)];
  const whole = average(
    kid.days
      .filter((day) => day.wcpm != null)
      .map((day) => ({ wcpm: day.wcpm as number, accuracy: day.accuracy ?? 0, comprehension: day.comprehension })),
    kid.grade
  );

  return (
    <Screen id="page-parent">
      <TopNav
        left={<span className="text-lg font-medium">Parent dashboard</span>}
        right={
          <Link to="/" className="mono rounded-2xl border-2 border-line bg-surface px-3 py-1.5 hover:border-leaf">
            home
          </Link>
        }
      />
      <main className={`mx-auto w-full flex-1 px-5 pb-6 ${PAGE}`}>
        {children.length > 1 && (
          <ul className="mb-5 flex flex-wrap gap-2">
            {children.map((one, i) => (
              <li key={one.id}>
                <button className="option py-2 font-medium" aria-pressed={i === at} onClick={() => setAt(i)}>
                  {one.name}
                  {one.age ? ` · ${one.age}` : ""}
                </button>
              </li>
            ))}
          </ul>
        )}

        {kid.totals.sessions === 0 ? (
          <section className="card p-6">
            <h2 className="text-xl">Nothing to show yet</h2>
            <p className="mt-1 text-muted">
              Once {kid.name} reads with Fig, every day they read appears here: how fast, how accurately, how much they
              understood, and which words they are working on.
            </p>
            <Link to="/read" className="btn btn-leaf mt-4 inline-flex">
              Start a story
            </Link>
          </section>
        ) : (
          <>
            <dl className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Cell value={kid.totals.streak} label="day streak" />
              <Cell value={kid.totals.minutes} label="minutes read" />
              <Cell value={kid.totals.books} label="stories & books" />
              <Cell value={kid.totals.mastered} label="words mastered" />
              <Cell value={whole ? `${whole.score}` : "—"} label="reading score" />
            </dl>

            <section className="card mb-5 p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl">{kid.label}</h2>
                <p className="mono text-muted">
                  {gradeOf(kid.grade).label} · reading in {kid.language}
                </p>
              </div>
              <Chart days={kid.days} />
            </section>

            <section className="card mb-5 overflow-x-auto p-5">
              <h2 className="mb-3 text-xl">Day by day</h2>
              <table className="w-full min-w-[46rem] border-collapse text-left">
                <thead className="mono text-muted">
                  <tr>
                    {["Day", "Sessions", "Minutes", "Words/min", "Accuracy", "Understood", "Stories"].map((head) => (
                      <th key={head} className="border-b-2 border-line pb-2 font-medium">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...kid.days].reverse().slice(0, 14).map((day) => (
                    <tr key={day.day} className="border-b border-line/60">
                      <td className="py-2.5 font-medium">{WHEN(day.day)}</td>
                      <td className="py-2.5">{day.sessions}</td>
                      <td className="py-2.5">{day.minutes}</td>
                      <td className="py-2.5">{day.wcpm ?? "listened"}</td>
                      <td className="py-2.5">{PCT(day.accuracy)}</td>
                      <td className="py-2.5">{PCT(day.comprehension)}</td>
                      <td className="py-2.5 text-muted">{day.books.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="card mb-5 p-5">
              <h2 className="text-xl">Understanding, by kind of question</h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-3">
                {Object.entries(kid.skills).map(([kind, pair]) => (
                  <li key={kind}>
                    <div className="flex items-baseline justify-between">
                      <span className="font-medium">{SKILLS[kind] ?? kind}</span>
                      <span className="mono text-muted">{pair[1] ? `${Math.round((100 * pair[0]) / pair[1])}%` : "—"}</span>
                    </div>
                    <div className="bar mt-1.5">
                      <span style={{ width: `${pair[1] ? (100 * pair[0]) / pair[1] : 0}%` }} />
                    </div>
                    <p className="mono mt-1 text-muted">
                      {pair[0]} of {pair[1]} right
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="card p-5">
              <h2 className="text-xl">Words being practised</h2>
              {kid.practice.length ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {kid.practice.map((word) => (
                    <li key={word} className="mono rounded-full bg-leaf-soft px-3 py-1.5 text-leaf-ink">
                      {word}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-muted">Nothing tripping them up right now.</p>
              )}
              {kid.likes.length > 0 && (
                <p className="mt-4 text-muted">
                  Loves stories about <strong className="font-medium text-ink">{kid.likes.join(", ")}</strong>.
                </p>
              )}
              <p className="mono mt-4 text-muted">signed in as {email}</p>
            </section>
          </>
        )}
      </main>
      <BottomNav />
    </Screen>
  );
}

function Cell({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="card flex flex-col items-center gap-0.5 px-3 py-4">
      <dd className="text-2xl font-medium">{value}</dd>
      <dt className="text-center text-xs text-muted">{label}</dt>
    </div>
  );
}

// Bars are words a minute, the dotted line is how much was understood — the Python dashboard's chart.
function Chart({ days }: { days: Day[] }) {
  const show = days.slice(-14);
  if (!show.length) return <p className="mt-2 text-muted">No sessions yet.</p>;
  const w = 640;
  const h = 220;
  const lane = 74; // the understanding line keeps its own band, clear of the bar labels
  const slot = (w - 40) / show.length;
  const bar = Math.min(36, slot - 10);
  const top = Math.max(60, ...show.map((day) => day.wcpm ?? 0)) * 1.15;
  const tall = h - 60 - lane;
  const at = (i: number) => 30 + i * slot;
  const dots = show
    .map((day, i) => (day.comprehension == null ? null : [at(i) + bar / 2, 18 + (1 - day.comprehension / 100) * (lane - 32)]))
    .filter((one): one is number[] => one !== null);

  return (
    <>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" className="mt-3" role="img" aria-label="Words a minute and understanding, by day">
        {show.map((day, i) =>
          day.wcpm == null ? null : (
            <g key={day.day}>
              <rect
                x={at(i)}
                y={h - 30 - (day.wcpm / top) * tall}
                width={bar}
                height={(day.wcpm / top) * tall}
                rx="6"
                fill="var(--rb-leaf)"
              />
              <text x={at(i) + bar / 2} y={h - 35 - (day.wcpm / top) * tall} textAnchor="middle" fontSize="11" fill="var(--rb-leaf-ink)">
                {day.wcpm}
              </text>
            </g>
          )
        )}
        {dots.length > 1 && (
          <polyline points={dots.map((one) => one.join(",")).join(" ")} fill="none" stroke="var(--rb-sun-ink)" strokeWidth="3" strokeDasharray="6 4" />
        )}
        {dots.map((one, i) => (
          <circle key={i} cx={one[0]} cy={one[1]} r="5" fill="var(--rb-sun-ink)" />
        ))}
        {show.map((day, i) => (
          <text key={day.day} x={at(i) + bar / 2} y={h - 8} textAnchor="middle" fontSize="11" fill="var(--rb-muted)">
            {day.day.slice(5).replace("-", "/")}
          </text>
        ))}
      </svg>
      <p className="mono mt-1 flex flex-wrap gap-4 text-muted">
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--rb-leaf)" }} /> words a minute
        </span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--rb-sun-ink)" }} /> understanding
        </span>
      </p>
    </>
  );
}
