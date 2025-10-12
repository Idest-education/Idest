import { NextResponse } from "next/server";
import { getSession } from "@/lib/supabase/session";

export async function GET() {
  const user = await getSession();
  return NextResponse.json({ user });
}
