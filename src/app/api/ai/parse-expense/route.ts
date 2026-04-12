import { NextResponse } from "next/server";

import type { ParseExpenseRequest } from "@/lib/ai/parse-expense-contract";
import { parseExpenseWithOpenRouter } from "@/lib/ai/parse-expense";

const invalidPayloadResponse = () =>
  NextResponse.json({ error: "Invalid payload" }, { status: 400 });

const readTrimmedInput = (payload: unknown) => {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const input = (payload as Partial<ParseExpenseRequest>).input;
  if (typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const POST = async (request: Request) => {
  try {
    let payload: unknown;

    try {
      payload = await request.json();
    } catch {
      return invalidPayloadResponse();
    }

    const input = readTrimmedInput(payload);

    if (!input) {
      return invalidPayloadResponse();
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
