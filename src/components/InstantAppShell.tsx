import React from "react";

type InstantAppShellProps = {
  variant?: "root" | "loading";
};

export default function InstantAppShell({
  variant = "root",
}: InstantAppShellProps) {
  const isRoot = variant === "root";

  return (
    <div
      id={isRoot ? "instant-app-shell" : "instant-app-loading-shell"}
      data-testid="instant-app-shell"
      data-instant-shell-root={isRoot ? "true" : undefined}
      aria-hidden="true"
      className="instant-app-shell"
    >
      <div className="flex flex-col items-start gap-2">
        <div
          data-testid="instant-shell-total"
          className="h-12 w-[80vw] rounded-2xl bg-white/10"
        />
        <div className="flex items-center gap-2">
          <span className="bg-muted h-10 w-24 rounded-full" />
          <span className="bg-muted h-10 w-32 rounded-full" />
        </div>
      </div>
      <div className="bg-muted mt-2 mb-4 min-h-[300px] rounded-[28px]" />
      <div className="flex items-center justify-between">
        <span className="bg-muted h-4 w-40 rounded-full"></span>
        <span className="bg-muted h-4 w-10 rounded-full"></span>
      </div>
      {/* <div className="instant-app-shell__day-summary" />
      <div className="instant-app-shell__rows">
        <span data-testid="instant-shell-row" />
        <span data-testid="instant-shell-row" />
        <span data-testid="instant-shell-row" />
      </div> */}
    </div>
  );
}
