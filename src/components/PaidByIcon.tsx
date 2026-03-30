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
        return "bg-primary/15 text-primary";
      case "Embe":
        return "bg-accent/15 text-accent";
      case "Other":
        return "bg-secondary/15 text-secondary";
      default:
        return "bg-muted text-muted-foreground";
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
