import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { processGenerationJob } from "@/lib/content/engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const bodySchema = z.object({ jobId: z.string().uuid().optional() });

function hasWorkerAccess(request: Request) {
  const configured = process.env.WORKER_SECRET;
  const received = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!configured || !received) return false;
  const expectedBytes = Buffer.from(configured);
  const receivedBytes = Buffer.from(received);
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
}

export async function POST(request: Request) {
  const workerAccess = hasWorkerAccess(request);
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "درخواست معتبر نیست." }, { status: 400 });

  if (workerAccess) {
    const admin = createAdminClient();
    let query = admin.from("generation_jobs").select("id, user_id").eq("status", "queued").eq("cancel_requested", false).order("created_at").limit(1);
    if (parsed.data.jobId) query = query.eq("id", parsed.data.jobId);
    const { data: jobs } = await query.returns<Array<{ id: string; user_id: string }>>();
    const job = jobs?.[0];
    if (!job) return NextResponse.json({ accepted: false, status: "empty" });
    return NextResponse.json(await processGenerationJob(job.id, job.user_id));
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "ورود لازم است." }, { status: 401 });

  if (!parsed.data.jobId) return NextResponse.json({ error: "شناسهٔ اجرا لازم است." }, { status: 400 });
  const { data: job } = await supabase.from("generation_jobs").select("id").eq("id", parsed.data.jobId).single<{ id: string }>();
  if (!job) return NextResponse.json({ error: "اجرا پیدا نشد." }, { status: 404 });

  const result = await processGenerationJob(job.id, userId);
  return NextResponse.json(result);
}
