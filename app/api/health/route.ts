import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    service: "mock-test-platform-api",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}