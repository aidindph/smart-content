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

type GeminiModelsResponse = { models?: Array<{ name?: string; displayName?: string; supportedGenerationMethods?: string[] }> };
type GeminiResponse = {
  responseId?: string;
  candidates?: Array<{ content?: { parts?: Array<{ text?: string; inlineData?: { data?: string; mimeType?: string } }> } }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
};

export class GeminiAdapter implements TextProviderAdapter, ImageProviderAdapter {
  readonly slug = "google-gemini" as const;

  private headers(apiKey: string) {
    return { "x-goog-api-key": apiKey, "Content-Type": "application/json" };
  }

  async validateKey(apiKey: string): Promise<ConnectionTestResult> {
    try {
      await providerFetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", { headers: this.headers(apiKey) }, 12_000);
      return { ok: true, code: "ok", message: "اتصال با موفقیت برقرار شد." };
    } catch (error) {
      return connectionFailure(error);
    }
  }

  async listModels(apiKey: string): Promise<ProviderModel[]> {
    const response = await providerFetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=100", { headers: this.headers(apiKey) }, 15_000);
    const payload = await safeJson<GeminiModelsResponse>(response);
    return (payload.models ?? [])
      .filter((model) => model.name && model.supportedGenerationMethods?.includes("generateContent"))
      .map((model) => ({ id: model.name!.replace(/^models\//, ""), name: model.displayName ?? model.name!, kind: "multimodal" as const }));
  }

  async generateText(input: TextGenerationInput): Promise<TextGenerationResult> {
    const model = encodeURIComponent(input.model.replace(/^models\//, ""));
    const response = await providerFetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: this.headers(input.apiKey),
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: input.prompt }] }],
        generationConfig: {
          temperature: input.temperature ?? 0.7,
          maxOutputTokens: input.maxOutputTokens ?? 6_000,
        },
      }),
      signal: input.signal,
    }, 55_000);
    const payload = await safeJson<GeminiResponse>(response);
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    if (!text.trim()) throw new ProviderError("پاسخ متنی خالی بود.", "invalid_response", false);
    return {
      text,
      inputTokens: payload.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: payload.usageMetadata?.candidatesTokenCount ?? 0,
      providerRequestId: payload.responseId,
    };
  }

  async generateImage(input: ImageGenerationInput): Promise<ImageGenerationResult> {
    const model = encodeURIComponent(input.model.replace(/^models\//, ""));
    const response = await providerFetch(`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`, {
      method: "POST",
      headers: this.headers(input.apiKey),
      body: JSON.stringify({
        contents: [{ parts: [{ text: input.prompt }] }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          responseFormat: { image: { aspectRatio: input.aspectRatio, imageSize: input.size ?? "1K" } },
        },
      }),
      signal: input.signal,
    }, 55_000);
    const payload = await safeJson<GeminiResponse>(response);
    const image = payload.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData;
    if (!image?.data) throw new ProviderError("تصویر معتبری دریافت نشد.", "invalid_response", false);
    return { bytes: Buffer.from(image.data, "base64"), mimeType: image.mimeType ?? "image/png", providerRequestId: payload.responseId };
  }
}
