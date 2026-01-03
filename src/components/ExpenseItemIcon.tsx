import { Category } from "@/enums";
import {
  AppleIcon,
  ShellIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
} from "lucide-react";

const ExpenseItemIcon = ({ category }: { category: Category }) => {
  switch (category) {
    case Category.FOOD:
      return (
        <span className="flex size-10 items-center justify-center rounded-full bg-teal-400/15 text-teal-400">
          <AppleIcon className="size-6" />
        </span>
      );
    case Category.SHOPPING:
      return (
        <span className="flex size-10 items-center justify-center rounded-full bg-purple-400/15 text-purple-400">
          <ShoppingCartIcon className="size-6" />
        </span>
      );
    case Category.OTHER:
      return (
        <span className="flex size-10 items-center justify-center rounded-full bg-orange-400/15 text-orange-400">
          <ShoppingBagIcon className="size-6" />
        </span>
      );
    default:
      return (
        <span className="flex size-10 items-center justify-center rounded-full bg-gray-400/15 text-gray-400">
          <ShellIcon className="size-6" />
        </span>
      );
  }
};

export default ExpenseItemIcon;
