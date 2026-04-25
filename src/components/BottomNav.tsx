"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { BarChart3, Cog, Home, Wallet } from "lucide-react";

import ExpenseEntryDrawer from "@/components/ExpenseEntryDrawer";

const navItems = [
  {
    href: "/",
    label: "Home",
    icon: Home,
    isActive: (pathname: string) => pathname === "/",
  },
  {
    href: "/budgets",
    label: "Budgets",
    icon: Wallet,
    isActive: (pathname: string) => pathname.startsWith("/budgets"),
  },
  {
    href: "/report",
    label: "Reports",
    icon: BarChart3,
    isActive: (pathname: string) => pathname.startsWith("/report"),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Cog,
    isActive: (pathname: string) => pathname.startsWith("/settings"),
  },
];

const HIDDEN_PATHS = ["/ai"];

const BottomNav = () => {
  const pathname = usePathname();

  if (HIDDEN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return null;
  }

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+12px)]"
    >
      <div className="ds-glass relative flex w-full max-w-md items-center rounded-[28px] border px-3 py-2">
        <div className="flex flex-1 items-center justify-between gap-2 pr-10">
          {navItems.slice(0, 2).map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={item.isActive(pathname) ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring/30 flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-[transform,background-color,color,box-shadow] duration-200 ease-out focus-visible:ring-2 focus-visible:outline-none",
                  item.isActive(pathname)
                    ? "bg-primary text-primary-foreground shadow-[0_12px_26px_color-mix(in_srgb,var(--accent)_34%,transparent)]"
                    : "text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="sr-only">{item.label}</span>
              </Link>
            );
          })}
        </div>
        <div className="w-14 shrink-0" aria-hidden="true" />
        <div className="flex flex-1 items-center justify-between gap-2 pl-10">
          {navItems.slice(2).map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={item.isActive(pathname) ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring/30 flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-[transform,background-color,color,box-shadow] duration-200 ease-out focus-visible:ring-2 focus-visible:outline-none",
                  item.isActive(pathname)
                    ? "bg-primary text-primary-foreground shadow-[0_12px_26px_color-mix(in_srgb,var(--accent)_34%,transparent)]"
                    : "text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="sr-only">{item.label}</span>
              </Link>
            );
          })}
        </div>
        <div className="ds-glass-strong absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border p-1">
          <ExpenseEntryDrawer compact />
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
