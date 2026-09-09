import { GeminiAdapter } from "./gemini";
import { OpenAIAdapter } from "./openai";
import { OpenRouterAdapter } from "./openrouter";
import type { ImageProviderAdapter, ProviderSlug, TextProviderAdapter } from "./types";

const openai = new OpenAIAdapter();
const gemini = new GeminiAdapter();
const openrouter = new OpenRouterAdapter();

const textAdapters: Record<ProviderSlug, TextProviderAdapter> = {
  openai,
  "google-gemini": gemini,
  openrouter,
};

const imageAdapters: Partial<Record<ProviderSlug, ImageProviderAdapter>> = {
  openai,
  "google-gemini": gemini,
};

export function getTextProviderAdapter(slug: string) {
  const adapter = textAdapters[slug as ProviderSlug];
  if (!adapter) throw new Error("ارائه‌دهندهٔ متنی پشتیبانی نمی‌شود.");
  return adapter;
}

export function getImageProviderAdapter(slug: string) {
  const adapter = imageAdapters[slug as ProviderSlug];
  if (!adapter) throw new Error("ارائه‌دهندهٔ تصویر پشتیبانی نمی‌شود.");
  return adapter;
}

export function getProviderAdapter(slug: string) {
  return getTextProviderAdapter(slug);
}
