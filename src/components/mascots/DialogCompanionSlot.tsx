import * as React from "react";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

import IdleMascot from "./IdleMascot";

interface DialogCompanionSlotProps extends HTMLAttributes<HTMLDivElement> {
  mascotClassName?: string;
}

const DialogCompanionSlot = ({
  className,
  mascotClassName,
  ...props
}: DialogCompanionSlotProps) => {
  return (
    <div
      data-testid="dialog-companion-slot"
      className={cn(className)}
      {...props}
    >
      <IdleMascot
        data-testid="idle-mascot"
        aria-hidden="true"
        focusable="false"
        className={cn(mascotClassName)}
      />
    </div>
  );
};

export default DialogCompanionSlot;
