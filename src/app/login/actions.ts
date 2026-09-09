"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { consumeAuthRateLimit } from "@/lib/auth/rate-limit";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { message: string | null };

const loginSchema = z.object({
  email: z.string().trim().email("نشانی ایمیل معتبر وارد کنید."),
  password: z.string().min(8, "رمز عبور باید دست‌کم ۸ نویسه باشد."),
});

export async function loginAction(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!hasSupabaseConfig()) {
    return { message: "اتصال Supabase هنوز پیکربندی نشده است." };
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "اطلاعات ورود معتبر نیست." };
  }

  if (!(await consumeAuthRateLimit("login", parsed.data.email))) {
    return { message: "تلاش‌های ورود بیش از حد است؛ پانزده دقیقه بعد دوباره امتحان کنید." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) return { message: "ایمیل یا رمز عبور درست نیست." };
  redirect("/dashboard");
}
