"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const FULL_BLEED_PATHS = ["/ai"];

const AppMain = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  const fullBleed = FULL_BLEED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  return <main className={cn(!fullBleed && "pb-24")}>{children}</main>;
};

export default AppMain;
