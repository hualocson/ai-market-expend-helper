export const INSTANT_SHELL_SNAPSHOT_KEY = "spendly:instant-shell:v1";

export type InstantShellSnapshot = {
  totalText: string | null;
  updatedAt: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getBrowserStorage = (): Storage | null => {
  try {
    return typeof globalThis.localStorage === "undefined"
      ? null
      : globalThis.localStorage;
  } catch {
    return null;
  }
};

export const parseInstantShellSnapshot = (
  value: unknown
): InstantShellSnapshot | null => {
  if (!isRecord(value)) {
    return null;
  }

  if ("theme" in value) {
    return null;
  }

  if (value.totalText !== null && typeof value.totalText !== "string") {
    return null;
  }

  if (
    typeof value.updatedAt !== "number" ||
    !Number.isFinite(value.updatedAt)
  ) {
    return null;
  }

  return {
    totalText: value.totalText,
    updatedAt: value.updatedAt,
  };
};

export const readInstantShellSnapshot = (): InstantShellSnapshot | null => {
  const storage = getBrowserStorage();

  if (storage === null) {
    return null;
  }

  try {
    return parseInstantShellSnapshot(
      JSON.parse(storage.getItem(INSTANT_SHELL_SNAPSHOT_KEY) ?? "null")
    );
  } catch {
    return null;
  }
};

export const writeInstantShellSnapshot = (
  snapshot: InstantShellSnapshot
): void => {
  const storage = getBrowserStorage();

  if (storage === null) {
    return;
  }

  try {
    storage.setItem(
      INSTANT_SHELL_SNAPSHOT_KEY,
      JSON.stringify({
        totalText: snapshot.totalText,
        updatedAt: snapshot.updatedAt,
      })
    );
  } catch {
    // Storage can be blocked. The shell hint is optional.
  }
};
