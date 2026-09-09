import { cache } from "react";
import { redirect } from "next/navigation";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type CurrentProfile = {
  id: string;
  display_name: string | null;
  role: "customer" | "system_admin";
  status: "active" | "suspended";
};

export const requireUser = cache(async () => {
  if (!hasSupabaseConfig()) {
    redirect("/login?error=missing-config");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || !userId) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, role, status")
    .eq("id", userId)
    .single<CurrentProfile>();

  if (!profile || profile.status !== "active") {
    await supabase.auth.signOut();
    redirect("/login?error=account-disabled");
  }

  return { supabase, profile };
});

export const requireSystemAdmin = cache(async () => {
  const context = await requireUser();

  if (context.profile.role !== "system_admin") {
    redirect("/dashboard");
  }

  return context;
});
