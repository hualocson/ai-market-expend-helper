"use client";

import { useId, useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAppHaptics } from "@/hooks/useAppHaptics";
import { cn } from "@/lib/utils";
import { BarChart3, ChevronUp, Cog, Home, Wallet } from "lucide-react";

import QuickExpenseDrawer from "@/components/QuickExpenseDrawer";

type TCompactNavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  isActive: (pathname: string) => boolean;
};

const isActiveSection = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

const primaryItems: TCompactNavItem[] = [
  {
    href: "/",
    label: "Home",
    icon: Home,
    isActive: (pathname) => pathname === "/",
  },
  {
    href: "/budgets",
    label: "Budgets",
    icon: Wallet,
    isActive: (pathname) => isActiveSection(pathname, "/budgets"),
  },
];

const secondaryItems: TCompactNavItem[] = [
  {
    href: "/report",
    label: "Reports",
    icon: BarChart3,
    isActive: (pathname) => isActiveSection(pathname, "/report"),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Cog,
    isActive: (pathname) => isActiveSection(pathname, "/settings"),
  },
];

const baseButtonClassName =
  "focus-visible:ring-ring/40 grid h-[52px] w-[72px] shrink-0 place-items-center rounded-full text-foreground transition-[transform,background-color,box-shadow,opacity] duration-200 ease-out active:scale-[0.96] focus-visible:ring-2 focus-visible:outline-none";

const CompactBottomNavPreview = () => {
  const [expanded, setExpanded] = useState(false);
  const pathname = usePathname();
  const haptics = useAppHaptics();
  const secondaryId = useId();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+20px)]"
    >
      <div className="flex w-full max-w-[390px] items-end justify-between gap-4">
        <div
          className={cn(
            "relative grid w-[236px] items-end overflow-hidden rounded-[34px] border border-white/25 bg-[linear-gradient(180deg,color-mix(in_srgb,#ffffff_9%,transparent),color-mix(in_srgb,#ffffff_2%,transparent)),color-mix(in_srgb,var(--surface-3)_78%,transparent)] p-1.5 shadow-[inset_0_1px_0_color-mix(in_srgb,#ffffff_20%,transparent),0_20px_46px_color-mix(in_srgb,#000000_58%,transparent)] backdrop-blur-2xl transition-[min-height,gap] duration-200 ease-out",
            expanded ? "min-h-[116px] gap-1.5" : "min-h-16 gap-0"
          )}
          data-expanded={expanded}
        >
          <div
            aria-hidden={!expanded}
            id={secondaryId}
            className={cn(
              "grid grid-cols-2 justify-end gap-1 transition-[max-height,opacity,transform] duration-200 ease-out",
              expanded
                ? "max-h-12 translate-y-0 opacity-100"
                : "pointer-events-none max-h-0 translate-y-2 opacity-0"
            )}
          >
            {expanded
              ? secondaryItems.map((item) => {
                  const Icon = item.icon;
                  const active = item.isActive(pathname);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-label={item.label}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        baseButtonClassName,
                        "h-[46px] opacity-85",
                        active
                          ? "bg-white/12 shadow-[inset_0_1px_0_color-mix(in_srgb,#ffffff_13%,transparent),0_8px_18px_color-mix(in_srgb,#000000_22%,transparent)]"
                          : "hover:bg-white/8"
                      )}
                    >
                      <Icon className="size-5" />
                      <span className="sr-only">{item.label}</span>
                    </Link>
                  );
                })
              : null}
          </div>

          <div className="grid grid-cols-3 gap-1">
            {primaryItems.map((item) => {
              const Icon = item.icon;
              const active = item.isActive(pathname);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    baseButtonClassName,
                    active
                      ? "bg-white/12 shadow-[inset_0_1px_0_color-mix(in_srgb,#ffffff_13%,transparent),0_8px_18px_color-mix(in_srgb,#000000_22%,transparent)]"
                      : "hover:bg-white/8"
                  )}
                >
                  <Icon className="size-7" />
                  <span className="sr-only">{item.label}</span>
                </Link>
              );
            })}

            <button
              type="button"
              aria-label={
                expanded ? "Collapse navigation" : "Expand navigation"
              }
              aria-expanded={expanded}
              aria-controls={secondaryId}
              onClick={() => setExpanded((value) => !value)}
              className={cn(baseButtonClassName, "hover:bg-white/8")}
            >
              <ChevronUp
                className={cn(
                  "size-7 transition-transform duration-200 ease-out",
                  expanded && "rotate-180"
                )}
              />
            </button>
          </div>
        </div>

        <div className="grid size-16 shrink-0 place-items-center rounded-full border border-white/25 bg-[linear-gradient(180deg,color-mix(in_srgb,#ffffff_9%,transparent),color-mix(in_srgb,#ffffff_2%,transparent)),color-mix(in_srgb,var(--surface-3)_78%,transparent)] p-1 shadow-[inset_0_1px_0_color-mix(in_srgb,#ffffff_20%,transparent),0_20px_46px_color-mix(in_srgb,#000000_58%,transparent)] backdrop-blur-2xl [&_[data-slot=button]]:size-14 [&_[data-slot=button]]:rounded-full">
          <QuickExpenseDrawer
            compact
            onTriggerClick={() => haptics.impact("medium")}
          />
        </div>
      </div>
    </nav>
  );
};

export default CompactBottomNavPreview;
