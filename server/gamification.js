import { prisma } from "./prisma.js";

// Pusat logika gamifikasi "Koin Talenta": dompet, buku besar, reward sekali-bayar (idempoten),
// dan login harian berantai (streak). Semua fungsi defensif — gamifikasi tak boleh memblok alur inti.

// Besaran reward (bisa disesuaikan).
export const COIN = {
  dailyBase: 20,        // klaim login harian (dasar)
  dailyStreakBonus: 5,  // +5 per hari beruntun
  dailyStreakCap: 7,    // bonus streak maksimum 7 hari
  exam: 30,             // menyelesaikan satu ujian kompetensi
  cvMap: 25,            // memetakan CV → jenjang KKNI (sekali)
  courseStart: 20,      // mulai/ikuti sebuah kursus AvatarEdu (sekali per kursus)
  mentorDaily: 10,      // bertanya ke AI Mentor (sekali per hari)
  missionClaim: 40,     // klaim bonus setelah semua misi harian selesai
  quizDone: 15,         // menyelesaikan Course Harian (kuis)
};

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}
function yesterdayStr() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Pastikan dompet ada; kembalikan barisnya.
export async function getWallet(userId) {
  try {
    return await prisma.coinWallet.upsert({
      where: { userId },
      update: {},
      create: { userId, balance: 0, streak: 0 },
    });
  } catch {
    return { userId, balance: 0, streak: 0, lastClaim: null };
  }
}

export async function getBalance(userId) {
  const w = await getWallet(userId);
  return w?.balance ?? 0;
}

// Catat transaksi + sesuaikan saldo (clamp >= 0). amount bertanda (+ earn / - spend).
export async function award(userId, amount, reason, ref) {
  try {
    await prisma.coinTransaction.create({
      data: { userId, amount, reason, refType: ref?.type ?? null, refId: ref?.id ?? null },
    });
    const w = await getWallet(userId);
    const next = Math.max(0, (w.balance ?? 0) + amount);
    const u = await prisma.coinWallet.update({ where: { userId }, data: { balance: next } });
    return { balance: u.balance, awarded: amount };
  } catch (e) {
    return { balance: await getBalance(userId), awarded: 0, error: e.message };
  }
}

// Reward sekali-bayar: hanya diberikan bila (user, refType, refId) belum pernah tercatat.
export async function awardOnce(userId, amount, reason, ref) {
  try {
    const exists = await prisma.coinTransaction.findFirst({
      where: { userId, refType: ref.type, refId: ref.id },
      select: { id: true },
    });
    if (exists) return { balance: await getBalance(userId), awarded: 0, already: true };
    const r = await award(userId, amount, reason, ref);
    return { ...r, already: false };
  } catch {
    return { balance: await getBalance(userId), awarded: 0, already: true };
  }
}

export async function recentTransactions(userId, limit = 25) {
  try {
    return await prisma.coinTransaction.findMany({
      where: { userId }, orderBy: { createdAt: "desc" }, take: limit,
    });
  } catch {
    return [];
  }
}

// Status login harian: apakah sudah klaim hari ini + streak berjalan.
export async function getDailyStatus(userId) {
  const w = await getWallet(userId);
  const claimedToday = w.lastClaim === todayStr();
  return {
    claimedToday,
    streak: w.streak ?? 0,
    balance: w.balance ?? 0,
    nextReward: COIN.dailyBase + Math.min((claimedToday ? w.streak : (w.streak ?? 0) + 1), COIN.dailyStreakCap) * COIN.dailyStreakBonus,
  };
}

// Klaim login harian. Streak bertambah bila kemarin klaim; reset ke 1 bila bolong.
export async function claimDaily(userId) {
  const w = await getWallet(userId);
  const today = todayStr();
  if (w.lastClaim === today) {
    return { already: true, awarded: 0, balance: w.balance ?? 0, streak: w.streak ?? 0 };
  }
  const streak = w.lastClaim === yesterdayStr() ? (w.streak ?? 0) + 1 : 1;
  const reward = COIN.dailyBase + Math.min(streak, COIN.dailyStreakCap) * COIN.dailyStreakBonus;

  try {
    await prisma.coinTransaction.create({
      data: { userId, amount: reward, reason: `Login harian (streak ${streak})`, refType: "daily", refId: today },
    });
    const u = await prisma.coinWallet.update({
      where: { userId },
      data: { balance: Math.max(0, (w.balance ?? 0) + reward), streak, lastClaim: today },
    });
    return { already: false, awarded: reward, balance: u.balance, streak };
  } catch {
    return { already: true, awarded: 0, balance: w.balance ?? 0, streak: w.streak ?? 0 };
  }
}
