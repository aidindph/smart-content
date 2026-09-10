"use client";

import { useMemo, useState } from "react";
import { suggestTitlesAction } from "./actions";

type Property = { id: string; site_url: string };
type KeyOption = { connectionId: string; label: string; source: "system" | "user"; provider: { id: string; name: string }; default_text_model: string | null };

export function SuggestTitleForm({ properties, keys }: { properties: Property[]; keys: KeyOption[] }) {
  const [connectionId, setConnectionId] = useState(keys[0]?.connectionId ?? "");
  const selectedKey = useMemo(() => keys.find((key) => key.connectionId === connectionId), [keys, connectionId]);

  return <form action={suggestTitlesAction} className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
    <label className="grid gap-2 text-sm font-bold">سایت<select className="field" name="propertyId" required>{properties.map((property) => <option key={property.id} value={property.id}>{property.site_url}</option>)}</select></label>
    <label className="grid gap-2 text-sm font-bold">اتصال هوش مصنوعی<select className="field" name="connectionId" onChange={(event) => setConnectionId(event.target.value)} value={connectionId} required>{keys.map((key) => <option key={key.connectionId} value={key.connectionId}>{key.provider.name} · {key.source === "system" ? "سراسری سامانه" : key.label}</option>)}</select></label>
    <div className="grid gap-2 text-sm font-bold"><span>مدل نگارش</span><div className="field flex items-center bg-surface-subtle text-muted" dir="ltr">{selectedKey?.default_text_model}</div></div>
    <button className="primary-button self-end" disabled={!selectedKey?.default_text_model} type="submit">پیشنهاد عنوان</button>
  </form>;
}
