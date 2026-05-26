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
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import BudgetBadge, { type TBudgetBadgeProps } from "@/components/BudgetBadge";

type BudgetEmojiPickerSheetProps = {
  value: string;
  color?: TBudgetBadgeProps["color"];
  onSelect: (emoji: string) => void;
  triggerLabel?: string;
};

const EmojiPicker = dynamic<EmojiPickerProps>(
  () => import("emoji-picker-react").then((mod) => mod.default),
  { ssr: false }
);

const BudgetEmojiPickerSheet = ({
  value,
  color,
  onSelect,
  triggerLabel = "Choose budget emoji",
}: BudgetEmojiPickerSheetProps) => {
  const [open, setOpen] = useState(false);
  const [pendingEmoji, setPendingEmoji] = useState(value);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setPendingEmoji(value);
    }

    setOpen(nextOpen);
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setPendingEmoji(emojiData.emoji);
  };

  const handleConfirm = () => {
    onSelect(pendingEmoji);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
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
        <SheetHeader className="px-4 py-3 text-left">
          <div className="flex items-center justify-between gap-3">
            <div className="flex w-full items-center justify-between gap-2">
              <SheetTitle className="text-xl">Choose emoji</SheetTitle>
              <BudgetBadge
                icon={pendingEmoji}
                color={color}
                name="Preview"
                className="h-8 shrink-0"
              />
            </div>
            <SheetDescription className="sr-only">
              {`Current emoji is ${pendingEmoji}.`}
            </SheetDescription>
          </div>
        </SheetHeader>
        <div className="py-2">
          <EmojiPicker
            theme={Theme.DARK}
            emojiStyle={EmojiStyle.APPLE}
            width="100svw"
            height="min(420px, 68svh)"
            lazyLoadEmojis
            skinTonesDisabled
            previewConfig={{ showPreview: false }}
            onEmojiClick={handleEmojiClick}
            searchDisabled
            className="overflow-hidden !rounded-none border-none !bg-transparent [--epr-bg-color:transparent] [--epr-category-label-bg-color:transparent] [--epr-category-label-text-color:var(--muted-foreground)] [--epr-dark-bg-color:transparent] [--epr-dark-category-label-bg-color:transparent] [--epr-dark-category-label-text-color:var(--muted-foreground)] [--epr-dark-hover-bg-color:color-mix(in_srgb,var(--primary)_12%,transparent)] [--epr-dark-picker-border-color:transparent] [--epr-dark-search-input-bg-color-active:color-mix(in_srgb,var(--background)_55%,transparent)] [--epr-dark-search-input-bg-color:color-mix(in_srgb,var(--background)_55%,transparent)] [--epr-dark-text-color:var(--foreground)] [--epr-emoji-padding:4px] [--epr-emoji-size:24px] [--epr-highlight-color:var(--primary)] [--epr-horizontal-padding:10px] [--epr-picker-border-color:transparent] [--epr-picker-border-radius:1rem] [--epr-search-border-color-active:var(--primary)] [--epr-search-border-color:color-mix(in_srgb,var(--border)_55%,transparent)]"
          />
        </div>
        <SheetFooter className="standalone:pb-[calc(env(safe-area-inset-bottom)+12px)] px-4 py-3">
          <Button type="button" className="w-full" onClick={handleConfirm}>
            Confirm emoji
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default BudgetEmojiPickerSheet;
