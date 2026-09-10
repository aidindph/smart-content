import { errorFromStatus, ProviderError } from "./errors";

export async function providerFetch(url: string, init: RequestInit, timeoutMs = 30_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const upstreamSignal = init.signal;
  const abortFromUpstream = () => controller.abort();
  upstreamSignal?.addEventListener("abort", abortFromUpstream, { once: true });

  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    if (!response.ok) {
      let providerDetail = "";
      try {
        const body = await response.text();
        const parsed = JSON.parse(body) as { error?: { message?: string }; message?: string };
        providerDetail = parsed.error?.message ?? parsed.message ?? body;
      } catch {
        providerDetail = "پاسخ خطای ارائه‌دهنده قابل خواندن نبود.";
      }
      throw errorFromStatus(response.status, providerDetail);
    }
    return response;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (controller.signal.aborted) {
      throw new ProviderError("پاسخ ارائه‌دهنده بیش از حد طول کشید.", "unavailable", true);
    }
    throw new ProviderError("ارتباط با ارائه‌دهنده برقرار نشد.", "unavailable", true);
  } finally {
    clearTimeout(timeout);
    upstreamSignal?.removeEventListener("abort", abortFromUpstream);
  }
}

export async function safeJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new ProviderError("پاسخ ارائه‌دهنده قابل خواندن نیست.", "invalid_response", false, response.status);
  }
}
