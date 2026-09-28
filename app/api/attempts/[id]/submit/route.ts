import { NextResponse } from "next/server";
import { submitAttempt } from "../../../../../lib/attempt-store";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = submitAttempt(id);
  if (!result) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  return NextResponse.json({ data: result });
}
