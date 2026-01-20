"use client";

import * as React from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchIcon, XIcon } from "lucide-react";

import { Input } from "@/components/ui/input";

type TransactionsSearchProps = {
  placeholder?: string;
};

const TransactionsSearch = ({
  placeholder = "Search expenses by note or category",
}: TransactionsSearchProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = React.useState(searchParams.get("q") ?? "");

  React.useEffect(() => {
    setValue(searchParams.get("q") ?? "");
  }, [searchParams]);

  React.useEffect(() => {
    const handle = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const trimmed = value.trim();
      const currentQuery = searchParams.get("q") ?? "";
      if (trimmed === currentQuery) {
        return;
      }
      if (trimmed) {
        params.set("q", trimmed);
      } else {
        params.delete("q");
      }
      const nextQuery = params.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
        scroll: false,
      });
    }, 300);

    return () => clearTimeout(handle);
  }, [value, searchParams, router, pathname]);

  return (
    <div className="relative">
      <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
      <Input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        className="h-10 rounded-full pl-9 pr-9"
        aria-label="Search expenses"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => setValue("")}
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition"
        >
          <XIcon className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
};

export default TransactionsSearch;
