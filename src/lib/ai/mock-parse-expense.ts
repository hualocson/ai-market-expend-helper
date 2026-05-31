import dayjs from "@/configs/date";
import { Category } from "@/enums";

import type { ExpenseListItemData } from "@/components/ExpenseListItem";

type MockParseOptions = {
  paidBy: string;
};

let mockIdCounter = 0;

const nextMockId = () => {
  mockIdCounter -= 1;
  return mockIdCounter;
};

export const mockParseExpense = (
  input: string,
  options: MockParseOptions
): ExpenseListItemData => ({
  id: nextMockId(),
  date: dayjs().format("YYYY-MM-DD"),
  amount: 35000,
  note: input,
  category: Category.OTHER,
  paidBy: options.paidBy,
  budgetId: null,
  budgetName: null,
  budgetIcon: null,
  budgetColor: null,
  syncStatus: "synced",
});
