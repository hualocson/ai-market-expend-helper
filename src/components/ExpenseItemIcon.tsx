import { Category } from "@/enums";
import { cn } from "@/lib/utils";
import {
  AppleIcon,
  BubblesIcon,
  BusIcon,
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
          wrapper: "size-5",
          icon: "size-3.5",
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
            "flex items-center justify-center rounded-full bg-teal-400/15 text-teal-400",
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
            "flex items-center justify-center rounded-full bg-purple-400/15 text-purple-400",
            sizeClass.wrapper,
            className
          )}
        >
          <ShoppingCartIcon className={sizeClass.icon} />
        </span>
      );
    case Category.OTHER:
      return (
        <span
          className={cn(
            "flex items-center justify-center rounded-full bg-blue-400/15 text-blue-400",
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
            "flex items-center justify-center rounded-full bg-teal-400/15 text-rose-400",
            sizeClass.wrapper,
            className
          )}
        >
          <BusIcon className={sizeClass.icon} />
        </span>
      );
    default:
      return (
        <span
          className={cn(
            "flex items-center justify-center rounded-full bg-gray-400/15 text-gray-400",
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
