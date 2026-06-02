import React, { type ReactNode } from "react";

import type { LucideIcon } from "lucide-react";

import { CardTitle } from "@/components/ui/card";

type InsightCardTitleProps = {
  icon: LucideIcon;
  children: ReactNode;
};

const InsightCardTitle = ({ icon: Icon, children }: InsightCardTitleProps) => (
  <CardTitle className="flex min-w-0 items-center gap-2 text-base text-balance">
    <span
      className="border-border/60 bg-muted/35 text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg border"
      aria-hidden="true"
    >
      <Icon className="size-4" strokeWidth={2.25} />
    </span>
    <span className="min-w-0">{children}</span>
  </CardTitle>
);

export default InsightCardTitle;
