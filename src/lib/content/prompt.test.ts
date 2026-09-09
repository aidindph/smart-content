import assert from "node:assert/strict";
import test from "node:test";
import { buildArticlePrompt, extractArticleTitle } from "./prompt.ts";

test("پرامپت همهٔ محدودیت‌های درخواست را نگه می‌دارد", () => {
  const prompt = buildArticlePrompt({ topic: "بازاریابی محتوایی", keywords: ["سئو", "محتوا"], language: "fa", audience: "مدیران", tone: "professional", targetWords: 1200 });
  assert.match(prompt, /بازاریابی محتوایی/);
  assert.match(prompt, /۱۲۰۰|1200/);
  assert.match(prompt, /سئو، محتوا/);
});

test("عنوان نخست مارک‌داون استخراج می‌شود", () => {
  assert.equal(extractArticleTitle("# عنوان اصلی\n\nمتن", "جایگزین"), "عنوان اصلی");
  assert.equal(extractArticleTitle("متن بدون عنوان", "جایگزین"), "جایگزین");
});
