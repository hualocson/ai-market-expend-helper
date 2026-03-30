import { PaidBy } from "@/enums";
import { cn } from "@/lib/utils";
import { UserRound } from "lucide-react";

type PaidByIconProps = {
  paidBy: string;
  size?: "sm" | "default";
};

export const getPaidByPalette = (paidBy: string) => {
  switch (paidBy) {
    case PaidBy.CUBI:
      return {
        icon: "bg-sky-500/15 text-sky-600",
        badge: "border-sky-300/60 bg-sky-500/10 text-sky-700",
      };
    case PaidBy.EMBE:
      return {
        icon: "bg-pink-500/15 text-pink-600",
        badge: "border-pink-300/60 bg-pink-500/10 text-pink-700",
      };
    case PaidBy.OTHER:
      return {
        icon: "bg-warning/15 text-warning",
        badge: "border-warning/35 bg-warning/10 text-warning",
      };
    default:
      return {
        icon: "bg-muted text-muted-foreground",
        badge: "border-border/60 bg-muted text-muted-foreground",
      };
  }
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

  const palette = getPaidByPalette(paidBy);

  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-full",
        palette.icon,
        sizeClass.wrapper
      )}
    >
      <UserRound className={sizeClass.icon} />
    </span>
  );
};

export default PaidByIcon;
