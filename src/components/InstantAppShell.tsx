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
      <div className="instant-app-shell__header">
        <div
          data-testid="instant-shell-total"
          className="instant-app-shell__total"
        />
        <div className="instant-app-shell__chips">
          <span />
          <span />
        </div>
      </div>
      <div className="instant-app-shell__heatmap" />
      <div className="instant-app-shell__day-summary" />
      <div className="instant-app-shell__rows">
        <span data-testid="instant-shell-row" />
        <span data-testid="instant-shell-row" />
        <span data-testid="instant-shell-row" />
      </div>
    </div>
  );
}
