import { useMemo } from "react";

import { norm, tokens, type Status } from "~/lib/scoring";

export function Passage({
  text,
  status,
  upTo,
  quote,
  onWord,
}: {
  text: string;
  status?: Status[];
  upTo?: number;
  quote?: string;
  onWord?: (word: string) => void;
}) {
  const words = useMemo(() => tokens(text), [text]);
  const lit = useMemo(() => litRange(words, quote), [words, quote]);

  return (
    <p className="story text-left">
      {words.map((word, index) => {
        const state = status?.[index];
        const at =
          lit && index >= lit[0] && index < lit[1]
            ? "quote"
            : state === "misread" || state === "skipped"
              ? "missed"
              : upTo !== undefined && index === upTo
                ? "now"
                : state === "correct" || (upTo !== undefined && index < upTo)
                  ? "said"
                  : undefined;
        return (
          <span key={index}>
            <span
              className="w"
              data-at={at}
              onClick={onWord ? () => onWord(word) : undefined}
              style={onWord ? { cursor: "pointer" } : undefined}
            >
              {word}
            </span>{" "}
          </span>
        );
      })}
    </p>
  );
}

function litRange(words: string[], quote?: string): [number, number] | null {
  if (!quote) return null;
  const want = quote.split(/\s+/).map(norm).filter(Boolean);
  if (!want.length) return null;
  const have = words.map(norm);
  for (let start = 0; start < have.length; start++) {
    let at = start;
    let matched = 0;
    while (at < have.length && matched < want.length) {
      if (!have[at]) {
        at++;
        continue;
      }
      if (have[at] !== want[matched]) break;
      matched++;
      at++;
    }
    if (matched === want.length) return [start, at];
  }
  return null;
}
