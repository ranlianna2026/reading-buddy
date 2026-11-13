import { Link } from "react-router";

import { Scene, type Place } from "./scene";

export function Cover({
  title,
  by,
  seed,
  place,
  to,
}: {
  title: string;
  by?: string;
  seed: number;
  place: Place;
  to?: string;
}) {
  const book = (
    <figure
      className="relative h-full overflow-hidden rounded-l-sm rounded-r-2xl border-2 border-line bg-surface"
      style={{ boxShadow: "inset 8px 0 0 -4px var(--rb-shade), 0 10px 26px -16px var(--rb-shade)" }}
    >
      <Scene seed={seed} place={place} width={300} height={390} still alt={`${title}, drawn`} />
      <figcaption
        className="absolute inset-x-0 bottom-0 px-3.5 pt-10 pb-3"
        style={{ background: "linear-gradient(transparent, oklch(0.16 0.022 84 / 0.76))" }}
      >
        <p className="text-[15px] leading-tight font-medium text-white">{title}</p>
        {by && <p className="mt-0.5 text-[12px] text-white/70">by {by}</p>}
      </figcaption>
    </figure>
  );
  return to ? (
    <Link to={to} className="block h-full rounded-r-2xl focus-visible:outline-offset-4">
      {book}
    </Link>
  ) : (
    book
  );
}
