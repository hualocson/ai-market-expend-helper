"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import {
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts";

type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode;
    color?: string;
    theme?: {
      light?: string;
      dark?: string;
    };
  }
>;

type ChartContainerProps = React.HTMLAttributes<HTMLDivElement> & {
  config: ChartConfig;
  children: React.ReactElement;
};

const ChartContainer = ({
  config,
  children,
  className,
  ...props
}: ChartContainerProps) => {
  const id = React.useId();

  return (
    <div
      data-chart={id}
      className={cn("h-[160px] w-full", className)}
      {...props}
    >
      <ChartStyle id={id} config={config} />
      <ResponsiveContainer>{children}</ResponsiveContainer>
    </div>
  );
};

type ChartStyleProps = {
  id: string;
  config: ChartConfig;
};

const ChartStyle = ({ id, config }: ChartStyleProps) => {
  const lightColors = Object.entries(config)
    .map(([key, item]) => {
      const color = item.theme?.light ?? item.color;
      return color ? `--color-${key}: ${color};` : "";
    })
    .filter(Boolean)
    .join("");

  const darkColors = Object.entries(config)
    .map(([key, item]) => {
      const color = item.theme?.dark;
      return color ? `--color-${key}: ${color};` : "";
    })
    .filter(Boolean)
    .join("");

  return (
    <style>{`
      [data-chart="${id}"] { ${lightColors} }
      .dark [data-chart="${id}"] { ${darkColors || lightColors} }
    `}</style>
  );
};

type ChartTooltipProps = TooltipProps<number, string> & {
  hideLabel?: boolean;
  labelFormatter?: (label: string) => React.ReactNode;
};

const ChartTooltip = RechartsTooltip;

const ChartTooltipContent = React.forwardRef<HTMLDivElement, ChartTooltipProps>(
  ({ active, payload, label, hideLabel, labelFormatter }, ref) => {
    if (!active || !payload?.length) {
      return null;
    }

    const displayedLabel = labelFormatter
      ? labelFormatter(String(label))
      : label;

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white shadow-[0_18px_40px_rgba(0,0,0,0.45)] backdrop-blur-md"
        )}
      >
        {!hideLabel && (
          <div className="text-[11px] text-white/60">{displayedLabel}</div>
        )}
        <div className="mt-1 flex flex-col gap-1">
          {payload.map((item) => (
            <div key={item.dataKey} className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: item.color }}
              />
              <span className="text-xs text-white/80">
                {item.value?.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
);

ChartTooltipContent.displayName = "ChartTooltipContent";

export { ChartContainer, ChartTooltip, ChartTooltipContent };
