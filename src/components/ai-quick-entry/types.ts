import type { TQuickExpenseDrawerInitialExpense } from "@/components/QuickExpenseDrawer";
import type {
  AIQuickEntryReviewReason,
  SavedQuickEntryExpense,
} from "@/components/ai-quick-entry/real-parse";

export type QuickEntryStatus = "parsing" | "saving" | "saved" | "needsReview";

export type QuickEntry = {
  id: string;
  input: string;
  status: QuickEntryStatus;
  createdAt: number;
  reviewDraft?: TQuickExpenseDrawerInitialExpense;
  savedExpense?: SavedQuickEntryExpense;
  errorReason?: AIQuickEntryReviewReason;
};
