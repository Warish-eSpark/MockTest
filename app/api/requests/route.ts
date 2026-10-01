import { NextRequest, NextResponse } from "next/server";
import { recordSubjectRequest, listSubjectRequests } from "../../../lib/admin-content";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const examSlug = searchParams.get("exam") || searchParams.get("examSlug") || undefined;

  try {
    const requests = await listSubjectRequests(examSlug);
    return NextResponse.json({ requests });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load requests", requests: [] },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { examSlug, trackSlug, subjectName } = body;

    if (!examSlug || !trackSlug || !subjectName) {
      return NextResponse.json(
        { error: "examSlug, trackSlug, and subjectName are required." },
        { status: 400 }
      );
    }

    const result = await recordSubjectRequest(
      String(examSlug).trim(),
      String(trackSlug).trim(),
      String(subjectName).trim()
    );

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to record request" },
      { status: 500 }
    );
  }
}
