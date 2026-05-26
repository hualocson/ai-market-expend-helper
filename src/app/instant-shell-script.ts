import { INSTANT_SHELL_SNAPSHOT_KEY } from "@/lib/instant-shell/snapshot";

const escapeCssString = String.raw`
const escapeCssString = (value) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, "\\\"")
    .replace(/[\u0000-\u001f\u007f]/g, (character) =>
      "\\" + character.charCodeAt(0).toString(16).toUpperCase() + " "
    );
`;

export const instantShellScript = `
(() => {
  try {
    ${escapeCssString}
    const root = document.documentElement;
    const raw = localStorage.getItem("${INSTANT_SHELL_SNAPSHOT_KEY}");
    const snapshot = raw ? JSON.parse(raw) : null;
    root.dataset.instantShellReady = "true";
    if (
      snapshot &&
      typeof snapshot === "object" &&
      !Array.isArray(snapshot) &&
      !("theme" in snapshot) &&
      typeof snapshot.totalText === "string" &&
      typeof snapshot.updatedAt === "number" &&
      Number.isFinite(snapshot.updatedAt)
    ) {
      root.style.setProperty(
        "--instant-shell-total",
        '"' + escapeCssString(snapshot.totalText) + '"'
      );
      root.dataset.instantShellHasTotal = "true";
    }
  } catch {
    document.documentElement.dataset.instantShellReady = "true";
  }
})();
`;
