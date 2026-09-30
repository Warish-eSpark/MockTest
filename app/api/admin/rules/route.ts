import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/admin-auth";
import { createRuleProfile, listRuleProfiles } from "../../../../lib/admin-content";
import { recordAuditEvent } from "../../../../lib/audit";

export async function GET(request: NextRequest) {
	const access = await requireAdmin(request);
	if ("response" in access) return access.response;
	return NextResponse.json({ data: await listRuleProfiles() });
}

export async function POST(request: NextRequest) {
	const access = await requireAdmin(request);
	if ("response" in access) return access.response;
	const body = await request.json();
	try {
		const rule = await createRuleProfile(body);
		await recordAuditEvent({ actorId: access.user.id, action: "rule.create", entityType: "rule_profile", entityId: rule.id, details: { exam: rule.exam, version: rule.version, status: rule.status } });
		return NextResponse.json({ data: rule }, { status: 201 });
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save rule profile." }, { status: 400 });
	}
}
