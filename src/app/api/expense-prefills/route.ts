import { NextResponse } from "next/server";

import { getExpensePrefills } from "@/lib/services/expenses";

export const GET = async () => {
  try {
    const prefills = await getExpensePrefills();
    return NextResponse.json(prefills);
  } catch (error) {
    console.error("Failed to fetch expense prefills:", error);
    return NextResponse.json(
      { error: "Failed to fetch expense prefills" },
      { status: 400 }
    );
  }
};
