import { NextRequest, NextResponse } from "next/server";
import { createAttempt } from "../../../lib/attempt-store";

export async function POST(request: NextRequest) {
  const { testSlug } = await request.json();
  const attempt = createAttempt(testSlug);
  if (!attempt) return NextResponse.json({ error: "Test not found" }, { status: 404 });
  return NextResponse.json({ data: { id: attempt.id, testSlug: attempt.testSlug, startedAt: attempt.startedAt, durationSeconds: attempt.durationSeconds } }, { status: 201 });
}
