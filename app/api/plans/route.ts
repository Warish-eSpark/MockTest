import { NextResponse } from "next/server";
import { plans } from "../../../lib/phase1";

export function GET() { return NextResponse.json({ data: plans }); }
