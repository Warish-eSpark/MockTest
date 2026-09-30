import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAttempt } from "../../../lib/attempt-store";
import { getUserForToken } from "../../../lib/auth-store";

export async function POST(request: NextRequest) {
  const { testSlug } = await request.json();
  const cookieStore = await cookies();
  const user = await getUserForToken(cookieStore.get("northstar_session")?.value);
  const attempt = await createAttempt(testSlug, user?.id ?? null);
  if (!attempt) return NextResponse.json({ error: "Test not found" }, { status: 404 });
  return NextResponse.json({ data: { id: attempt.id, testSlug: attempt.testSlug, startedAt: attempt.startedAt, durationSeconds: attempt.durationSeconds } }, { status: 201 });
}
