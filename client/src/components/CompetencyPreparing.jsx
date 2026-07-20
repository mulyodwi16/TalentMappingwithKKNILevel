import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import api from "../api/client.js";
import { useLang } from "../lib/i18n.jsx";

// Layar tunggu saat kompetensi baru dipilih. Daftar unit ditarik dari data resmi SKKNI
// di latar belakang, dan sumbernya membatasi jumlah permintaan sehingga bisa memakan
// waktu sampai sekitar dua menit. Tanpa layar ini user masuk dashboard lebih dulu dan
// melihat Skill Gap, Kelas, serta Learning Path yang masih kosong.
//
// props:
//   docId    id dokumen SKKNI yang sedang disiapkan
//   title    nama kompetensi (untuk ditampilkan)
//   onReady  dipanggil sekali saat unit siap
//   onSkip   opsional: lanjut tanpa menunggu (tombol muncul setelah beberapa saat)
//   onPickOther opsional: dipanggil bila kompetensi ternyata tak punya rincian unit
export default function CompetencyPreparing({ docId, title, onReady, onSkip, onPickOther }) {
  const { t } = useLang();
  const [elapsed, setElapsed] = useState(0);
  const [retrying, setRetrying] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["skkni-prepare", docId],
    queryFn: () => api.get(`/skkni/prepare/${encodeURIComponent(docId)}`),
    enabled: !!docId,
    refetchInterval: (q) => (q.state.data?.ready || q.state.data?.error ? false : 3000),
  });

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const failed = !!data?.error;
  const empty = !!data?.empty;
  const ready = !!data?.ready && !empty;

  useEffect(() => { if (ready) onReady?.(data); }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  async function retry() {
    setRetrying(true);
    try {
      await api.post("/skkni/choose", { docId });
      await refetch();
    } catch { /* pesan gagal sudah tampil di kartu */ }
    finally { setRetrying(false); }
  }

  // Kompetensi tanpa rincian unit: menunggu lebih lama tak akan menolong.
  if (empty) {
    return (
      <Shell tone="warn" icon={<AlertTriangle className="w-6 h-6 text-amber-500" />} title={t("Kompetensi ini belum punya rincian skill")}>
        <p className="text-sm" style={{ color: "var(--text-3)" }}>
          {t("Data resmi SKKNI belum merinci unit untuk kompetensi ini, jadi Skill Gap dan Kelas tidak bisa dihitung. Silakan pilih kompetensi lain yang sudah lengkap.")}
        </p>
        <div className="flex flex-wrap gap-2 justify-center pt-1">
          {onPickOther && <button onClick={onPickOther} className="btn-primary text-sm">{t("Pilih kompetensi lain")}</button>}
          {onSkip && <button onClick={onSkip} className="btn-outline text-sm">{t("Lanjut saja")}</button>}
        </div>
      </Shell>
    );
  }

  if (failed) {
    return (
      <Shell tone="warn" icon={<AlertTriangle className="w-6 h-6 text-amber-500" />} title={t("Gagal menyiapkan kompetensi")}>
        <p className="text-sm" style={{ color: "var(--text-3)" }}>
          {t("Sumber data SKKNI sedang sibuk atau tidak bisa dihubungi. Kamu bisa mencoba lagi, atau lanjut dulu dan datanya akan menyusul.")}
        </p>
        <div className="flex flex-wrap gap-2 justify-center pt-1">
          <button onClick={retry} disabled={retrying} className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-60">
            {retrying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} {t("Coba lagi")}
          </button>
          {onSkip && <button onClick={onSkip} className="btn-outline text-sm">{t("Lanjut saja")}</button>}
        </div>
      </Shell>
    );
  }

  if (ready) {
    return (
      <Shell tone="ok" icon={<CheckCircle2 className="w-6 h-6 text-emerald-500" />} title={t("Kompetensi siap")}>
        <p className="text-sm" style={{ color: "var(--text-3)" }}>
          {t("{n} skill berhasil dipasang. Sebentar lagi kamu masuk.", { n: data?.unitCount || 0 })}
        </p>
      </Shell>
    );
  }

  return (
    <Shell icon={<Loader2 className="w-6 h-6 animate-spin text-brand-500" />} title={t("Menyiapkan kompetensimu")}>
      {title && <p className="text-sm font-semibold" style={{ color: "var(--text-base)" }}>{title}</p>}
      <p className="text-sm" style={{ color: "var(--text-3)" }}>
        {t("Kami sedang mengambil daftar skill dari data resmi SKKNI. Proses ini bisa sampai dua menit karena sumbernya membatasi jumlah permintaan.")}
      </p>
      <p className="text-xs" style={{ color: "var(--text-4)" }}>
        {t("Tunggu sebentar supaya Skill Gap, Kelas, dan Learning Path langsung terisi begitu kamu masuk.")}
      </p>
      {/* Bar tak tentu: durasinya tak bisa diprediksi, jadi jangan berpura-pura tahu persentasenya. */}
      <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "var(--bg-raised)" }}>
        <div className="h-full w-1/3 rounded-full bg-brand-500 prep-sweep" />
      </div>
      <p className="text-[11px]" style={{ color: "var(--text-4)" }}>{t("Berjalan {n} detik", { n: elapsed })}</p>
      {onSkip && elapsed >= 25 && (
        <button onClick={onSkip} className="text-xs hover:underline" style={{ color: "var(--text-4)" }}>
          {t("Lanjut saja, biar datanya menyusul")}
        </button>
      )}
    </Shell>
  );
}

function Shell({ icon, title, children }) {
  return (
    <div className="card p-6 text-center flex flex-col items-center gap-2.5">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "var(--bg-raised)" }}>{icon}</div>
      <h3 className="font-bold" style={{ color: "var(--text-base)" }}>{title}</h3>
      {children}
    </div>
  );
}
