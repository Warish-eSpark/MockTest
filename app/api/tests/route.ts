import { NextRequest, NextResponse } from "next/server";
import { listMockTests } from "../../../lib/admin-content";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const examSlug = searchParams.get("exam") || searchParams.get("examSlug") || undefined;
  const trackSlug = searchParams.get("track") || searchParams.get("trackSlug") || undefined;
  const subjectName = searchParams.get("subject") || searchParams.get("subjectName") || undefined;
  const status = searchParams.get("status") || "published";

  try {
    const tests = await listMockTests({
      examSlug,
      trackSlug,
      subjectName,
      status: status === "all" ? undefined : status,
    });
    return NextResponse.json({ tests });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch mock tests", tests: [] },
      { status: 500 }
    );
  }
}
