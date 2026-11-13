import { useEffect, useState } from "react";

const SCENE =
  "A friendly little green dragon sits on a grassy hill at golden hour with a big open storybook on his lap, " +
  "soft clouds behind him, wildflowers around him, waiting for a child to come and read with him.";

export function Hero() {
  const [painted, setPainted] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/picture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Reading Buddy", page: SCENE, kind: "new" }),
    })
      .then((res) => (res.ok ? (res.json() as Promise<{ url: string }>) : Promise.reject(new Error("no picture"))))
      .then((made) => alive && setPainted(made.url))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {painted && <img src={painted} alt="" className="h-full w-full object-cover" />}
      <div
        className="absolute inset-0"
        style={{
          background: painted
            ? [
                "linear-gradient(to bottom, color-mix(in oklab, var(--rb-page) 14%, transparent) 0%, color-mix(in oklab, var(--rb-page) 54%, transparent) 36%, color-mix(in oklab, var(--rb-page) 88%, transparent) 70%, var(--rb-page) 100%)",
                "radial-gradient(120% 80% at 50% 45%, transparent 40%, color-mix(in oklab, var(--rb-page) 70%, transparent) 100%)",
              ].join(", ")
            : "radial-gradient(120% 90% at 50% 20%, var(--rb-leaf-soft) 0%, var(--rb-page) 70%)",
        }}
      />
    </div>
  );
}
