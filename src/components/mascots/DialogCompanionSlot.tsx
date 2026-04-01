import * as React from "react";

import { cn } from "@/lib/utils";

import IdleMascot from "./IdleMascot";

interface DialogCompanionSlotProps {
  className?: string;
  mascotClassName?: string;
}

const DialogCompanionSlot = ({
  className,
  mascotClassName,
}: DialogCompanionSlotProps) => (
  <div
    data-testid="dialog-companion-slot"
    className={cn(
      "mx-auto mb-1 flex h-20 w-20 items-center justify-center",
      className
    )}
  >
    <IdleMascot
      data-testid="idle-mascot"
      aria-hidden="true"
      focusable="false"
      className={cn("h-full w-full", mascotClassName)}
    />
  </div>
);

export default DialogCompanionSlot;
