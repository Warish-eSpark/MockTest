import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/admin-auth";
import { recordAuditEvent } from "../../../../lib/audit";
import { createQuestion, listQuestions } from "../../../../lib/admin-content";

export async function GET(request: NextRequest) {
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;

  const url = new URL(request.url);
  const exam = url.searchParams.get("exam") || undefined;
  const subject = url.searchParams.get("subject") || undefined;
  const status = url.searchParams.get("status") || undefined;
  const query = url.searchParams.get("query") || undefined;

  const questions = await listQuestions({ exam, subject, status, query });
  return NextResponse.json({ data: questions });
}

export async function POST(request: NextRequest) {
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;
  const body = await request.json();
  try {
    const question = await createQuestion(body);
    await recordAuditEvent({
      actorId: access.user.id,
      action: "question.create",
      entityType: "question",
      entityId: question.id,
      details: { exam: question.exam, subject: question.subject, status: question.status, optionsCount: question.options?.length },
    });
    return NextResponse.json({ data: question }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save question." }, { status: 400 });
  }
}
