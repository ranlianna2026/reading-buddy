import { gradeOf } from "./grades";

export type Parts = { wcpm: number; accuracy: number; comprehension: number };

const held = (value: number) => Math.min(1, Math.max(0, value));

// One number out of a reading: how fast, how accurately, how well understood.
// Accuracy is scored against the instructional band (90% frustration, 98% independent),
// speed against the grade's own words-a-minute norm, so a Pre-K reader is not judged like a sixth grader.
export function reading(parts: Parts, grade?: string | null) {
  const target = gradeOf(grade).wcpm;
  const speed = held(parts.wcpm / target);
  const fluency = held((parts.accuracy - 80) / 18);
  const meaning = held(parts.comprehension / 100);
  const score = Math.round(100 * (0.3 * speed + 0.35 * fluency + 0.35 * meaning));
  return { score, speed, fluency, meaning, target, band: bandOf(score) };
}

export const BANDS = [
  { at: 0, name: "Getting started", note: "every reader starts here" },
  { at: 40, name: "Growing", note: "it is coming together" },
  { at: 60, name: "On track", note: "right where this grade should be" },
  { at: 80, name: "Strong", note: "reading above the grade's pace" },
  { at: 92, name: "Soaring", note: "fast, accurate and understood" },
];

export const bandOf = (score: number) => [...BANDS].reverse().find((band) => score >= band.at) ?? BANDS[0];

export function average(rows: { wcpm: number; accuracy: number; comprehension: number }[], grade?: string | null) {
  if (!rows.length) return null;
  const mean = (pick: (row: (typeof rows)[number]) => number) => rows.reduce((sum, row) => sum + pick(row), 0) / rows.length;
  return reading(
    { wcpm: mean((row) => row.wcpm), accuracy: mean((row) => row.accuracy), comprehension: mean((row) => row.comprehension) },
    grade
  );
}
