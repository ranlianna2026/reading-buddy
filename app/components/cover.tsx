import { Link } from "react-router";

import { Scene, type Place } from "./scene";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

export function Cover({
  title,
  by,
  seed,
  place,
  label,
  note,
  to,
  n,
}: {
  title: string;
  by?: string;
  seed: number;
  place: Place;
  label?: string;
  note?: string;
  to?: string;
  n?: number;
}) {
  const book = (
    <div className="shelf h-full">
      <article className="book h-full">
        <div className="book-spine" aria-hidden />
        <div className="flex grow flex-col">
          <div className="px-4 pt-6">
            <h3 className="letterpress line-clamp-2 h-[2.55em] text-[17px] leading-[1.25] font-medium text-ink/85">{title}</h3>
          </div>
          <div className="mt-5 px-4">
            <div className="h-px bg-ink/10" />
          </div>
          <p className="mono mt-2.5 px-4 text-muted">{label ?? (n ? `Story ${ROMAN[(n - 1) % 12]}` : "A story")}</p>
          <div className="mt-3 px-4">
            <Scene seed={seed} place={place} w={150} h={132} className="rounded-sm" alt={`${title}, drawn`} />
          </div>
          <div className="mono mt-auto flex items-center justify-between px-4 pt-3.5 pb-3.5 text-muted">
            <span>{by ? `by ${by}` : "unwritten"}</span>
            <span>{note ?? ""}</span>
          </div>
        </div>
      </article>
    </div>
  );
  return to ? (
    <Link to={to} className="block h-full rounded-r-xl focus-visible:outline-offset-4">
      {book}
    </Link>
  ) : (
    book
  );
}
