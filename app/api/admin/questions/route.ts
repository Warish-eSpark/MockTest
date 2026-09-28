import { NextResponse } from "next/server";
import { adminQuestions } from "../../../../lib/phase1";

export function GET() { return NextResponse.json({ data: adminQuestions }); }
export async function POST(request: Request) { const body = await request.json(); return NextResponse.json({ data: { id: `q-${Date.now()}`, ...body, status: "Draft", usedIn: [] } }, { status: 201 }); }
