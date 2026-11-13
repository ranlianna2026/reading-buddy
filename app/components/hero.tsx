import { useEffect, useRef } from "react";

import { paint, PLACES, type Place } from "~/lib/scenery";

export function Hero({ seed, place }: { seed: number; place: Place }) {
  const board = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ink = board.current?.getContext("2d");
    if (ink) ink.putImageData(paint(seed >>> 0, PLACES.includes(place) ? place : "meadow", 420, 272), 0, 0);
  }, [seed, place]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <canvas
        ref={board}
        width={420}
        height={272}
        className="h-full w-full"
        style={{ objectFit: "cover", imageRendering: "pixelated" }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: [
            "linear-gradient(to bottom, color-mix(in oklab, var(--rb-page) 12%, transparent) 0%, color-mix(in oklab, var(--rb-page) 52%, transparent) 36%, color-mix(in oklab, var(--rb-page) 88%, transparent) 70%, var(--rb-page) 100%)",
            "radial-gradient(120% 80% at 50% 45%, transparent 40%, color-mix(in oklab, var(--rb-page) 70%, transparent) 100%)",
          ].join(", "),
        }}
      />
    </div>
  );
}
