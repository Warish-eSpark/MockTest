import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/admin-auth";
import { getTaxonomy } from "../../../../lib/admin-content";

export async function GET(request: NextRequest) {
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;

  try {
    const taxonomy = await getTaxonomy();
    return NextResponse.json({ data: taxonomy });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load taxonomy." },
      { status: 500 }
    );
  }
}
