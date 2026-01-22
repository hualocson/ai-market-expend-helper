import { PaidBy } from "@/enums";
import { persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

export type TSettingsState = {
  paidBy: string;
};

export type TSettingsActions = {
  setPaidBy: (paidBy: string) => void;
};

export type TSettingsStore = TSettingsState & TSettingsActions;

export const defaultInitState: TSettingsState = {
  paidBy: PaidBy.CUBI,
};

export const createSettingsStore = (
  initState: TSettingsState = defaultInitState
) => {
  return createStore<TSettingsStore>()(
    persist(
      (set) => ({
        ...initState,
        setPaidBy: (paidBy: string) => set({ paidBy }),
      }),
      {
        version: 1,
        name: "settings",
      }
    )
  );
};
