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
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

import BudgetBadge from "@/components/BudgetBadge";

type BudgetEmojiPickerDrawerProps = {
  value: string;
  onSelect: (emoji: string) => void;
  triggerLabel?: string;
};

const EmojiPicker = dynamic<EmojiPickerProps>(
  () => import("emoji-picker-react").then((mod) => mod.default),
  { ssr: false }
);

const BudgetEmojiPickerDrawer = ({
  value,
  onSelect,
  triggerLabel = "Choose budget emoji",
}: BudgetEmojiPickerDrawerProps) => {
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
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
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
      </DrawerTrigger>
      <DrawerContent
        hideIndicator
        className={cn(
          "max-h-[82svh] gap-0 rounded-t-3xl! border-t-0! p-0",
          "!bg-transparent"
        )}
        overlayClassName="backdrop-blur-none bg-background/15"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DrawerHeader className="px-4 py-3 text-left">
          <div className="flex items-center justify-between gap-3">
            <div className="flex w-full items-center justify-between gap-2">
              <DrawerTitle className="text-xl">Choose emoji</DrawerTitle>
              <BudgetBadge
                icon={pendingEmoji}
                name="Preview"
                className="h-8 shrink-0"
              />
            </div>
            <DrawerDescription className="sr-only">
              {`Current emoji is ${pendingEmoji}.`}
            </DrawerDescription>
          </div>
        </DrawerHeader>
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
        <DrawerFooter className="standalone:pb-[calc(env(safe-area-inset-bottom)+12px)] px-4 py-3">
          <Button type="button" className="w-full" onClick={handleConfirm}>
            Confirm emoji
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default BudgetEmojiPickerDrawer;
