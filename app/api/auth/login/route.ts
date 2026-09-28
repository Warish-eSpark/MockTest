import { NextRequest, NextResponse } from "next/server";
import { loginUser } from "../../../../lib/auth-store";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = loginUser(String(body.email ?? ""), String(body.password ?? ""));
  if ("error" in result) return NextResponse.json(result, { status: 401 });
  const response = NextResponse.json({ user: result.user });
  response.cookies.set("northstar_session", result.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return response;
}
