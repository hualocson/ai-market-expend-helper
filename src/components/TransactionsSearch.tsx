"use client";

import * as React from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Loader2, SearchIcon, XIcon } from "lucide-react";

import { Input } from "@/components/ui/input";

type TransactionsSearchProps = {
  placeholder?: string;
  debounceMs?: number;
  paramKey?: string;
};

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function TransactionsSearch({
  placeholder = "Search expenses by note or category",
  debounceMs = 500,
  paramKey = "q",
}: TransactionsSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isLoading, startTransition] = React.useTransition();
  const searchParamsString = searchParams.toString();

  const urlValue = React.useMemo(() => {
    const sp = new URLSearchParams(searchParamsString);
    return sp.get(paramKey) ?? "";
  }, [searchParamsString, paramKey]);

  const [value, setValue] = React.useState(urlValue);

  // This tracks what THIS component last wrote into the URL.
  const lastCommittedRef = React.useRef(urlValue);

  // Sync input from URL only when the URL change is external,
  // not the result of our own router.replace.
  React.useEffect(() => {
    const lastCommitted = lastCommittedRef.current;

    // If the URL matches what we committed, do nothing.
    // This prevents overwriting the user's current typing.
    if (urlValue === lastCommitted) {
      return;
    }

    // External navigation happened (back/forward, link click, etc.)
    // Now we can safely sync.
    setValue(urlValue);
    lastCommittedRef.current = urlValue;
  }, [urlValue]);

  const debouncedValue = useDebouncedValue(value, debounceMs);

  const replaceUrl = React.useCallback(
    (nextRaw: string) => {
      const nextTrimmed = nextRaw.trim();

      const sp = new URLSearchParams(searchParamsString);
      const current = sp.get(paramKey) ?? "";

      if (nextTrimmed === current) {
        return;
      }

      if (nextTrimmed) {
        sp.set(paramKey, nextTrimmed);
      } else {
        sp.delete(paramKey);
      }

      const qs = sp.toString();
      const href = qs ? `${pathname}?${qs}` : pathname;

      // Mark what we are about to commit, before navigation triggers a re render.
      lastCommittedRef.current = nextTrimmed;

      startTransition(() => {
        router.replace(href, { scroll: false });
      });
    },
    [router, pathname, searchParamsString, paramKey]
  );

  React.useEffect(() => {
    replaceUrl(debouncedValue);
  }, [debouncedValue, replaceUrl]);

  const onChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setValue(event.target.value);
    },
    []
  );

  const onClear = React.useCallback(() => {
    setValue("");
  }, []);

  return (
    <div className="relative">
      <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
      <Input
        type="search"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="h-10 rounded-full pr-9 pl-9"
        aria-label="Search expenses"
        autoComplete="off"
        spellCheck={false}
        inputMode="search"
      />
      {value || isLoading ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={onClear}
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <XIcon className="h-4 w-4" />
          )}
        </button>
      ) : null}
    </div>
  );
}
