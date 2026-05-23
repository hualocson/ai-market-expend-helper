import { getExpensePrefills } from "@/lib/services/expenses";

import ExpensePrefillChipsClient from "@/components/ExpensePrefillChipsClient";

const ExpensePrefillChips = async () => {
  const items = await getExpensePrefills();

  return <ExpensePrefillChipsClient items={items} />;
};

export default ExpensePrefillChips;
