import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getGoogleAccessToken, googleApi } from "./google";

type SitesResponse = { siteEntry?: Array<{ siteUrl?: string; permissionLevel?: string }> };
type AnalyticsResponse = { rows?: Array<{ keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }> };
function dateOnly(date: Date) { return date.toISOString().slice(0, 10); }

export async function syncSearchConsoleForUser(userId: string) {
  const admin = createAdminClient();
  const { connection, accessToken } = await getGoogleAccessToken(userId);
  const sites = await googleApi<SitesResponse>("https://www.googleapis.com/webmasters/v3/sites", accessToken);
  for (const site of sites.siteEntry ?? []) {
    if (!site.siteUrl) continue;
    await admin.from("gsc_properties").upsert({ connection_id: connection.id, user_id: userId, site_url: site.siteUrl, permission_level: site.permissionLevel ?? "unknown" }, { onConflict: "user_id,site_url", ignoreDuplicates: false });
  }
  const { data: properties } = await admin.from("gsc_properties").select("id, site_url").eq("user_id", userId).eq("selected", true).returns<Array<{ id: string; site_url: string }>>();
  const end = new Date(); end.setUTCDate(end.getUTCDate() - 3);
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 27);
  const startDate = dateOnly(start); const endDate = dateOnly(end);

  for (const property of properties ?? []) {
    await admin.from("gsc_metrics_daily").delete().eq("property_id", property.id).gte("metric_date", startDate).lte("metric_date", endDate);
    let startRow = 0;
    while (startRow < 100_000) {
      const payload = await googleApi<AnalyticsResponse>(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property.site_url)}/searchAnalytics/query`, accessToken, {
        method: "POST",
        body: JSON.stringify({ startDate, endDate, dimensions: ["date", "query", "page", "country", "device"], rowLimit: 25_000, startRow, dataState: "final", type: "web" }),
      });
      const rows = payload.rows ?? [];
      for (let offset = 0; offset < rows.length; offset += 1000) {
        const batch = rows.slice(offset, offset + 1000).flatMap((row) => row.keys?.[0] ? [{ property_id: property.id, user_id: userId, metric_date: row.keys[0], query: row.keys[1] ?? "", page: row.keys[2] ?? "", country: row.keys[3] ?? "", device: row.keys[4] ?? "", search_type: "web", clicks: row.clicks ?? 0, impressions: row.impressions ?? 0, ctr: row.ctr ?? 0, position: row.position ?? 0, synced_at: new Date().toISOString() }] : []);
        if (batch.length) await admin.from("gsc_metrics_daily").upsert(batch, { onConflict: "property_id,metric_date,query,page,country,device,search_type" });
      }
      startRow += rows.length;
      if (rows.length < 25_000) break;
    }
    await admin.from("gsc_properties").update({ last_synced_at: new Date().toISOString() }).eq("id", property.id);
  }
  await admin.from("gsc_connections").update({ last_synced_at: new Date().toISOString() }).eq("id", connection.id);
  return { properties: properties?.length ?? 0 };
}
