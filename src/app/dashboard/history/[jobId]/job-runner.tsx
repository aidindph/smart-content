"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function JobRunner({ jobId, status }: { jobId: string; status: string }) {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (status !== "queued" && status !== "running") return;
    const kick = () => {
      if (started.current) return;
      started.current = true;
      void fetch("/api/generation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      }).finally(() => { started.current = false; router.refresh(); });
    };
    kick();
    const refreshInterval = window.setInterval(() => router.refresh(), 2500);
    const recoveryInterval = window.setInterval(kick, 30000);
    return () => { window.clearInterval(refreshInterval); window.clearInterval(recoveryInterval); };
  }, [jobId, router, status]);

  return null;
}
