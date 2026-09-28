import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserForToken } from "../../../../lib/auth-store";

export async function GET() {
  const cookieStore = await cookies();
  const user = getUserForToken(cookieStore.get("northstar_session")?.value);
  return NextResponse.json({ user });
}
