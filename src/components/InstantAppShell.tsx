import React from "react";

export default function InstantAppShell() {
  return (
    <div
      id="instant-app-shell"
      data-testid="instant-app-shell"
      aria-hidden="true"
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
      <div className="instant-app-shell__rows">
        <span data-testid="instant-shell-row" />
        <span data-testid="instant-shell-row" />
        <span data-testid="instant-shell-row" />
      </div>
      <div className="instant-app-shell__bottom" />
    </div>
  );
}
