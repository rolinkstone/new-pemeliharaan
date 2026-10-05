// utils/ttdPenandatangan.js
// ============================================
// Ambil TTD (tanda tangan elektronik) penandatangan dari aplikasi Talawang
// untuk ditempelkan ke dokumen cetak (SPB/SBBK, laporan, dsb).
//
// Read-only: backend hanya membaca tabel profil Talawang dan mengembalikan
// URL gambar. Kalau gagal / tidak ketemu, dokumen tetap dicetak dengan garis
// tanda tangan kosong (TTD bersifat pelengkap).
// ============================================

const getBaseUrl = () =>
  (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');

/** Normalisasi kunci untuk pencocokan (buang spasi + lowercase). */
export const normalisasiKunci = (v) => String(v ?? '').replace(/\s+/g, '').toLowerCase();

/** Buang kunci kosong & duplikat (spasi/kapital tidak dianggap berbeda). */
export const bersihkanKunci = (keys = []) => {
  const seen = new Set();
  const hasil = [];
  for (const k of Array.isArray(keys) ? keys : [keys]) {
    const teks = String(k ?? '').trim();
    if (!teks) continue;
    const norm = normalisasiKunci(teks);
    if (seen.has(norm)) continue;
    seen.add(norm);
    hasil.push(teks);
  }
  return hasil;
};

/**
 * Cari TTD berdasarkan daftar kunci identitas (user_id / UUID / NIP / username / nama).
 *
 * @param {object} session - sesi NextAuth (butuh accessToken)
 * @param {string[]} keys - kandidat identitas penandatangan
 * @returns {Promise<Record<string,string>>} peta `kunci` -> URL gambar TTD
 */
export const ambilPetaTtd = async (session, keys = []) => {
  const peta = {};
  const daftar = bersihkanKunci(keys);
  if (daftar.length === 0) return peta;

  const token = session?.accessToken || session?.token || session?.access_token;
  if (!token) return peta;

  try {
    const res = await fetch(`${getBaseUrl()}/ttd/penandatangan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ keys: daftar }),
    });

    if (!res.ok) return peta;

    const json = await res.json();
    (json?.data || []).forEach((item) => {
      if (item?.ketemu && item?.ttd_url) {
        peta[String(item.kunci).trim()] = item.ttd_url;
      }
    });
  } catch (error) {
    console.warn('⚠️ TTD tidak dapat dimuat:', error.message);
  }

  return peta;
};
