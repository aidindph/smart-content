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
  const { data: connections } = await createAdminClient().from("gsc_connections").select("user_id").eq("status", "active").order("last_synced_at", { ascending: true, nullsFirst: true }).returns<Array<{ user_id: string }>>();
  if (!connections?.length) return NextResponse.json({ synced: false, status: "empty", message: "اتصال فعالی وجود ندارد." });
  const results: Array<{ userId: string; ok: boolean; rowsWritten?: number; message?: string }> = [];
  for (const connection of connections) {
    try {
      const result = await syncSearchConsoleForUser(connection.user_id, "scheduled");
      results.push({ userId: connection.user_id, ok: true, rowsWritten: result.rowsWritten });
    } catch (error) {
      results.push({ userId: connection.user_id, ok: false, message: error instanceof Error ? error.message : "همگام‌سازی انجام نشد." });
    }
  }
  const failed = results.filter((result) => !result.ok).length;
  return NextResponse.json({ synced: failed === 0, status: failed ? "partial" : "completed", users: results.length, failed, results }, { status: failed === results.length ? 500 : 200 });
}
