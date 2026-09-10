"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSystemAdmin } from "@/lib/auth/guards";
import { getProviderAdapter } from "@/lib/providers/registry";
import { selectDefaultTextModel } from "@/lib/providers/model-selection";
import { systemApiKeyContext } from "@/lib/security/api-key-vault";
import { createKeyHint, encryptSecret } from "@/lib/security/encryption";
import { createAdminClient } from "@/lib/supabase/admin";

export type SystemApiKeyState = {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors?: Record<string, string[]>;
};

const schema = z.object({
  providerId: z.string().uuid("ارائه‌دهنده معتبر نیست."),
  label: z.string().trim().min(2, "یک نام روشن برای اتصال بنویسید.").max(80),
  apiKey: z.string().trim().min(8, "مقدار کلید معتبر نیست.").max(4096),
});

export async function saveSystemApiKeyAction(
  _state: SystemApiKeyState,
  formData: FormData,
): Promise<SystemApiKeyState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", message: "اطلاعات اتصال را اصلاح کنید.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { profile } = await requireSystemAdmin();
  const admin = createAdminClient();
  const { data: provider } = await admin.from("providers").select("id, slug, name")
    .eq("id", parsed.data.providerId).single<{ id: string; slug: string; name: string }>();
  if (!provider) return { status: "error", message: "ارائه‌دهنده پیدا نشد." };

  const adapter = getProviderAdapter(provider.slug);
  const test = await adapter.validateKey(parsed.data.apiKey);
  if (!test.ok) return { status: "error", message: test.message };
  let availableModels;
  try {
    availableModels = (await adapter.listModels(parsed.data.apiKey)).slice(0, 200);
  } catch {
    return { status: "error", message: "کلید معتبر است، اما دریافت فهرست مدل‌ها انجام نشد؛ دوباره تلاش کنید." };
  }
  const defaultTextModel = selectDefaultTextModel(provider.slug, availableModels);
  if (!defaultTextModel) return { status: "error", message: "این کلید معتبر است، اما مدل نگارشیِ قابل‌استفاده‌ای برای آن پیدا نشد." };

  const { data: existing } = await admin.from("system_api_keys").select("id")
    .eq("provider_id", provider.id).is("deleted_at", null).maybeSingle<{ id: string }>();
  const keyId = existing?.id ?? randomUUID();
  const encrypted = encryptSecret(parsed.data.apiKey, systemApiKeyContext(keyId, provider.id));
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
    updated_by: profile.id,
  };
  const result = existing
    ? await admin.from("system_api_keys").update(values).eq("id", keyId)
    : await admin.from("system_api_keys").insert({ id: keyId, provider_id: provider.id, created_by: profile.id, ...values });
  if (result.error) return { status: "error", message: "ذخیرهٔ امن اتصال سراسری انجام نشد." };

  if (availableModels.length) {
    await admin.from("provider_models").upsert(availableModels.map((model) => ({
      provider_id: provider.id,
      model_key: model.id,
      display_name: model.name,
      kind: model.kind,
      enabled: true,
    })), { onConflict: "provider_id,model_key" });
  }
  await admin.from("providers").update({ enabled: true }).eq("id", provider.id);
  revalidatePath("/system-admin");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/content/new");
  return { status: "success", message: `${provider.name} متصل شد. مدل نگارش «${defaultTextModel.name}» برای این اتصال قفل شد.` };
}

export async function toggleSystemApiKeyAction(formData: FormData) {
  const keyId = z.string().uuid().parse(formData.get("keyId"));
  const active = z.enum(["true", "false"]).parse(formData.get("active")) === "true";
  const { profile } = await requireSystemAdmin();
  await createAdminClient().from("system_api_keys").update({ is_active: active, updated_by: profile.id }).eq("id", keyId).is("deleted_at", null);
  revalidatePath("/system-admin");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/content/new");
}

export async function deleteSystemApiKeyAction(formData: FormData) {
  const keyId = z.string().uuid().parse(formData.get("keyId"));
  const { profile } = await requireSystemAdmin();
  await createAdminClient().from("system_api_keys").update({ is_active: false, deleted_at: new Date().toISOString(), updated_by: profile.id }).eq("id", keyId);
  revalidatePath("/system-admin");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/content/new");
}
