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
//   TALAWANG_PUBLIC_URL      (default prod: https://talawang.bbpompky.id,
//                             default dev : http://localhost:3001)
//   TALAWANG_UPLOADS_PREFIX  (default: /api/uploads)
//
// Cara koneksi DB:
//   1) Default  : query lintas-database lewat pool DB Pemeliharaan
//                 (SELECT ... FROM `accounting`.user_profiles)
//   2) Pool sendiri (dipakai bila user DB Pemeliharaan tidak punya akses ke
//      DB accounting): set TALAWANG_DB_USER + TALAWANG_DB_PASSWORD
//      (opsional TALAWANG_DB_HOST / TALAWANG_DB_PORT).
// =====================================================================

const mysql = require('mysql2/promise');
const db = require('../db');

const DB_NAME_RAW = process.env.TALAWANG_DB_NAME || 'accounting';
const DB_NAME = /^[A-Za-z0-9_]+$/.test(DB_NAME_RAW) ? DB_NAME_RAW : 'accounting';

const DEFAULT_PUBLIC_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://talawang.bbpompky.id'
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
      password:
        process.env.TALAWANG_DB_PASSWORD !== undefined
          ? process.env.TALAWANG_DB_PASSWORD
          : process.env.DB_PASSWORD || '',
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

  return daftar.map((kunci) => {
    const rec = cache.map.get(norm(kunci));
    return rec ? { kunci, ketemu: true, ...rec } : { kunci, ketemu: false };
  });
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
});

module.exports = { cariTtd, infoTalawang, buatUrlTtd };
