import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/admin-auth";
import { recordAuditEvent } from "../../../../../lib/audit";
import { createQuestionsBulk, type QuestionInput } from "../../../../../lib/admin-content";

export async function POST(request: NextRequest) {
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;

  try {
    const body = await request.json();
    const rawQuestions: QuestionInput[] = Array.isArray(body)
      ? body
      : Array.isArray(body.questions)
      ? body.questions
      : [];

    if (rawQuestions.length === 0) {
      return NextResponse.json(
        { error: "No question rows provided for bulk import. Please supply a valid question list." },
        { status: 400 }
      );
    }

    if (rawQuestions.length > 500) {
      return NextResponse.json(
        { error: "Maximum bulk import size is 500 questions per batch. Please split your file into smaller batches." },
        { status: 400 }
      );
    }

    const result = await createQuestionsBulk(rawQuestions);

    await recordAuditEvent({
      actorId: access.user.id,
      action: "question.bulk_import",
      entityType: "question",
      entityId: `bulk-${Date.now()}`,
      details: {
        total: result.total,
        importedCount: result.importedCount,
        rejectedCount: result.rejectedCount,
      },
    });

    return NextResponse.json({ data: result }, { status: result.importedCount > 0 ? 201 : 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bulk import failed unexpectedly." },
      { status: 500 }
    );
  }
}
