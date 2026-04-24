import { CircleDollarSign, Tag, CalendarDays } from "lucide-react";

import { Button } from "./ui/button";

type AIExpensePreviewCardProps = {
  expense: TExpense;
  onContinue: () => void;
  onDismiss: () => void;
};

const AIExpensePreviewCard = ({
  expense,
  onContinue,
  onDismiss,
}: AIExpensePreviewCardProps) => {
  return (
    <div className="border-border/60 bg-card/80 space-y-4 rounded-3xl border p-4 shadow-lg shadow-black/5 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Review AI suggestion</h3>
          <p className="text-muted-foreground text-sm">
            Check the parsed expense before opening the full form.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-muted-foreground hover:text-foreground text-sm transition"
        >
          Dismiss
        </button>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div className="bg-muted/50 rounded-2xl p-3">
          <dt className="text-muted-foreground flex items-center gap-2 text-xs uppercase tracking-[0.2em]">
            <CircleDollarSign className="h-4 w-4" />
            Amount
          </dt>
          <dd className="mt-2 font-medium">{expense.amount.toLocaleString("en-US")}</dd>
        </div>
        <div className="bg-muted/50 rounded-2xl p-3">
          <dt className="text-muted-foreground flex items-center gap-2 text-xs uppercase tracking-[0.2em]">
            <Tag className="h-4 w-4" />
            Category
          </dt>
          <dd className="mt-2 font-medium">{expense.category}</dd>
        </div>
        <div className="bg-muted/50 rounded-2xl p-3">
          <dt className="text-muted-foreground flex items-center gap-2 text-xs uppercase tracking-[0.2em]">
            <CalendarDays className="h-4 w-4" />
            Date
          </dt>
          <dd className="mt-2 font-medium">{expense.date}</dd>
        </div>
      </dl>

      <div className="bg-muted/40 rounded-2xl px-4 py-3">
        <p className="text-muted-foreground text-xs uppercase tracking-[0.2em]">Note</p>
        <p className="mt-2 text-sm font-medium">{expense.note}</p>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDismiss}>
          Reset
        </Button>
        <Button type="button" onClick={onContinue}>
          Continue to form
        </Button>
      </div>
    </div>
  );
};

export default AIExpensePreviewCard;
