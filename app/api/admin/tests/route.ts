import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/admin-auth";
import { createTest, listTests } from "../../../../lib/admin-content";
import { recordAuditEvent } from "../../../../lib/audit";

export async function GET(request: NextRequest) {
	const access = await requireAdmin(request);
	if ("response" in access) return access.response;
	return NextResponse.json({ data: await listTests() });
}

export async function POST(request: NextRequest) {
	const access = await requireAdmin(request);
	if ("response" in access) return access.response;
	const body = await request.json();
	try {
		const test = await createTest(body);
		await recordAuditEvent({ actorId: access.user.id, action: "test.create", entityType: "test", entityId: test.id, details: { exam: test.exam, status: test.status } });
		return NextResponse.json({ data: test }, { status: 201 });
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save test." }, { status: 400 });
	}
}
