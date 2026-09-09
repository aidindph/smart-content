"use client";

import { useState } from "react";

export function CopyButton({ value, label = "کپی" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return <button className="secondary-button text-sm" onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }} type="button">{copied ? "کپی شد ✓" : label}</button>;
}
