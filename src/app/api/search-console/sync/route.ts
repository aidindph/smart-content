import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { syncSearchConsoleForUser } from "@/lib/search-console/sync";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const expected = process.env.WORKER_SECRET;
  const received = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !received) return false;
  const a = Buffer.from(expected); const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "دسترسی غیرمجاز است." }, { status: 401 });
  const { data: connections } = await createAdminClient().from("gsc_connections").select("user_id").eq("status", "active").order("last_synced_at", { ascending: true, nullsFirst: true }).limit(1).returns<Array<{ user_id: string }>>();
  const connection = connections?.[0];
  if (!connection) return NextResponse.json({ synced: false, status: "empty" });
  try {
    const result = await syncSearchConsoleForUser(connection.user_id);
    return NextResponse.json({ synced: true, ...result });
  } catch {
    return NextResponse.json({ synced: false, status: "failed" }, { status: 500 });
  }
}
