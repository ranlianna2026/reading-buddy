import { useState } from "react";
import { Link, redirect, useRevalidator } from "react-router";

import { Buddy, Head } from "~/components/buddy";
import { BottomNav, Crumbs, PAGE, Screen, TopNav } from "~/components/chrome";
import { Flame, Star } from "~/components/icons";
import { fields, send } from "~/lib/api";
import { userOf } from "~/lib/auth.server";
import { gradeOf, GRADES } from "~/lib/grades";
import { heartsNow, levelFor } from "~/lib/kid";
import { kidsOf, reading } from "~/lib/kid.server";
import { levelLabel, levelName, SKILLS } from "~/lib/levels";
import { dashboard } from "~/lib/parent.server";
import type { Route } from "./+types/home";

export const meta = () => [{ title: "Reading Buddy" }];

export async function loader({ request }: Route.LoaderArgs) {
  const user = await userOf(request);
  if (!user) throw redirect("/hello");
  const kids = await kidsOf(user.id);
  if (!kids.length) throw redirect("/hello?who=1");
  const now = (await reading(request, user.id)) ?? kids[0];
  const all = await dashboard(user.id);
  return {
    kid: { ...now, hearts: heartsNow(now) },
    readers: kids.map((one) => ({ id: one.id, name: one.name, level: levelFor(one) })),
    me: all.find((one) => one.id === now.id) ?? all[0],
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { kid, readers, me } = loaderData;
  const again = useRevalidator();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [busy, setBusy] = useState(false);

  const pick = async (kidId: string) => {
    await send("/api/auth/reader", fields({ kidId }));
    again.revalidate();
  };

  const add = async () => {
    setBusy(true);
    await send("/api/auth/kid", fields({ name, grade }));
    setBusy(false);
    setAdding(false);
    setName("");
    setGrade("");
    again.revalidate();
  };

  const speed = me.days.map((day) => day.wcpm).filter((one): one is number => one != null);

  return (
    <Screen id="page-home">
      <TopNav left={<span className="text-lg font-medium">Reading Buddy</span>} right={<Crumbs kid={kid} />} />
      <main className={`mx-auto w-full flex-1 px-5 pb-6 ${PAGE}`}>
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <Buddy mood="hi" size={110} className="breathe shrink-0" />
          <p className="bubble text-lg">Hi {kid.name}! Shall we read a book, or make your own story?</p>
        </div>

        <section className="mb-6">
          <ul className="flex flex-wrap gap-2">
            {readers.map((one) => (
              <li key={one.id}>
                <button className="option flex items-center gap-2.5 py-2" aria-pressed={one.id === kid.id} onClick={() => pick(one.id)}>
                  <Head size={30} />
                  <span className="font-medium">{one.name}</span>
                  <span className="mono text-muted">Level {one.level}</span>
                </button>
              </li>
            ))}
            <li>
              <button className="option py-2 font-medium" onClick={() => setAdding(!adding)}>
                + Add a reader
              </button>
            </li>
          </ul>
          {adding && (
            <form
              className="card mt-3 flex flex-col gap-3 p-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (name.trim() && grade) void add();
              }}
            >
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={40}
                placeholder="Their name"
                className="h-14 rounded-2xl border-2 border-line bg-page px-4 text-lg outline-none focus:border-leaf"
              />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {GRADES.map((one) => (
                  <button key={one.id} type="button" className="option text-center" aria-pressed={grade === one.id} onClick={() => setGrade(one.id)}>
                    <span className="block font-medium">{one.short}</span>
                    <span className="mono block text-muted">age {one.age}</span>
                  </button>
                ))}
              </div>
              <button className="btn btn-leaf w-full" disabled={!name.trim() || !grade || busy}>
                {busy ? "One moment…" : "Add them"}
              </button>
            </form>
          )}
        </section>

        <div className="mb-6 grid gap-4 md:grid-cols-[1fr_auto]">
          <div className="card flex items-center gap-4 p-5">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-sunk text-2xl font-medium text-sun-ink">{me.level}</div>
            <div className="min-w-0">
              <p className="text-xl">{levelLabel(me.level)}</p>
              <p className="text-muted">
                {gradeOf(kid.grade).label} · {speed.length ? `${speed[speed.length - 1]} words a minute` : `a ${levelName(me.level)} reading with Fig`}
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-3">
            <Tile icon={<Flame on={me.totals.streak > 0} size={24} />} value={me.totals.streak} label="days in a row" />
            <Tile value={me.totals.books} label="stories read" />
            <Tile icon={<Star size={24} />} value={me.totals.mastered} label="words learned" />
          </dl>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <Door to="/read" title="Read a book" note="Fig writes one, you read it out loud." />
          <Door to="/library" title="My stories" note="The shelf of everything you have read." />
          <Door to="/me" title="My reading" note="One score, your words, your language." />
          <Door to="/parent" title="Parent dashboard" note="Day by day, for grown-ups." />
        </div>

        {speed.length > 1 && (
          <section className="card mb-6 p-5">
            <h2 className="text-xl">My reading speed</h2>
            <Spark values={speed} />
          </section>
        )}

        <section className="card p-5">
          <h2 className="text-xl">My super powers</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {Object.entries(me.skills).map(([kind, pair]) => {
              const stars = pair[1] ? Math.round((pair[0] / pair[1]) * 3) : 0;
              return (
                <li key={kind} className="flex items-center justify-between rounded-2xl bg-sunk px-4 py-3">
                  <span className="font-medium">{SKILLS[kind] ?? kind}</span>
                  <span className="flex gap-0.5" aria-label={`${stars} of 3`}>
                    {[0, 1, 2].map((at) => (
                      <span key={at} className={at < stars ? "" : "opacity-25"}>
                        <Star size={20} />
                      </span>
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
          {me.practice.length > 0 && (
            <>
              <h3 className="mt-5 font-medium">Words I am learning</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {me.practice.slice(0, 6).map((word) => (
                  <li key={word} className="mono rounded-full bg-leaf-soft px-3 py-1.5 text-leaf-ink">
                    {word}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </main>
      <BottomNav />
    </Screen>
  );
}

function Door({ to, title, note }: { to: string; title: string; note: string }) {
  return (
    <Link to={to} className="card flex flex-col gap-1 p-6 hover:border-leaf">
      <span className="text-xl">{title}</span>
      <span className="text-muted">{note}</span>
    </Link>
  );
}

function Tile({ icon, value, label }: { icon?: React.ReactNode; value: string | number; label: string }) {
  return (
    <div className="card flex flex-col items-center gap-0.5 px-3 py-4">
      {icon}
      <dd className="text-2xl font-medium">{value}</dd>
      <dt className="text-center text-xs text-muted">{label}</dt>
    </div>
  );
}

function Spark({ values }: { values: number[] }) {
  const w = 300;
  const h = 46;
  const top = Math.max(...values) * 1.1 || 1;
  const step = w / (values.length - 1);
  const points = values.map((one, at) => `${(at * step).toFixed(1)},${(h - (one / top) * h).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 -4 ${w} ${h + 8}`} width="100%" className="mt-2" role="img" aria-label="Words a minute over time">
      <polyline points={points} fill="none" stroke="var(--rb-leaf)" strokeWidth="3" strokeLinejoin="round" />
      {values.map((one, at) => (
        <circle key={at} cx={at * step} cy={h - (one / top) * h} r="4" fill="var(--rb-leaf)" />
      ))}
    </svg>
  );
}
