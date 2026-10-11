"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, toast } from "@/lib/client";

export function InboxClient() {
  const router = useRouter();
  useEffect(() => {
    api("/api/notifications", { body: {} }).catch(() => {});
    const on = (e: Event) => { if ((e as CustomEvent<{ type: string }>).detail.type === "notification") router.refresh(); };
    window.addEventListener("app-event", on);
    return () => window.removeEventListener("app-event", on);
  }, [router]);
  return null;
}

export function RequestButtons({ userId }: { userId: string }) {
  const [done, setDone] = useState<string | null>(null);
  async function act(accept: boolean) {
    try {
      await api(`/api/follow-requests/${userId}`, { body: { accept } });
      setDone(accept ? "Accepted" : "Removed");
    } catch (e) { toast((e as Error).message); }
  }
  if (done) return <span className="muted" style={{ fontSize: 13 }}>{done}</span>;
  return (
    <div className="row" style={{ gap: 6 }}>
      <button className="btn btn-sm btn-primary" onClick={() => act(true)}>Confirm</button>
      <button className="btn btn-sm" onClick={() => act(false)}>Delete</button>
    </div>
  );
}
