export const MAX_HEARTS = 5;
export const REFILL = 20 * 60 * 1000;

export type Kid = {
  id: string;
  name: string;
  age: number | null;
  hearts: number;
  hearts_at: number;
  streak: number;
  streak_day: string | null;
  stars: number;
};

export const day = (at = Date.now()) => new Date(at).toLocaleDateString("en-CA");

export function heartsNow(kid: Kid) {
  if (kid.hearts >= MAX_HEARTS) return MAX_HEARTS;
  return Math.min(MAX_HEARTS, kid.hearts + Math.floor((Date.now() - kid.hearts_at) / REFILL));
}

export function nextHeartIn(kid: Kid) {
  return heartsNow(kid) >= MAX_HEARTS ? 0 : REFILL - ((Date.now() - kid.hearts_at) % REFILL);
}

export const band = (age: number | null) => (!age ? 2 : age <= 5 ? 1 : age <= 6 ? 2 : age <= 7 ? 3 : age <= 8 ? 4 : 5);
