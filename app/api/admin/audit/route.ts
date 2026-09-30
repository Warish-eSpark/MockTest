import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/admin-auth";
import { getRecentAuditEvents } from "../../../../lib/audit";

export async function GET(request: NextRequest) {
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;
  return NextResponse.json({ data: await getRecentAuditEvents() });
}
