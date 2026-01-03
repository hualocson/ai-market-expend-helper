import { cn } from "@/lib/utils";
import { UserRound } from "lucide-react";

type PaidByIconProps = {
  paidBy: string;
  size?: "sm" | "default";
};

const PaidByIcon = ({ paidBy, size = "default" }: PaidByIconProps) => {
  const sizeClass =
    size === "sm"
      ? {
          wrapper: "size-5",
          icon: "size-3.5",
        }
      : {
          wrapper: "size-10",
          icon: "size-6",
        };

  const palette = (() => {
    switch (paidBy) {
      case "Cubi":
        return "bg-sky-400/15 text-sky-400";
      case "Embe":
        return "bg-pink-400/15 text-pink-400";
      case "Other":
        return "bg-slate-400/15 text-slate-400";
      default:
        return "bg-gray-400/15 text-gray-400";
    }
  })();

  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-full",
        palette,
        sizeClass.wrapper
      )}
    >
      <UserRound className={sizeClass.icon} />
    </span>
  );
};

export default PaidByIcon;
