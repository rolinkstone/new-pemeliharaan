// backend/utils/talawangTtd.js
// =====================================================================
// Ambil data TTD (tanda tangan) penandatangan dari aplikasi TALAWANG.
//
// Sifat integrasi: READ-ONLY, tidak mengubah apa pun di project Talawang.
//   - Sumber  : tabel `accounting.user_profiles` (DB Talawang) di server MySQL
//               yang sama -> dibaca dari pool DB milik Pemeliharaan.
//   - File TTD: disajikan publik oleh Talawang (middleware Next.js me-rewrite
//               /api/uploads/* -> backend /uploads/*), sehingga browser bisa
//               langsung memuat gambarnya tanpa token.
//
// Env opsional:
//   TALAWANG_DB_NAME         (default: accounting)
//   TALAWANG_PUBLIC_URL      (default prod: https://api-talawang.bbpompky.id,
//                             default dev : http://localhost:3001)
//     ⚠️ Di production JANGAN pakai https://talawang.bbpompky.id untuk file:
//        rewrite Next.js `/api/uploads/*` yang jalan di local (localhost:3001)
//        mengembalikan 500 di production. Yang benar domain API Talawang
//        (https://api-talawang.bbpompky.id/api/uploads/ttd/<file> -> 200 image/png).
//   TALAWANG_UPLOADS_PREFIX  (default: /api/uploads)
//
// Cara koneksi DB:
//   1) Default  : query lintas-database lewat pool DB Pemeliharaan
//                 (SELECT ... FROM `accounting`.user_profiles)
//   2) Pool sendiri (dipakai bila user DB Pemeliharaan tidak punya akses ke
//      DB accounting): set TALAWANG_DB_USER + TALAWANG_DB_PASSWORD
//      (opsional TALAWANG_DB_HOST / TALAWANG_DB_PORT).
//
// Pencocokan identitas:
//   Sebagian kolom di Pemeliharaan hanya menyimpan NAMA tampilan
//   (`req.user.name`, mis. `laporan_rusak.kabag_confirm_by`), sedangkan
//   `user_profiles` Talawang sering memakai NIP sebagai `nama_lengkap`.
//   Karena itu nama yang tidak ketemu langsung diterjemahkan dulu ke
//   identitas Keycloak (user_id / username / NIP) lewat admin API, lalu
//   dicocokkan lagi. Hasilnya di-cache agar tidak membebani Keycloak.
// =====================================================================

const mysql = require('mysql2/promise');
const axios = require('axios');
const db = require('../db');
const KEYCLOAK_CONFIG = require('../config/keycloak');
const { getAdminCliToken } = require('./keycloakHelpers');

const DB_NAME_RAW = process.env.TALAWANG_DB_NAME || 'accounting';
const DB_NAME = /^[A-Za-z0-9_]+$/.test(DB_NAME_RAW) ? DB_NAME_RAW : 'accounting';

const DEFAULT_PUBLIC_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://api-talawang.bbpompky.id'
    : 'http://localhost:3001';

const PUBLIC_URL = (process.env.TALAWANG_PUBLIC_URL || DEFAULT_PUBLIC_URL).replace(/\/+$/, '');
const UPLOADS_PREFIX = (process.env.TALAWANG_UPLOADS_PREFIX || '/api/uploads').replace(/\/+$/, '');

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 menit

// Normalisasi untuk pencocokan: buang semua spasi + lowercase
// (NIP di DB Talawang tanpa spasi; nama bisa beda spasi/tanda baca ringan)
const norm = (v) => String(v ?? '').replace(/\s+/g, '').toLowerCase();

let cache = { at: 0, map: null, error: null };

// ============ KONEKSI DB ============
const pakaiPoolKhusus = Boolean(process.env.TALAWANG_DB_USER || process.env.TALAWANG_DB_HOST);
let poolTalawang = null;

const getPoolTalawang = () => {
  if (!pakaiPoolKhusus) return null;
  if (!poolTalawang) {
    poolTalawang = mysql.createPool({
      host: process.env.TALAWANG_DB_HOST || process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.TALAWANG_DB_PORT || process.env.DB_PORT || '3306', 10),
      user: process.env.TALAWANG_DB_USER || process.env.DB_USER || 'root',
      // Nilai kosong dianggap belum diset (mis. env docker-compose
      // `${TALAWANG_DB_PASSWORD:-}`) -> pakai DB_PASSWORD.
      password: process.env.TALAWANG_DB_PASSWORD || process.env.DB_PASSWORD || '',
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 3,
      queueLimit: 0,
    });
    console.log(`🔌 Pool TTD Talawang dibuat (db: ${DB_NAME}, host: ${process.env.TALAWANG_DB_HOST || process.env.DB_HOST || '127.0.0.1'})`);
  }
  return poolTalawang;
};

const buatUrlTtd = (ttdPath) => {
  if (!ttdPath) return null;
  const file = String(ttdPath).split('/').filter(Boolean).pop();
  if (!file) return null;
  return `${PUBLIC_URL}${UPLOADS_PREFIX}/ttd/${file}`;
};

async function muatPetaTtd() {
  const poolKhusus = getPoolTalawang();
  const sql = `SELECT user_id, username, nip, nama_lengkap, jabatan, ttd_path
       FROM ${poolKhusus ? '' : `\`${DB_NAME}\`.`}user_profiles
      WHERE ttd_path IS NOT NULL AND ttd_path <> ''`;

  const [rows] = poolKhusus ? await poolKhusus.query(sql) : await db.query(sql);

  const map = new Map();
  rows.forEach((r) => {
    const ttdUrl = buatUrlTtd(r.ttd_path);
    if (!ttdUrl) return;
    const rec = {
      nama: r.nama_lengkap || r.nama || r.username || r.nip || '',
      jabatan: r.jabatan || '',
      nip: r.nip || '',
      ttd_url: ttdUrl,
    };
    // Satu profil bisa dikenali lewat beberapa kunci
    [r.user_id, r.nip, r.username, r.nama_lengkap].forEach((k) => {
      const key = norm(k);
      if (key && !map.has(key)) map.set(key, rec);
    });
  });

  return map;
}

// ============ FALLBACK: NAMA TAMPILAN -> IDENTITAS KEYCLOAK ============
// Dipakai untuk kolom yang hanya menyimpan nama (mis. `kabag_confirm_by`),
// karena nama tampilan tidak selalu sama dengan `nama_lengkap` di Talawang
// (sering diisi NIP).
const CACHE_IDENTITAS_TTL_MS = 10 * 60 * 1000;
let cacheIdentitas = { at: 0, map: null, error: null };

const kandidatNama = (u) => [
  `${u.firstName || ''} ${u.lastName || ''}`.trim(),
  u.attributes?.nama_lengkap?.[0],
  u.username,
  u.email,
];

async function muatPetaIdentitas() {
  const token = await getAdminCliToken();
  const url = `${KEYCLOAK_CONFIG.serverUrl}/admin/realms/${KEYCLOAK_CONFIG.realm}/users`;
  const { data } = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
    params: { max: 1000 },
    timeout: 15000,
  });

  const map = new Map();
  (Array.isArray(data) ? data : [])
    .filter((u) => u.enabled !== false)
    .forEach((u) => {
      const identitas = {
        user_id: u.id,
        username: u.username,
        nip: u.attributes?.nip?.[0] || '',
        nama: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username || '',
      };
      [...kandidatNama(u), identitas.nip].forEach((k) => {
        const key = norm(k);
        if (!key) return;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(identitas);
      });
    });

  return map;
}

async function petaIdentitas() {
  if (cacheIdentitas.map && Date.now() - cacheIdentitas.at < CACHE_IDENTITAS_TTL_MS) {
    return cacheIdentitas.map;
  }
  try {
    const map = await muatPetaIdentitas();
    cacheIdentitas = { at: Date.now(), map, error: null };
    console.log(`👥 Peta identitas Keycloak untuk TTD dimuat (${map.size} kunci)`);
  } catch (error) {
    console.error('⚠️ Gagal memuat identitas user Keycloak:', error.message);
    cacheIdentitas = { at: Date.now(), map: cacheIdentitas.map || null, error: error.message };
  }
  return cacheIdentitas.map;
}

/**
 * Cocokkan satu kunci lewat identitas Keycloak:
 * nama tampilan -> (user_id / username / NIP) -> peta TTD Talawang.
 * Hanya dipakai bila pencocokan langsung gagal. Bila hasilnya ambigu
 * (nama kembar dengan TTD berbeda) maka diabaikan supaya tidak salah orang.
 */
const cocokLewatIdentitas = (kunci, petaTtd, petaId) => {
  const kandidat = petaId.get(norm(kunci));
  if (!kandidat || kandidat.length === 0) return null;

  const hasil = new Map(); // ttd_url -> rec
  kandidat.forEach((id) => {
    [id.user_id, id.username, id.nip, id.nama].forEach((k) => {
      const rec = petaTtd.get(norm(k));
      if (rec) hasil.set(rec.ttd_url, rec);
    });
  });

  return hasil.size === 1 ? [...hasil.values()][0] : null;
};

/**
 * Cari TTD berdasarkan daftar kunci (boleh campur: user_id / NIP / username / nama).
 * @param {string[]} keys
 * @returns {Promise<Array<{kunci:string, ketemu:boolean, nama?:string, jabatan?:string, nip?:string, ttd_url?:string}>>}
 */
async function cariTtd(keys = []) {
  const daftar = (Array.isArray(keys) ? keys : [keys])
    .map((k) => String(k ?? '').trim())
    .filter(Boolean)
    .slice(0, 100);

  if (daftar.length === 0) return [];

  if (!cache.map || Date.now() - cache.at > CACHE_TTL_MS) {
    try {
      const map = await muatPetaTtd();
      cache = { at: Date.now(), map, error: null };
    } catch (error) {
      // Jangan gagalkan proses cetak: TTD hanya pelengkap
      console.error('⚠️ Gagal membaca user_profiles Talawang:', error.code || '', error.message);
      cache = { at: Date.now(), map: cache.map || null, error: error.message };
    }
  }

  if (!cache.map) {
    return daftar.map((kunci) => ({ kunci, ketemu: false }));
  }

  const hasil = daftar.map((kunci) => {
    const rec = cache.map.get(norm(kunci));
    return rec ? { kunci, ketemu: true, ...rec } : null;
  });

  // Fallback: kunci berupa nama tampilan diterjemahkan dulu ke identitas
  // Keycloak, lalu dicocokkan lagi ke peta TTD Talawang.
  const belumKetemu = hasil.map((h, i) => (h ? -1 : i)).filter((i) => i >= 0);
  if (belumKetemu.length > 0) {
    const petaId = await petaIdentitas();
    if (petaId) {
      belumKetemu.forEach((i) => {
        const rec = cocokLewatIdentitas(daftar[i], cache.map, petaId);
        if (rec) hasil[i] = { kunci: daftar[i], ketemu: true, ...rec, via: 'nama' };
      });
    }
  }

  return hasil.map((h, i) => h || { kunci: daftar[i], ketemu: false });
}

const infoTalawang = () => ({
  dbName: DB_NAME,
  modeKoneksi: pakaiPoolKhusus ? 'pool-khusus' : 'cross-database',
  publicUrl: PUBLIC_URL,
  uploadsPrefix: UPLOADS_PREFIX,
  cacheAktif: Boolean(cache.map),
  jumlahProfil: cache.map ? cache.map.size : 0,
  error: cache.error,
  terakhirMuat: cache.at ? new Date(cache.at).toISOString() : null,
  identitasKeycloak: {
    aktif: Boolean(cacheIdentitas.map),
    jumlahKunci: cacheIdentitas.map ? cacheIdentitas.map.size : 0,
    error: cacheIdentitas.error,
    terakhirMuat: cacheIdentitas.at ? new Date(cacheIdentitas.at).toISOString() : null,
  },
});

module.exports = { cariTtd, infoTalawang, buatUrlTtd };
