// ============================================================
// SIT — System Integration Testing (smoke test backend)
// Jalankan dari folder backend:  npm test
//
// Cara kerja:
//  - Memakai database lokal (pemeliharaan_aset_bpom) via db.js
//  - Meng-inject req.user palsu ber-role admin supaya keycloakAuth
//    lolos, sehingga route ASLI (query DB asli) bisa diuji end-to-end
//    tanpa token Keycloak.
//  - Semua test bersifat READ-ONLY (tidak mengubah data).
// ============================================================

const path = require('path');
// Muat .env.local seperti server.js (DB_HOST/DB_NAME dsb.)
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const express = require('express');
const request = require('supertest');
const assert = require('assert');

const db = require('../db');

// ---------- Bantuan: aplikasi Express uji ----------
// Meniru pendaftaran route di server.js (ingat pola path ganda /reagen/reagen...)
function buildApp({ authed = true } = {}) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  if (authed) {
    // User "admin" palsu agar keycloakAuth & hasRole lolos
    app.use((req, res, next) => {
      req.user = {
        id: 'sit-test-user',
        sub: 'sit-test-user',
        name: 'admin_pemeliharaan',
        username: 'admin_pemeliharaan',
        preferred_username: 'admin_pemeliharaan',
        roles: ['admin', 'admin_pemeliharaan', 'pic_gudang'],
        realm_access: { roles: ['admin', 'admin_pemeliharaan', 'pic_gudang'] },
      };
      next();
    });
  }

  app.use('/api/reagen', require('../routes/reagen'));
  app.use('/api/persediaan', require('../routes/persediaan'));

  return app;
}

// ============================================================
describe('🔌 Koneksi Database (MySQL)', function () {
  this.timeout(15000);

  it('bisa SELECT 1', async function () {
    const [rows] = await db.query('SELECT 1 AS ok');
    assert.strictEqual(rows[0].ok, 1);
  });

  it('tabel reagen & reagen_opname ada', async function () {
    const [t1] = await db.query(
      "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'reagen'"
    );
    assert.strictEqual(t1[0].n, 1, 'tabel reagen tidak ditemukan');

    const [t2] = await db.query(
      "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'reagen_opname'"
    );
    assert.strictEqual(t2[0].n, 1, 'tabel reagen_opname tidak ditemukan (jalankan data/migration_reagen_opname.sql)');
  });

  it('master reagen terisi (seed)', async function () {
    const [rows] = await db.query('SELECT COUNT(*) AS n FROM reagen');
    assert.ok(rows[0].n > 0, 'tabel reagen kosong');
  });
});

// ============================================================
describe('🔒 Route terproteksi TANPA token (harus 401)', function () {
  const app = buildApp({ authed: false });
  const endpoints = [
    '/api/reagen/reagen/opname',
    '/api/reagen/reagen/opname/mutasi',
    '/api/reagen/reagen/opname/mutasi/1/detail',
    '/api/reagen/reagen/stok',
    '/api/reagen/reagen/masuk',
    '/api/reagen/reagen/pengeluaran',
    '/api/reagen/reagen/lab-stok',
    '/api/persediaan/opname',
    '/api/persediaan/opname/mutasi',
  ];

  endpoints.forEach((url) => {
    it(`GET ${url} -> 401`, async function () {
      const res = await request(app).get(url);
      assert.strictEqual(res.status, 401, `seharusnya 401 (route terproteksi), dapat ${res.status}`);
    });
  });
});

// ============================================================
describe('✅ Route terproteksi sebagai admin (harus 200 + success)', function () {
  const app = buildApp({ authed: true });
  const endpoints = [
    '/api/reagen/reagen/opname',
    '/api/reagen/reagen/opname/mutasi',
    '/api/reagen/reagen/opname/mutasi/1/detail',
    '/api/reagen/reagen/stok',
    '/api/reagen/reagen/masuk',
    '/api/reagen/reagen/pengeluaran',
    '/api/reagen/reagen/lab-stok',
    '/api/reagen/reagen/lab-pemakaian',
    '/api/persediaan/barang',
    '/api/persediaan/opname',
    '/api/persediaan/opname/mutasi',
  ];

  endpoints.forEach((url) => {
    it(`GET ${url} -> 200`, async function () {
      const res = await request(app).get(url);
      assert.strictEqual(res.status, 200, `seharusnya 200, dapat ${res.status}: ${JSON.stringify(res.body).slice(0, 200)}`);
      assert.strictEqual(res.body.success, true);
    });
  });
});

// ============================================================
describe('📄 Route publik (template, tanpa auth)', function () {
  const app = buildApp({ authed: false });

  it('GET /api/reagen/reagen/import-stok/template -> 200', async function () {
    const res = await request(app).get('/api/reagen/reagen/import-stok/template');
    assert.strictEqual(res.status, 200);
  });

  it('GET /api/persediaan/barang/template-xlsx -> 200', async function () {
    const res = await request(app).get('/api/persediaan/barang/template-xlsx');
    assert.strictEqual(res.status, 200);
  });
});

// ============================================================
describe('🐛 Regresi: mutasi "keluar" tetap terhitung setelah disetujui_kabag', function () {
  const app = buildApp({ authed: true });

  it('mutasi konsisten & S15A Sodium Sulphate tidak minus', async function () {
    const res = await request(app).get('/api/reagen/reagen/opname/mutasi');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.data));

    // Konsistensi internal tiap baris: stok_awal + masuk - keluar === stok_akhir
    for (const row of res.body.data) {
      const expected = row.stok_awal + row.masuk - row.keluar;
      assert.strictEqual(row.stok_akhir, expected, `stok tidak konsisten utk ${row.nama_barang}`);
    }

    // Item spesifik (kalau ada di DB): keluar harus terhitung walau status disetujui_kabag
    const item = res.body.data.find((r) => /Sodium Sulphate/.test(r.nama_barang));
    if (item) {
      assert.ok(item.keluar >= 1, `Keluar seharusnya >= 1, dapat ${item.keluar} (bug disetujui_kabag)`);
      assert.ok(item.stok_awal >= 0, `Stok awal tidak boleh negatif, dapat ${item.stok_awal}`);
    }
  });
});
