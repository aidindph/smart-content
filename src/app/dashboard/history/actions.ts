"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

const idSchema = z.string().uuid();

export async function cancelJobAction(formData: FormData) {
  const jobId = idSchema.parse(formData.get("jobId"));
  const { profile } = await requireUser();
  const admin = createAdminClient();
  await admin.from("generation_jobs").update({ status: "cancelled", cancel_requested: true, current_step: "لغوشده", completed_at: new Date().toISOString() })
    .eq("id", jobId).eq("user_id", profile.id).eq("status", "queued");
  await admin.from("generation_jobs").update({ cancel_requested: true, current_step: "در انتظار لغو" })
    .eq("id", jobId).eq("user_id", profile.id).eq("status", "running");
  revalidatePath(`/dashboard/history/${jobId}`);
}

export async function rerunJobAction(formData: FormData) {
  const sourceJobId = idSchema.parse(formData.get("jobId"));
  const { profile } = await requireUser();
  const admin = createAdminClient();
  const { data: source } = await admin.from("generation_jobs").select("request_id").eq("id", sourceJobId).eq("user_id", profile.id).single<{ request_id: string }>();
  if (!source) redirect("/dashboard/history?error=missing");
  const { data: request } = await admin.from("content_requests").select("text_provider_slug, text_model, image_provider_slug, image_model, image_count")
    .eq("id", source.request_id).eq("user_id", profile.id).single<{ text_provider_slug: string; text_model: string; image_provider_slug: string | null; image_model: string | null; image_count: number }>();
  if (!request) redirect("/dashboard/history?error=missing");

  const jobId = randomUUID();
  const { error } = await admin.from("generation_jobs").insert({ id: jobId, request_id: source.request_id, user_id: profile.id, idempotency_key: randomUUID() });
  if (error) redirect(`/dashboard/history/${sourceJobId}?error=rerun`);
  const steps = [
    { job_id: jobId, user_id: profile.id, kind: "article" as const, position: 0, provider_slug: request.text_provider_slug, model_key: request.text_model },
    ...Array.from({ length: request.image_count }, (_, index) => ({ job_id: jobId, user_id: profile.id, kind: index === 0 ? "hero_image" as const : "inline_image" as const, position: index, provider_slug: request.image_provider_slug!, model_key: request.image_model! })),
  ];
  await admin.from("generation_steps").insert(steps);
  redirect(`/dashboard/history/${jobId}`);
}
