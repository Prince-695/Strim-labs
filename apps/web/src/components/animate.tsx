"use client";

import { type ReactNode } from "react";
import gsap from "gsap";
import { useGsap } from "@/hooks/use-gsap";
import { cn } from "@/lib/utils";

type AnimateProps = {
  children: ReactNode;
  className?: string;
  /** CSS selector for children to animate. Defaults to "> *" (direct children). */
  selector?: string;
  /** Stagger delay between items in seconds. Default 0.06 */
  stagger?: number;
  /** Translate Y offset in px for the entrance. Default 24 */
  y?: number;
  /** Animation duration in seconds. Default 0.5 */
  duration?: number;
  /** Delay before animation starts. Default 0 */
  delay?: number;
  /** GSAP ease string. Default "power2.out" */
  ease?: string;
  /** HTML tag for the wrapper. Default "div" */
  as?: keyof HTMLElementTagNameMap;
};

/**
 * Staggered fade-in-up wrapper. Wrap a group of elements and they'll
 * animate in one after another on mount.
 *
 * <Animate>
 *   <Card>...</Card>
 *   <Card>...</Card>
 * </Animate>
 */
export function Animate({
  children,
  className,
  selector = "> *",
  stagger = 0.06,
  y = 24,
  duration = 0.5,
  delay = 0,
  ease = "power2.out",
  as: Tag = "div",
}: AnimateProps) {
  const ref = useGsap<HTMLElement>((container) => {
    const targets = container.querySelectorAll(selector);
    if (!targets.length) return;
    gsap.from(targets, {
      y,
      autoAlpha: 0,
      duration,
      delay,
      stagger,
      ease,
    });
  });

  // @ts-expect-error — dynamic HTML tag with ref
  return <Tag ref={ref} className={cn(className)}>{children}</Tag>;
}
