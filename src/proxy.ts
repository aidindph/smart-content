import type { NextRequest } from "next/server";
import { refreshSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return refreshSession(request);
}

export const config = {
  matcher: ["/dashboard/:path*", "/system-admin/:path*", "/api/google/:path*"],
};
