import { useEffect, useState } from "react";
import { useNavigate, useRevalidator } from "react-router";

import { post } from "~/lib/api";
import { readTheme, writeTheme, type Theme } from "~/lib/theme";
import { Flame, Heart, Star } from "./icons";

type Settings = {
  email: string;
  kid: { id: string; name: string; age: number | null; language: string };
  stats: {
    hearts: number;
    maxHearts: number;
    heartIn: number;
    streak: number;
    stars: number;
    stories: number;
    words: number;
    bestWcpm: number;
    accuracy: number;
    remembered: number;
  };
};

const LANGUAGES = [
  ["en", "English"],
  ["es", "Español"],
  ["fr", "Français"],
  ["de", "Deutsch"],
  ["pt", "Português"],
] as const;

const THEMES: [Theme, string][] = [
  ["light", "Day"],
  ["dark", "Night"],
  ["system", "Auto"],
];

export function Progress({ onClose }: { onClose: () => void }) {
  const go = useNavigate();
  const again = useRevalidator();
  const [data, setData] = useState<Settings | null>(null);
  const [theme, setTheme] = useState<Theme>("system");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setTheme(readTheme());
    fetch("/api/settings")
      .then(async (res) => (res.ok ? ((await res.json()) as Settings) : Promise.reject(new Error(await res.text()))))
      .then(setData)
      .catch((problem: Error) => setError(problem.message));
    const escape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    addEventListener("keydown", escape);
    return () => removeEventListener("keydown", escape);
  }, []);

  const save = async (change: Partial<Settings["kid"]>) => {
    if (!data) return;
    const kid = { ...data.kid, ...change };
    setData({ ...data, kid });
    try {
      await post("/api/settings", { name: kid.name, age: kid.age, language: kid.language });
      setSaved(true);
      again.revalidate();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "That did not save.");
    }
  };

  const pickTheme = (next: Theme) => {
    setTheme(next);
    writeTheme(next);
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/45 p-0 sm:place-items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Your progress"
      onClick={onClose}
    >
      <div
        className="pop card flex max-h-[92svh] w-full max-w-lg flex-col gap-5 overflow-y-auto rounded-b-none p-6 text-left sm:rounded-[28px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl">{data ? `${data.kid.name}'s progress` : "Your progress"}</h2>
            {data && <p className="text-sm text-muted">{data.stats.remembered} things Fig remembers</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="text-3xl leading-none text-muted">
            ×
          </button>
        </div>

        {error && <p className="text-berry-ink">{error}</p>}
        {!data && !error && <p className="text-muted">One moment…</p>}

        {data && (
          <>
            <dl className="grid grid-cols-3 gap-3">
              <Cell icon={<Flame on={data.stats.streak > 0} size={24} />} value={data.stats.streak} label="day streak" />
              <Cell icon={<Star size={24} />} value={data.stats.stars} label="stars" />
              <Cell
                icon={<Heart on={data.stats.hearts > 0} size={24} />}
                value={data.stats.hearts}
                label={data.stats.hearts < data.stats.maxHearts ? `+1 in ${data.stats.heartIn}m` : "hearts"}
              />
              <Cell value={data.stats.stories} label="stories read" />
              <Cell value={data.stats.bestWcpm} label="best words a minute" />
              <Cell value={`${data.stats.accuracy}%`} label="read right" />
            </dl>

            <Row label="Theme">
              <Chips options={THEMES} now={theme} pick={pickTheme} />
            </Row>

            <Row label="Language">
              <select
                value={data.kid.language}
                onChange={(event) => save({ language: event.target.value })}
                className="h-12 w-full rounded-2xl border-2 border-line bg-page px-3 outline-none focus:border-leaf"
              >
                {LANGUAGES.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </Row>

            <Row label="How old is the reader?">
              <select
                value={String(data.kid.age ?? 7)}
                onChange={(event) => save({ age: Number(event.target.value) })}
                className="h-12 w-full rounded-2xl border-2 border-line bg-page px-3 outline-none focus:border-leaf"
              >
                {[5, 6, 7, 8, 9, 10, 11].map((years) => (
                  <option key={years} value={years}>
                    {years} years old
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-muted">Fig writes every story at this reading level.</p>
            </Row>

            <Row label="Grown-ups">
              <p className="text-muted">{data.email}</p>
              <button
                className="btn btn-quiet mt-3 w-full"
                disabled
                title="Reports, reading time and sharing — not built yet"
              >
                Parent portal · coming soon
              </button>
              <button className="btn btn-quiet mt-3 w-full" onClick={() => { onClose(); go("/me"); }}>
                What Fig remembers
              </button>
            </Row>

            {saved && <p className="text-sm text-leaf-ink">Saved.</p>}
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="border-t-2 border-line pt-4">
      <h3 className="mb-2 font-medium">{label}</h3>
      {children}
    </section>
  );
}

function Chips<T extends string>({ options, now, pick }: { options: readonly (readonly [T, string])[]; now: T; pick: (value: T) => void }) {
  return (
    <div className="flex gap-2">
      {options.map(([value, label]) => (
        <button
          key={value}
          onClick={() => pick(value)}
          aria-pressed={value === now}
          className={`h-12 flex-1 rounded-2xl border-2 font-medium ${
            value === now ? "border-leaf bg-leaf-soft text-leaf-ink" : "border-line bg-page text-muted"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Cell({ icon, value, label }: { icon?: React.ReactNode; value: string | number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-2xl bg-sunk px-2 py-3">
      {icon}
      <dd className="text-2xl font-medium">{value}</dd>
      <dt className="text-center text-xs text-muted">{label}</dt>
    </div>
  );
}
