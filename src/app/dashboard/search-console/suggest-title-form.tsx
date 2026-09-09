"use client";

import { useMemo, useState } from "react";
import { suggestTitlesAction } from "./actions";

type Property = { id: string; site_url: string };
type KeyOption = { connectionId: string; label: string; source: "system" | "user"; provider: { id: string; name: string } };
type Model = { provider_id: string; model_key: string; display_name: string };

export function SuggestTitleForm({ properties, keys, models }: { properties: Property[]; keys: KeyOption[]; models: Model[] }) {
  const [connectionId, setConnectionId] = useState(keys[0]?.connectionId ?? "");
  const providerId = keys.find((key) => key.connectionId === connectionId)?.provider.id;
  const availableModels = useMemo(() => models.filter((model) => model.provider_id === providerId), [models, providerId]);

  return <form action={suggestTitlesAction} className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
    <label className="grid gap-2 text-sm font-bold">سایت<select className="field" name="propertyId" required>{properties.map((property) => <option key={property.id} value={property.id}>{property.site_url}</option>)}</select></label>
    <label className="grid gap-2 text-sm font-bold">اتصال هوش مصنوعی<select className="field" name="connectionId" onChange={(event) => setConnectionId(event.target.value)} value={connectionId} required>{keys.map((key) => <option key={key.connectionId} value={key.connectionId}>{key.provider.name} · {key.source === "system" ? "سراسری سامانه" : key.label}</option>)}</select></label>
    <label className="grid gap-2 text-sm font-bold">مدل نگارش<select className="field" dir="ltr" key={connectionId} name="model" required>{availableModels.map((model) => <option key={model.model_key} value={model.model_key}>{model.display_name}</option>)}</select></label>
    <button className="primary-button self-end" disabled={!availableModels.length} type="submit">پیشنهاد عنوان</button>
  </form>;
}
