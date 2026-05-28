"use client";

import { useMemo } from "react";

import { useWebHaptics } from "web-haptics/react";

export type AppHapticImpact = "light" | "medium" | "heavy";
export type AppHapticNotification = "success" | "warning" | "error";
export type AppHapticType =
  | AppHapticNotification
  | "selection"
  | AppHapticImpact;

export type AppHaptics = {
  success: () => void;
  warning: () => void;
  error: () => void;
  selection: () => void;
  impact: (level?: AppHapticImpact) => void;
  trigger: (type?: AppHapticType) => void;
};

export function useAppHaptics(): AppHaptics {
  const { trigger } = useWebHaptics();

  return useMemo(
    () => ({
      success: () => trigger("success"),
      warning: () => trigger("warning"),
      error: () => trigger("error"),
      selection: () => trigger("selection"),
      impact: (level: AppHapticImpact = "medium") => trigger(level),
      trigger,
    }),
    [trigger]
  );
}
