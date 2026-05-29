import { PaidBy } from "@/enums";
import { persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

export type TSettingsState = {
  paidBy: string;
  keepDrawerOpen: boolean;
};

export type TSettingsActions = {
  setPaidBy: (paidBy: string) => void;
  setKeepDrawerOpen: (keepDrawerOpen: boolean) => void;
};

export type TSettingsStore = TSettingsState & TSettingsActions;

export const defaultInitState: TSettingsState = {
  paidBy: PaidBy.CUBI,
  keepDrawerOpen: false,
};

export const createSettingsStore = (
  initState: TSettingsState = defaultInitState
) => {
  return createStore<TSettingsStore>()(
    persist(
      (set) => ({
        ...initState,
        setPaidBy: (paidBy: string) => set({ paidBy }),
        setKeepDrawerOpen: (keepDrawerOpen: boolean) => set({ keepDrawerOpen }),
      }),
      {
        version: 2,
        name: "settings",
      }
    )
  );
};
