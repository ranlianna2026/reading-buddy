import { useEffect, useRef } from "react";

export const PLACES = ["meadow", "sea", "space", "forest", "night", "dawn"] as const;
export type Place = (typeof PLACES)[number];

type Painter = { paint: (seed: number, kind: number, w: number, h: number, beat: number) => number; memory: WebAssembly.Memory };

let loading: Promise<Painter> | null = null;

function painter() {
  loading ??= WebAssembly.instantiateStreaming(fetch("/scene.wasm"), {}).then(({ instance }) => ({
    paint: instance.exports.paint as Painter["paint"],
    memory: instance.exports.memory as WebAssembly.Memory,
  }));
  return loading;
}

export function seedOf(text: string) {
  let seed = 2166136261;
  for (let i = 0; i < text.length; i++) {
    seed ^= text.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  return seed >>> 0;
}

export function Scene({
  seed,
  place,
  width = 180,
  height = 260,
  still = false,
  className = "",
  alt = "The story, drawn",
}: {
  seed: number;
  place: Place;
  width?: number;
  height?: number;
  still?: boolean;
  className?: string;
  alt?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let frame = 0;
    let alive = true;
    const started = performance.now();
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const kind = Math.max(0, PLACES.indexOf(place));

    painter().then(({ paint, memory }) => {
      const board = canvas.current;
      const ink = board?.getContext("2d");
      if (!board || !ink || !alive) return;
      board.width = width;
      board.height = height;
      ink.imageSmoothingEnabled = false;
      const draw = (now: number) => {
        const at = paint(seed >>> 0, kind, width, height, Math.round(now - started));
        const pixels = new Uint8ClampedArray(memory.buffer, at, width * height * 4);
        ink.putImageData(new ImageData(pixels, width, height), 0, 0);
        if (alive && !still && !calm) frame = requestAnimationFrame(draw);
      };
      draw(started);
    });

    return () => {
      alive = false;
      cancelAnimationFrame(frame);
    };
  }, [seed, place, width, height, still]);

  return (
    <canvas
      ref={canvas}
      role="img"
      aria-label={alt}
      className={className}
      style={{ imageRendering: "pixelated", width: "100%", height: "auto", display: "block" }}
    />
  );
}
