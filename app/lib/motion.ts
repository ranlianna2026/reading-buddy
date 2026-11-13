import { useEffect, useRef } from "react";

const still = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function useIntro<T extends HTMLElement>(key: unknown = null) {
  const scope = useRef<T>(null);
  useEffect(() => {
    const root = scope.current;
    if (!root || still()) return;
    let undo = () => {};
    import("gsap").then(({ gsap }) => {
      const parts = root.querySelectorAll<HTMLElement>("[data-intro]");
      const play = gsap.from(parts.length ? parts : root.children, {
        y: 18,
        opacity: 0,
        scale: 0.97,
        duration: 0.45,
        stagger: 0.07,
        ease: "back.out(1.4)",
        clearProps: "all",
      });
      undo = () => play.kill();
    });
    return () => undo();
  }, [key]);
  return scope;
}

export async function cheerBurst(element: Element | null) {
  if (!element || still()) return;
  const { gsap } = await import("gsap");
  gsap.fromTo(element, { scale: 0.9, rotate: -4 }, { scale: 1, rotate: 0, duration: 0.6, ease: "elastic.out(1, 0.45)" });
}
