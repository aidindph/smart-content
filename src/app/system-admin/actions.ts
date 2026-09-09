"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { invitationTokenHash } from "@/lib/auth/invitations";
import { requireSystemAdmin } from "@/lib/auth/guards";

const booleanValue = z.enum(["true", "false"]);
const uuid = z.string().uuid();

export type InvitationState = { status: "idle" | "success" | "error"; message: string; link?: string };

export async function createInvitationAction(_state: InvitationState, formData: FormData): Promise<InvitationState> {
  const parsed = z.object({ email: z.string().trim().toLowerCase().email(), role: z.enum(["customer", "system_admin"]), days: z.coerce.number().int().min(1).max(30) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "ایمیل یا مدت اعتبار صحیح نیست." };
  const { supabase, profile } = await requireSystemAdmin();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + parsed.data.days * 86_400_000).toISOString();
  await supabase.from("user_invitations").update({ revoked_at: new Date().toISOString() }).eq("email", parsed.data.email).is("accepted_at", null).is("revoked_at", null);
  const { error } = await supabase.from("user_invitations").insert({ email: parsed.data.email, role: parsed.data.role, token_hash: invitationTokenHash(token), invited_by: profile.id, expires_at: expiresAt });
  if (error) return { status: "error", message: "ساخت دعوت‌نامه انجام نشد." };
  revalidatePath("/system-admin");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://smart-content-orcin.vercel.app";
  const link = `${baseUrl}/signup?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(parsed.data.email)}`;
  return { status: "success", message: "دعوت‌نامه ساخته شد.", link };
}

export async function revokeInvitationAction(formData: FormData) {
  const invitationId = uuid.parse(formData.get("invitationId"));
  const { supabase } = await requireSystemAdmin();
  await supabase.from("user_invitations").update({ revoked_at: new Date().toISOString() }).eq("id", invitationId).is("accepted_at", null);
  revalidatePath("/system-admin");
}

export async function setDefaultLimitsAction(formData: FormData) {
  const parsed = z.object({ daily: z.coerce.number().int().min(0).max(100000), monthly: z.coerce.number().int().min(0).max(1000000) }).parse(Object.fromEntries(formData));
  const { supabase, profile } = await requireSystemAdmin();
  const { error } = await supabase.from("system_settings").update({ default_daily_request_limit: parsed.daily, default_monthly_request_limit: parsed.monthly, updated_by: profile.id }).eq("id", 1);
  if (error) throw new Error("ذخیرهٔ سقف‌های پیش‌فرض انجام نشد.");
  revalidatePath("/system-admin");
}

export async function setUserStatusAction(formData: FormData) {
  const userId = uuid.parse(formData.get("userId"));
  const status = z.enum(["active", "suspended"]).parse(formData.get("status"));
  const { supabase, profile } = await requireSystemAdmin();
  if (userId === profile.id && status === "suspended") throw new Error("مدیر نمی‌تواند حساب خودش را معلق کند.");
  await supabase.from("profiles").update({ status }).eq("id", userId);
  revalidatePath("/system-admin");
}

export async function setUserRoleAction(formData: FormData) {
  const userId = uuid.parse(formData.get("userId"));
  const role = z.enum(["customer", "system_admin"]).parse(formData.get("role"));
  const { supabase, profile } = await requireSystemAdmin();
  if (userId === profile.id && role !== "system_admin") throw new Error("مدیر نمی‌تواند نقش خودش را کاهش دهد.");
  await supabase.from("profiles").update({ role }).eq("id", userId);
  revalidatePath("/system-admin");
}

export async function setUserQuotaAction(formData: FormData) {
  const parsed = z.object({ userId: z.string().uuid(), daily: z.coerce.number().int().min(0).max(100000), monthly: z.coerce.number().int().min(0).max(1000000) }).parse(Object.fromEntries(formData));
  const { supabase, profile } = await requireSystemAdmin();
  await supabase.from("quota_policies").upsert({ user_id: parsed.userId, daily_request_limit: parsed.daily, monthly_request_limit: parsed.monthly, updated_by: profile.id });
  revalidatePath("/system-admin");
}

export async function setRegistrationAction(formData: FormData) {
  const { supabase, profile } = await requireSystemAdmin();
  const enabled = booleanValue.parse(formData.get("enabled")) === "true";
  const { error } = await supabase.from("system_settings").update({ registration_enabled: enabled, updated_by: profile.id }).eq("id", 1);
  if (error) throw new Error("تغییر وضعیت ثبت‌نام انجام نشد.");
  updateTag("registration-settings");
  revalidatePath("/login");
  revalidatePath("/system-admin");
}

export async function setMaintenanceAction(formData: FormData) {
  const { supabase, profile } = await requireSystemAdmin();
  const enabled = booleanValue.parse(formData.get("enabled")) === "true";
  const { error } = await supabase.from("system_settings").update({ maintenance_mode: enabled, updated_by: profile.id }).eq("id", 1);
  if (error) throw new Error("تغییر حالت تعمیر انجام نشد.");
  revalidatePath("/system-admin");
}

export async function setProviderAction(formData: FormData) {
  const { supabase } = await requireSystemAdmin();
  const providerId = z.string().uuid().parse(formData.get("providerId"));
  const enabled = booleanValue.parse(formData.get("enabled")) === "true";
  const { error } = await supabase.from("providers").update({ enabled }).eq("id", providerId);
  if (error) throw new Error("تغییر وضعیت ارائه‌دهنده انجام نشد.");
  revalidatePath("/system-admin");
}

export async function addProviderModelAction(formData: FormData) {
  const parsed = z.object({ providerId: z.string().uuid(), modelKey: z.string().trim().min(2).max(200), displayName: z.string().trim().min(2).max(200), kind: z.enum(["text", "image", "multimodal"]) }).parse(Object.fromEntries(formData));
  const { supabase } = await requireSystemAdmin();
  const { error } = await supabase.from("provider_models").insert({ provider_id: parsed.providerId, model_key: parsed.modelKey, display_name: parsed.displayName, kind: parsed.kind, enabled: true });
  if (error) throw new Error("افزودن مدل انجام نشد؛ ممکن است این شناسه قبلاً ثبت شده باشد.");
  revalidatePath("/system-admin");
}

export async function toggleProviderModelAction(formData: FormData) {
  const modelId = uuid.parse(formData.get("modelId"));
  const enabled = booleanValue.parse(formData.get("enabled")) === "true";
  const { supabase } = await requireSystemAdmin();
  await supabase.from("provider_models").update({ enabled }).eq("id", modelId);
  revalidatePath("/system-admin");
}

export async function setModelPriceAction(formData: FormData) {
  const parsed = z.object({ modelId: z.string().uuid(), unit: z.enum(["input_million_tokens", "output_million_tokens", "image", "request"]), price: z.coerce.number().min(0).max(1000000) }).parse(Object.fromEntries(formData));
  const { supabase, profile } = await requireSystemAdmin();
  const effectiveFrom = new Date().toISOString();
  await supabase.from("provider_pricing").update({ effective_until: effectiveFrom }).eq("provider_model_id", parsed.modelId).eq("unit", parsed.unit).is("effective_until", null);
  const { error } = await supabase.from("provider_pricing").insert({ provider_model_id: parsed.modelId, unit: parsed.unit, price_usd: parsed.price, effective_from: effectiveFrom, created_by: profile.id });
  if (error) throw new Error("ثبت قیمت مدل انجام نشد.");
  revalidatePath("/system-admin");
}
