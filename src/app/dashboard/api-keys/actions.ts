"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { getProviderAdapter } from "@/lib/providers/registry";
import { selectDefaultTextModel } from "@/lib/providers/model-selection";
import { apiKeyContext, loadUserApiKey } from "@/lib/security/api-key-vault";
import { createKeyHint, encryptSecret } from "@/lib/security/encryption";
import { createAdminClient } from "@/lib/supabase/admin";

export type SaveApiKeyState = {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors?: Record<string, string[]>;
};

const saveSchema = z.object({
  keyId: z.string().uuid().optional().or(z.literal("")),
  providerId: z.string().uuid("ارائه‌دهنده معتبر نیست."),
  label: z.string().trim().min(2, "نام کلید دست‌کم دو نویسه باشد.").max(80, "نام کلید بیش از ۸۰ نویسه است."),
  apiKey: z.string().trim().min(8, "مقدار کلید معتبر نیست.").max(4096, "مقدار کلید بیش از اندازه بلند است."),
});

const keyIdSchema = z.string().uuid();

type ProviderRow = { id: string; slug: string; enabled: boolean; supports_byok: boolean };
type ExistingKeyRow = { id: string; provider_id: string };

async function getEnabledProvider(providerId: string) {
  const { data } = await createAdminClient()
    .from("providers")
    .select("id, slug, enabled, supports_byok")
    .eq("id", providerId)
    .single<ProviderRow>();

  if (!data?.enabled || !data.supports_byok) {
    throw new Error("این ارائه‌دهنده در حال حاضر برای ثبت کلید فعال نیست.");
  }
  return data;
}

export async function saveApiKeyAction(
  _previousState: SaveApiKeyState,
  formData: FormData,
): Promise<SaveApiKeyState> {
  const parsed = saveSchema.safeParse({
    keyId: formData.get("keyId") ?? "",
    providerId: formData.get("providerId"),
    label: formData.get("label"),
    apiKey: formData.get("apiKey"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "اطلاعات فرم را اصلاح کنید.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { profile } = await requireUser();
  const admin = createAdminClient();
  let provider: ProviderRow;
  try {
    provider = await getEnabledProvider(parsed.data.providerId);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "ارائه‌دهنده در دسترس نیست." };
  }

  const existingId = parsed.data.keyId || undefined;
  if (existingId) {
    const { data: existing } = await admin
      .from("user_api_keys")
      .select("id, provider_id")
      .eq("id", existingId)
      .eq("user_id", profile.id)
      .is("deleted_at", null)
      .single<ExistingKeyRow>();

    if (!existing || existing.provider_id !== provider.id) {
      return { status: "error", message: "کلید موردنظر برای جایگزینی پیدا نشد." };
    }
  }

  const adapter = getProviderAdapter(provider.slug);
  const connection = await adapter.validateKey(parsed.data.apiKey);
  if (!connection.ok) return { status: "error", message: connection.message };
  let availableModels;
  try {
    availableModels = (await adapter.listModels(parsed.data.apiKey)).slice(0, 200);
  } catch {
    return { status: "error", message: "کلید معتبر است، اما دریافت فهرست مدل‌ها انجام نشد؛ دوباره تلاش کنید." };
  }
  const defaultTextModel = selectDefaultTextModel(provider.slug, availableModels);
  if (!defaultTextModel) return { status: "error", message: "این کلید معتبر است، اما هیچ مدل نگارشیِ قابل‌استفاده‌ای برای آن پیدا نشد." };

  const keyId = existingId ?? randomUUID();
  const encrypted = encryptSecret(parsed.data.apiKey, apiKeyContext(profile.id, keyId, provider.id));
  const values = {
    label: parsed.data.label,
    encrypted_key: encrypted.ciphertext,
    encryption_iv: encrypted.iv,
    encryption_tag: encrypted.tag,
    key_version: encrypted.keyVersion,
    key_hint: createKeyHint(parsed.data.apiKey),
    is_active: true,
    test_status: "valid" as const,
    last_tested_at: new Date().toISOString(),
    last_error_code: null,
    default_text_model: defaultTextModel.id,
  };

  const result = existingId
    ? await admin.from("user_api_keys").update(values).eq("id", keyId).eq("user_id", profile.id)
    : await admin.from("user_api_keys").insert({ id: keyId, user_id: profile.id, provider_id: provider.id, ...values });

  if (result.error) {
    return {
      status: "error",
      message: result.error.code === "23505" ? "برای این ارائه‌دهنده کلیدی با همین نام وجود دارد." : "ذخیرهٔ امن کلید انجام نشد.",
    };
  }

  if (availableModels.length) {
    await admin.from("provider_models").upsert(availableModels.map((model) => ({
      provider_id: provider.id,
      model_key: model.id,
      display_name: model.name,
      kind: model.kind,
      enabled: true,
    })), { onConflict: "provider_id,model_key" });
  }

  revalidatePath("/dashboard/api-keys");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/content/new");
  return {
    status: "success",
    message: `${existingId ? "کلید تازه آزمایش و جایگزین شد" : "کلید آزمایش و به‌صورت رمزنگاری‌شده ذخیره شد"}. مدل نگارش این اتصال روی «${defaultTextModel.name}» قفل شد.`,
  };
}

export async function testApiKeyAction(formData: FormData) {
  const keyId = keyIdSchema.parse(formData.get("keyId"));
  const { profile } = await requireUser();
  const admin = createAdminClient();
  const stored = await loadUserApiKey(profile.id, keyId);
  const { data: provider } = await admin.from("providers").select("slug").eq("id", stored.providerId).single<{ slug: string }>();
  if (!provider) redirect("/dashboard/api-keys?error=provider");

  const adapter = getProviderAdapter(provider.slug);
  const connection = await adapter.validateKey(stored.apiKey);
  let defaultTextModel = undefined;
  if (connection.ok) {
    try {
      const availableModels = (await adapter.listModels(stored.apiKey)).slice(0, 200);
      defaultTextModel = selectDefaultTextModel(provider.slug, availableModels);
      if (availableModels.length) {
        await admin.from("provider_models").upsert(availableModels.map((model) => ({
          provider_id: stored.providerId,
          model_key: model.id,
          display_name: model.name,
          kind: model.kind,
          enabled: true,
        })), { onConflict: "provider_id,model_key" });
      }
    } catch {
      // اعتبار اتصال حفظ می‌شود؛ آخرین مدل قفل‌شده تا آزمایش بعدی باقی می‌ماند.
    }
  }
  await admin.from("user_api_keys").update({
    test_status: connection.ok ? "valid" : "invalid",
    last_tested_at: new Date().toISOString(),
    last_error_code: connection.ok ? null : connection.code,
    ...(defaultTextModel ? { default_text_model: defaultTextModel.id } : {}),
  }).eq("id", keyId).eq("user_id", profile.id);

  revalidatePath("/dashboard/api-keys");
  revalidatePath("/dashboard/content/new");
  redirect(`/dashboard/api-keys?${connection.ok ? "notice=tested" : "error=test"}`);
}

export async function toggleApiKeyAction(formData: FormData) {
  const keyId = keyIdSchema.parse(formData.get("keyId"));
  const active = z.enum(["true", "false"]).parse(formData.get("active")) === "true";
  const { profile } = await requireUser();
  const { error } = await createAdminClient().from("user_api_keys").update({ is_active: active })
    .eq("id", keyId).eq("user_id", profile.id).is("deleted_at", null);
  if (error) redirect("/dashboard/api-keys?error=update");
  revalidatePath("/dashboard/api-keys");
  redirect("/dashboard/api-keys?notice=updated");
}

export async function deleteApiKeyAction(formData: FormData) {
  const keyId = keyIdSchema.parse(formData.get("keyId"));
  const { profile } = await requireUser();
  const { error } = await createAdminClient().from("user_api_keys")
    .update({ is_active: false, deleted_at: new Date().toISOString() })
    .eq("id", keyId).eq("user_id", profile.id).is("deleted_at", null);
  if (error) redirect("/dashboard/api-keys?error=delete");
  revalidatePath("/dashboard/api-keys");
  redirect("/dashboard/api-keys?notice=deleted");
}
