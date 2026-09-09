"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { getImageProviderAdapter, getTextProviderAdapter } from "@/lib/providers/registry";
import { createAdminClient } from "@/lib/supabase/admin";

export type CreateContentState = { status: "idle" | "error"; message: string; fieldErrors?: Record<string, string[]> };

const schema = z.object({
  idempotencyKey: z.string().uuid(),
  topic: z.string().trim().min(5, "موضوع دست‌کم پنج نویسه باشد.").max(300),
  primaryKeyword: z.string().trim().max(120).default(""),
  primaryDensity: z.coerce.number().min(.5).max(3).default(1),
  secondaryKeyword1: z.string().trim().max(120).default(""),
  secondaryDensity1: z.coerce.number().min(.5).max(3).default(.5),
  secondaryKeyword2: z.string().trim().max(120).default(""),
  secondaryDensity2: z.coerce.number().min(.5).max(3).default(.5),
  audience: z.string().trim().min(2, "مخاطب را مشخص کنید.").max(200),
  language: z.string().trim().min(2).max(16).default("fa"),
  tone: z.enum(["professional", "friendly", "persuasive", "educational", "creative"]),
  targetWords: z.coerce.number().int().min(400, "حداقل طول ۴۰۰ واژه است.").max(5000, "حداکثر طول ۵۰۰۰ واژه است."),
  searchIntent: z.enum(["informational", "commercial", "transactional", "navigational"]),
  contentType: z.enum(["guide", "list", "comparison", "review", "tutorial", "pillar"]),
  pointOfView: z.enum(["second", "first_plural", "neutral"]),
  faqCount: z.coerce.number().int().min(0).max(8),
  requiredHeadings: z.string().max(1500).default(""),
  contentBrief: z.string().max(5000).default(""),
  callToAction: z.string().max(500).default(""),
  forbiddenTerms: z.string().max(1000).default(""),
  internalLinks: z.string().max(2000).default(""),
  imageTopics: z.string().max(2000).default(""),
  generateImages: z.string().optional(),
  textConnectionId: z.string().regex(/^(user|system):[0-9a-f-]{36}$/i, "اتصال متن معتبر نیست."),
  textModel: z.string().trim().min(2, "شناسهٔ مدل متن را وارد کنید.").max(200),
  imageCount: z.coerce.number().int().min(0).max(4).default(0),
  imageConnectionId: z.string().regex(/^(user|system):[0-9a-f-]{36}$/i).optional().or(z.literal("")),
  imageModel: z.string().trim().max(200).default(""),
}).superRefine((value, context) => {
  if (value.generateImages === "on" && value.imageCount > 0 && (!value.imageConnectionId || value.imageModel.length < 2)) {
    context.addIssue({ code: "custom", path: ["imageModel"], message: "برای ساخت تصویر، کلید و مدل تصویر را انتخاب کنید." });
  }
});

type KeyRow = { id: string; provider_id: string; is_active: boolean; test_status: "valid" | "invalid" | "untested"; deleted_at: string | null };

async function resolveCredential(userId: string, connectionId: string) {
  const admin = createAdminClient();
  const [source, keyId] = connectionId.split(":") as ["user" | "system", string];
  const query = source === "user"
    ? admin.from("user_api_keys").select("id, provider_id, is_active, test_status, deleted_at").eq("id", keyId).eq("user_id", userId)
    : admin.from("system_api_keys").select("id, provider_id, is_active, test_status, deleted_at").eq("id", keyId);
  const { data: key } = await query.single<KeyRow>();
  if (!key || key.deleted_at || !key.is_active || key.test_status !== "valid") throw new Error("کلید انتخاب‌شده فعال و تأییدشده نیست.");
  const { data: provider } = await admin.from("providers").select("id, slug, enabled").eq("id", key.provider_id).single<{ id: string; slug: string; enabled: boolean }>();
  if (!provider?.enabled) throw new Error("ارائه‌دهندهٔ انتخاب‌شده غیرفعال است.");
  return { key, provider, source };
}

async function validateModel(providerId: string, modelKey: string, kind: "text" | "image") {
  const admin = createAdminClient();
  const { data: model } = await admin.from("provider_models")
    .select("id")
    .eq("provider_id", providerId)
    .eq("model_key", modelKey)
    .eq("enabled", true)
    .in("kind", kind === "text" ? ["text", "multimodal"] : ["image", "multimodal"])
    .maybeSingle<{ id: string }>();
  if (!model) throw new Error(kind === "text" ? "مدل نگارش انتخاب‌شده فعال نیست." : "مدل تصویر انتخاب‌شده فعال نیست.");
}

export async function createContentAction(_state: CreateContentState, formData: FormData): Promise<CreateContentState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", message: "اطلاعات درخواست را اصلاح کنید.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { profile, supabase } = await requireUser();
  const [{ data: settings }, { data: quota }] = await Promise.all([
    supabase.from("system_settings").select("maintenance_mode, default_daily_request_limit, default_monthly_request_limit").eq("id", 1).single<{ maintenance_mode: boolean; default_daily_request_limit: number; default_monthly_request_limit: number }>(),
    supabase.from("quota_policies").select("daily_request_limit, monthly_request_limit").eq("user_id", profile.id).maybeSingle<{ daily_request_limit: number; monthly_request_limit: number }>(),
  ]);
  if (settings?.maintenance_mode) return { status: "error", message: "سامانه موقتاً در حالت تعمیر است." };

  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const [{ count: dailyCount }, { count: monthlyCount }] = await Promise.all([
    supabase.from("generation_jobs").select("id", { count: "exact", head: true }).gte("created_at", startOfDay),
    supabase.from("generation_jobs").select("id", { count: "exact", head: true }).gte("created_at", startOfMonth),
  ]);
  const dailyLimit = quota?.daily_request_limit ?? settings?.default_daily_request_limit ?? 25;
  const monthlyLimit = quota?.monthly_request_limit ?? settings?.default_monthly_request_limit ?? 500;
  if ((dailyCount ?? 0) >= dailyLimit) return { status: "error", message: "سقف درخواست روزانهٔ شما پر شده است." };
  if ((monthlyCount ?? 0) >= monthlyLimit) return { status: "error", message: "سقف درخواست ماهانهٔ شما پر شده است." };

  let textConnection: Awaited<ReturnType<typeof resolveCredential>>;
  let imageConnection: Awaited<ReturnType<typeof resolveCredential>> | undefined;
  try {
    textConnection = await resolveCredential(profile.id, parsed.data.textConnectionId);
    getTextProviderAdapter(textConnection.provider.slug);
    await validateModel(textConnection.provider.id, parsed.data.textModel, "text");
    if (parsed.data.generateImages === "on" && parsed.data.imageCount && parsed.data.imageConnectionId) {
      imageConnection = await resolveCredential(profile.id, parsed.data.imageConnectionId);
      getImageProviderAdapter(imageConnection.provider.slug);
      await validateModel(imageConnection.provider.id, parsed.data.imageModel, "image");
    }
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "اتصال انتخاب‌شده معتبر نیست." };
  }

  const admin = createAdminClient();
  const { data: existing } = await admin.from("generation_jobs").select("id").eq("user_id", profile.id).eq("idempotency_key", parsed.data.idempotencyKey).maybeSingle<{ id: string }>();
  if (existing) redirect(`/dashboard/history/${existing.id}`);

  const requestId = randomUUID();
  const jobId = randomUUID();
  const keywordTargets = [
    { keyword: parsed.data.primaryKeyword, density: parsed.data.primaryDensity },
    { keyword: parsed.data.secondaryKeyword1, density: parsed.data.secondaryDensity1 },
    { keyword: parsed.data.secondaryKeyword2, density: parsed.data.secondaryDensity2 },
  ].filter((item) => item.keyword);
  const keywords = keywordTargets.map((item) => item.keyword);
  const splitLines = (value: string) => value.split(/\r?\n|،/).map((item) => item.trim()).filter(Boolean);
  const requiredHeadings = splitLines(parsed.data.requiredHeadings).slice(0, 20);
  const imageTopics = splitLines(parsed.data.imageTopics).slice(0, 10);
  const imageConfigured = parsed.data.generateImages === "on" && parsed.data.imageCount > 0 && parsed.data.imageConnectionId && imageConnection;
  const { error: requestError } = await admin.from("content_requests").insert({
    id: requestId,
    user_id: profile.id,
    topic: parsed.data.topic,
    keywords,
    language: parsed.data.language,
    audience: parsed.data.audience,
    tone: parsed.data.tone,
    target_words: parsed.data.targetWords,
    keyword_targets: keywordTargets,
    content_brief: parsed.data.contentBrief || null,
    required_headings: requiredHeadings,
    image_topics: imageTopics,
    seo_settings: {
      search_intent: parsed.data.searchIntent,
      content_type: parsed.data.contentType,
      point_of_view: parsed.data.pointOfView,
      faq_count: parsed.data.faqCount,
      call_to_action: parsed.data.callToAction,
      forbidden_terms: splitLines(parsed.data.forbiddenTerms).slice(0, 30),
      internal_links: splitLines(parsed.data.internalLinks).slice(0, 20),
    },
    text_api_key_id: textConnection.source === "user" ? textConnection.key.id : null,
    text_system_api_key_id: textConnection.source === "system" ? textConnection.key.id : null,
    text_provider_slug: textConnection.provider.slug,
    text_model: parsed.data.textModel,
    image_api_key_id: imageConfigured && imageConnection!.source === "user" ? imageConnection!.key.id : null,
    image_system_api_key_id: imageConfigured && imageConnection!.source === "system" ? imageConnection!.key.id : null,
    image_provider_slug: imageConfigured ? imageConnection!.provider.slug : null,
    image_model: imageConfigured ? parsed.data.imageModel : null,
    image_count: imageConfigured ? parsed.data.imageCount : 0,
    settings_snapshot: { daily_limit: dailyLimit, monthly_limit: monthlyLimit },
  });
  if (requestError) return { status: "error", message: "ثبت درخواست انجام نشد." };

  const { error: jobError } = await admin.from("generation_jobs").insert({ id: jobId, request_id: requestId, user_id: profile.id, idempotency_key: parsed.data.idempotencyKey });
  if (jobError) {
    await admin.from("content_requests").delete().eq("id", requestId).eq("user_id", profile.id);
    return { status: "error", message: "ساخت اجرای پردازش انجام نشد." };
  }

  const steps = [
    { job_id: jobId, user_id: profile.id, kind: "article" as const, position: 0, provider_slug: textConnection.provider.slug, model_key: parsed.data.textModel },
    ...Array.from({ length: imageConfigured ? parsed.data.imageCount : 0 }, (_, index) => ({
      job_id: jobId, user_id: profile.id, kind: index === 0 ? "hero_image" as const : "inline_image" as const,
      position: index, provider_slug: imageConnection!.provider.slug, model_key: parsed.data.imageModel,
    })),
  ];
  const { error: stepsError } = await admin.from("generation_steps").insert(steps);
  if (stepsError) {
    await admin.from("generation_jobs").delete().eq("id", jobId);
    await admin.from("content_requests").delete().eq("id", requestId);
    return { status: "error", message: "مراحل پردازش ساخته نشدند." };
  }

  redirect(`/dashboard/history/${jobId}`);
}
