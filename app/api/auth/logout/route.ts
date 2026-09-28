import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deleteSession } from "../../../../lib/auth-store";

export async function POST() {
  const cookieStore = await cookies();
  deleteSession(cookieStore.get("northstar_session")?.value);
  const response = NextResponse.json({ success: true });
  response.cookies.delete("northstar_session");
  return response;
}
