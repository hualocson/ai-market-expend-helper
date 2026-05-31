"use client";

import React from "react";

import { XIcon } from "lucide-react";

import ProgressiveBlur from "../ProgressiveBlur";
import AIQuickEntryRow from "./AIQuickEntryRow";
import type { QuickEntry } from "./types";

type AIQuickEntryPreviewProps = {
  activeEntries: QuickEntry[];
  savedEntries: QuickEntry[];
  reviewEntries: QuickEntry[];
  onDone: () => void;
  onSelectSavedEntry: (entry: QuickEntry) => void;
  onSelectReviewEntry: (entry: QuickEntry) => void;
};

type PreviewSectionProps = {
  title: string;
  entries: QuickEntry[];
  variant: "active" | "saved" | "needsReview";
  onSelectEntry?: (entry: QuickEntry) => void;
};

const getEntryNote = (entry: QuickEntry) =>
  entry.savedExpense?.note?.trim() ||
  entry.reviewDraft?.note?.trim() ||
  entry.input;

const getSelectableLabel = (
  entry: QuickEntry,
  variant: "saved" | "needsReview"
) => {
  const note = getEntryNote(entry);

  return variant === "saved"
    ? `Edit saved expense ${note}`
    : `Review expense ${note}`;
};

const PreviewSection = ({
  title,
  entries,
  variant,
  onSelectEntry,
}: PreviewSectionProps) => {
  if (entries.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2">
      <h3 className="text-muted-foreground px-1 text-[11px] font-bold tracking-[0.12em] uppercase">
        {title}
      </h3>
      <div className="space-y-2">
        {entries.map((entry) =>
          variant === "active" ? (
            <AIQuickEntryRow key={entry.id} entry={entry} variant={variant} />
          ) : (
            <button
              key={entry.id}
              type="button"
              aria-label={getSelectableLabel(entry, variant)}
              onClick={() => onSelectEntry?.(entry)}
              onPointerDown={(event) => event.preventDefault()}
              className="block min-h-11 w-full text-left"
            >
              <AIQuickEntryRow entry={entry} variant={variant} />
            </button>
          )
        )}
      </div>
    </section>
  );
};

const AIQuickEntryPreview = ({
  activeEntries,
  savedEntries,
  reviewEntries,
  onDone,
  onSelectSavedEntry,
  onSelectReviewEntry,
}: AIQuickEntryPreviewProps) => {
  return (
    <div className="relative mx-auto flex h-dvh w-full max-w-[390px] flex-col px-4 pt-[calc(env(safe-area-inset-top)+18px)] pb-0">
      <h2 className="text-foreground text-center text-sm font-bold">
        AI Quick Entry
      </h2>

      <div className="no-scrollbar mt-4 flex-1 space-y-5 overflow-y-auto pb-24">
        <PreviewSection
          title="Active"
          entries={activeEntries}
          variant="active"
        />
        <PreviewSection
          title="Saved"
          entries={savedEntries}
          variant="saved"
          onSelectEntry={onSelectSavedEntry}
        />
        <PreviewSection
          title="Needs review"
          entries={reviewEntries}
          variant="needsReview"
          onSelectEntry={onSelectReviewEntry}
        />
      </div>

      <ProgressiveBlur
        className="absolute right-0 bottom-0 left-0"
        position="bottom"
        height="120px"
      />
      <button
        type="button"
        aria-label="Return to quick entry"
        onPointerDown={(event) => event.preventDefault()}
        onClick={onDone}
        className="ds-glass glass-border text-foreground absolute bottom-[calc(env(safe-area-inset-bottom)+20px)] left-1/2 grid size-14 -translate-x-1/2 place-items-center rounded-full transition-transform active:scale-[0.96]"
      >
        <XIcon className="size-5" />
      </button>
    </div>
  );
};

export default AIQuickEntryPreview;
