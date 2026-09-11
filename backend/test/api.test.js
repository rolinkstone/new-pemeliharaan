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
const XLSX = require('xlsx');

const db = require('../db');

// ---------- Bantuan: aplikasi Express uji ----------
// Meniru pendaftaran route di server.js (ingat pola path ganda /reagen/reagen...)
function buildApp({ authed = true } = {}) {
  const app = express();
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

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
  app.use('/api/glassware', require('../routes/glassware'));
  app.use('/api/asetRuangan', require('../routes/asetRuangan'));
  app.use('/api/ruangan', require('../routes/ruangan'));
  app.use('/api/aset', require('../routes/aset'));
  app.use('/api/laporanrusak', require('../routes/laporanRusak'));

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
    '/api/glassware/laboratorium',
    '/api/glassware/periode',
    '/api/glassware/stok',
    '/api/glassware/masuk',
    '/api/glassware/pecah',
    '/api/glassware/movement',
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
    '/api/glassware/laboratorium',
    '/api/glassware/periode',
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

  it('GET /api/asetRuangan/import/template -> 200', async function () {
    const res = await request(app)
      .get('/api/asetRuangan/import/template')
      .buffer(true)
      .parse((response, callback) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    assert.strictEqual(res.status, 200);
    assert.ok(Buffer.isBuffer(res.body), 'body harus berupa buffer XLSX');

    const wb = XLSX.read(res.body, { type: 'buffer' });
    assert.ok(wb.SheetNames.includes('Template Import'), 'sheet "Template Import" harus ada');
    assert.ok(wb.SheetNames.includes('Petunjuk'), 'sheet "Petunjuk" harus ada');

    const [header] = XLSX.utils.sheet_to_json(wb.Sheets['Template Import'], { header: 1, defval: '' });
    assert.deepStrictEqual(
      header,
      ['kode_barang', 'nup', 'kode_ruangan', 'tgl_masuk', 'tgl_keluar', 'keterangan']
    );
  });

  it('GET /api/ruangan/import/template -> 200', async function () {
    const res = await request(app)
      .get('/api/ruangan/import/template')
      .buffer(true)
      .parse((response, callback) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    assert.strictEqual(res.status, 200);
    assert.ok(Buffer.isBuffer(res.body), 'body harus berupa buffer XLSX');

    const wb = XLSX.read(res.body, { type: 'buffer' });
    assert.ok(wb.SheetNames.includes('Template Import'), 'sheet "Template Import" harus ada');

    const [header] = XLSX.utils.sheet_to_json(wb.Sheets['Template Import'], { header: 1, defval: '' });
    assert.deepStrictEqual(
      header,
      ['kode_ruangan', 'nama_ruangan', 'deskripsi', 'lokasi', 'is_active']
    );
  });

  it('GET /api/aset/import/template -> 200', async function () {
    const res = await request(app)
      .get('/api/aset/import/template')
      .buffer(true)
      .parse((response, callback) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    assert.strictEqual(res.status, 200);
    assert.ok(Buffer.isBuffer(res.body), 'body harus berupa buffer XLSX');

    const wb = XLSX.read(res.body, { type: 'buffer' });
    assert.ok(wb.SheetNames.includes('Template Import'), 'sheet "Template Import" harus ada');

    const [header] = XLSX.utils.sheet_to_json(wb.Sheets['Template Import'], { header: 1, defval: '' });
    assert.deepStrictEqual(
      header,
      ['jenis_bmn', 'nama_satker', 'kode_barang', 'nup', 'nama_barang', 'status_bmn', 'merk', 'tipe', 'kondisi', 'intra_extra', 'tanggal_perolehan']
    );
  });
});

// ============================================================
describe('📤 Export XLSX (Barang BMN, Ruangan, Aset Ruangan)', function () {
  const app = buildApp({ authed: true });

  const fetchXlsx = (url) => request(app)
    .get(url)
    .buffer(true)
    .parse((response, callback) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => callback(null, Buffer.concat(chunks)));
    });

  const assertXlsx = (res, expectedHeaderWithoutNo) => {
    assert.strictEqual(res.status, 200, `seharusnya 200, dapat ${res.status}: ${JSON.stringify(res.body).slice(0, 200)}`);
    assert.ok(String(res.headers['content-type']).includes('spreadsheetml.sheet'), 'content-type harus XLSX');
    assert.ok(Buffer.isBuffer(res.body), 'body harus buffer');

    const wb = XLSX.read(res.body, { type: 'buffer' });
    const [header] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
    assert.strictEqual(header[0], 'No');
    assert.deepStrictEqual(header.slice(1), expectedHeaderWithoutNo);
  };

  it('GET /api/aset/export/xlsx -> 200', async function () {
    const res = await fetchXlsx('/api/aset/export/xlsx');
    assertXlsx(res, ['Jenis BMN', 'Nama Satker', 'Kode Barang', 'NUP', 'Nama Barang', 'Status BMN', 'Merk', 'Tipe', 'Kondisi', 'Intra/Ekstra', 'Tanggal Perolehan']);
  });

  it('GET /api/ruangan/export/xlsx -> 200', async function () {
    const res = await fetchXlsx('/api/ruangan/export/xlsx');
    assertXlsx(res, ['Kode Ruangan', 'Nama Ruangan', 'Deskripsi', 'Lokasi', 'Status']);
  });

  it('GET /api/asetRuangan/export/xlsx -> 200', async function () {
    const res = await fetchXlsx('/api/asetRuangan/export/xlsx');
    assertXlsx(res, ['Kode Barang', 'NUP', 'Nama Barang', 'Kode Ruangan', 'Nama Ruangan', 'Tgl Masuk', 'Tgl Keluar', 'Status', 'Keterangan']);
  });

  // Jumlah baris data pada sheet pertama sebuah file XLSX (di luar baris header)
  const countDataRows = (buf) => {
    const wb = XLSX.read(buf, { type: 'buffer' });
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
    return aoa.slice(1).filter(r => r.some(v => String(v).trim() !== '')).length;
  };

  const assertRoundTrip = async (modul) => {
    const exp = await fetchXlsx(`/api/${modul}/export/xlsx`);
    const imp = await request(app)
      .post(`/api/${modul}/import`)
      .send({ fileBase64: exp.body.toString('base64') });

    if (countDataRows(exp.body) === 0) {
      // File tanpa baris data wajib ditolak dengan pesan jelas, BUKAN 200 "0 berhasil, 0 gagal"
      assert.strictEqual(imp.status, 400, `status ${imp.status}: ${JSON.stringify(imp.body).slice(0, 200)}`);
      assert.ok(/tidak ada baris data/i.test(imp.body.message), imp.body.message);
    } else {
      assert.strictEqual(imp.status, 200, `status ${imp.status}: ${JSON.stringify(imp.body).slice(0, 200)}`);
      assert.strictEqual(imp.body.success, true);
      assert.ok(imp.body.data.failed > 0, 'baris hasil export harus terbaca (terdeteksi duplikat)');
      assert.notStrictEqual(imp.body.message, '0 berhasil, 0 gagal');
    }
  };

  it('hasil Export Barang BMN dapat dibaca oleh Import (bukan 0 berhasil 0 gagal)', async function () {
    await assertRoundTrip('aset');
  });

  it('hasil Export Ruangan dapat dibaca oleh Import (bukan 0 berhasil 0 gagal)', async function () {
    await assertRoundTrip('ruangan');
  });

  it('import menolak file dengan header tidak dikenali (bukan 0 berhasil 0 gagal)', async function () {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([['Foo', 'Bar'], ['a', 'b']]);
    XLSX.utils.book_append_sheet(wb, ws, 'Template Import');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const imp = await request(app)
      .post('/api/aset/import')
      .send({ fileBase64: buf.toString('base64') });

    assert.strictEqual(imp.status, 400);
    assert.ok(/header tidak dikenali/i.test(imp.body.message), imp.body.message);
    assert.notStrictEqual(imp.body.message, '0 berhasil, 0 gagal');
  });

  it('import membaca header gaya Export (baris dikenali, bukan 0/0)', async function () {
    // Header persis seperti hasil Export, sheet bernama 'Barang BMN' (bukan 'Template Import')
    const header = ['No', 'Jenis BMN', 'Nama Satker', 'Kode Barang', 'NUP', 'Nama Barang', 'Status BMN', 'Merk', 'Tipe', 'Kondisi', 'Intra/Ekstra', 'Tanggal Perolehan'];
    // nup sengaja tidak valid agar baris GAGAL validasi (tidak menulis ke DB) namun terbukti terbaca
    const row = [1, 'Komputer', 'SATKER UJI', 'ZZZ-UJI-999', 'bukan-angka', 'Barang Uji', 'Aktif', 'Merk', 'Tipe', 'Baik', 'Intra', '2024-01-15'];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, row]), 'Barang BMN');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const imp = await request(app)
      .post('/api/aset/import')
      .send({ fileBase64: buf.toString('base64') });

    assert.strictEqual(imp.status, 200, `status ${imp.status}: ${JSON.stringify(imp.body).slice(0, 200)}`);
    assert.strictEqual(imp.body.success, true);
    assert.strictEqual(imp.body.data.failed, 1, 'baris harus terbaca (gagal validasi nup), bukan 0/0');
    assert.ok(/nup/i.test(imp.body.data.errors[0]), imp.body.data.errors[0]);
  });
});

// ============================================================
describe('🔎 Ruangan: pencarian (search)', function () {
  const app = buildApp({ authed: true });

  it('GET /api/ruangan?search=<deskripsi> menemukan ruangan berdasarkan deskripsi', async function () {
    const all = await request(app).get('/api/ruangan').query({ page: 1, limit: 500 });
    assert.strictEqual(all.status, 200);

    const target = (all.body.data || []).find(r => (r.deskripsi || '').trim().length >= 4);
    if (!target) this.skip(); // tidak ada data deskripsi untuk diuji di DB ini

    const term = target.deskripsi.trim();
    const res = await request(app).get('/api/ruangan').query({ search: term, page: 1, limit: 500 });

    assert.strictEqual(res.status, 200);
    assert.ok(
      (res.body.data || []).some(r => r.id === target.id),
      `ruangan id ${target.id} (deskripsi "${term}") harus muncul saat dicari`
    );
  });

  it('GET /api/ruangan/search/:keyword mencari kode, nama, deskripsi, dan lokasi', async function () {
    const all = await request(app).get('/api/ruangan').query({ page: 1, limit: 500 });
    assert.strictEqual(all.status, 200);

    const target = (all.body.data || []).find(r => (r.deskripsi || '').trim().length >= 4);
    if (!target) this.skip();

    const term = encodeURIComponent(target.deskripsi.trim());
    const res = await request(app).get(`/api/ruangan/search/${term}`);

    assert.strictEqual(res.status, 200);
    assert.ok(
      (res.body.data || []).some(r => r.id === target.id),
      `ruangan id ${target.id} harus ditemukan via /search/:keyword`
    );
  });
});

// ============================================================
describe('📋 Ruangan: opsi dropdown (butuh SEMUA ruangan)', function () {
  const app = buildApp({ authed: true });

  it('GET /api/ruangan?limit=1000 memuat seluruh ruangan (termasuk di luar 10 pertama)', async function () {
    const def = await request(app).get('/api/ruangan');
    const all = await request(app).get('/api/ruangan').query({ page: 1, limit: 1000 });

    assert.strictEqual(def.status, 200);
    assert.strictEqual(all.status, 200);
    assert.ok(
      all.body.data.length > def.body.data.length,
      `limit besar harus mengambil lebih banyak ruangan (default ${def.body.data.length}, semua ${all.body.data.length})`
    );
    assert.strictEqual(
      all.body.data.length,
      all.body.pagination.total,
      'limit besar harus mengembalikan seluruh data sesuai total'
    );
  });
});

// ============================================================
describe('🧾 Laporan Rusak: aset per ruangan (select box)', function () {
  const app = buildApp({ authed: true });

  it('GET /api/laporanrusak/aset-berdasarkan-ruangan/:id mengembalikan field nup & merk', async function () {
    const all = await request(app).get('/api/asetRuangan').query({ page: 1, limit: 500 });
    assert.strictEqual(all.status, 200);

    const ruanganIds = [...new Set((all.body.data || []).map(r => r.ruangan_id).filter(Boolean))].slice(0, 5);

    let checkedRows = 0;
    for (const ruanganId of ruanganIds) {
      const res = await request(app).get(`/api/laporanrusak/aset-berdasarkan-ruangan/${ruanganId}`);
      assert.strictEqual(res.status, 200, `status ${res.status}: ${JSON.stringify(res.body).slice(0, 200)}`);

      const rows = res.body.data || [];
      if (rows.length === 0) continue;

      rows.forEach((row) => {
        assert.ok('nup' in row, 'field nup harus ada pada tiap baris aset (untuk ditampilkan di select box)');
        assert.ok('merk' in row, 'field merk harus ada pada tiap baris aset (untuk ditampilkan di select box)');
      });
      checkedRows = rows.length;
      break;
    }

    if (checkedRows === 0) this.skip(); // tidak ada ruangan dengan aset aktif di DB ini
  });
});

// ============================================================
describe('🔎 Aset Ruangan: pencarian (search)', function () {
  const app = buildApp({ authed: true });

  it('GET /api/asetRuangan?search=... tidak error & mengembalikan array', async function () {
    const res = await request(app)
      .get('/api/asetRuangan')
      .query({ search: 'zzz-tidak-ada-xyz', page: 1, limit: 10 });

    assert.strictEqual(res.status, 200, `status ${res.status}: ${JSON.stringify(res.body).slice(0, 200)}`);
    assert.ok(Array.isArray(res.body.data), 'data harus array');
    assert.ok(res.body.pagination, 'harus ada pagination');
  });

  it('GET /api/asetRuangan?search=<kode/nama aset> menyaring sesuai kata kunci', async function () {
    const all = await request(app).get('/api/asetRuangan').query({ page: 1, limit: 500 });
    assert.strictEqual(all.status, 200);

    const target = (all.body.data || []).find(r => (r.kode_barang || '').trim().length > 0);
    if (!target) this.skip(); // tabel aset_ruangan masih kosong

    const res = await request(app)
      .get('/api/asetRuangan')
      .query({ search: target.kode_barang.trim(), page: 1, limit: 500 });

    assert.strictEqual(res.status, 200);
    assert.ok(
      (res.body.data || []).some(r => r.id === target.id),
      `baris id ${target.id} harus muncul saat mencari kode_barang "${target.kode_barang}"`
    );
  });

  it('GET /api/asetRuangan?search=<nama ruangan> menemukan baris via kolom ruangan', async function () {
    const all = await request(app).get('/api/asetRuangan').query({ page: 1, limit: 500 });
    assert.strictEqual(all.status, 200);

    const target = (all.body.data || []).find(r => (r.nama_ruangan || '').trim().length > 0);
    if (!target) this.skip();

    const res = await request(app)
      .get('/api/asetRuangan')
      .query({ search: target.nama_ruangan.trim(), page: 1, limit: 500 });

    assert.strictEqual(res.status, 200);
    assert.ok(
      (res.body.data || []).some(r => r.id === target.id),
      `baris id ${target.id} harus muncul saat mencari ruangan "${target.nama_ruangan}"`
    );
  });
});

// ============================================================
describe('🎛️ Aset Ruangan: filter (aset_id / ruangan_id)', function () {
  const app = buildApp({ authed: true });

  it('GET /api/asetRuangan?ruangan_id=X hanya mengembalikan baris ruangan tersebut', async function () {
    const all = await request(app).get('/api/asetRuangan').query({ page: 1, limit: 500 });
    assert.strictEqual(all.status, 200);

    const ids = [...new Set((all.body.data || []).map(r => r.ruangan_id).filter(Boolean))];
    if (ids.length < 2) this.skip(); // butuh minimal 2 ruangan berbeda

    const target = ids[0];
    const res = await request(app)
      .get('/api/asetRuangan')
      .query({ ruangan_id: target, page: 1, limit: 500 });

    assert.strictEqual(res.status, 200, `status ${res.status}: ${JSON.stringify(res.body).slice(0, 200)}`);
    assert.ok(res.body.data.length > 0, 'harus ada data untuk ruangan terpilih');
    assert.ok(
      res.body.data.every(r => r.ruangan_id === target),
      'semua baris hasil filter harus milik ruangan terpilih'
    );
    assert.ok(
      res.body.pagination.total < all.body.pagination.total,
      'total hasil terfilter harus lebih kecil dari total keseluruhan'
    );
  });

  it('GET /api/asetRuangan?aset_id=X hanya mengembalikan baris aset tersebut', async function () {
    const all = await request(app).get('/api/asetRuangan').query({ page: 1, limit: 500 });
    assert.strictEqual(all.status, 200);

    const ids = [...new Set((all.body.data || []).map(r => r.aset_id).filter(Boolean))];
    if (ids.length < 2) this.skip();

    const target = ids[0];
    const res = await request(app)
      .get('/api/asetRuangan')
      .query({ aset_id: target, page: 1, limit: 500 });

    assert.strictEqual(res.status, 200, `status ${res.status}: ${JSON.stringify(res.body).slice(0, 200)}`);
    assert.ok(res.body.data.length > 0, 'harus ada data untuk aset terpilih');
    assert.ok(
      res.body.data.every(r => r.aset_id === target),
      'semua baris hasil filter harus milik aset terpilih'
    );
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

// ============================================================
describe('🫙 Persediaan Glassware (stok opname lab)', function () {
  const app = buildApp({ authed: true });

  it('laboratorium & jenis terisi', async function () {
    const lab = await request(app).get('/api/glassware/laboratorium');
    assert.strictEqual(lab.status, 200);
    assert.ok(Array.isArray(lab.body.data) && lab.body.data.length === 4, 'harus ada 4 laboratorium');

    const jenis = await request(app).get('/api/glassware/jenis');
    assert.strictEqual(jenis.status, 200);
    assert.ok(Array.isArray(jenis.body.data) && jenis.body.data.length === 2, 'harus ada 2 jenis');
  });

  it('periode mengembalikan tanggal YYYY-MM-DD', async function () {
    const res = await request(app).get('/api/glassware/periode');
    assert.strictEqual(res.status, 200);
    const p = res.body.data && res.body.data[0];
    assert.ok(p, 'harus ada minimal 1 periode');
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(p.tanggal), `tanggal periode tidak valid: ${p.tanggal}`);
  });

  it('stok per lab+jenis benar (MIKRO kuant 75, kual 165)', async function () {
    const q = { periode_id: 1, lab: 1 };
    const kuant = await request(app).get('/api/glassware/stok').query({ ...q, jenis: 1 });
    assert.strictEqual(kuant.status, 200);
    assert.strictEqual(kuant.body.data.length, 75, `MIKRO kuantitatif harus 75, dapat ${kuant.body.data.length}`);

    const kual = await request(app).get('/api/glassware/stok').query({ ...q, jenis: 2 });
    assert.strictEqual(kual.status, 200);
    assert.strictEqual(kual.body.data.length, 165, `MIKRO kualitatif harus 165, dapat ${kual.body.data.length}`);
  });

  it('transaksi masuk & pecah: tambah -> list -> hapus', async function () {
    const g = await request(app).get('/api/glassware/stok').query({ periode_id: 1, lab: 1, jenis: 1 });
    const item = g.body.data[0];

    const addM = await request(app).post('/api/glassware/masuk').send({ periode_id: 1, laboratorium_id: 1, glassware_id: item.glassware_id, tanggal: '2026-03-10', jumlah: 4, keterangan: 'test' });
    assert.strictEqual(addM.status, 200, JSON.stringify(addM.body));

    const addP = await request(app).post('/api/glassware/pecah').send({ periode_id: 1, laboratorium_id: 1, glassware_id: item.glassware_id, tanggal: '2026-05-01', jumlah: 1, keterangan: 'test' });
    assert.strictEqual(addP.status, 200, JSON.stringify(addP.body));

    const listM = await request(app).get('/api/glassware/masuk').query({ periode_id: 1, lab: 1, jenis: 1 });
    assert.strictEqual(listM.status, 200);
    assert.ok(listM.body.data.some(r => r.id === addM.body.data.id), 'barang masuk baru harus ada di list');

    const listP = await request(app).get('/api/glassware/pecah').query({ periode_id: 1, lab: 1, jenis: 1 });
    assert.strictEqual(listP.status, 200);
    assert.ok(listP.body.data.some(r => r.id === addP.body.data.id), 'pecah baru harus ada di list');

    // Pecah melebihi stok harus ditolak (stok tidak boleh negatif)
    const bad = await request(app).post('/api/glassware/pecah').send({ periode_id: 1, laboratorium_id: 1, glassware_id: item.glassware_id, tanggal: '2026-05-02', jumlah: 999999, keterangan: 'test' });
    assert.strictEqual(bad.status, 400, `pecah berlebih harus 400, dapat ${bad.status}`);

    // Bersihkan data test
    await request(app).delete(`/api/glassware/masuk/${addM.body.data.id}`);
    await request(app).delete(`/api/glassware/pecah/${addP.body.data.id}`);
  });

  it('movement (tidak bergerak) per lab+jenis', async function () {
    const res = await request(app).get('/api/glassware/movement').query({ lab: 1, jenis: 1 });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.data) && res.body.data.length === 75, `harus 75, dapat ${res.body.data && res.body.data.length}`);
    const r = res.body.data[0];
    assert.ok(r.nama_barang && r.kode_barang, 'row harus punya nama & kode');
    assert.ok(typeof r.pernah_bergerak === 'boolean', 'pernah_bergerak harus boolean');
    if (r.pernah_bergerak) assert.ok(r.last_movement, 'pernah bergerak harus punya last_movement');
    if (!r.pernah_bergerak) assert.strictEqual(r.hari_tidak_bergerak, null);
  });

  it('hapus periode tidak ada -> 404 (tidak crash)', async function () {
    const res = await request(app).delete('/api/glassware/periode/999999');
    assert.strictEqual(res.status, 404, `harus 404, dapat ${res.status}`);
  });
});
