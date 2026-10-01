import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/admin-auth";
import { deleteQuestion, transitionQuestion } from "../../../../../lib/admin-content";
import { recordAuditEvent } from "../../../../../lib/audit";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;
  const { id } = await context.params;
  const body = await request.json();
  const allowed = ["Draft", "In review", "Approved", "Published", "Archived"];
  if (!allowed.includes(body.status)) return NextResponse.json({ error: "Invalid question workflow status." }, { status: 400 });
  try {
    const question = await transitionQuestion(id, body.status);
    await recordAuditEvent({
      actorId: access.user.id,
      action: "question.status_change",
      entityType: "question",
      entityId: id,
      details: { status: question.status },
    });
    return NextResponse.json({ data: question });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update question." }, { status: 404 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;
  const { id } = await context.params;

  try {
    const success = await deleteQuestion(id);
    if (!success) {
      return NextResponse.json({ error: "Question not found or could not be removed." }, { status: 404 });
    }
    await recordAuditEvent({
      actorId: access.user.id,
      action: "question.delete",
      entityType: "question",
      entityId: id,
      details: { deletedAt: new Date().toISOString() },
    });
    return NextResponse.json({ success: true, message: `Question ${id} removed.` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete question." }, { status: 500 });
  }
}
