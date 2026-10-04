"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

/**
 * Run a GSAP animation scoped to a container element.
 * Automatically reverts on unmount. Skips animation when user prefers reduced motion.
 *
 * Usage:
 *   const ref = useGsap((container) => {
 *     gsap.from(container.querySelectorAll(".card"), { y: 30, autoAlpha: 0, stagger: 0.08 });
 *   });
 *   return <div ref={ref}>...</div>;
 */
export function useGsap<T extends HTMLElement = HTMLDivElement>(
  animation: (container: T) => void,
  deps: unknown[] = [],
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      animation(el);
    });

    return () => mm.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}
