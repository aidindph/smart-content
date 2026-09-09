import assert from "node:assert/strict";
import test from "node:test";
import { analyzeSeo, markdownToArticleHtml } from "./article-output.ts";
import { buildArticlePrompt, extractArticleTitle } from "./prompt.ts";

test("پرامپت همهٔ محدودیت‌های درخواست را نگه می‌دارد", () => {
  const prompt = buildArticlePrompt({ topic: "بازاریابی محتوایی", keywords: ["سئو", "محتوا"], language: "fa", audience: "مدیران", tone: "professional", targetWords: 1200 });
  assert.match(prompt, /بازاریابی محتوایی/);
  assert.match(prompt, /۱۲۰۰|1200/);
  assert.match(prompt, /سئو \(هدف تقریبی 1٪/);
  assert.match(prompt, /محتوا \(هدف تقریبی 1٪/);
});

test("خروجی اچ‌تی‌ام‌ال معنایی و امن ساخته می‌شود", () => {
  const html = markdownToArticleHtml("# عنوان\n\nمتن **مهم** <script>alert(1)</script>\n\n- مورد", "fa");
  assert.match(html, /<article lang="fa" dir="rtl">/);
  assert.match(html, /<strong>مهم<\/strong>/);
  assert.doesNotMatch(html, /<script>/);
});

test("گزارش سئو چگالی واقعی کلیدواژه را محاسبه می‌کند", () => {
  const report = analyzeSeo("# سئو\n\nسئو برای محتوای خوب مفید است.\n\n## راهنما\n\nمتن تکمیلی", [{ keyword: "سئو", density: 1 }], 10);
  assert.equal(report.keywords[0].count, 2);
  assert.ok(report.score >= 0 && report.score <= 100);
});

test("عنوان نخست مارک‌داون استخراج می‌شود", () => {
  assert.equal(extractArticleTitle("# عنوان اصلی\n\nمتن", "جایگزین"), "عنوان اصلی");
  assert.equal(extractArticleTitle("متن بدون عنوان", "جایگزین"), "جایگزین");
});
