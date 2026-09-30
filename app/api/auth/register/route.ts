import { NextRequest, NextResponse } from "next/server";
import { registerUser } from "../../../../lib/auth-store";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await registerUser(String(body.email ?? ""), String(body.password ?? ""), String(body.displayName ?? ""));
  if ("error" in result) return NextResponse.json(result, { status: 400 });
  const response = NextResponse.json({ user: result.user }, { status: 201 });
  response.cookies.set("northstar_session", result.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return response;
}
