import { ProviderError } from "./errors";
import { connectionFailure } from "./connection";
import { providerFetch, safeJson } from "./http";
import type {
  ConnectionTestResult,
  ImageGenerationInput,
  ImageGenerationResult,
  ImageProviderAdapter,
  ProviderModel,
  TextGenerationInput,
  TextGenerationResult,
  TextProviderAdapter,
} from "./types";

type OpenAIModelsResponse = { data?: Array<{ id?: string }> };
type OpenAIResponse = {
  id?: string;
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};
type OpenAIImageResponse = { id?: string; data?: Array<{ b64_json?: string }> };

export class OpenAIAdapter implements TextProviderAdapter, ImageProviderAdapter {
  readonly slug = "openai" as const;

  private headers(apiKey: string) {
    return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
  }

  async validateKey(apiKey: string): Promise<ConnectionTestResult> {
    try {
      await providerFetch("https://api.openai.com/v1/models", { headers: this.headers(apiKey) }, 12_000);
      return { ok: true, code: "ok", message: "اتصال با موفقیت برقرار شد." };
    } catch (error) {
      return connectionFailure(error);
    }
  }

  async listModels(apiKey: string): Promise<ProviderModel[]> {
    const response = await providerFetch("https://api.openai.com/v1/models", { headers: this.headers(apiKey) }, 15_000);
    const payload = await safeJson<OpenAIModelsResponse>(response);
    return (payload.data ?? [])
      .filter((model): model is { id: string } => Boolean(model.id?.startsWith("gpt-")))
      .map((model) => ({ id: model.id, name: model.id, kind: "text" as const }));
  }

  async generateText(input: TextGenerationInput): Promise<TextGenerationResult> {
    const response = await providerFetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: this.headers(input.apiKey),
      body: JSON.stringify({
        model: input.model,
        input: input.prompt,
        max_output_tokens: input.maxOutputTokens ?? 6_000,
      }),
      signal: input.signal,
    }, 55_000);
    const payload = await safeJson<OpenAIResponse>(response);
    const text = payload.output_text ?? payload.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("") ?? "";
    if (!text.trim()) throw new ProviderError("پاسخ متنی خالی بود.", "invalid_response", false);
    return {
      text,
      inputTokens: payload.usage?.input_tokens ?? 0,
      outputTokens: payload.usage?.output_tokens ?? 0,
      providerRequestId: payload.id,
    };
  }

  async generateImage(input: ImageGenerationInput): Promise<ImageGenerationResult> {
    const response = await providerFetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: this.headers(input.apiKey),
      body: JSON.stringify({
        model: input.model,
        prompt: input.prompt,
        size: input.size ?? (input.aspectRatio === "16:9" ? "1536x1024" : input.aspectRatio === "9:16" ? "1024x1536" : "1024x1024"),
        n: 1,
        output_format: "png",
      }),
      signal: input.signal,
    }, 55_000);
    const payload = await safeJson<OpenAIImageResponse>(response);
    const encoded = payload.data?.[0]?.b64_json;
    if (!encoded) throw new ProviderError("تصویر معتبری دریافت نشد.", "invalid_response", false);
    return { bytes: Buffer.from(encoded, "base64"), mimeType: "image/png", providerRequestId: payload.id };
  }
}
