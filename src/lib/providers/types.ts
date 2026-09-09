export type ProviderSlug = "openai" | "google-gemini" | "openrouter";

export type ProviderModel = {
  id: string;
  name: string;
  kind: "text" | "image" | "multimodal";
};

export type ConnectionTestResult = {
  ok: boolean;
  code: "ok" | "invalid_key" | "rate_limited" | "unavailable" | "unexpected";
  message: string;
};

export type TextGenerationInput = {
  apiKey: string;
  model: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
};

export type TextGenerationResult = {
  text: string;
  inputTokens: number;
  outputTokens: number;
  providerRequestId?: string;
};

export type ImageGenerationInput = {
  apiKey: string;
  model: string;
  prompt: string;
  aspectRatio: string;
  size?: string;
  signal?: AbortSignal;
};

export type ImageGenerationResult = {
  bytes: Uint8Array;
  mimeType: string;
  providerRequestId?: string;
};

export interface TextProviderAdapter {
  readonly slug: ProviderSlug;
  validateKey(apiKey: string): Promise<ConnectionTestResult>;
  listModels(apiKey: string): Promise<ProviderModel[]>;
  generateText(input: TextGenerationInput): Promise<TextGenerationResult>;
}

export interface ImageProviderAdapter {
  readonly slug: ProviderSlug;
  generateImage(input: ImageGenerationInput): Promise<ImageGenerationResult>;
}
