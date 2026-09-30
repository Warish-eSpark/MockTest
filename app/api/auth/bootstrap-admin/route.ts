import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { bootstrapAdmin } from "../../../../lib/auth-store";

export async function POST(request: NextRequest) {
  const bootstrapKey = process.env.ADMIN_BOOTSTRAP_KEY;
  const suppliedKey = request.headers.get("x-admin-bootstrap-key") ?? "";
  if (!bootstrapKey) return NextResponse.json({ error: "Admin bootstrap is not enabled." }, { status: 404 });
  const expected = Buffer.from(bootstrapKey);
  const supplied = Buffer.from(suppliedKey);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = await request.json();
  const result = await bootstrapAdmin(String(body.email ?? ""), String(body.password ?? ""), String(body.displayName ?? ""));
  if ("error" in result) return NextResponse.json(result, { status: 409 });
  const response = NextResponse.json({ user: result.user }, { status: 201 });
  response.cookies.set("northstar_session", result.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return response;
}
