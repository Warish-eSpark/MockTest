import { NextResponse } from "next/server";
import { ruleProfiles } from "../../../../lib/phase1";

export function GET() { return NextResponse.json({ data: ruleProfiles }); }
export async function POST(request: Request) { const body = await request.json(); return NextResponse.json({ data: { id: `rule-${Date.now()}`, version: 1, status: "Draft", ...body } }, { status: 201 }); }
