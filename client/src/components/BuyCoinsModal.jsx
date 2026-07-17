import { useEffect, useState } from "react";
import {
  Coins, X, Loader2, CheckCircle2, ArrowLeft, ShieldCheck,
  QrCode, Wallet, Landmark, CreditCard,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../api/client.js";
import { useLang } from "../lib/i18n.jsx";

// SIMULASI beli koin (demo — tanpa payment gateway asli). Koin benar-benar bertambah lewat
// POST /coins/purchase, tercatat di buku besar. Ditandai jelas sebagai simulasi.

const rupiah = (n) => "Rp " + new Intl.NumberFormat("id-ID").format(n || 0);

const METHODS = [
  { id: "qris", label: "QRIS", Icon: QrCode },
  { id: "gopay", label: "GoPay", Icon: Wallet },
  { id: "ovo", label: "OVO", Icon: Wallet },
  { id: "dana", label: "DANA", Icon: Wallet },
  { id: "bank", label: "Transfer Bank", Icon: Landmark },
  { id: "card", label: "Kartu Kredit/Debit", Icon: CreditCard },
];

// Pola dekoratif mirip QR (BUKAN kode asli) — hanya untuk tampilan simulasi.
function FakeQr() {
  const cells = [];
  for (let i = 0; i < 169; i++) {
    const r = (i * 73 + ((i % 13) * (i % 7)) * 17) % 100; // pseudo-acak deterministik
    if (r > 48) cells.push(i);
  }
  return (
    <svg viewBox="0 0 13 13" className="w-40 h-40" shapeRendering="crispEdges" role="img" aria-label="QRIS">
      <rect width="13" height="13" fill="#ffffff" />
      {cells.map((i) => <rect key={i} x={i % 13} y={Math.floor(i / 13)} width="1" height="1" fill="#0f2a52" />)}
      {[[0, 0], [8, 0], [0, 8]].map(([x, y], k) => (
        <g key={k}>
          <rect x={x} y={y} width="5" height="5" fill="#0f2a52" />
          <rect x={x + 1} y={y + 1} width="3" height="3" fill="#ffffff" />
          <rect x={x + 2} y={y + 2} width="1" height="1" fill="#0f2a52" />
        </g>
      ))}
    </svg>
  );
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function BuyCoinsModal({ open, onClose, onSuccess }) {
  const { t } = useLang();
  const [packages, setPackages] = useState(null);
  const [step, setStep] = useState("choose"); // choose | pay | processing | success
  const [pkg, setPkg] = useState(null);
  const [method, setMethod] = useState("qris");
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!open) return;
    setStep("choose"); setPkg(null); setMethod("qris"); setResult(null);
    api.get("/coins/packages").then((d) => setPackages(d.packages || [])).catch(() => setPackages([]));
  }, [open]);

  // Kunci scroll latar saat modal terbuka.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const total = pkg ? pkg.coins + pkg.bonus : 0;

  async function pay() {
    setStep("processing");
    try {
      await sleep(1600); // simulasikan proses pembayaran
      const d = await api.post("/coins/purchase", { packageId: pkg.id, method });
      setResult(d);
      setStep("success");
      if (typeof d.balance === "number") onSuccess?.(d.balance);
    } catch (e) {
      setStep("pay");
      toast.error(typeof e === "string" ? e : t("Gagal memproses pembayaran"));
    }
  }

  return (
    <div className="is-modal fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={step === "processing" ? undefined : onClose} />
      <div className="relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>

        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-5 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white shrink-0">
          <div className="flex items-center gap-2">
            {step === "pay" && (
              <button onClick={() => setStep("choose")} className="hover:bg-white/20 rounded-lg p-1 -ml-1" aria-label={t("Kembali")}>
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <Coins className="w-5 h-5" />
            <h3 className="font-bold text-white">{t("Beli Koin")}</h3>
          </div>
          {step !== "processing" && (
            <button onClick={onClose} className="hover:bg-white/20 rounded-lg p-1" aria-label={t("Tutup")}><X className="w-5 h-5" /></button>
          )}
        </div>

        <div className="p-5 overflow-y-auto">
          {/* Banner simulasi */}
          <div className="flex items-start gap-2 rounded-lg px-3 py-2 mb-4 text-[11px]" style={{ background: "var(--bg-raised)", color: "var(--text-4)" }}>
            <ShieldCheck className="w-4 h-4 shrink-0 mt-px text-emerald-500" />
            <span>{t("Simulasi pembayaran untuk demo — tidak ada transaksi uang sungguhan.")}</span>
          </div>

          {/* STEP 1: pilih paket */}
          {step === "choose" && (
            <>
              <p className="text-sm mb-3" style={{ color: "var(--text-3)" }}>{t("Pilih paket koin yang kamu butuhkan.")}</p>
              {!packages ? (
                <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-500" /></div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {packages.map((p) => (
                    <button key={p.id} onClick={() => { setPkg(p); setStep("pay"); }}
                      className="relative text-left rounded-xl p-4 transition-all hover:-translate-y-0.5"
                      style={{ background: "var(--bg-raised)", border: p.popular ? "1.5px solid #f59e0b" : "1px solid var(--border)" }}>
                      {p.popular && <span className="absolute -top-2 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white">{t("Paling Laris")}</span>}
                      <div className="flex items-center gap-1.5 text-amber-500 mb-1">
                        <Coins className="w-5 h-5" />
                        <span className="text-2xl font-black font-mono" style={{ color: "var(--text-base)" }}>{p.coins}</span>
                      </div>
                      {p.bonus > 0 && <p className="text-[11px] font-semibold text-emerald-500 mb-1">+{p.bonus} {t("bonus")}</p>}
                      <p className="text-sm font-bold mt-1" style={{ color: "var(--text-base)" }}>{rupiah(p.price)}</p>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* STEP 2: bayar */}
          {step === "pay" && pkg && (
            <>
              {/* Ringkasan */}
              <div className="rounded-xl p-4 mb-4" style={{ background: "var(--bg-raised)" }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-4)" }}>{t("Ringkasan Pesanan")}</p>
                <div className="flex items-center justify-between text-sm mb-1" style={{ color: "var(--text-3)" }}>
                  <span>{t("Paket")} {pkg.label}</span>
                  <span className="font-mono">{pkg.coins} {t("Koin")}</span>
                </div>
                {pkg.bonus > 0 && (
                  <div className="flex items-center justify-between text-sm mb-1 text-emerald-500">
                    <span>{t("Bonus")}</span><span className="font-mono">+{pkg.bonus}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm pt-2 mt-1 border-t" style={{ borderColor: "var(--border)", color: "var(--text-base)" }}>
                  <span className="font-semibold flex items-center gap-1"><Coins className="w-4 h-4 text-amber-500" /> {t("Total Koin")}</span>
                  <span className="font-mono font-bold text-amber-500">{total}</span>
                </div>
              </div>

              {/* Metode pembayaran */}
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-4)" }}>{t("Metode Pembayaran")}</p>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {METHODS.map((m) => (
                  <button key={m.id} onClick={() => setMethod(m.id)}
                    className="flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 text-[11px] font-medium transition-colors"
                    style={{
                      background: method === m.id ? "rgb(var(--brand-600) / 0.12)" : "var(--bg-raised)",
                      border: method === m.id ? "1.5px solid rgb(var(--brand-600))" : "1px solid var(--border)",
                      color: method === m.id ? "rgb(var(--brand-600))" : "var(--text-3)",
                    }}>
                    <m.Icon className="w-4 h-4" /> {t(m.label)}
                  </button>
                ))}
              </div>

              {/* QRIS preview bila metode qris */}
              {method === "qris" && (
                <div className="flex flex-col items-center gap-2 rounded-xl p-4 mb-4" style={{ background: "#ffffff", border: "1px solid var(--border)" }}>
                  <FakeQr />
                  <p className="text-[11px] text-center" style={{ color: "#6b7280" }}>{t("Scan QRIS dengan aplikasi e-wallet / m-banking-mu.")}</p>
                </div>
              )}

              <button onClick={pay} className="btn-primary w-full flex items-center justify-center gap-2">
                <ShieldCheck className="w-4 h-4" /> {t("Bayar {amount}", { amount: rupiah(pkg.price) })}
              </button>
            </>
          )}

          {/* STEP 3: memproses */}
          {step === "processing" && (
            <div className="py-12 text-center">
              <Loader2 className="w-10 h-10 animate-spin mx-auto text-amber-500 mb-4" />
              <p className="font-semibold" style={{ color: "var(--text-base)" }}>{t("Memproses pembayaran…")}</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-4)" }}>{rupiah(pkg?.price)} · {t(METHODS.find((m) => m.id === method)?.label || "QRIS")}</p>
            </div>
          )}

          {/* STEP 4: sukses */}
          {step === "success" && result && (
            <div className="py-8 text-center">
              <div className="w-16 h-16 rounded-full grid place-items-center mx-auto mb-4 bg-emerald-500/15">
                <CheckCircle2 className="w-9 h-9 text-emerald-500" />
              </div>
              <p className="text-lg font-bold mb-1" style={{ color: "var(--text-base)" }}>{t("Pembayaran Berhasil!")}</p>
              <p className="text-sm mb-2" style={{ color: "var(--text-3)" }}>
                {t("{n} Koin telah ditambahkan ke dompetmu.", { n: result.credited })}
              </p>
              <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-5 bg-amber-500/10">
                <Coins className="w-4 h-4 text-amber-500" />
                <span className="text-sm" style={{ color: "var(--text-4)" }}>{t("Saldo sekarang:")}</span>
                <span className="font-mono font-bold text-amber-500">{result.balance}</span>
              </div>
              <p className="text-[11px] mb-4 font-mono" style={{ color: "var(--text-4)" }}>{result.orderId}</p>
              <button onClick={onClose} className="btn-primary w-full">{t("Selesai")}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
