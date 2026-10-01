import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/admin-auth";
import { updateMockTestStatus, deleteMockTest } from "../../../../../lib/admin-content";
import { recordAuditEvent } from "../../../../../lib/audit";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;

  const { id } = await context.params;

  try {
    const body = await request.json();
    const { status } = body;

    if (!status || !["Draft", "Published", "Archived"].includes(status)) {
      return NextResponse.json(
        { error: "Valid status (Draft, Published, Archived) is required." },
        { status: 400 }
      );
    }

    await updateMockTestStatus(id, status);

    await recordAuditEvent({
      actorId: access.user.id,
      action: "mock_test.update_status",
      entityType: "test",
      entityId: id,
      details: { status },
    });

    return NextResponse.json({ success: true, status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update test status" },
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
    const success = await deleteMockTest(id);

    await recordAuditEvent({
      actorId: access.user.id,
      action: "mock_test.delete",
      entityType: "test",
      entityId: id,
      details: {},
    });

    return NextResponse.json({ success });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete test" },
      { status: 500 }
    );
  }
}
