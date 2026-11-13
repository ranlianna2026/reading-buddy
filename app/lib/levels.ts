// The reading-level ladder, forked from the Python app's learner profile.
export const LEVELS: Record<number, { label: string; name: string; words: [number, number] }> = {
  1: { label: "Level 1 · first reader", name: "first reader", words: [50, 80] },
  2: { label: "Level 2 · early reader", name: "early reader", words: [80, 120] },
  3: { label: "Level 3 · developing reader", name: "developing reader", words: [120, 170] },
  4: { label: "Level 4 · fluent reader", name: "fluent reader", words: [170, 230] },
  5: { label: "Level 5 · advanced reader", name: "advanced reader", words: [220, 300] },
};

export const levelLabel = (level: number) => (LEVELS[level] ?? LEVELS[2]).label;
export const levelName = (level: number) => (LEVELS[level] ?? LEVELS[2]).name;

export const SKILLS: Record<string, string> = { recall: "Remember", inference: "Think", vocabulary: "Words" };
