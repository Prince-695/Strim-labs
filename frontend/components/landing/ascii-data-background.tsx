
"use client";

import { useEffect, useRef } from "react";

interface AsciiDataBackgroundProps {
  className?: string;
}

export function AsciiDataBackground({
  className = "",
}: AsciiDataBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;
    let animationId = 0;
    let lastFrame = 0;

    const computed = getComputedStyle(document.documentElement);
    const sandColor = computed.getPropertyValue("--sand").trim() || "#D8CBB3";
    const mutedColor = computed.getPropertyValue("--foreground-muted").trim() || "#9C9585";
    const dangerColor = computed.getPropertyValue("--danger").trim() || "#EF4444";

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const random = (x: number, y: number) => {
      const value =
        Math.sin(x * 127.1 + y * 311.7) * 43758.5453;

      return value - Math.floor(value);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      width = rect.width;
      height = rect.height;

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const render = (time: number) => {
      if (!reducedMotion && time - lastFrame < 33) {
        animationId = requestAnimationFrame(render);
        return;
      }

      lastFrame = time;

      ctx.clearRect(0, 0, width, height);

      const t = reducedMotion ? 0 : time * 0.00025;

      const stepX = 40;
      const stepY = 20;

      ctx.font = '12px "JetBrains Mono", monospace';
      ctx.textBaseline = "middle";

      for (let y = 0; y < height; y += stepY) {
        for (let x = 0; x < width; x += stepX) {
          const nx = x / width;
          const ny = y / height;

          // --------------------------------
          // HORIZONTAL ASCII WAVES
          // --------------------------------

          const wave1 =
            0.18 +
            Math.sin(nx * 6 + t * 2.0) * 0.10 +
            Math.sin(nx * 13 - t * 1.3) * 0.035;

          const wave2 =
            0.48 +
            Math.sin(nx * 5 - t * 1.7 + 1.7) * 0.13 +
            Math.sin(nx * 12 + t * 1.1) * 0.045;

          const wave3 =
            0.78 +
            Math.sin(nx * 7 + t * 1.5 + 3) * 0.10 +
            Math.sin(nx * 14 - t * 1.0) * 0.035;

          const d1 = Math.exp(
            -Math.pow((ny - wave1) / 0.055, 2)
          );

          const d2 = Math.exp(
            -Math.pow((ny - wave2) / 0.075, 2)
          );

          const d3 = Math.exp(
            -Math.pow((ny - wave3) / 0.055, 2)
          );

          const field = Math.max(
            d1,
            d2 * 0.85,
            d3 * 0.75
          );

          // --------------------------------
          // GENERATE ASCII CHARACTERS
          // --------------------------------

          const noise = random(x, y);

          const length =
            2 + Math.floor(
              random(x + 13, y + 71) * 15
            );

          const isNumeric =
            ny > 0.43 && noise > 0.10;

          const chars = isNumeric
            ? "0123456789  6789"
            : "~-~--~  ~-";

          let text = "";

          for (let i = 0; i < length; i++) {
            const index = Math.floor(
              random(x + i * 17, y + i * 29) *
                chars.length
            );

            text += chars[index];
          }

          // --------------------------------
          // LAYER 1: STATIC AMBIENT ASCII
          // --------------------------------

          const ambientNoise = random(
            x + 791,
            y + 397
          );

          if (ambientNoise < 0.20) {
            const ambientOpacity =
              0.055 +
              random(x + 51, y + 91) * 0.09;

            ctx.globalAlpha = ambientOpacity;
            ctx.fillStyle = sandColor;

            ctx.fillText(text, x, y);
          }

          // --------------------------------
          // LAYER 2: ANIMATED ASCII WAVES
          // --------------------------------

          if (noise > 0.32 + field * 0.62) continue;

          const opacity = Math.min(
            0.36,
            (0.035 + field * 0.28) *
              (0.65 + random(x + 7, y + 3) * 0.7)
          );

          const waveOffset =
            Math.sin(nx * 9 + t * 2.4 + ny * 4) * 22 +
            Math.sin(nx * 18 - t * 1.8 + ny * 3) * 9 +
            Math.sin(nx * 5 + t * 1.2 + ny * 7) * 5;

          const offsetY =
            Math.sin(nx * 8 + t * 2.2 + ny * 5) * 5 +
            waveOffset;

          ctx.globalAlpha = opacity;
          ctx.fillStyle = mutedColor;

          ctx.fillText(text, x, y + offsetY);
        }
      }

      ctx.globalAlpha = 1;

      // --------------------------------
      // RANDOMLY WANDERING ASCII BUNNY
      // --------------------------------

      // Time in seconds, independent of wave animation
      const bunnyTime = reducedMotion ? 0 : time / 1000;

      // Change destination every 5 seconds
      const segmentDuration = 8;

      const segment = Math.floor(
        bunnyTime / segmentDuration
      );

      const progress =
        (bunnyTime / segmentDuration) % 1;

      // Generate deterministic random destinations
      const getWaypoint = (index: number) => ({
        x: width * (
          0.07 + random(index * 137 + 17, 31) * 0.86
        ),
        y: height * (
          0.09 + random(index * 193 + 53, 71) * 0.80
        ),
      });

      // Smooth curved movement using Catmull-Rom
      const p0 = getWaypoint(segment - 1);
      const p1 = getWaypoint(segment);
      const p2 = getWaypoint(segment + 1);
      const p3 = getWaypoint(segment + 2);

      const smoothPath = (
        a: number,
        b: number,
        c: number,
        d: number,
        amount: number
      ) => {
        const t2 = amount * amount;
        const t3 = t2 * amount;

        return 0.5 * (
          2 * b +
          (-a + c) * amount +
          (2 * a - 5 * b + 4 * c - d) * t2 +
          (-a + 3 * b - 3 * c + d) * t3
        );
      };

      // Bunny position
      const bunnyX = smoothPath(
        p0.x,
        p1.x,
        p2.x,
        p3.x,
        progress
      );

      const bunnyY = smoothPath(
        p0.y,
        p1.y,
        p2.y,
        p3.y,
        progress
      );

      // Determine direction from the actual path
      const nextProgress = Math.min(
        progress + 0.01,
        1
      );

      const nextX = smoothPath(
        p0.x,
        p1.x,
        p2.x,
        p3.x,
        nextProgress
      );

      const direction = nextX >= bunnyX ? 1 : -1;

      // Gentle running bounce
      const bounce =
        Math.abs(Math.sin(bunnyTime * 7)) * 2;

      ctx.save();

      ctx.translate(
        bunnyX,
        bunnyY + bounce
      );

      ctx.scale(direction, 1);

      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.fillStyle = dangerColor;
      ctx.globalAlpha = 0.65;

      // Bunny ears and face
      ctx.fillText("(\\_/)", 0, -12);
      ctx.fillText("(. .)", 0, 0);

      // Alternating running legs
      const runningFrame =
        Math.floor(bunnyTime * 5) % 2 === 0;

      ctx.fillText(
        runningFrame ? "/>♥️" : "\\ /",
        0,
        12
      );

      ctx.restore();

      ctx.globalAlpha = 1;

      if (!reducedMotion) {
        animationId = requestAnimationFrame(render);
      }
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    resize();
    render(0);

    return () => {
      cancelAnimationFrame(animationId);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 top-0 z-0 overflow-hidden ${className}`}
      style={{
        maskImage:
          "linear-gradient(to bottom, black 88%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, black 88%, transparent 100%)",
      }}
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
      />
    </div>
  );
}
