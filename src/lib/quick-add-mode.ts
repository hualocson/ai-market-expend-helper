export type QuickAddMode = "quick" | "advanced";

export type QuickAddSource = "manual" | "home_prefill" | "repeat_entry";

const QUICK_ADD_SOURCES: readonly QuickAddSource[] = [
  "manual",
  "home_prefill",
  "repeat_entry",
];

export const normalizePrefillSource = (
  source: string | undefined
): QuickAddSource => {
  return QUICK_ADD_SOURCES.includes(source as QuickAddSource)
    ? (source as QuickAddSource)
    : "manual";
};

export const resolveQuickAddMode = ({
  source,
  hasPrefill,
}: {
  source: QuickAddSource;
  hasPrefill: boolean;
}): QuickAddMode => {
  if (source !== "manual" && hasPrefill) {
    return "quick";
  }

  return "advanced";
};
