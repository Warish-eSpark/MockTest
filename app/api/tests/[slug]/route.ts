import { NextResponse } from "next/server";
import { attemptFixtures } from "../../../../lib/attempts";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const test = attemptFixtures[slug];
  if (!test) return NextResponse.json({ error: "Test not found" }, { status: 404 });

  return NextResponse.json({ data: { ...test, questions: test.questions.map(({ correctIndex: _correctIndex, explanation: _explanation, ...question }) => question) }, source: "fixture" });
}
