import { create } from "zustand";

type AIQuickEntryState = {
  open: boolean;
  setOpen: (value: boolean) => void;
};

export const useAIQuickEntryStore = create<AIQuickEntryState>((set) => ({
  open: false,
  setOpen: (value) => set({ open: value }),
}));
