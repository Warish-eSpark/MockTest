import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../../../lib/admin-auth";
import {
  getQuestionsForMockTest,
  addQuestionsToMockTest,
  removeQuestionFromMockTest,
} from "../../../../../../lib/admin-content";
import { recordAuditEvent } from "../../../../../../lib/audit";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;

  const { id } = await context.params;

  try {
    const questions = await getQuestionsForMockTest(id);
    return NextResponse.json({ questions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load test questions" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;

  const { id } = await context.params;

  try {
    const body = await request.json();
    const { questionIds } = body;

    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      return NextResponse.json({ error: "questionIds array is required" }, { status: 400 });
    }

    const added = await addQuestionsToMockTest(id, questionIds);

    await recordAuditEvent({
      actorId: access.user.id,
      action: "mock_test.link_questions",
      entityType: "test",
      entityId: id,
      details: { addedCount: added, questionIds },
    });

    return NextResponse.json({ success: true, added });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to link questions" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;

  const { id } = await context.params;

  try {
    const body = await request.json();
    const { questionId } = body;

    if (!questionId) {
      return NextResponse.json({ error: "questionId is required" }, { status: 400 });
    }

    const success = await removeQuestionFromMockTest(id, String(questionId));

    await recordAuditEvent({
      actorId: access.user.id,
      action: "mock_test.unlink_question",
      entityType: "test",
      entityId: id,
      details: { questionId },
    });

    return NextResponse.json({ success });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to unlink question" },
      { status: 500 }
    );
  }
}
