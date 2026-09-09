import { unstable_cache } from "next/cache";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/admin";

const readRegistrationEnabled = unstable_cache(async () => {
  if (!hasSupabaseConfig()) return false;

  const { data, error } = await createAdminClient()
    .from("system_settings")
    .select("registration_enabled")
    .eq("id", 1)
    .single<{ registration_enabled: boolean }>();

  if (error) return false;
  return data.registration_enabled;
}, ["registration-enabled"], { revalidate: 60, tags: ["registration-settings"] });

export async function isRegistrationEnabled() {
  return readRegistrationEnabled();
}
