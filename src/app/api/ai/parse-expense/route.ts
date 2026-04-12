import { NextResponse } from "next/server";

import type { ParseExpenseRequest } from "@/lib/ai/parse-expense-contract";
import { parseExpenseWithOpenRouter } from "@/lib/ai/parse-expense";

export const POST = async (request: Request) => {
  try {
    const payload = (await request.json()) as Partial<ParseExpenseRequest>;
    const input = payload.input?.trim();

    if (!input) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENROUTER_API_KEY" },
        { status: 500 }
      );
    }

    const result = await parseExpenseWithOpenRouter({
      input,
      apiKey,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to parse expense with OpenRouter:", error);
    return NextResponse.json(
      { error: "Failed to parse expense" },
      { status: 500 }
    );
  }
};
