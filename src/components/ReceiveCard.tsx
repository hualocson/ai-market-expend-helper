"use client";

import { useState } from "react";

import { Category } from "@/enums/category";
import { Calendar, DollarSign, Edit3, PlusIcon, Tag } from "lucide-react";

import ConfirmAddDrawer from "./ConfirmAddDrawer";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

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
                type="number"
                value={editableExpense.amount}
                onChange={(e) =>
                  handleFieldChange("amount", parseFloat(e.target.value) || 0)
                }
                className="h-10 [appearance:textfield] pr-14 text-right text-lg font-semibold [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                placeholder="0.00"
              />
              <span className="text-muted-foreground absolute top-1/2 right-4 -translate-y-1/2 text-sm">
                VND
              </span>
            </div>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <label className="text-foreground text-sm font-medium">
              Category
            </label>
            <div className="relative">
              <Tag className="text-muted-foreground absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2" />
              <Select
                value={editableExpense.category}
                onValueChange={(value) => handleFieldChange("category", value)}
              >
                <SelectTrigger className="h-12 w-full pl-10">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(Category).map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
          <div className="space-y-2">
            <label className="text-foreground text-sm font-medium">Date</label>
            <div className="relative">
              <Calendar className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <input
                type="date"
                value={
                  new Date(editableExpense.date).toISOString().split("T")[0]
                }
                onChange={(e) => handleFieldChange("date", e.target.value)}
                className="border-input bg-background text-foreground focus:ring-ring h-10 w-full rounded-md border pr-4 pl-10 focus:ring-2 focus:outline-none"
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
