import { NextRequest, NextResponse } from "next/server";
import { saveResponse } from "../../../../../lib/attempt-store";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const attempt = saveResponse(id, Number(body.questionId), body.optionIndex === null ? null : Number(body.optionIndex), body.markForReview);
  if (!attempt) return NextResponse.json({ error: "Attempt not found or already submitted" }, { status: 404 });
  return NextResponse.json({ data: { questionId: Number(body.questionId), saved: true, savedAt: Date.now() } });
}
