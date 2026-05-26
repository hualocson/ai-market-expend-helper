export const DEFAULT_BUDGET_ICON = "💰";
export const DEFAULT_BUDGET_COLOR = "lime";

export const BUDGET_COLOR_OPTIONS = [
  {
    id: "lime",
    label: "Lime",
    chipClassName: "bg-primary/14 text-primary border-primary/30",
    swatchClassName: "bg-primary",
  },
  {
    id: "sky",
    label: "Sky",
    chipClassName: "bg-sky-400/14 text-sky-300 border-sky-300/30",
    swatchClassName: "bg-sky-400",
  },
  {
    id: "violet",
    label: "Violet",
    chipClassName: "bg-violet-400/14 text-violet-300 border-violet-300/30",
    swatchClassName: "bg-violet-400",
  },
  {
    id: "rose",
    label: "Rose",
    chipClassName: "bg-rose-400/14 text-rose-300 border-rose-300/30",
    swatchClassName: "bg-rose-400",
  },
  {
    id: "amber",
    label: "Amber",
    chipClassName: "bg-amber-400/14 text-amber-300 border-amber-300/30",
    swatchClassName: "bg-amber-400",
  },
  {
    id: "emerald",
    label: "Emerald",
    chipClassName: "bg-emerald-400/14 text-emerald-300 border-emerald-300/30",
    swatchClassName: "bg-emerald-400",
  },
  {
    id: "cyan",
    label: "Cyan",
    chipClassName: "bg-cyan-400/14 text-cyan-300 border-cyan-300/30",
    swatchClassName: "bg-cyan-400",
  },
  {
    id: "fuchsia",
    label: "Fuchsia",
    chipClassName: "bg-fuchsia-400/14 text-fuchsia-300 border-fuchsia-300/30",
    swatchClassName: "bg-fuchsia-400",
  },
  {
    id: "orange",
    label: "Orange",
    chipClassName: "bg-orange-400/14 text-orange-300 border-orange-300/30",
    swatchClassName: "bg-orange-400",
  },
  {
    id: "teal",
    label: "Teal",
    chipClassName: "bg-teal-400/14 text-teal-300 border-teal-300/30",
    swatchClassName: "bg-teal-400",
  },
  {
    id: "indigo",
    label: "Indigo",
    chipClassName: "bg-indigo-400/14 text-indigo-300 border-indigo-300/30",
    swatchClassName: "bg-indigo-400",
  },
  {
    id: "slate",
    label: "Slate",
    chipClassName: "bg-slate-400/14 text-slate-200 border-slate-300/30",
    swatchClassName: "bg-slate-400",
  },
] as const;

export type BudgetColorId = (typeof BUDGET_COLOR_OPTIONS)[number]["id"];

export const BUDGET_COLOR_IDS = BUDGET_COLOR_OPTIONS.map(
  (option) => option.id
) as [BudgetColorId, ...BudgetColorId[]];

export const isBudgetColorId = (value: unknown): value is BudgetColorId =>
  typeof value === "string" &&
  BUDGET_COLOR_OPTIONS.some((option) => option.id === value);

export const getBudgetColorOption = (value: unknown) =>
  BUDGET_COLOR_OPTIONS.find((option) => option.id === value) ??
  BUDGET_COLOR_OPTIONS[0];

export const normalizeBudgetColor = (value: unknown): BudgetColorId =>
  isBudgetColorId(value) ? value : DEFAULT_BUDGET_COLOR;

export const normalizeBudgetIcon = (value: unknown): string => {
  if (typeof value !== "string") {
    return DEFAULT_BUDGET_ICON;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 8) {
    return DEFAULT_BUDGET_ICON;
  }

  return trimmed;
};
