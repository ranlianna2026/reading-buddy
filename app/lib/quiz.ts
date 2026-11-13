export type Kind = "recall" | "inference" | "vocabulary";

export type Question = {
  kind: Kind;
  question: string;
  answer: string;
  quote: string;
  word: string;
  format: "choice" | "open";
  choices: string[];
  right: number;
};

export type Verdict = { verdict: string; feedback: string; hint: string; quote: string; next: Next };
export type Next = "praise_move_on" | "hint_retry" | "reread_retry" | "explain_move_on";

export const KIND_LABEL: Record<Kind, string> = {
  recall: "What happened",
  inference: "Why",
  vocabulary: "What it means",
};

// How hard a question may be, by reading level: which kinds are tapped and which are spoken,
// and how long the question and its options may run.
export const DIFFICULTY: Record<number, { formats: Record<Kind, "choice" | "open">; q: number; opt: number; style: string }> = {
  1: {
    formats: { recall: "choice", inference: "choice", vocabulary: "choice" },
    q: 8,
    opt: 3,
    style: "very easy: ask only about things said directly in one sentence; the feeling question uses simple feeling options like 'happy', 'sad', 'scared'",
  },
  2: {
    formats: { recall: "choice", inference: "choice", vocabulary: "choice" },
    q: 10,
    opt: 4,
    style: "easy: literal recall; the why/feel question has 3 short options, one clearly right",
  },
  3: {
    formats: { recall: "choice", inference: "open", vocabulary: "choice" },
    q: 12,
    opt: 5,
    style: "gentle: the why/feel question is answered out loud in a few words",
  },
  4: { formats: { recall: "open", inference: "open", vocabulary: "choice" }, q: 14, opt: 6, style: "moderate" },
  5: { formats: { recall: "open", inference: "open", vocabulary: "choice" }, q: 16, opt: 6, style: "moderate, a little more thinking" },
};

export const levelOf = (level: number) => DIFFICULTY[Math.min(5, Math.max(1, level))] ?? DIFFICULTY[2];

// Code decides the format: three distinct options and a real answer or it is answered out loud.
export function shape(raw: Partial<Question> & { answer_index?: number }, want: "choice" | "open"): Question {
  const base = {
    kind: (["recall", "inference", "vocabulary"].includes(String(raw.kind)) ? raw.kind : "recall") as Kind,
    question: String(raw.question ?? ""),
    answer: String(raw.answer ?? ""),
    quote: String(raw.quote ?? ""),
    word: String(raw.word ?? ""),
  };
  const choices = (raw.choices ?? []).map((one) => String(one).trim()).filter(Boolean);
  const at = Number(raw.answer_index ?? raw.right ?? -1);
  if (want === "open" || choices.length !== 3 || new Set(choices.map((one) => one.toLowerCase())).size !== 3 || !(at >= 0 && at < 3))
    return { ...base, format: "open", choices: [], right: -1 };
  const answer = choices[at];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return { ...base, format: "choice", choices, right: choices.indexOf(answer) };
}

const plain = (words: string) =>
  ` ${words
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()} `;

const FIRST = /\b(first|one|a|primera?|premiere?|erste|prima)\b|第一/;
const SECOND = /\b(second|two|b|segunda?|seconde|deuxieme|zweite|seconda)\b|第二/;
const THIRD = /\b(third|three|c|last|tercera?|troisieme|derniere?|dritte|terza)\b|第三|最后/;

// Which option did the child say? Match the option's own words first, then "the second one".
export function pickByVoice(said: string, choices: string[], cjk = false) {
  const heard = plain(said);
  let best = -1;
  let score = 0;
  choices.forEach((choice, at) => {
    const clean = plain(choice).trim();
    const parts = cjk ? [...clean.replace(/\s/g, "")] : clean.split(" ").filter((word) => word.length > 2);
    if (!parts.length) return;
    const hit = parts.filter((word) => heard.includes(cjk ? word : ` ${word}`)).length / parts.length;
    if (hit > score) {
      score = hit;
      best = at;
    }
  });
  if (score >= 0.5) return best;
  if (SECOND.test(heard)) return 1;
  if (THIRD.test(heard)) return 2;
  if (FIRST.test(heard)) return 0;
  return -1;
}
