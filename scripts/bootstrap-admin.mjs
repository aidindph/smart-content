import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const displayName = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "مدیر سامانه";

if (!url || !serviceRoleKey || !email || !password) {
  console.error("متغیرهای Supabase و مشخصات مدیر نخست کامل نیستند.");
  process.exit(1);
}

if (password.length < 12) {
  console.error("رمز مدیر نخست باید دست‌کم ۱۲ نویسه باشد.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const tokenHash = createHash("sha256").update(randomUUID()).digest("hex");
const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

const { data: invitation, error: invitationError } = await supabase
  .from("user_invitations")
  .insert({ email, role: "system_admin", token_hash: tokenHash, expires_at: expiresAt })
  .select("id")
  .single();

if (invitationError) {
  console.error("ساخت دعوت مدیر نخست انجام نشد:", invitationError.message);
  process.exit(1);
}

const { data: created, error: createError } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { display_name: displayName },
});

if (createError || !created.user) {
  await supabase.from("user_invitations").delete().eq("id", invitation.id);
  console.error("ساخت مدیر نخست انجام نشد:", createError?.message ?? "خطای ناشناخته");
  process.exit(1);
}

const { error: roleError } = await supabase
  .from("profiles")
  .update({ role: "system_admin", status: "active" })
  .eq("id", created.user.id);

if (roleError) {
  console.error("حساب ساخته شد، اما تخصیص نقش مدیر انجام نشد:", roleError.message);
  process.exit(1);
}

console.log(`مدیر سامانه برای ${email} ساخته شد.`);
