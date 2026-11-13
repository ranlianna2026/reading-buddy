export type Status = "unread" | "correct" | "misread" | "skipped";
export type Miscue = { index: number; expected: string; said: string | null; type: "misread" | "skipped" };
export type Score = {
  status: Status[];
  tokens: string[];
  wordsInPassage: number;
  wordsAttempted: number;
  wordsCorrect: number;
  accuracy: number;
  wcpm: number;
  seconds: number;
  finished: boolean;
  miscues: Miscue[];
  practiceWords: string[];
};

const NUMBERS: Record<string, string> = {
  "0": "zero",
  "1": "one",
  "2": "two",
  "3": "three",
  "4": "four",
  "5": "five",
  "6": "six",
  "7": "seven",
  "8": "eight",
  "9": "nine",
  "10": "ten",
};

export const tokens = (passage: string) => passage.split(/\s+/).filter(Boolean);

export function norm(token: string) {
  const bare = token
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9']/g, "")
    .replace(/^'+|'+$/g, "");
  return NUMBERS[bare] ?? bare;
}

export const bareWord = (token: string) => token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").toLowerCase();

function ratio(a: string, b: string) {
  if (!a.length || !b.length) return 0;
  const row = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let left = 0;
    for (let j = 1; j <= b.length; j++) {
      const up = row[j];
      row[j] = a[i - 1] === b[j - 1] ? left + 1 : Math.max(row[j], row[j - 1]);
      left = up;
    }
  }
  return (2 * row[b.length]) / (a.length + b.length);
}

const close = (a: string, b: string) => a === b || (a.length > 3 && ratio(a, b) >= 0.8);

type Op = { tag: "equal" | "replace" | "delete" | "insert"; i1: number; i2: number; j1: number; j2: number };

export function opcodes(a: string[], b: string[]): Op[] {
  const table: Uint32Array[] = [];
  for (let i = 0; i <= a.length; i++) table.push(new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const raw: Op[] = [];
  let i = 0;
  let j = 0;
  const push = (tag: Op["tag"], i1: number, i2: number, j1: number, j2: number) => {
    const last = raw[raw.length - 1];
    if (last && last.tag === tag) {
      last.i2 = i2;
      last.j2 = j2;
    } else {
      raw.push({ tag, i1, i2, j1, j2 });
    }
  };
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push("equal", i, i + 1, j, j + 1);
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      push("delete", i, i + 1, j, j);
      i++;
    } else {
      push("insert", i, i, j, j + 1);
      j++;
    }
  }
  if (i < a.length) push("delete", i, a.length, j, j);
  if (j < b.length) push("insert", a.length, a.length, j, b.length);

  const merged: Op[] = [];
  for (const op of raw) {
    const last = merged[merged.length - 1];
    if (op.tag === "insert" && last?.tag === "delete") {
      merged[merged.length - 1] = { tag: "replace", i1: last.i1, i2: last.i2, j1: op.j1, j2: op.j2 };
    } else if (op.tag === "delete" && last?.tag === "insert") {
      merged[merged.length - 1] = { tag: "replace", i1: op.i1, i2: op.i2, j1: last.j1, j2: last.j2 };
    } else {
      merged.push({ ...op });
    }
  }
  return merged;
}

export function score(passage: string, transcript: string, seconds: number): Score {
  const display = tokens(passage);
  const normalised = display.map(norm);
  const keep = normalised.map((word, index) => (word ? index : -1)).filter((index) => index >= 0);
  const reference = keep.map((index) => normalised[index]);
  const heard = tokens(transcript).map(norm).filter(Boolean);

  const status: Status[] = display.map(() => "unread");
  const miscues: Miscue[] = [];
  const ops = opcodes(reference, heard);

  let reached = 0;
  for (const op of ops) if (op.tag === "equal" || op.tag === "replace") reached = op.i2;

  for (const op of ops) {
    if (op.i1 >= reached && op.tag !== "insert") continue;
    if (op.tag === "equal") {
      for (let i = op.i1; i < op.i2; i++) status[keep[i]] = "correct";
    } else if (op.tag === "replace") {
      const said = heard.slice(op.j1, op.j2);
      const end = Math.min(op.i2, reached);
      for (let i = op.i1, k = 0; i < end; i++, k++) {
        const word = k < said.length ? said[k] : null;
        if (word !== null && close(reference[i], word)) {
          status[keep[i]] = "correct";
        } else if (word === null) {
          status[keep[i]] = "skipped";
          miscues.push({ index: keep[i], expected: display[keep[i]], said: null, type: "skipped" });
        } else {
          status[keep[i]] = "misread";
          miscues.push({ index: keep[i], expected: display[keep[i]], said: word, type: "misread" });
        }
      }
    } else if (op.tag === "delete") {
      for (let i = op.i1; i < Math.min(op.i2, reached); i++) {
        status[keep[i]] = "skipped";
        miscues.push({ index: keep[i], expected: display[keep[i]], said: null, type: "skipped" });
      }
    }
  }

  const attempted = status.filter((state) => state !== "unread").length;
  const correct = status.filter((state) => state === "correct").length;
  const minutes = Math.max(seconds, 1) / 60;
  return {
    status,
    tokens: display,
    wordsInPassage: reference.length,
    wordsAttempted: attempted,
    wordsCorrect: correct,
    accuracy: attempted ? Math.round((correct / attempted) * 100) : 0,
    wcpm: Math.round(correct / minutes),
    seconds: Math.round(seconds * 10) / 10,
    finished: reached >= reference.length - 2,
    miscues,
    practiceWords: [...new Set(miscues.map((miscue) => bareWord(miscue.expected)).filter((word) => word.length > 3))].slice(0, 8),
  };
}

export function readingPlace(passage: string, transcript: string) {
  const display = tokens(passage);
  const normalised = display.map(norm);
  const keep = normalised.map((word, index) => (word ? index : -1)).filter((index) => index >= 0);
  const reference = keep.map((index) => normalised[index]);
  const heard = tokens(transcript).map(norm).filter(Boolean);
  if (!heard.length) return 0;
  let at = 0;
  for (const word of heard) {
    for (let look = at; look < Math.min(at + 5, reference.length); look++) {
      if (close(reference[look], word)) {
        at = look + 1;
        break;
      }
    }
  }
  return at < reference.length ? keep[at] : display.length;
}
