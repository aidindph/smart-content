import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { getGoogleAccessToken, googleApi, SearchConsoleError } from "./google";

type SitesResponse = { siteEntry?: Array<{ siteUrl?: string; permissionLevel?: string }> };
type AnalyticsResponse = { rows?: Array<{ keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }> };
type SitemapsResponse = { sitemap?: Array<{ path?: string; lastSubmitted?: string; isPending?: boolean; isSitemapsIndex?: boolean; type?: string; lastDownloaded?: string; warnings?: string | number; errors?: string | number; contents?: Json[] }> };
type Property = { id: string; site_url: string };
type SyncIssue = { property?: string; searchType?: string; code: string; message: string; details?: Json };
const searchTypes = ["web", "image", "video", "news", "discover", "googleNews"] as const;
type SearchType = (typeof searchTypes)[number];
type PerformanceDimension = "date" | "query" | "page" | "country" | "device";
type DataScope = "total" | "query" | "page" | "query_page" | "country" | "device";
type ReportSpec = { scope: DataScope; dimensions: PerformanceDimension[] };
const commonReports: ReportSpec[] = [
  { scope: "total", dimensions: ["date"] },
  { scope: "page", dimensions: ["date", "page"] },
  { scope: "country", dimensions: ["date", "country"] },
];
const queryReports: ReportSpec[] = [
  { scope: "query", dimensions: ["date", "query"] },
  { scope: "query_page", dimensions: ["date", "query", "page"] },
];
const deviceReport: ReportSpec = { scope: "device", dimensions: ["date", "device"] };
const reportLabel: Record<DataScope, string> = { total: "آمار کل", query: "عبارت‌ها", page: "صفحه‌ها", query_page: "ارتباط عبارت و صفحه", country: "کشورها", device: "دستگاه‌ها" };
const reportsBySearchType: Record<SearchType, ReportSpec[]> = {
  web: [...commonReports, ...queryReports, deviceReport],
  image: [...commonReports, ...queryReports, deviceReport],
  video: [...commonReports, ...queryReports, deviceReport],
  news: [...commonReports, ...queryReports, deviceReport],
  // Discover does not expose query data and rejects grouping by device.
  discover: commonReports,
  // Google News does not expose search queries.
  googleNews: [...commonReports, deviceReport],
};
const dateOnly = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: Date, days: number) => { const next = new Date(date); next.setUTCDate(next.getUTCDate() + days); return next; };
const safeJson = (value: unknown): Json | undefined => value === undefined ? undefined : JSON.parse(JSON.stringify(value)) as Json;

async function syncSitemaps(accessToken: string, userId: string, property: Property) {
  const admin = createAdminClient();
  const result = await googleApi<SitemapsResponse>(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property.site_url)}/sitemaps`, accessToken);
  for (const sitemap of result.sitemap ?? []) {
    if (!sitemap.path) continue;
    await admin.from("gsc_sitemaps").upsert({ property_id: property.id, user_id: userId, path: sitemap.path, sitemap_type: sitemap.type ?? null, is_pending: Boolean(sitemap.isPending), is_sitemaps_index: Boolean(sitemap.isSitemapsIndex), last_submitted_at: sitemap.lastSubmitted ?? null, last_downloaded_at: sitemap.lastDownloaded ?? null, warnings: Number(sitemap.warnings ?? 0), errors: Number(sitemap.errors ?? 0), contents: sitemap.contents ?? [], synced_at: new Date().toISOString() }, { onConflict: "property_id,path" });
  }
  return result.sitemap?.length ?? 0;
}

async function syncPerformance(accessToken: string, userId: string, property: Property, start: Date, end: Date, issues: SyncIssue[]) {
  const admin = createAdminClient();
  let rowsWritten = 0;
  const completedTypes: string[] = [];
  for (const searchType of searchTypes) {
    let typeSucceeded = true;
    for (const report of reportsBySearchType[searchType]) {
      for (let windowStart = new Date(start); windowStart <= end; windowStart = addDays(windowStart, 30)) {
        const windowEnd = new Date(Math.min(addDays(windowStart, 29).getTime(), end.getTime()));
        let startRow = 0;
        try {
          do {
            const payload = await googleApi<AnalyticsResponse>(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property.site_url)}/searchAnalytics/query`, accessToken, { method: "POST", body: JSON.stringify({ startDate: dateOnly(windowStart), endDate: dateOnly(windowEnd), dimensions: report.dimensions, rowLimit: 25_000, startRow, dataState: "final", type: searchType }) });
            const rows = payload.rows ?? [];
            for (let offset = 0; offset < rows.length; offset += 1000) {
              const batch = rows.slice(offset, offset + 1000).flatMap((row) => {
                if (!row.keys?.[0]) return [];
                const values = Object.fromEntries(report.dimensions.map((dimension, index) => [dimension, row.keys?.[index] ?? ""])) as Partial<Record<PerformanceDimension, string>>;
                return [{ property_id: property.id, user_id: userId, metric_date: values.date!, query: values.query ?? "", page: values.page ?? "", country: values.country ?? "", device: values.device ?? "", search_type: searchType, data_scope: report.scope, clicks: row.clicks ?? 0, impressions: row.impressions ?? 0, ctr: row.ctr ?? 0, position: row.position ?? 0, synced_at: new Date().toISOString() }];
              });
              if (batch.length) { const { error } = await admin.from("gsc_metrics_daily").upsert(batch, { onConflict: "property_id,metric_date,query,page,country,device,search_type,data_scope" }); if (error) throw error; rowsWritten += batch.length; }
            }
            startRow += rows.length;
              if (rows.length < 25_000) break;
          } while (true);
        } catch (error) {
          typeSucceeded = false;
          const known = error instanceof SearchConsoleError ? error : null;
          issues.push({ property: property.site_url, searchType, code: known?.code ?? "sync_failed", message: `${known?.message ?? (error instanceof Error ? error.message : "همگام‌سازی این گزارش انجام نشد.")} (گزارش ${reportLabel[report.scope]})`, details: safeJson(known?.details) });
          break;
        }
      }
      if (!typeSucceeded) break;
    }
    if (typeSucceeded) completedTypes.push(searchType);
  }
  return { rowsWritten, completedTypes };
}

export async function syncSearchConsoleForUser(userId: string, triggerType: "manual" | "scheduled" = "manual") {
  const admin = createAdminClient();
  const { data: storedConnection } = await admin.from("gsc_connections").select("id").eq("user_id", userId).single<{ id: string }>();
  if (!storedConnection) throw new Error("اتصال سرچ کنسول وجود ندارد.");
  const { data: run } = await admin.from("gsc_sync_runs").insert({ connection_id: storedConnection.id, user_id: userId, trigger_type: triggerType, status: "running" }).select("id").single<{ id: string }>();
  if (!run) throw new Error("ثبت اجرای همگام‌سازی انجام نشد.");
  const issues: SyncIssue[] = [];
  let rowsWritten = 0;
  let propertiesSynced = 0;
  const completedTypes = new Set<string>();
  try {
    const { connection, accessToken } = await getGoogleAccessToken(userId);
    const sites = await googleApi<SitesResponse>("https://www.googleapis.com/webmasters/v3/sites", accessToken);
    for (const site of sites.siteEntry ?? []) if (site.siteUrl) await admin.from("gsc_properties").upsert({ connection_id: connection.id, user_id: userId, site_url: site.siteUrl, permission_level: site.permissionLevel ?? "unknown" }, { onConflict: "user_id,site_url" });
    const { data: properties } = await admin.from("gsc_properties").select("id, site_url").eq("user_id", userId).eq("selected", true).returns<Property[]>();
    const { data: latest } = await admin.from("gsc_metrics_daily").select("metric_date").eq("user_id", userId).eq("data_scope", "total").order("metric_date", { ascending: false }).limit(1).maybeSingle<{ metric_date: string }>();
    const end = addDays(new Date(), -3);
    const start = latest?.metric_date ? addDays(new Date(`${latest.metric_date}T00:00:00Z`), -3) : addDays(end, -486);
    for (const property of properties ?? []) {
      try { await syncSitemaps(accessToken, userId, property); } catch (error) { const known = error instanceof SearchConsoleError ? error : null; issues.push({ property: property.site_url, code: known?.code ?? "sitemap_failed", message: known?.message ?? "دریافت نقشه‌های سایت انجام نشد.", details: safeJson(known?.details) }); }
      const result = await syncPerformance(accessToken, userId, property, start, end, issues);
      rowsWritten += result.rowsWritten; result.completedTypes.forEach((type) => completedTypes.add(type)); propertiesSynced += 1;
      await admin.from("gsc_properties").update({ last_synced_at: new Date().toISOString() }).eq("id", property.id);
    }
    const status = issues.length ? (rowsWritten ? "partial" : "failed") : "completed";
    const message = issues[0]?.message ?? null;
    await admin.from("gsc_sync_runs").update({ status, completed_at: new Date().toISOString(), properties_found: sites.siteEntry?.length ?? 0, properties_synced: propertiesSynced, rows_written: rowsWritten, search_types: [...completedTypes], error_code: issues[0]?.code ?? null, error_message: message, error_details: { issues } }).eq("id", run.id);
    await admin.from("gsc_connections").update({ last_synced_at: new Date().toISOString(), status: status === "failed" ? "expired" : "active" }).eq("id", connection.id);
    if (status === "failed") throw new Error(message ?? "همگام‌سازی انجام نشد.");
    return { properties: propertiesSynced, rowsWritten, status, issues: issues.length };
  } catch (error) {
    await admin.from("gsc_sync_runs").update({ status: "failed", completed_at: new Date().toISOString(), rows_written: rowsWritten, error_code: error instanceof SearchConsoleError ? error.code : "sync_failed", error_message: error instanceof Error ? error.message : "همگام‌سازی انجام نشد.", error_details: { issues } }).eq("id", run.id);
    throw error;
  }
}
