"use client";

import React from "react";
import { useState } from "react";

import dynamic from "next/dynamic";

import { cn } from "@/lib/utils";
import {
  type EmojiClickData,
  type Props as EmojiPickerProps,
  EmojiStyle,
  Theme,
} from "emoji-picker-react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type BudgetEmojiPickerSheetProps = {
  value: string;
  onSelect: (emoji: string) => void;
  triggerLabel?: string;
};

const EmojiPicker = dynamic<EmojiPickerProps>(
  () => import("emoji-picker-react").then((mod) => mod.default),
  { ssr: false }
);

const BudgetEmojiPickerSheet = ({
  value,
  onSelect,
  triggerLabel = "Choose budget emoji",
}: BudgetEmojiPickerSheetProps) => {
  const [open, setOpen] = useState(false);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onSelect(emojiData.emoji);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          aria-label={triggerLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          onPointerDown={(event) => event.preventDefault()}
          className="size-8 shrink-0 rounded-lg border border-dashed"
        >
          <Plus className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className={cn(
          "max-h-[82svh] gap-0 rounded-t-3xl! border-t-0! p-0",
          "!bg-transparent"
        )}
        overlayClassName="backdrop-blur-none bg-background/15"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <SheetHeader className="sr-only gap-1 pb-3">
          <SheetTitle>Choose emoji</SheetTitle>
          <SheetDescription>
            Select an emoji for the budget icon. Current emoji is {value}.
          </SheetDescription>
        </SheetHeader>
        <div className="standalone:pb-[calc(env(safe-area-inset-bottom)+12px)]">
          <EmojiPicker
            theme={Theme.DARK}
            emojiStyle={EmojiStyle.APPLE}
            width="max(100svw,300px)"
            height="min(420px, 68svh)"
            lazyLoadEmojis
            skinTonesDisabled
            previewConfig={{ showPreview: false }}
            onEmojiClick={handleEmojiClick}
            searchDisabled
            className="overflow-hidden !rounded-t-3xl !rounded-b-none border-none [--epr-bg-color:var(--card)] [--epr-category-label-bg-color:var(--card)] [--epr-category-label-text-color:var(--muted-foreground)] [--epr-dark-bg-color:var(--card)] [--epr-dark-category-label-bg-color:var(--card)] [--epr-dark-category-label-text-color:var(--muted-foreground)] [--epr-dark-hover-bg-color:color-mix(in_srgb,var(--primary)_12%,transparent)] [--epr-dark-picker-border-color:color-mix(in_srgb,var(--border)_55%,transparent)] [--epr-dark-search-input-bg-color-active:color-mix(in_srgb,var(--background)_55%,transparent)] [--epr-dark-search-input-bg-color:color-mix(in_srgb,var(--background)_55%,transparent)] [--epr-dark-text-color:var(--foreground)] [--epr-emoji-padding:4px] [--epr-emoji-size:24px] [--epr-highlight-color:var(--primary)] [--epr-horizontal-padding:10px] [--epr-picker-border-color:color-mix(in_srgb,var(--border)_55%,transparent)] [--epr-picker-border-radius:1rem] [--epr-search-border-color-active:var(--primary)] [--epr-search-border-color:color-mix(in_srgb,var(--border)_55%,transparent)]"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default BudgetEmojiPickerSheet;
