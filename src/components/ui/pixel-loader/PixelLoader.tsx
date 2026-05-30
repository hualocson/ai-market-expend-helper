"use client";

import type { CSSProperties, FC } from "react";

import { cn } from "@/lib/utils";

import {
  COLOR_PALETTE,
  PATTERNS,
  SPEED_MULTIPLIER,
  generateKeyframes,
} from "./patterns";

type PixelLoaderProps = {
  pattern?: "wave" | "pulse" | "zigzag";
  colorCycle?: boolean;
  color?: string;
  size?: "sm" | "md" | "lg";
  speed?: "slow" | "normal" | "fast";
  className?: string;
  label?: string;
};

const SIZE_CLASSES = {
  sm: { cell: "size-1.5" },
  md: { cell: "size-2.5" },
  lg: { cell: "size-3.5" },
} as const;

const CELLS = Array.from({ length: 9 });
const KEYFRAMES_CSS = generateKeyframes();

const PixelLoader: FC<PixelLoaderProps> = ({
  pattern = "wave",
  colorCycle = true,
  color = COLOR_PALETTE[0],
  size = "md",
  speed = "normal",
  className,
  label = "Loading",
}) => {
  const { delays, duration } = PATTERNS[pattern];
  const multiplier = SPEED_MULTIPLIER[speed];
  const sizeConfig = SIZE_CLASSES[size];

  return (
    <div
      role="status"
      aria-label={label}
      className={cn(
        "inline-grid grid-cols-3 gap-[2px] motion-reduce:animate-none",
        className
      )}
      style={
        colorCycle
          ? { animation: "pixel-color-cycle 8s ease-in-out infinite" }
          : ({ "--pixel-color": color } as CSSProperties)
      }
    >
      <style>{KEYFRAMES_CSS}</style>
      {CELLS.map((_, i) => (
        <div
          key={i}
          className={cn(
            sizeConfig.cell,
            "rounded-[1px] motion-reduce:animate-none motion-reduce:opacity-60"
          )}
          style={{
            animation: `pixel-fade ${duration * multiplier}ms cubic-bezier(0.25, 1, 0.5, 1) ${delays[i] * multiplier}ms infinite`,
          }}
        />
      ))}
    </div>
  );
};

export default PixelLoader;
