import React from "react";

import { cn } from "@/lib/utils";

type TVndSymbolProps = {
  className?: string;
};

const VndSymbol = ({ className }: TVndSymbolProps) => (
  <span aria-label="Vietnamese dong" className={cn("inline-block", className)}>
    &#8363;
  </span>
);

export default VndSymbol;
