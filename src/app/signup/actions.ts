"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isRegistrationEnabled } from "@/lib/settings/registration";

export type SignupState = { message: string | null; success: boolean };

const signupSchema = z
  .object({
    displayName: z.string().trim().min(2, "نام باید دست‌کم ۲ نویسه باشد.").max(80),
    email: z.string().trim().email("نشانی ایمیل معتبر وارد کنید."),
    password: z.string().min(8, "رمز عبور باید دست‌کم ۸ نویسه باشد."),
    passwordConfirmation: z.string(),
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    message: "تکرار رمز عبور یکسان نیست.",
    path: ["passwordConfirmation"],
  });

export async function signupAction(
  _previousState: SignupState,
  formData: FormData,
): Promise<SignupState> {
  if (!(await isRegistrationEnabled())) {
    return { success: false, message: "ثبت‌نام عمومی در حال حاضر بسته است." };
  }

  const parsed = signupSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
    passwordConfirmation: formData.get("passwordConfirmation"),
  });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "اطلاعات ثبت‌نام معتبر نیست." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { display_name: parsed.data.displayName } },
  });

  if (error) return { success: false, message: "ساخت حساب انجام نشد. ممکن است این ایمیل قبلاً ثبت شده باشد." };
  return { success: true, message: "حساب ساخته شد. پیوند تأیید ایمیل را بررسی کنید." };
}
