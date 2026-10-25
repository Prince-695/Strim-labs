import type { Transition } from "framer-motion";

/** Shared motion language: one expressive ease, two springs. Keeps every animation in the product feeling related. */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

export const SPRING_SOFT: Transition = { type: "spring", stiffness: 140, damping: 20, mass: 0.8 };
export const SPRING_SNAPPY: Transition = { type: "spring", stiffness: 420, damping: 32 };

export const DUR = { fast: 0.14, base: 0.2, slow: 0.45 } as const;
