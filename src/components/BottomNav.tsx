"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { BarChart3, Cog, Home, Receipt } from "lucide-react";

import ExpenseEntryDrawer from "@/components/ExpenseEntryDrawer";

const navItems = [
  {
    href: "/",
    label: "Home",
    icon: Home,
    isActive: (pathname: string) => pathname === "/",
  },
  {
    href: "/transactions",
    label: "Transactions",
    icon: Receipt,
    isActive: (pathname: string) => pathname.startsWith("/transactions"),
  },
  {
    href: "/report",
    label: "Reports",
    icon: BarChart3,
    isActive: (pathname: string) => pathname.startsWith("/report"),
  },
  {
    href: "/#",
    label: "Settings",
    icon: Cog,
    isActive: (pathname: string) => pathname.startsWith("/settings"),
  },
];

const BottomNav = () => {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+12px)]"
    >
      <div className="relative flex w-full max-w-lg items-center justify-between rounded-3xl border border-white/10 bg-white/5 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-6">
          {navItems.slice(0, 2).map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={item.isActive(pathname) ? "page" : undefined}
                className={cn(
                  "text-muted-foreground/80 flex flex-col items-center gap-1 text-xs transition hover:text-white",
                  item.isActive(pathname) && "text-primary"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-6">
          {navItems.slice(2).map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={item.isActive(pathname) ? "page" : undefined}
                className={cn(
                  "text-muted-foreground/80 flex flex-col items-center gap-1 text-xs transition hover:text-white",
                  item.isActive(pathname) && "text-primary"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <ExpenseEntryDrawer compact />
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
