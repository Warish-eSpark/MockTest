import { NextResponse } from "next/server";
import { getAttemptResult } from "../../../../lib/attempt-store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const stored = getAttemptResult(id);
  if (!stored) return NextResponse.json({ error: "Submitted result not found" }, { status: 404 });
  const { attempt, result } = stored;
  return NextResponse.json({ data: { ...result, title: attempt.title, exam: attempt.exam, questions: attempt.questions.map((question) => ({ id: question.id, section: question.section, prompt: question.prompt, selectedIndex: attempt.answers[question.id] ?? null, correctIndex: question.correctIndex, explanation: question.explanation })) } });
}
