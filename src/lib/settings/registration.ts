import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function isRegistrationEnabled() {
  if (!hasSupabaseConfig()) return false;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("system_settings")
    .select("registration_enabled")
    .eq("id", 1)
    .single<{ registration_enabled: boolean }>();

  if (error) return false;
  return data.registration_enabled;
}
