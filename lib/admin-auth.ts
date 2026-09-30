import { NextResponse, type NextRequest } from "next/server";
import { getUserForToken, type AuthUser } from "./auth-store";

export async function requireAdmin(request: NextRequest): Promise<{ user: AuthUser } | { response: NextResponse }> {
  const user = await getUserForToken(request.cookies.get("northstar_session")?.value);
  if (!user) return { response: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  if (user.role !== "admin") return { response: NextResponse.json({ error: "Administrator access required." }, { status: 403 }) };
  return { user };
}
