"use client";

import { formatVnd } from "@/lib/utils";
import { Pie, PieChart } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

type CategoryTotal = {
  category: string;
  total: number;
};

type CategorySpendPieChartProps = {
  totals: CategoryTotal[];
  monthLabel: string;
};

const toKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");

const CategorySpendPieChart = ({
  totals,
  monthLabel,
}: CategorySpendPieChartProps) => {
  const totalSpent = totals.reduce((sum, item) => sum + item.total, 0);
  const chartData = totals.map((item, index) => {
    const key = toKey(item.category) || `category-${index}`;
    return {
      ...item,
      key,
      colorKey: `color-${key}`,
      fill: `var(--color-${key})`,
    };
  });

  const chartConfig = chartData.reduce<ChartConfig>(
    (acc, item) => {
      acc[item.category] = {
        label: item.category,
        color: `var(--${item.colorKey})`,
      };
      return acc;
    },
    {
      total: {
        label: "Total",
      },
    }
  ) satisfies ChartConfig;
  const emptyState = !totals.length;

  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>Spending by category</CardTitle>
        <CardDescription>
          {emptyState
            ? `No expenses recorded for ${monthLabel}.`
            : `${monthLabel} breakdown.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[200px]"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  valueFormatter={(value) => formatVnd(Number(value))}
                />
              }
            />
            <Pie data={chartData} dataKey="total" nameKey="category" />
          </PieChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-3 text-sm">
        {emptyState ? (
          <div className="text-muted-foreground leading-none">
            Add expenses to see category totals.
          </div>
        ) : (
          <>
            <div className="flex w-full flex-col gap-2">
              {chartData.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: `var(--${item.colorKey})` }}
                    />
                    <span className="text-muted-foreground">
                      {item.category}
                    </span>
                  </div>
                  <span className="text-foreground font-semibold">
                    {formatVnd(item.total)} VND
                  </span>
                </div>
              ))}
            </div>
            <div className="flex w-full items-center justify-between border-t border-white/10 pt-2 text-xs">
              <span className="text-muted-foreground">Total</span>
              <span className="text-foreground font-semibold">
                {formatVnd(totalSpent)} VND
              </span>
            </div>
          </>
        )}
      </CardFooter>
    </Card>
  );
};

export default CategorySpendPieChart;
