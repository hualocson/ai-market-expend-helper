"use client";

import { useState } from "react";

import dayjs from "@/configs/date";
import { Category } from "@/enums/category";
import { Calendar, DollarSign, Edit3, PlusIcon, Tag } from "lucide-react";

import ConfirmAddDrawer from "./ConfirmAddDrawer";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { WheelPicker, WheelPickerWrapper } from "./ui/wheel-picker";
import { formatVnd, parseVndInput } from "@/lib/utils";

const categoryWheelOptions = Object.values(Category).map((category) => ({
  value: category,
  label: category,
}));

const ReceiveCard: React.FC<{ expense: TExpense }> = ({ expense }) => {
  const [editableExpense, setEditableExpense] = useState(expense);
  const [openConfirmAddDrawer, setOpenConfirmAddDrawer] = useState(false);

  const handleFieldChange = (field: keyof TExpense, value: string | number) => {
    setEditableExpense((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddToSheet = () => {
    setOpenConfirmAddDrawer(true);
  };

  return (
    <>
      <div className="bg-card rounded-2xl border p-6 shadow-sm backdrop-blur-sm">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-accent flex h-10 w-10 items-center justify-center rounded-full">
              <DollarSign className="text-primary h-5 w-5" />
            </div>
            <div>
              <h3 className="text-card-foreground font-medium">
                Expense Details
              </h3>
              <p className="text-muted-foreground text-sm">
                Review and edit before adding
              </p>
            </div>
          </div>
          <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full">
            <Edit3 className="text-muted-foreground h-4 w-4" />
          </div>
        </div>

        {/* Form Fields */}
        <div className="space-y-2">
          {/* Amount */}
          <div className="space-y-2">
            <label className="text-foreground text-sm font-medium">
              Amount
            </label>
            <div className="relative">
              <Input
                type="text"
                inputMode="numeric"
                value={formatVnd(editableExpense.amount)}
                onChange={(e) =>
                  handleFieldChange("amount", parseVndInput(e.target.value))
                }
                className="h-10 pr-14 text-right text-lg font-semibold"
                placeholder="0"
              />
              <span className="text-muted-foreground absolute top-1/2 right-4 -translate-y-1/2 text-sm">
                VND
              </span>
            </div>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <label className="text-foreground flex items-center gap-2 text-sm font-medium">
              <Tag className="text-muted-foreground h-4 w-4" />
              Category
            </label>
            <WheelPickerWrapper className="w-full">
              <WheelPicker
                value={editableExpense.category}
                onValueChange={(value) =>
                  handleFieldChange("category", value)
                }
                options={categoryWheelOptions}
                visibleCount={4}
                optionItemHeight={36}
                classNames={{
                  optionItem: "text-sm",
                  highlightWrapper: "bg-muted text-foreground font-semibold",
                }}
              />
            </WheelPickerWrapper>
          </div>

          {/* Note */}
          <div className="space-y-2">
            <label className="text-foreground text-sm font-medium">Note</label>
            <Input
              value={editableExpense.note || ""}
              onChange={(e) => handleFieldChange("note", e.target.value)}
              className="h-10"
              placeholder="Add a note (optional)"
            />
          </div>

          {/* Date */}
          <div className="w-full space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="date"
                className="text-foreground flex items-center gap-2 text-sm font-medium"
              >
                <Calendar className="text-muted-foreground h-4 w-4" />
                Date
              </label>
              <Button
                type="button"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={() =>
                  handleFieldChange("date", dayjs().format("DD/MM/YYYY"))
                }
              >
                Today
              </Button>
            </div>
            <div className="dark:bg-input/30 w-full rounded-lg border">
              <Input
                id="date"
                type="date"
                value={dayjs(editableExpense.date, "DD/MM/YYYY").format(
                  "YYYY-MM-DD"
                )}
                onChange={(e) =>
                  handleFieldChange(
                    "date",
                    dayjs(e.target.value).format("DD/MM/YYYY")
                  )
                }
                className="h-10 w-full rounded-lg border-none !bg-transparent pr-4 ring-0 focus:ring-0 focus:outline-none focus-visible:ring-0"
              />
            </div>
          </div>
        </div>

        {/* Action Button */}
        <Button
          onClick={handleAddToSheet}
          className="mt-6 h-12 w-full rounded-xl font-medium shadow-sm transition-all duration-200"
        >
          <PlusIcon className="mr-2 h-4 w-4" />
          Add to Sheet
        </Button>
      </div>

      <ConfirmAddDrawer
        open={openConfirmAddDrawer}
        setOpen={setOpenConfirmAddDrawer}
        data={editableExpense}
      />
    </>
  );
};

export default ReceiveCard;
