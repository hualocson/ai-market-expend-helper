import { NextResponse } from "next/server";

import { getTransferCandidates } from "@/db/budget-queries";
import { parsePositiveIntParam } from "@/lib/api/route-schemas";

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const destinationId = parsePositiveIntParam(
    searchParams.get("destinationId") ?? "",
    "Invalid destination budget id"
  );

  if ("error" in destinationId) {
    return NextResponse.json({ error: destinationId.error }, { status: 400 });
  }

  try {
    const candidates = await getTransferCandidates(destinationId.value);
    return NextResponse.json(candidates);
  } catch (error) {
    console.error("Failed to fetch budget transfer candidates:", error);
    return NextResponse.json(
      { error: "Failed to fetch budget transfer candidates" },
      { status: 400 }
    );
  }
};
