"use client";

import { type ReactNode, createContext, useContext, useState } from "react";

import {
  type TSettingsStore,
  createSettingsStore,
} from "@/stores/settings-store";
import { useStore } from "zustand";

export type TSettingsStoreApi = ReturnType<typeof createSettingsStore>;

export const SettingsStoreContext = createContext<
  TSettingsStoreApi | undefined
>(undefined);

export interface SettingsStoreProviderProps {
  children: ReactNode;
}

export const SettingsStoreProvider = ({
  children,
}: SettingsStoreProviderProps) => {
  const [store] = useState(() => createSettingsStore());
  return (
    <SettingsStoreContext.Provider value={store}>
      {children}
    </SettingsStoreContext.Provider>
  );
};

export const useSettingsStore = <T,>(
  selector: (store: TSettingsStore) => T
): T => {
  const settingsStoreContext = useContext(SettingsStoreContext);
  if (!settingsStoreContext) {
    throw new Error(
      `useSettingsStore must be used within SettingsStoreProvider`
    );
  }

  return useStore(settingsStoreContext, selector);
};
