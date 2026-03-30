"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";

type SpendingTrendChartProps = {
  totals: number[];
};

const SpendingTrendChart = ({ totals }: SpendingTrendChartProps) => {
  const chartData =
    totals.length > 0
      ? totals.map((total, index) => ({
          day: index + 1,
          total,
        }))
      : [{ day: 1, total: 0 }];

  return (
    <ChartContainer
      config={{
        total: {
          label: "Spendings",
          color: "var(--accent)",
        },
      }}
      className="h-[150px] w-full"
    >
      <AreaChart data={chartData} margin={{ left: 0, right: 0, top: 8 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="color-mix(in srgb, var(--accent) 36%, transparent)"
            />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        <CartesianGrid
          vertical={false}
          stroke="color-mix(in srgb, var(--border) 70%, transparent)"
          strokeDasharray="4 6"
        />
        <XAxis
          dataKey="day"
          axisLine={false}
          tickLine={false}
          tickMargin={10}
          tick={{
            fill: "color-mix(in srgb, var(--muted-foreground) 75%, transparent)",
            fontSize: 10,
          }}
        />
        <YAxis hide />
        <Tooltip
          cursor={{
            stroke: "color-mix(in srgb, var(--border) 90%, transparent)",
            strokeWidth: 1,
          }}
          content={
            <ChartTooltipContent labelFormatter={(label) => `Day ${label}`} />
          }
        />
        <Area
          type="monotone"
          dataKey="total"
          stroke="var(--color-total)"
          strokeWidth={2.2}
          fill="url(#trendFill)"
          dot={false}
          activeDot={{
            r: 5,
            stroke: "var(--foreground)",
            strokeWidth: 1.5,
          }}
        />
      </AreaChart>
    </ChartContainer>
  );
};

export default SpendingTrendChart;
