import { LANGUAGES, tongueOf } from "~/lib/languages";

export function LanguagePick({ now, pick }: { now: string; pick: (name: string) => void }) {
  const here = tongueOf(now);
  return (
    <>
      <p className="mt-1 text-muted">
        Fig writes the story, reads it aloud and listens in this language. Now reading in{" "}
        <strong className="font-medium">{here.own}</strong>.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {LANGUAGES.map((one) => (
          <button
            key={one.name}
            className="option flex items-center justify-between"
            aria-pressed={one.name === here.name}
            onClick={() => pick(one.name)}
          >
            <span>{one.own}</span>
            {one.own !== one.name && <span className="text-muted">{one.name}</span>}
          </button>
        ))}
      </div>
    </>
  );
}
