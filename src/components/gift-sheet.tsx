"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Coins } from "lucide-react";
import { Sheet } from "@/components/ui";
import { api, toast } from "@/lib/client";

type Gift = { id: string; name: string; emoji: string; coins: number };

export function GiftSheet({ videoId, liveId, onClose, onSent }: { videoId?: string; liveId?: string; onClose: () => void; onSent?: (g: Gift, qty: number) => void }) {
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [coins, setCoins] = useState(0);
  const [pick, setPick] = useState<Gift | null>(null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api<{ gifts: Gift[]; coins: number }>("/api/gifts").then((d) => { setGifts(d.gifts); setCoins(d.coins); }).catch(() => {}); }, []);

  async function send() {
    if (!pick) return;
    setBusy(true);
    try {
      const d = await api<{ coins: number }>("/api/gifts", { body: { giftId: pick.id, quantity: qty, videoId, liveId } });
      setCoins(d.coins); onSent?.(pick, qty); toast(`Sent ${qty}× ${pick.emoji} ${pick.name}`);
      if (!liveId) onClose();
    } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <Sheet title="Send a gift" onClose={onClose} footer={
      <div className="row between">
        <Link href="/wallet" className="chip"><Coins size={15} color="var(--amber)" />{coins} coins · Recharge</Link>
        <div className="row">
          <select className="input" style={{ width: 76, height: 42 }} value={qty} onChange={(e) => setQty(Number(e.target.value))}>{[1, 5, 10, 25, 99].map((n) => <option key={n} value={n}>×{n}</option>)}</select>
          <button className="btn btn-primary" disabled={!pick || busy} onClick={send}>Send{pick ? ` · ${pick.coins * qty}` : ""}</button>
        </div>
      </div>
    }>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {gifts.map((g) => (
          <button key={g.id} onClick={() => setPick(g)} className="card" style={{ padding: "12px 4px", display: "grid", justifyItems: "center", gap: 4, borderColor: pick?.id === g.id ? "var(--amber)" : undefined, background: pick?.id === g.id ? "#ffb02014" : undefined }}>
            <span style={{ fontSize: 34 }}>{g.emoji}</span>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{g.name}</span>
            <span className="row" style={{ gap: 3, fontSize: 11, color: "#ffd27a" }}><Coins size={11} />{g.coins}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
