import type { ExpenseListItemData } from "@/components/ExpenseListItem";

export type QuickEntryStatus = "pending" | "resolved" | "failed";

export type QuickEntry = {
  id: string;
  input: string;
  status: QuickEntryStatus;
  result?: ExpenseListItemData;
  error?: string;
};
