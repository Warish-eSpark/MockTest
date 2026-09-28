import { NextResponse } from "next/server";
import { adminTests } from "../../../../lib/phase1";

export function GET() { return NextResponse.json({ data: adminTests }); }
export async function POST(request: Request) { const body = await request.json(); return NextResponse.json({ data: { id: `test-${Date.now()}`, status: "Draft", ...body } }, { status: 201 }); }
