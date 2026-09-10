import assert from "node:assert/strict";
import test from "node:test";
import { selectDefaultTextModel } from "./model-selection.ts";

test("مدل فعال و فعلی جیمینی به اتصال قفل می‌شود", () => {
  const selected = selectDefaultTextModel("google-gemini", [
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", kind: "multimodal" },
    { id: "gemini-3.6-flash", name: "Gemini 3.6 Flash", kind: "multimodal" },
  ]);
  assert.equal(selected?.id, "gemini-3.6-flash");
});

test("مدل تصویری به‌عنوان مدل نگارش انتخاب نمی‌شود", () => {
  const selected = selectDefaultTextModel("openai", [
    { id: "gpt-image-1", name: "مدل تصویر", kind: "image" },
    { id: "gpt-5", name: "مدل متن", kind: "text" },
  ]);
  assert.equal(selected?.id, "gpt-5");
});
