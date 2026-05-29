"use client";

import { type CSSProperties, useEffect, useId, useRef, useState } from "react";

import { usePathname, useRouter } from "next/navigation";

import { useAppHaptics } from "@/hooks/useAppHaptics";
import { cn } from "@/lib/utils";
import { BarChart3, ChevronsUpDown, Cog, Home, Wallet } from "lucide-react";

import QuickExpenseDrawer from "@/components/QuickExpenseDrawer";

type TBottomNavItemId = "home" | "budgets" | "reports" | "settings";

type TBottomNavItem = {
  id: TBottomNavItemId;
  href: string;
  label: string;
  icon: typeof Home;
  isActive: (pathname: string) => boolean;
};

const isActiveSection = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

const primaryItems: TBottomNavItem[] = [
  {
    id: "home",
    href: "/",
    label: "Home",
    icon: Home,
    isActive: (pathname) => pathname === "/",
  },
  {
    id: "budgets",
    href: "/budgets",
    label: "Budget",
    icon: Wallet,
    isActive: (pathname) => isActiveSection(pathname, "/budgets"),
  },
];

const secondaryItems: TBottomNavItem[] = [
  {
    id: "reports",
    href: "/report",
    label: "Report",
    icon: BarChart3,
    isActive: (pathname) => isActiveSection(pathname, "/report"),
  },
  {
    id: "settings",
    href: "/settings",
    label: "Settings",
    icon: Cog,
    isActive: (pathname) => isActiveSection(pathname, "/settings"),
  },
];

const menuItems = [...primaryItems, ...secondaryItems];

const hiddenPaths = ["/ai"];

const baseButtonClassName =
  "focus-visible:ring-ring/40 group grid shrink-0 place-items-center rounded-full text-foreground focus-visible:ring-2 focus-visible:outline-none";

const baseIconGroupClassName =
  "grid place-items-center rounded-full transition-[transform,background-color,box-shadow,opacity] duration-200 ease-out group-active:scale-[0.96]";

const animationVars = {
  "--resize-dur": "300ms",
  "--resize-ease": "cubic-bezier(0.22, 1, 0.36, 1)",
} as CSSProperties;

const getActiveItemId = (pathname: string): TBottomNavItemId =>
  menuItems.find((item) => item.isActive(pathname))?.id ?? "home";

const BottomNav = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [activeItem, setActiveItem] = useState<TBottomNavItemId>(() =>
    getActiveItemId(pathname)
  );

  const SecondaryIcon = secondaryItems.find((i) => i.id === activeItem)?.icon;

  const haptics = useAppHaptics();
  const navRef = useRef<HTMLDivElement>(null);
  const secondaryId = useId();

  useEffect(() => {
    setActiveItem(getActiveItemId(pathname));
  }, [pathname]);

  useEffect(() => {
    if (!expanded) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Node) || navRef.current?.contains(target)) {
        return;
      }

      setExpanded(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [expanded]);

  if (
    hiddenPaths.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`)
    )
  ) {
    return null;
  }

  const handleNavigate = (item: TBottomNavItem) => {
    setActiveItem(item.id);
    setExpanded(false);
    router.push(item.href);
  };

  return (
    <nav
      aria-label="Primary"
      className="standalone:pb-[calc(env(safe-area-inset-bottom))] fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pt-3 pb-4"
    >
      <div
        className="flex w-full max-w-[390px] items-end justify-between gap-4"
        style={animationVars}
      >
        <div
          ref={navRef}
          className={cn(
            "relative grid w-[236px] items-end overflow-hidden rounded-[34px] bg-[linear-gradient(180deg,color-mix(in_srgb,#ffffff_9%,transparent),color-mix(in_srgb,#ffffff_2%,transparent)),color-mix(in_srgb,var(--surface-3)_78%,transparent)] shadow-[inset_0_1px_0_color-mix(in_srgb,#ffffff_20%,transparent),0_20px_46px_color-mix(in_srgb,#000000_58%,transparent)] backdrop-blur-2xl select-none active:scale-[1.02] active:bg-white/10",
            expanded ? "gap-2 p-2" : "gap-0 p-1.5"
          )}
          style={
            {
              height: expanded ? 200 : 60,
              transition: "height var(--resize-dur) var(--resize-ease)",
              willChange: "height",
            } as CSSProperties
          }
          data-expanded={expanded}
        >
          {expanded ? (
            <div
              id={secondaryId}
              className="grid w-full gap-1 transition-[opacity,transform] duration-200 ease-out"
            >
              {menuItems.map((item) => {
                const Icon = item.icon;
                const active = item.id === activeItem;

                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={item.label}
                    aria-pressed={active}
                    onClick={() => handleNavigate(item)}
                    className="group text-foreground focus-visible:ring-ring/40 grid h-11 w-full grid-cols-[36px_minmax(0,1fr)] items-center rounded-full text-left text-[17px] font-semibold transition-opacity duration-200 ease-out focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <span
                      className={cn(
                        "col-span-2 grid h-11 grid-cols-[36px_minmax(0,1fr)] items-center rounded-full px-4 transition-[transform,background-color,box-shadow] duration-200 ease-out group-hover:bg-white/10",
                        active && "bg-white/8"
                      )}
                    >
                      <Icon className="size-5" />
                      <span className="truncate">{item.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div id={secondaryId} className="grid grid-cols-3 gap-1">
              {primaryItems.map((item) => {
                const Icon = item.icon;
                const active = item.id === activeItem;

                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={item.label}
                    aria-pressed={active}
                    onClick={() => handleNavigate(item)}
                    className={cn(
                      baseButtonClassName,
                      "hover:[&>span]:bg-white/15"
                    )}
                  >
                    <span
                      className={cn(
                        baseIconGroupClassName,
                        "h-12 w-18",
                        active && "bg-white/10"
                      )}
                    >
                      <Icon className="size-6" />
                    </span>
                    <span className="sr-only">{item.label}</span>
                  </button>
                );
              })}

              <button
                type="button"
                aria-label="Expand navigation"
                aria-expanded={expanded}
                aria-controls={secondaryId}
                onClick={() => setExpanded(true)}
                className={cn(baseButtonClassName, "hover:[&>span]:bg-white/8")}
              >
                <span
                  className={cn(
                    baseIconGroupClassName,
                    "h-12 w-18",
                    SecondaryIcon && "relative isolate bg-white/10"
                  )}
                >
                  {SecondaryIcon && (
                    <ChevronsUpDown className="text-foreground/50 absolute right-0 mr-1 size-3.5" />
                  )}
                  {SecondaryIcon ? (
                    <SecondaryIcon className="size-6" />
                  ) : (
                    <ChevronsUpDown className="size-6 transition-transform duration-200 ease-out" />
                  )}
                </span>
              </button>
            </div>
          )}
        </div>

        <div className="grid size-14 shrink-0 place-items-center rounded-full bg-[linear-gradient(180deg,color-mix(in_srgb,#ffffff_9%,transparent),color-mix(in_srgb,#ffffff_2%,transparent)),color-mix(in_srgb,var(--surface-3)_78%,transparent)] p-1 shadow-[inset_0_1px_0_color-mix(in_srgb,#ffffff_20%,transparent),0_20px_46px_color-mix(in_srgb,#000000_58%,transparent)] backdrop-blur-2xl [&_[data-slot=button]]:size-14 [&_[data-slot=button]]:rounded-full [&_[data-slot=button]:active>span]:scale-[0.96] [&_[data-slot=button]>span]:transition-transform [&_[data-slot=button]>span]:duration-200 [&_[data-slot=button]>span]:ease-out">
          <QuickExpenseDrawer
            compact
            onTriggerClick={() => haptics.impact("medium")}
          />
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
