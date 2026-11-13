import { useState } from "react";

import { LANGUAGES, tongueOf } from "~/lib/languages";

export function LanguageRow({ now, pick }: { now: string; pick: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const here = tongueOf(now);
  return (
    <>
      <button className="option flex w-full items-center justify-between" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span className="text-lg">{here.own}</span>
        <span className="mono text-muted">{here.name === here.own ? here.tag : here.name}</span>
      </button>
      <p className="mt-2 text-sm text-muted">Fig writes the story, reads it aloud and listens in this language.</p>
      {open && (
        <div
          className="fixed inset-0 z-60 grid place-items-end bg-black/45 p-0 sm:place-items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Choose a language"
          onClick={() => setOpen(false)}
        >
          <div
            className="pop card flex max-h-[86svh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-b-none p-6 text-left sm:rounded-[28px]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-2xl">Multilanguage stories and reading</h2>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-3xl leading-none text-muted">
                ×
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {LANGUAGES.map((one) => (
                <button
                  key={one.name}
                  className="option flex items-center justify-between"
                  aria-pressed={one.name === here.name}
                  onClick={() => {
                    pick(one.name);
                    setOpen(false);
                  }}
                >
                  <span>{one.own}</span>
                  {one.own !== one.name && <span className="text-muted">{one.name}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
