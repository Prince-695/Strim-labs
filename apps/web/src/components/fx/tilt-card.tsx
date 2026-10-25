"use client";

import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { useRef, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type TiltCardProps = {
  children: ReactNode;
  className?: string;
  /** Max rotation in degrees. */
  max?: number;
  glare?: boolean;
  /** Extra lift on hover (px, along Z). */
  lift?: number;
};

/**
 * A card that leans toward the pointer in 3D with a soft glare that tracks the cursor.
 * Direct children can add `translate-z-*` style depth via `style={{ transform: "translateZ(24px)" }}`.
 * Disabled for touch input and reduced-motion users.
 */
export function TiltCard({ children, className, max = 7, glare = true, lift = 10 }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const hover = useMotionValue(0);

  const sx = useSpring(px, { stiffness: 220, damping: 24 });
  const sy = useSpring(py, { stiffness: 220, damping: 24 });
  const sh = useSpring(hover, { stiffness: 200, damping: 26 });

  const rotateY = useTransform(sx, [0, 1], [-max, max]);
  const rotateX = useTransform(sy, [0, 1], [max, -max]);
  const z = useTransform(sh, [0, 1], [0, lift]);

  const gx = useTransform(sx, (v) => `${v * 100}%`);
  const gy = useTransform(sy, (v) => `${v * 100}%`);
  const glareBg = useMotionTemplate`radial-gradient(360px circle at ${gx} ${gy}, rgb(0 229 117 / 0.13), transparent 62%)`;

  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (reduce || e.pointerType !== "mouse") return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  }
  function onEnter(e: PointerEvent<HTMLDivElement>) {
    if (reduce || e.pointerType !== "mouse") return;
    hover.set(1);
  }
  function onLeave() {
    px.set(0.5);
    py.set(0.5);
    hover.set(0);
  }

  return (
    <div className="perspective-1000" onPointerMove={onMove} onPointerEnter={onEnter} onPointerLeave={onLeave}>
      <motion.div
        ref={ref}
        style={reduce ? undefined : { rotateX, rotateY, z, transformStyle: "preserve-3d" }}
        className={cn("relative h-full will-change-transform", className)}
      >
        {children}
        {glare && !reduce && (
          <motion.div
            aria-hidden
            style={{ background: glareBg, opacity: sh }}
            className="pointer-events-none absolute inset-0 rounded-[inherit]"
          />
        )}
      </motion.div>
    </div>
  );
}
