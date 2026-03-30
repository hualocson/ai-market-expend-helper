import { Category } from "@/enums";
import { cn } from "@/lib/utils";
import {
  AppleIcon,
  BubblesIcon,
  BusIcon,
  DumbbellIcon,
  HandHeartIcon,
  HomeIcon,
  PartyPopperIcon,
  ShellIcon,
  ShoppingCartIcon,
} from "lucide-react";

const ExpenseItemIcon = ({
  category,
  size = "default",
  className,
}: {
  category: Category;
  size?: "sm" | "default";
  className?: string;
}) => {
  const sizeClass =
    size === "sm"
      ? {
          wrapper: "size-6",
          icon: "size-4",
        }
      : {
          wrapper: "size-10",
          icon: "size-6",
        };
  switch (category) {
    case Category.FOOD:
      return (
        <span
          className={cn(
            "bg-food/15 text-food flex items-center justify-center rounded-full",
            sizeClass.wrapper,
            className
          )}
        >
          <AppleIcon className={sizeClass.icon} />
        </span>
      );
    case Category.SHOPPING:
      return (
        <span
          className={cn(
            "bg-shopping/15 text-shopping flex items-center justify-center rounded-full",
            sizeClass.wrapper,
            className
          )}
        >
          <ShoppingCartIcon className={sizeClass.icon} />
        </span>
      );
    case Category.HOUSING:
      return (
        <span
          className={cn(
            "bg-housing/15 text-housing flex items-center justify-center rounded-full",
            sizeClass.wrapper,
            className
          )}
        >
          <HomeIcon className={sizeClass.icon} />
        </span>
      );
    case Category.OTHER:
      return (
        <span
          className={cn(
            "bg-other/15 text-other flex items-center justify-center rounded-full",
            sizeClass.wrapper,
            className
          )}
        >
          <BubblesIcon className={sizeClass.icon} />
        </span>
      );
    case Category.TRANSPORT:
      return (
        <span
          className={cn(
            "bg-transport/15 text-transport flex items-center justify-center rounded-full",
            sizeClass.wrapper,
            className
          )}
        >
          <BusIcon className={sizeClass.icon} />
        </span>
      );
    case Category.BADMINTON:
      return (
        <span
          className={cn(
            "bg-badminton/15 text-badminton flex items-center justify-center rounded-full",
            sizeClass.wrapper,
            className
          )}
        >
          <DumbbellIcon className={sizeClass.icon} />
        </span>
      );
    case Category.ENTERTAINMENT:
      return (
        <span
          className={cn(
            "bg-entertainment/15 text-entertainment flex items-center justify-center rounded-full",
            sizeClass.wrapper,
            className
          )}
        >
          <PartyPopperIcon className={sizeClass.icon} />
        </span>
      );
    case Category.GIVING:
      return (
        <span
          className={cn(
            "bg-giving/15 text-giving flex items-center justify-center rounded-full",
            sizeClass.wrapper,
            className
          )}
        >
          <HandHeartIcon className={sizeClass.icon} />
        </span>
      );
    default:
      return (
        <span
          className={cn(
            "bg-muted text-muted-foreground flex items-center justify-center rounded-full",
            sizeClass.wrapper,
            className
          )}
        >
          <ShellIcon className={sizeClass.icon} />
        </span>
      );
  }
};

export default ExpenseItemIcon;
