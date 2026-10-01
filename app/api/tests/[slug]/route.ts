import { NextResponse } from "next/server";
import { getTestAttemptDefinition } from "../../../../lib/attempt-store";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const test = await getTestAttemptDefinition(slug);
  if (!test) return NextResponse.json({ error: "Test not found" }, { status: 404 });

  return NextResponse.json({
    data: {
      ...test,
      questions: test.questions.map(({ correctIndex: _correctIndex, explanation: _explanation, ...question }) => question),
    },
    source: "database",
  });
}
