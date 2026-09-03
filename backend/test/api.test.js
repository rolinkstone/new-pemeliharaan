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

  it('kolom foto_url ada di barang_masuk & reagen_masuk', async function () {
    const [b] = await db.query(
      "SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = 'barang_masuk' AND column_name = 'foto_url'"
    );
    assert.strictEqual(b[0].n, 1, 'kolom barang_masuk.foto_url belum ada (jalankan data/migration_barang_masuk_foto.sql)');

    const [r] = await db.query(
      "SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = 'reagen_masuk' AND column_name = 'foto_url'"
    );
    assert.strictEqual(r[0].n, 1, 'kolom reagen_masuk.foto_url belum ada (jalankan data/migration_barang_masuk_foto.sql)');
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
    '/api/reagen/reagen/lab-pemakaian',
    '/api/reagen/reagen/movement',
    '/api/reagen/reagen/masuk/merge',
    '/api/persediaan/opname',
    '/api/persediaan/opname/mutasi',
    '/api/persediaan/movement',
    '/api/persediaan/barang-masuk/merge',
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
    '/api/reagen/reagen/movement',
    '/api/persediaan/barang',
    '/api/persediaan/opname',
    '/api/persediaan/opname/mutasi',
    '/api/persediaan/movement',
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

// ============================================================
describe('📉 Pemantauan barang tidak bergerak (movement)', function () {
  const app = buildApp({ authed: true });

  const checkRows = (rows, source) => {
    assert.ok(Array.isArray(rows), `${source}: data harus array`);
    for (const r of rows) {
      assert.ok(r.id != null, `${source}: row tanpa id`);
      assert.ok(r.nama_barang, `${source}: row tanpa nama_barang`);
      assert.strictEqual(typeof r.stok, 'number', `${source}: stok harus number`);
      // last_masuk/last_keluar/last_movement: null atau string tanggal
      for (const k of ['last_masuk', 'last_keluar', 'last_movement']) {
        assert.ok(r[k] === null || /^\d{4}-\d{2}-\d{2}$/.test(r[k]), `${source}: field ${k} tidak valid`);
      }
      // hari_tidak_bergerak: null (belum pernah) atau integer >= 0
      if (r.hari_tidak_bergerak !== null) {
        assert.ok(Number.isInteger(r.hari_tidak_bergerak) && r.hari_tidak_bergerak >= 0, `${source}: hari_tidak_bergerak tidak valid`);
      }
      assert.strictEqual(typeof r.pernah_bergerak, 'boolean', `${source}: pernah_bergerak harus boolean`);
      if (r.pernah_bergerak) assert.ok(r.last_movement, `${source}: pernah bergerak harus punya last_movement`);
      if (!r.pernah_bergerak) assert.strictEqual(r.hari_tidak_bergerak, null, `${source}: belum pernah -> hari harus null`);
    }
  };

  it('GET /api/persediaan/movement -> 200 + struktur benar', async function () {
    const res = await request(app).get('/api/persediaan/movement');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    checkRows(res.body.data, 'persediaan');
  });

  it('GET /api/reagen/reagen/movement -> 200 + struktur benar', async function () {
    const res = await request(app).get('/api/reagen/reagen/movement');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    checkRows(res.body.data, 'reagen');
  });
});

// ============================================================
describe('🧾 Barang Masuk — foto_url & merge lampiran (PDF)', function () {
  const app = buildApp({ authed: true });

  it('GET /api/persediaan/barang-masuk mengembalikan foto_url', async function () {
    const res = await request(app).get('/api/persediaan/barang-masuk?limit=5');
    assert.strictEqual(res.status, 200);
    if (res.body.data && res.body.data.length > 0) {
      assert.ok('foto_url' in res.body.data[0], 'barang_masuk harus punya field foto_url');
    }
  });

  it('GET /api/reagen/reagen/masuk mengembalikan foto_url', async function () {
    const res = await request(app).get('/api/reagen/reagen/masuk');
    assert.strictEqual(res.status, 200);
    if (res.body.data && res.body.data.length > 0) {
      assert.ok('foto_url' in res.body.data[0], 'reagen_masuk harus punya field foto_url');
    }
  });

  it('GET merge tanpa parameter -> 400 (ATK & Reagen)', async function () {
    const r1 = await request(app).get('/api/persediaan/barang-masuk/merge');
    assert.strictEqual(r1.status, 400, `ATK merge tanpa param harus 400, dapat ${r1.status}`);

    const r2 = await request(app).get('/api/reagen/reagen/masuk/merge');
    assert.strictEqual(r2.status, 400, `Reagen merge tanpa param harus 400, dapat ${r2.status}`);
  });

  it('GET merge dgn param file tidak ada -> 404 (tidak crash)', async function () {
    const r1 = await request(app).get('/api/persediaan/barang-masuk/merge?nota=/uploads/not-exist-a.jpg&foto=/uploads/not-exist-b.jpg');
    assert.strictEqual(r1.status, 404, `ATK merge file hilang harus 404, dapat ${r1.status}`);

    const r2 = await request(app).get('/api/reagen/reagen/masuk/merge?nota=/uploads/not-exist-a.jpg&foto=/uploads/not-exist-b.jpg');
    assert.strictEqual(r2.status, 404, `Reagen merge file hilang harus 404, dapat ${r2.status}`);
  });
});
