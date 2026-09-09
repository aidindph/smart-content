"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSystemAdmin } from "@/lib/auth/guards";

const booleanValue = z.enum(["true", "false"]);

export async function setRegistrationAction(formData: FormData) {
  const { supabase, profile } = await requireSystemAdmin();
  const enabled = booleanValue.parse(formData.get("enabled")) === "true";
  const { error } = await supabase.from("system_settings").update({ registration_enabled: enabled, updated_by: profile.id }).eq("id", 1);
  if (error) throw new Error("تغییر وضعیت ثبت‌نام انجام نشد.");
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
