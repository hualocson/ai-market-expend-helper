"use client";

import { useState } from "react";

import { PlusIcon } from "lucide-react";

import ConfirmAddDrawer from "./ConfirmAddDrawer";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

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
      <div className="rounded border bg-white p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 rounded-xl px-2 shadow ring-1 ring-blue-200">
            <span className="size-2 flex-shrink-0 rounded-full bg-blue-500"></span>
            <p className="text-sm text-gray-500">{editableExpense.category}</p>
          </div>
          <div className="flex items-center">
            <Input
              type="number"
              value={editableExpense.amount}
              onChange={(e) =>
                handleFieldChange("amount", parseFloat(e.target.value) || 0)
              }
              className="h-auto [appearance:textfield] border-none bg-transparent text-right font-medium shadow focus:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="ml-1 text-sm">VND</span>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <Input
            value={editableExpense.note || ""}
            onChange={(e) => handleFieldChange("note", e.target.value)}
            placeholder="Note"
            className="h-auto border-none bg-transparent text-gray-500 shadow focus:ring-0"
          />
          <Input
            value={editableExpense.date}
            onChange={(e) => handleFieldChange("date", e.target.value)}
            className="h-auto border-none bg-transparent text-right text-gray-400 shadow focus:ring-0"
          />
        </div>
        <Button size="sm" className="mt-3 w-full" onClick={handleAddToSheet}>
          <PlusIcon className="h-3 w-3" />
          Add
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
