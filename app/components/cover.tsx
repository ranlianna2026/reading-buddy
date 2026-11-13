import { Scene, type Place } from "./scene";

export function Cover({
  title,
  by,
  seed,
  place,
  wide = false,
}: {
  title: string;
  by: string;
  seed: number;
  place: Place;
  wide?: boolean;
}) {
  return (
    <figure
      className={`overflow-hidden rounded-r-xl rounded-l-sm border-2 border-line bg-surface ${wide ? "w-full" : "w-28 shrink-0"}`}
      style={{ boxShadow: "inset 6px 0 0 -3px var(--rb-shade), 0 8px 20px -14px var(--rb-shade)" }}
    >
      <Scene seed={seed} place={place} width={wide ? 320 : 112} height={wide ? 200 : 84} still alt={`${title}, drawn`} />
      <figcaption className={`px-2.5 py-2 ${wide ? "px-4 py-3" : ""}`}>
        <p className={`font-medium leading-tight ${wide ? "text-xl" : "text-[13px]"}`}>{title}</p>
        <p className={`text-muted ${wide ? "text-sm" : "text-[11px]"}`}>by {by}</p>
      </figcaption>
    </figure>
  );
}
