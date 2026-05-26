"use client";

import { useEffect } from "react";

export default function InstantShellBridge() {
  useEffect(() => {
    document.documentElement.dataset.instantShellHydrated = "true";
  }, []);

  return null;
}
