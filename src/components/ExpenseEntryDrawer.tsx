"use client";

import { useState } from "react";

import { Plus, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

import ExpenseEntry from "@/components/ExpenseEntry";

const ExpenseEntryDrawer = () => {
  const [open, setOpen] = useState(false);
  return (
    <Drawer open={open} onOpenChange={setOpen} direction="right">
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
        <div className="no-scrollbar overflow-y-auto px-4 pb-6 sm:px-6">
          <ExpenseEntry />
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default ExpenseEntryDrawer;
