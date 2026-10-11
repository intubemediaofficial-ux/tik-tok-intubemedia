"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Coins, Gem, ArrowDownToLine, History, QrCode } from "lucide-react";
import { Sheet } from "@/components/ui";
import { ago, api, toast } from "@/lib/client";

type Pkg = { id: string; coins: number; bonus: number; priceInr: number };
type Row = { id: string; status: string; createdAt: string; coins?: number; amountInr: number; diamonds?: number; upiId?: string; note?: string | null; providerRef?: string | null };
type H = { id: string; at: string; text: string; amount: string };

declare global { interface Window { Razorpay?: new (o: Record<string, unknown>) => { open: () => void } } }

export function WalletClient(p: { coins: number; diamonds: number; packages: Pkg[]; purchases: Row[]; withdrawals: Row[]; history: H[]; upiId: string; upiName: string; inrPerDiamond: number; minWithdraw: number; razorpay: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<"recharge" | "withdraw" | "history">("recharge");
  const [pay, setPay] = useState<Pkg | null>(null);
  const [utr, setUtr] = useState("");
  const [amt, setAmt] = useState(p.minWithdraw);
  const [upi, setUpi] = useState("");
  const [busy, setBusy] = useState(false);

  async function buy(pkg: Pkg) {
    if (!p.razorpay) return setPay(pkg);
    try {
      const d = await api<{ keyId: string; orderId: string; amount: number }>("/api/wallet/purchase", { body: { packageId: pkg.id } });
      if (!window.Razorpay) await new Promise((r) => { const s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js"; s.onload = r; document.body.appendChild(s); });
      new window.Razorpay!({ key: d.keyId, order_id: d.orderId, amount: d.amount, currency: "INR", name: "Thirak coins", description: `${pkg.coins + pkg.bonus} coins`,
        handler: async (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          await api("/api/wallet/razorpay", { body: { orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature } });
          toast("Coins added!"); router.refresh();
        } }).open();
    } catch (e) { toast((e as Error).message); }
  }
  async function submitUtr() {
    if (!pay) return;
    setBusy(true);
    try { await api("/api/wallet/purchase", { body: { packageId: pay.id, utr } }); toast("Submitted! Coins will be added after verification."); setPay(null); setUtr(""); router.refresh(); }
    catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  }
  async function withdraw() {
    setBusy(true);
    try { const d = await api<{ amountInr: number }>("/api/wallet/withdraw", { body: { diamonds: amt, upiId: upi } }); toast(`Withdrawal of ₹${d.amountInr} requested`); router.refresh(); }
    catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  }
  const badge = (s: string) => <span className="chip" style={{ padding: "2px 10px", fontSize: 12, color: s === "PAID" ? "#7cf0b0" : s === "REJECTED" ? "#ff8fb1" : "#ffd27a" }}>{s === "PAID" ? "Completed" : s === "REJECTED" ? "Rejected" : "Pending"}</span>;
  const upiLink = pay ? `upi://pay?pa=${encodeURIComponent(p.upiId)}&pn=${encodeURIComponent(p.upiName)}&am=${pay.priceInr}&cu=INR&tn=${encodeURIComponent(`Thirak ${pay.coins + pay.bonus} coins`)}` : "";
  return (
    <div className="page page-narrow">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
        <div className="stat-card" style={{ background: "linear-gradient(135deg, #ffb02033, #ff3d7f1a)" }}><div className="row muted"><Coins size={18} color="var(--amber)" />Coins</div><div className="v">{p.coins.toLocaleString("en-IN")}</div><div className="muted" style={{ fontSize: 12 }}>Use coins to send gifts</div></div>
        <div className="stat-card" style={{ background: "linear-gradient(135deg, #7c5cff33, #5ad1ff1a)" }}><div className="row muted"><Gem size={18} color="#5ad1ff" />Diamonds</div><div className="v">{p.diamonds.toLocaleString("en-IN")}</div><div className="muted" style={{ fontSize: 12 }}>≈ ₹{(p.diamonds * p.inrPerDiamond).toFixed(2)} · earned from gifts</div></div>
      </div>
      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={`tab ${tab === "recharge" ? "on" : ""}`} onClick={() => setTab("recharge")}><Coins size={14} /> Recharge</button>
        <button className={`tab ${tab === "withdraw" ? "on" : ""}`} onClick={() => setTab("withdraw")}><ArrowDownToLine size={14} /> Withdraw</button>
        <button className={`tab ${tab === "history" ? "on" : ""}`} onClick={() => setTab("history")}><History size={14} /> History</button>
      </div>
      {tab === "recharge" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
            {p.packages.map((k) => (
              <button key={k.id} onClick={() => buy(k)} className="card" style={{ padding: 16, display: "grid", gap: 4, justifyItems: "center" }}>
                <Coins size={30} color="var(--amber)" /><b style={{ fontSize: 20 }}>{k.coins.toLocaleString("en-IN")}</b>
                {k.bonus > 0 && <span className="chip on" style={{ padding: "1px 8px", fontSize: 11 }}>+{k.bonus} bonus</span>}
                <span className="btn btn-sm btn-primary" style={{ marginTop: 6 }}>₹{k.priceInr}</span>
              </button>
            ))}
          </div>
          {p.purchases.length > 0 && <div className="card" style={{ padding: 14, marginTop: 16 }}><b>Recharges</b>{p.purchases.map((r) => <div key={r.id} className="row between" style={{ padding: "8px 0", borderBottom: "1px solid #221f33", fontSize: 14 }}><span>{r.coins} coins · ₹{r.amountInr}<div className="muted" style={{ fontSize: 12 }}>{ago(r.createdAt)}{r.note ? ` · ${r.note}` : ""}</div></span>{badge(r.status)}</div>)}</div>}
        </>
      )}
      {tab === "withdraw" && (
        <div className="card" style={{ padding: 18, display: "grid", gap: 12 }}>
          <p className="muted" style={{ margin: 0 }}>Convert diamonds to cash in your UPI account. 1 diamond = ₹{p.inrPerDiamond}. Minimum {p.minWithdraw} diamonds.</p>
          <label><span className="label">Diamonds</span><input className="input" type="number" min={p.minWithdraw} max={p.diamonds} value={amt} onChange={(e) => setAmt(Number(e.target.value))} /></label>
          <div className="muted">You get ₹{(amt * p.inrPerDiamond).toFixed(2)}</div>
          <label><span className="label">UPI ID</span><input className="input" value={upi} onChange={(e) => setUpi(e.target.value.trim())} placeholder="name@okbank" /></label>
          <button className="btn btn-primary" disabled={busy || amt < p.minWithdraw || amt > p.diamonds || !upi} onClick={withdraw}>Request withdrawal</button>
          {p.withdrawals.map((w) => <div key={w.id} className="row between" style={{ padding: "8px 0", borderTop: "1px solid #221f33", fontSize: 14 }}><span>{w.diamonds} 💎 → ₹{w.amountInr}<div className="muted" style={{ fontSize: 12 }}>{w.upiId} · {ago(w.createdAt)}{w.note ? ` · ${w.note}` : ""}</div></span>{badge(w.status)}</div>)}
        </div>
      )}
      {tab === "history" && (
        <div className="card" style={{ padding: "4px 14px" }}>
          {p.history.length === 0 ? <div className="muted" style={{ padding: 20, textAlign: "center" }}>No gift activity yet</div> : p.history.map((h) => <div key={h.id} className="row between" style={{ padding: "10px 0", borderBottom: "1px solid #221f33", fontSize: 14 }}><span>{h.text}<div className="muted" style={{ fontSize: 12 }}>{ago(h.at)}</div></span><b>{h.amount}</b></div>)}
        </div>
      )}
      {pay && (
        <Sheet title={`Pay ₹${pay.priceInr} for ${pay.coins + pay.bonus} coins`} onClose={() => setPay(null)}>
          <div style={{ display: "grid", gap: 12, justifyItems: "center", textAlign: "center" }}>
            {p.upiId ? (
              <>
                <img alt="UPI QR" width={200} height={200} style={{ background: "#fff", borderRadius: 16, padding: 8 }} src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiLink)}`} />
                <div><b>{p.upiName}</b><div className="muted">{p.upiId}</div></div>
                <a href={upiLink} className="btn"><QrCode size={16} />Open UPI app</a>
                <input className="input" placeholder="Enter UPI transaction ID (UTR) after paying" value={utr} onChange={(e) => setUtr(e.target.value.trim())} />
                <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy || utr.length < 6} onClick={submitUtr}>Submit payment</button>
              </>
            ) : <div className="muted">Payments are not configured yet. Please contact support.</div>}
          </div>
        </Sheet>
      )}
    </div>
  );
}
