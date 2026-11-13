import { Link } from "react-router";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

export function Cover({
  title,
  by,
  picture,
  seed = 0,
  label,
  note,
  to,
  n,
}: {
  title: string;
  by?: string;
  picture?: string;
  seed?: number;
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
            {picture ? (
              <img src={picture} alt={`${title}, illustrated`} className="block aspect-[7/6] w-full rounded-sm object-cover" />
            ) : (
              <Blank title={title} seed={seed} />
            )}
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

// Before a story is written there is no picture yet, so the cover carries its own initial.
function Blank({ title, seed }: { title: string; seed: number }) {
  const hue = 30 + (seed % 12) * 28;
  return (
    <div
      aria-hidden
      className="grid aspect-[7/6] w-full place-items-center rounded-sm"
      style={{
        background: `linear-gradient(160deg, oklch(0.9 0.06 ${hue}), oklch(0.82 0.08 ${(hue + 40) % 360}))`,
        color: `oklch(0.38 0.1 ${hue})`,
      }}
    >
      <span className="text-4xl font-medium">{title.trim().charAt(0).toUpperCase()}</span>
    </div>
  );
}
