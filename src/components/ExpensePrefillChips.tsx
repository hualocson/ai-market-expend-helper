"use client";

import { queries } from "@/lib/queries";
import { useQuery } from "@tanstack/react-query";

import ExpensePrefillChipsClient from "@/components/ExpensePrefillChipsClient";

const ExpensePrefillChips = () => {
  const { data: items = [] } = useQuery(queries.expenses.prefills);

  return <ExpensePrefillChipsClient items={items} />;
};

export default ExpensePrefillChips;
