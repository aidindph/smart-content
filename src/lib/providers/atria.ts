import { ProviderError } from "./errors";
import { connectionFailure } from "./connection";
import { providerFetch, safeJson } from "./http";
import type { ConnectionTestResult, ProviderModel, TextGenerationInput, TextGenerationResult, TextProviderAdapter } from "./types";

const model = { id: "Atria-Dawn-Preview", name: "Atria Dawn Preview", kind: "text" as const };

type AtriaResponse = {
  id?: string;
  choices?: Array<{ message?: { content?: string | Array<{ text?: string }>; reasoning_content?: string }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

type AtriaMessageContent = string | Array<{ text?: string }> | undefined;

function contentText(content: AtriaMessageContent) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => part.text ?? "").join("");
  return "";
}

export class AtriaAdapter implements TextProviderAdapter {
  readonly slug = "atria" as const;

  private headers(apiKey: string) {
    return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
  }

  async validateKey(apiKey: string): Promise<ConnectionTestResult> {
    try {
      const response = await providerFetch("https://api.atria-asi.ai/v1/chat/completions", {
        method: "POST",
        headers: this.headers(apiKey),
        body: JSON.stringify({ model: model.id, messages: [{ role: "user", content: "Reply with OK only." }], max_completion_tokens: 64 }),
      }, 20_000);
      const payload = await safeJson<AtriaResponse>(response);
      if (!contentText(payload.choices?.[0]?.message?.content).trim()) throw new ProviderError("پاسخ آزمایشی آتریا خالی بود.", "invalid_response", false);
      return { ok: true, code: "ok", message: "اتصال با موفقیت برقرار شد." };
    } catch (error) {
      return connectionFailure(error);
    }
  }

  async listModels(_apiKey: string): Promise<ProviderModel[]> {
    return [model];
  }

  async generateText(input: TextGenerationInput): Promise<TextGenerationResult> {
    if (input.model !== model.id) throw new ProviderError("مدل انتخاب‌شدهٔ آتریا پشتیبانی نمی‌شود.", "unsupported", false);
    const generate = async (maxOutputTokens: number) => {
      const response = await providerFetch("https://api.atria-asi.ai/v1/chat/completions", {
        method: "POST",
        headers: this.headers(input.apiKey),
        body: JSON.stringify({
          model: input.model,
          messages: [{ role: "user", content: input.prompt }],
          temperature: input.temperature ?? 0.7,
          max_completion_tokens: maxOutputTokens,
        }),
        signal: input.signal,
      }, maxOutputTokens <= 400 ? 30_000 : 240_000);
      return safeJson<AtriaResponse>(response);
    };

    const requestedLimit = input.maxOutputTokens ?? 6_000;
    let payload = await generate(requestedLimit);
    let choice = payload.choices?.[0];
    let text = contentText(choice?.message?.content);

    // آتریا ممکن است سقف خروجی را ابتدا برای پردازش داخلی مصرف کند و هنوز متن نهایی نداده باشد.
    // در این حالت یک‌بار با فضای کافی برای پردازش و مقاله دوباره تلاش می‌کنیم.
    if (!text.trim() && choice?.message?.reasoning_content?.trim()) {
      payload = await generate(Math.min(16_000, Math.max(4_000, requestedLimit * 3)));
      choice = payload.choices?.[0];
      text = contentText(choice?.message?.content);
    }

    if (!text.trim()) throw new ProviderError("آتریا پس از پردازش، متن قابل‌نمایش تولید نکرد. لطفاً دوباره اجرا کنید.", "invalid_response", true);
    await input.onTextDelta?.(text);
    return {
      text,
      inputTokens: payload.usage?.prompt_tokens ?? 0,
      outputTokens: payload.usage?.completion_tokens ?? 0,
      providerRequestId: payload.id,
      finishReason: choice?.finish_reason,
    };
  }
}
