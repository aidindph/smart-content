import { ProviderError } from "./errors";
import { connectionFailure } from "./connection";
import { providerFetch, safeJson } from "./http";
import type { ConnectionTestResult, ProviderModel, TextGenerationInput, TextGenerationResult, TextProviderAdapter } from "./types";

type OpenRouterModelsResponse = { data?: Array<{ id?: string; name?: string }> };
type OpenRouterResponse = {
  id?: string;
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

export class OpenRouterAdapter implements TextProviderAdapter {
  readonly slug = "openrouter" as const;

  private headers(apiKey: string) {
    return {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://smart-content-orcin.vercel.app",
      "X-Title": "Smart Content by Aidin Ghassemi",
    };
  }

  async validateKey(apiKey: string): Promise<ConnectionTestResult> {
    try {
      await providerFetch("https://openrouter.ai/api/v1/key", { headers: this.headers(apiKey) }, 12_000);
      return { ok: true, code: "ok", message: "اتصال با موفقیت برقرار شد." };
    } catch (error) {
      return connectionFailure(error);
    }
  }

  async listModels(apiKey: string): Promise<ProviderModel[]> {
    const response = await providerFetch("https://openrouter.ai/api/v1/models", { headers: this.headers(apiKey) }, 20_000);
    const payload = await safeJson<OpenRouterModelsResponse>(response);
    return (payload.data ?? []).filter((model): model is { id: string; name?: string } => Boolean(model.id)).map((model) => ({ id: model.id, name: model.name ?? model.id, kind: "text" as const }));
  }

  async generateText(input: TextGenerationInput): Promise<TextGenerationResult> {
    const response = await providerFetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: this.headers(input.apiKey),
      body: JSON.stringify({
        model: input.model,
        messages: [{ role: "user", content: input.prompt }],
        temperature: input.temperature ?? 0.7,
        max_tokens: input.maxOutputTokens ?? 6_000,
      }),
      signal: input.signal,
    }, 55_000);
    const payload = await safeJson<OpenRouterResponse>(response);
    const text = payload.choices?.[0]?.message?.content ?? "";
    if (!text.trim()) throw new ProviderError("پاسخ متنی خالی بود.", "invalid_response", false);
    return {
      text,
      inputTokens: payload.usage?.prompt_tokens ?? 0,
      outputTokens: payload.usage?.completion_tokens ?? 0,
      providerRequestId: payload.id,
    };
  }
}
