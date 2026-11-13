import { useEffect, useRef } from "react";

import { paint, PLACES, type Place } from "~/lib/scenery";

export { PLACES, seedOf, type Place } from "~/lib/scenery";

export function Scene({
  seed,
  place,
  w = 132,
  h = 118,
  className = "",
  alt = "The story, drawn",
}: {
  seed: number;
  place: Place;
  w?: number;
  h?: number;
  className?: string;
  alt?: string;
}) {
  const board = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ink = board.current?.getContext("2d");
    if (!ink) return;
    ink.putImageData(paint(seed >>> 0, PLACES.includes(place) ? place : "meadow", w, h), 0, 0);
  }, [seed, place, w, h]);

  return (
    <canvas
      ref={board}
      width={w}
      height={h}
      role="img"
      aria-label={alt}
      className={className}
      style={{ imageRendering: "pixelated", width: "100%", height: "auto", display: "block" }}
    />
  );
}
