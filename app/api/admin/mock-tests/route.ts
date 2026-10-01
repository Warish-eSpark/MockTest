import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/admin-auth";
import { listMockTests, createMockTest } from "../../../../lib/admin-content";
import { recordAuditEvent } from "../../../../lib/audit";

export async function GET(request: NextRequest) {
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;

  const { searchParams } = new URL(request.url);
  const examSlug = searchParams.get("exam") || undefined;
  const trackSlug = searchParams.get("track") || undefined;
  const subjectName = searchParams.get("subject") || undefined;

  try {
    const tests = await listMockTests({
      examSlug,
      trackSlug,
      subjectName,
      status: "All",
    });
    return NextResponse.json({ tests });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load tests" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;

  try {
    const body = await request.json();
    const test = await createMockTest(body);

    await recordAuditEvent({
      actorId: access.user.id,
      action: "mock_test.create",
      entityType: "test",
      entityId: test.id,
      details: {
        name: test.name,
        exam: test.examName,
        subject: test.subjectName,
        status: test.status,
      },
    });

    return NextResponse.json({ test }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create mock test" },
      { status: 400 }
    );
  }
}
