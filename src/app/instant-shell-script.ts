export const instantShellScript = `
(() => {
  try {
    const root = document.documentElement;
    if (window.location.pathname !== "/") {
      root.dataset.instantShellHydrated = "true";
    }
    root.dataset.instantShellReady = "true";
  } catch {
    const root = document.documentElement;
    root.dataset.instantShellReady = "true";
    if (window.location.pathname !== "/") {
      root.dataset.instantShellHydrated = "true";
    }
  }
})();
`;
