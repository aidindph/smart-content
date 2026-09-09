import "server-only";

import { ProviderError } from "@/lib/providers/errors";
import { getImageProviderAdapter, getTextProviderAdapter } from "@/lib/providers/registry";
import { loadSystemApiKey, loadUserApiKey } from "@/lib/security/api-key-vault";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildArticlePrompt, buildImagePrompt, extractArticleTitle } from "./prompt";
import { analyzeSeo, buildImageSuggestions, markdownToArticleHtml, type KeywordTarget } from "./article-output";

type Job = {
  id: string; request_id: string; user_id: string; attempt: number; max_attempts: number; cancel_requested: boolean;
};
type Request = {
  id: string; user_id: string; topic: string; keywords: string[]; language: string; audience: string; tone: string;
  target_words: number; text_api_key_id: string | null; text_system_api_key_id: string | null; text_provider_slug: string; text_model: string;
  image_api_key_id: string | null; image_system_api_key_id: string | null; image_provider_slug: string | null; image_model: string | null; image_count: number;
  keyword_targets: KeywordTarget[]; seo_settings: { search_intent?: string; content_type?: string; point_of_view?: string; faq_count?: number; call_to_action?: string; forbidden_terms?: string[]; internal_links?: string[] }; content_brief: string | null; required_headings: string[]; image_topics: string[];
};
type Step = { id: string; kind: "article" | "hero_image" | "inline_image"; position: number };
type PricingUnit = "input_million_tokens" | "output_million_tokens" | "image" | "request";

async function pricingFor(providerId: string, modelKey: string) {
  const admin = createAdminClient();
  const { data: model } = await admin.from("provider_models").select("id").eq("provider_id", providerId).eq("model_key", modelKey).eq("enabled", true).maybeSingle<{ id: string }>();
  if (!model) return new Map<PricingUnit, number>();
  const now = new Date().toISOString();
  const { data: rows } = await admin.from("provider_pricing").select("unit, price_usd").eq("provider_model_id", model.id)
    .lte("effective_from", now).or(`effective_until.is.null,effective_until.gt.${now}`).order("effective_from", { ascending: false })
    .returns<Array<{ unit: PricingUnit; price_usd: number }>>();
  const prices = new Map<PricingUnit, number>();
  for (const row of rows ?? []) if (!prices.has(row.unit)) prices.set(row.unit, Number(row.price_usd));
  return prices;
}

async function cancellationRequested(jobId: string) {
  const { data } = await createAdminClient().from("generation_jobs").select("cancel_requested").eq("id", jobId).single<{ cancel_requested: boolean }>();
  return Boolean(data?.cancel_requested);
}

async function failJob(job: Job, error: unknown) {
  const providerError = error instanceof ProviderError ? error : undefined;
  const canRetry = Boolean(providerError?.retryable && job.attempt < job.max_attempts);
  const code = providerError?.code ?? "unexpected";
  const message = providerError?.message ?? "اجرای درخواست با خطای پیش‌بینی‌نشده متوقف شد.";
  const admin = createAdminClient();
  await admin.from("generation_steps").update({ status: "failed", error_code: code, error_message: message, completed_at: new Date().toISOString() })
    .eq("job_id", job.id).eq("status", "running");
  await admin.from("generation_jobs").update({
    status: canRetry ? "queued" : "failed",
    current_step: canRetry ? "در انتظار تلاش دوباره" : "متوقف‌شده",
    error_code: code,
    error_message: message,
    locked_at: null,
    completed_at: canRetry ? null : new Date().toISOString(),
  }).eq("id", job.id);
}

export async function processGenerationJob(jobId: string, userId: string) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const staleBefore = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data: current } = await admin.from("generation_jobs").select("status, locked_at")
    .eq("id", jobId).eq("user_id", userId).single<{ status: string; locked_at: string | null }>();
  if (current?.status === "running" && current.locked_at && current.locked_at < staleBefore) {
    await admin.from("generation_jobs").update({ status: "queued", locked_at: null, current_step: "بازیابی اجرای متوقف‌شده" })
      .eq("id", jobId).eq("user_id", userId).eq("status", "running").eq("locked_at", current.locked_at);
  }
  const { data: job } = await admin.from("generation_jobs").update({
    status: "running", locked_at: now, started_at: now, current_step: "نگارش مقاله", error_code: null,
    error_message: null,
  }).eq("id", jobId).eq("user_id", userId).eq("status", "queued").eq("cancel_requested", false)
    .select("id, request_id, user_id, attempt, max_attempts, cancel_requested").single<Job>();

  if (!job) return { accepted: false, status: "already-claimed" } as const;
  await admin.from("generation_jobs").update({ attempt: job.attempt + 1 }).eq("id", job.id);
  const activeJob = { ...job, attempt: job.attempt + 1 };

  try {
    const [{ data: request }, { data: steps }] = await Promise.all([
      admin.from("content_requests").select("*").eq("id", job.request_id).eq("user_id", userId).single<Request>(),
      admin.from("generation_steps").select("id, kind, position").eq("job_id", job.id).order("position").returns<Step[]>(),
    ]);
    if (!request) throw new Error("تنظیمات درخواست در دسترس نیست.");
    const articleStep = steps?.find((step) => step.kind === "article");
    if (!articleStep) throw new Error("مرحلهٔ نگارش در دسترس نیست.");

    const textSecret = request.text_api_key_id
      ? await loadUserApiKey(userId, request.text_api_key_id)
      : await loadSystemApiKey(request.text_system_api_key_id!);
    const { data: textProvider } = await admin.from("providers").select("id, slug, enabled").eq("id", textSecret.providerId).single<{ id: string; slug: string; enabled: boolean }>();
    if (!textProvider?.enabled || textProvider.slug !== request.text_provider_slug) throw new Error("ارائه‌دهندهٔ متن غیرفعال یا ناسازگار است.");

    await admin.from("generation_steps").update({ status: "running", attempt: activeJob.attempt, started_at: now, error_code: null, error_message: null }).eq("id", articleStep.id);
    const textResult = await getTextProviderAdapter(textProvider.slug).generateText({
      apiKey: textSecret.apiKey,
      model: request.text_model,
      prompt: buildArticlePrompt({ topic: request.topic, keywords: request.keywords, language: request.language, audience: request.audience, tone: request.tone, targetWords: request.target_words, keywordTargets: request.keyword_targets, searchIntent: request.seo_settings.search_intent, contentType: request.seo_settings.content_type, pointOfView: request.seo_settings.point_of_view, faqCount: request.seo_settings.faq_count, requiredHeadings: request.required_headings, contentBrief: request.content_brief ?? undefined, callToAction: request.seo_settings.call_to_action, forbiddenTerms: request.seo_settings.forbidden_terms, internalLinks: request.seo_settings.internal_links }),
      maxOutputTokens: Math.min(12_000, Math.max(2_000, Math.ceil(request.target_words * 2.2))),
    });
    const title = extractArticleTitle(textResult.text, request.topic);
    const outputHtml = markdownToArticleHtml(textResult.text, request.language);
    const seoAnalysis = analyzeSeo(textResult.text, request.keyword_targets, request.target_words);
    const imageSuggestions = buildImageSuggestions(textResult.text, request.image_topics, request.image_count || Math.min(3, Math.max(1, request.image_topics.length)));
    const textPrices = await pricingFor(textProvider.id, request.text_model);
    const inputQuantity = textResult.inputTokens / 1_000_000;
    const outputQuantity = textResult.outputTokens / 1_000_000;
    let estimatedCost = inputQuantity * (textPrices.get("input_million_tokens") ?? 0)
      + outputQuantity * (textPrices.get("output_million_tokens") ?? 0);
    await Promise.all([
      admin.from("generation_steps").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", articleStep.id),
      admin.from("generation_jobs").update({ progress: request.image_count ? 55 : 100, current_step: request.image_count ? "ساخت تصاویر" : "تکمیل‌شده", output_title: title, output_markdown: textResult.text, output_html: outputHtml, seo_analysis: seoAnalysis, image_suggestions: imageSuggestions, input_tokens: textResult.inputTokens, output_tokens: textResult.outputTokens, estimated_cost_usd: estimatedCost }).eq("id", job.id),
      admin.from("usage_ledger").insert([
        { job_id: job.id, user_id: userId, provider_slug: textProvider.slug, model_key: request.text_model, unit: "input_million_tokens", quantity: inputQuantity, estimated_cost_usd: inputQuantity * (textPrices.get("input_million_tokens") ?? 0), provider_request_id: textResult.providerRequestId ?? null },
        { job_id: job.id, user_id: userId, provider_slug: textProvider.slug, model_key: request.text_model, unit: "output_million_tokens", quantity: outputQuantity, estimated_cost_usd: outputQuantity * (textPrices.get("output_million_tokens") ?? 0), provider_request_id: textResult.providerRequestId ?? null },
      ]),
    ]);

    if (await cancellationRequested(job.id)) {
      await admin.from("generation_jobs").update({ status: "cancelled", current_step: "لغوشده", locked_at: null, completed_at: new Date().toISOString() }).eq("id", job.id);
      await admin.from("generation_steps").update({ status: "cancelled", completed_at: new Date().toISOString() }).eq("job_id", job.id).eq("status", "pending");
      return { accepted: true, status: "cancelled" } as const;
    }

    if (request.image_count && (request.image_api_key_id || request.image_system_api_key_id) && request.image_provider_slug && request.image_model) {
      const imageSecret = request.image_api_key_id
        ? await loadUserApiKey(userId, request.image_api_key_id)
        : await loadSystemApiKey(request.image_system_api_key_id!);
      const { data: imageProvider } = await admin.from("providers").select("id, slug, enabled").eq("id", imageSecret.providerId).single<{ id: string; slug: string; enabled: boolean }>();
      if (!imageProvider?.enabled || imageProvider.slug !== request.image_provider_slug) throw new Error("ارائه‌دهندهٔ تصویر غیرفعال یا ناسازگار است.");
      const adapter = getImageProviderAdapter(imageProvider.slug);
      const imagePrices = await pricingFor(imageProvider.id, request.image_model);
      const imageSteps = (steps ?? []).filter((step) => step.kind !== "article").slice(0, request.image_count);

      for (let index = 0; index < imageSteps.length; index += 1) {
        if (await cancellationRequested(job.id)) {
          await admin.from("generation_jobs").update({ status: "cancelled", current_step: "لغوشده", completed_at: new Date().toISOString() }).eq("id", job.id);
          await admin.from("generation_steps").update({ status: "cancelled", completed_at: new Date().toISOString() }).eq("job_id", job.id).eq("status", "pending");
          return { accepted: true, status: "cancelled" } as const;
        }

        const step = imageSteps[index];
        await admin.from("generation_steps").update({ status: "running", attempt: activeJob.attempt, started_at: new Date().toISOString() }).eq("id", step.id);
        const imageTitle = imageSuggestions[index]?.title ?? title;
        const image = await adapter.generateImage({ apiKey: imageSecret.apiKey, model: request.image_model, prompt: buildImagePrompt(request.topic, imageTitle, index), aspectRatio: index === 0 ? "16:9" : "1:1" });
        const extension = image.mimeType === "image/jpeg" ? "jpg" : image.mimeType === "image/webp" ? "webp" : "png";
        const storagePath = `${userId}/${job.id}/${step.position}-${step.id}.${extension}`;
        const { error: uploadError } = await admin.storage.from("content-assets").upload(storagePath, image.bytes, { contentType: image.mimeType, upsert: true });
        if (uploadError) throw new Error("ذخیرهٔ تصویر تولیدشده انجام نشد.");
        const altText = imageSuggestions[index]?.altText ?? (index === 0 ? `تصویر اصلی مقالهٔ ${title}` : `تصویر مرتبط با ${request.topic}`);
        const imageCost = imagePrices.get("image") ?? 0;
        estimatedCost += imageCost;
        await Promise.all([
          admin.from("content_assets").upsert({ job_id: job.id, user_id: userId, step_id: step.id, storage_path: storagePath, mime_type: image.mimeType, alt_text: altText, position: step.position }, { onConflict: "storage_path" }),
          admin.from("generation_steps").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", step.id),
          admin.from("usage_ledger").insert({ job_id: job.id, user_id: userId, provider_slug: imageProvider.slug, model_key: request.image_model, unit: "image", quantity: 1, estimated_cost_usd: imageCost, provider_request_id: image.providerRequestId ?? null }),
          admin.from("generation_jobs").update({ progress: Math.round(55 + ((index + 1) / imageSteps.length) * 45), current_step: `تصویر ${index + 1} از ${imageSteps.length}`, estimated_cost_usd: estimatedCost }).eq("id", job.id),
        ]);
      }
    }

    await admin.from("generation_jobs").update({ status: "completed", progress: 100, current_step: "تکمیل‌شده", locked_at: null, completed_at: new Date().toISOString() }).eq("id", job.id);
    return { accepted: true, status: "completed" } as const;
  } catch (error) {
    await failJob(activeJob, error);
    return { accepted: true, status: "failed" } as const;
  }
}
