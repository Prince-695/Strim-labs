"use client";

import { useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type Props = {
  value: number | null | undefined;
  format?: (v: number) => string;
  className?: string;
  /** Text shown when value is missing — never a fake zero. */
  fallback?: string;
};

const defaultFormat = (v: number) => Math.round(v).toLocaleString("en-US");

/** Spring-tweened number that writes straight to the DOM node (no React re-render per frame). */
export function AnimatedNumber({ value, format = defaultFormat, className, fallback = "—" }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const fmt = useRef(format);
  fmt.current = format;

  const mv = useMotionValue(typeof value === "number" ? value : 0);
  const spring = useSpring(mv, { stiffness: 130, damping: 24, mass: 0.7 });

  useEffect(() => {
    if (typeof value !== "number") return;
    if (reduce) {
      mv.jump(value);
      if (ref.current) ref.current.textContent = fmt.current(value);
    } else {
      mv.set(value);
    }
  }, [value, mv, reduce]);

  useEffect(() => {
    return spring.on("change", (v) => {
      if (ref.current && typeof value === "number") ref.current.textContent = fmt.current(v);
    });
  }, [spring, value]);

  return (
    <span ref={ref} className={cn("font-mono tnum", className)}>
      {typeof value === "number" ? format(value) : fallback}
    </span>
  );
}
