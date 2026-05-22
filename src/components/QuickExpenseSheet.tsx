"use client";

import React, { useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export type TQuickExpenseSheetProps = {
  compact?: boolean;
};

const QuickExpenseSheet = ({ compact = false }: TQuickExpenseSheetProps) => {
  const [open, setOpen] = useState(false);
  const noteRef = useRef<HTMLInputElement>(null);

  return (
    <Sheet open={open} onOpenChange={setOpen} modal>
      <SheetTrigger asChild>
        <Button
          size={compact ? "icon-lg" : "default"}
          aria-label={compact ? "Add expense" : undefined}
          className={cn(
            "rounded-full shadow-[0_25px_60px_color-mix(in_srgb,var(--background)_60%,transparent)] active:scale-[0.97]",
            compact && "size-12"
          )}
        >
          <Plus className={compact ? "h-5 w-5" : "h-4 w-4"} />
          {compact ? null : "Add expense"}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="h-full w-full gap-0 rounded-none p-0"
      >
        <div className="flex h-full flex-col px-4 pt-4">
          <input
            ref={noteRef}
            autoFocus
            placeholder="What did you spend on?"
            className="w-full whitespace-nowrap overflow-hidden border-0 bg-transparent px-0 py-2 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default QuickExpenseSheet;
