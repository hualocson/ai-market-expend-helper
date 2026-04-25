type Pattern = {
  name: string;
  delays: ReadonlyArray<number>;
  duration: number;
};

export const PATTERNS: Record<string, Pattern> = {
  wave: {
    name: "wave-lr",
    delays: [0, 100, 200, 0, 100, 200, 0, 100, 200],
    duration: 600,
  },
  pulse: {
    name: "pulse",
    delays: [200, 100, 200, 100, 0, 100, 200, 100, 200],
    duration: 600,
  },
  zigzag: {
    name: "zigzag",
    delays: [0, 100, 200, 100, 200, 300, 200, 300, 400],
    duration: 800,
  },
};

export const SPEED_MULTIPLIER: Record<string, number> = {
  slow: 1.6,
  normal: 1,
  fast: 0.6,
};

export const COLOR_PALETTE = [
  "#b8f34a",
  "#d4ff7a",
  "#7dd3fc",
  "#4ade80",
  "#facc15",
] as const;

const ACTIVE =
  "opacity: 1; background-color: var(--pixel-color); box-shadow: 0 0 8px 0 color-mix(in srgb, var(--pixel-color) 70%, transparent), 0 0 14px 0 color-mix(in srgb, var(--pixel-color) 35%, transparent);";
const INACTIVE =
  "opacity: 0; box-shadow: none; background-color: transparent;";

export const generateKeyframes = (): string => {
  const colorStops = COLOR_PALETTE.map((color, i) => {
    const pct = ((i / COLOR_PALETTE.length) * 100).toFixed(1);
    return `  ${pct}% { --pixel-color: ${color}; }`;
  }).join("\n");

  return `@property --pixel-color {
  syntax: '<color>';
  inherits: true;
  initial-value: ${COLOR_PALETTE[0]};
}

@keyframes pixel-fade {
  0% { ${INACTIVE} }
  50% { ${ACTIVE} }
  100% { ${INACTIVE} }
}

@keyframes pixel-color-cycle {
${colorStops}
  100% { --pixel-color: ${COLOR_PALETTE[0]}; }
}`;
};
