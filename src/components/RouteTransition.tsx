"use client";

import type { ReactNode } from "react";

import { usePathname } from "next/navigation";

const RouteTransition = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();

  return (
    <div key={pathname} className="route-transition">
      {children}
    </div>
  );
};

export default RouteTransition;
