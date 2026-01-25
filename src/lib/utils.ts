import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

export const formatVnd = (amount: number) => {
  if (!Number.isFinite(amount)) {
    return "";
  }
  return Math.max(0, Math.trunc(amount)).toLocaleString("vi-VN");
};

export const formatVndSigned = (amount: number) => {
  if (!Number.isFinite(amount)) {
    return "";
  }
  const normalized = Math.trunc(amount);
  const formatted = Math.abs(normalized).toLocaleString("vi-VN");
  return normalized < 0 ? `-${formatted}` : formatted;
};

export const parseVndInput = (raw: string) => {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) {
    return 0;
  }
  return Number.parseInt(digits, 10);
};
