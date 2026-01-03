"use client";

import { useRef, useState } from "react";

import { Loader2, Plus, XIcon } from "lucide-react";

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

import ExpenseEntry from "@/components/ExpenseEntry";
import { type ManualExpenseFormHandle } from "@/components/ManualExpenseForm";

const ExpenseEntryDrawer = () => {
  const [open, setOpen] = useState(false);
  const [formState, setFormState] = useState({
    canSubmit: false,
    loading: false,
  });
  const formRef = useRef<ManualExpenseFormHandle>(null);
  const submitLabel = "Add Expense";
  const loadingLabel = "Adding...";
  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      direction="right"
      dismissible={false}
    >
      <DrawerTrigger asChild>
        <Button className="w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Add expense
        </Button>
      </DrawerTrigger>
      <DrawerContent className="backdrop-blur data-[vaul-drawer-direction=right]:w-full data-[vaul-drawer-direction=right]:max-w-[min(100svw,680px)]!">
        <DrawerHeader className="text-left">
          <DrawerTitle>Add a new expense</DrawerTitle>
          <DrawerDescription>
            Use AI or the quick form to add a new entry.
          </DrawerDescription>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 rounded-full"
            onClick={() => setOpen(false)}
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </DrawerHeader>
        <div className="no-scrollbar scroll-fade-y flex-1 overflow-y-auto px-2 pb-4">
          <ExpenseEntry
            formRef={formRef}
            showSubmitButton={false}
            onStateChange={setFormState}
          />
        </div>
        <DrawerFooter className="border-t">
          <Button
            onClick={() => formRef.current?.submit()}
            disabled={!formState.canSubmit || formState.loading}
            className="h-10 w-full rounded-xl text-base font-medium"
          >
            {formState.loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {loadingLabel}
              </>
            ) : (
              submitLabel
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default ExpenseEntryDrawer;
