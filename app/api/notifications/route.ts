import { NextResponse } from "next/server";
import { notifications } from "../../../lib/phase1";

export function GET() { return NextResponse.json({ data: notifications }); }
