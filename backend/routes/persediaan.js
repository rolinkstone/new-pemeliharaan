const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { keycloakAuth } = require('../middleware/keycloakAuth');
const { getUsernameFromToken, hasRole } = require('../utils/routeHelpers');
let XLSX = null;
try { XLSX = require('xlsx'); } catch (e) { console.log('⚠️ xlsx not installed, upload disabled'); }

// ========== HELPERS ==========
const getUsername = (req) => req.user?.name || req.user?.username || req.user?.preferred_username || req.user?.email || 'system';
const createNotif = async (userId, userRole, title, message, link) => {
    try {
        await db.query(
            'INSERT INTO notifications (user_id, user_role, title, message, link) VALUES (?, ?, ?, ?, ?)',
            [userId || '', userRole, title, message, link || '']
        );
    } catch (e) { console.error('Notif error:', e.message); }
};

// ========== BARANG PERSEDIAAN (Master) ==========

// GET all barang persediaan
router.get('/barang', keycloakAuth, async (req, res) => {
    try {
        const { search, jenis, kategori, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = ' WHERE 1=1';
        const params = [];
        if (search) {
            whereClause += ' AND (nama_barang LIKE ? OR jenis LIKE ? OR kategori LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s, s);
        }
        if (jenis) {
            whereClause += ' AND jenis = ?';
            params.push(jenis);
        }
        if (kategori) {
            whereClause += ' AND kategori = ?';
            params.push(kategori);
        }

        // Count total
        const [countResult] = await db.query(`SELECT COUNT(*) as total FROM barang_persediaan${whereClause}`, params);
        const total = countResult[0]?.total || 0;

        // Fetch page
        const [rows] = await db.query(
            `SELECT * FROM barang_persediaan${whereClause} ORDER BY nama_barang ASC LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), parseInt(offset)]
        );

        res.json({
            success: true,
            data: rows,
            pagination: {
                currentPage: parseInt(page),
                perPage: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit) || 1
            }
        });
    } catch (error) {
        console.error('Error fetch barang:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data barang', error: error.message });
    }
});

// GET filter options (jenis & kategori distinct)
router.get('/barang/filter-options', keycloakAuth, async (req, res) => {
    try {
        const [jenis] = await db.query('SELECT DISTINCT jenis FROM barang_persediaan WHERE jenis != "" ORDER BY jenis');
        const [kategori] = await db.query('SELECT DISTINCT kategori FROM barang_persediaan WHERE kategori != "" ORDER BY kategori');
        res.json({ success: true, data: { jenis: jenis.map(r => r.jenis), kategori: kategori.map(r => r.kategori) } });
    } catch (error) {
        console.error('Error fetch filter options:', error);
        res.status(500).json({ success: false, message: 'Gagal', error: error.message });
    }
});

// GET download template XLSX
router.get('/barang/template-xlsx', async (req, res) => {
    try {
        if (!XLSX) return res.status(500).json({ success: false, message: 'xlsx package tidak tersedia' });

        const wb = XLSX.utils.book_new();
        const wsData = [
            ['nama_barang', 'jenis', 'kategori', 'satuan', 'saldo_awal'],
            ['Contoh Barang A', 'ATK', 'Konsumsi', 'pcs', '100'],
            ['Contoh Barang B', 'ATK', 'Cetakan', 'box', '50'],
            ['', '', '', '', ''],
            ['Keterangan:', '', '', '', ''],
            ['- Nama barang (wajib)', '', '', '', ''],
            ['- Satuan (wajib): pcs, box, kg, rim, dll', '', '', '', ''],
            ['- Jenis & kategori (opsional)', '', '', '', ''],
            ['- Saldo awal (opsional, default 0)', '', '', '', ''],
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Template Barang');

        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template_import_barang.xlsx');
        res.send(buf);
    } catch (error) {
        console.error('Error generate template:', error);
        res.status(500).json({ success: false, message: 'Gagal generate template', error: error.message });
    }
});

// GET export mutasi stok per bulan (format XLSX)
router.get('/opname/export-mutasi', keycloakAuth, async (req, res) => {
    try {
        if (!XLSX) return res.status(500).json({ success: false, message: 'xlsx package tidak tersedia' });
        const { tahun } = req.query;
        const thn = tahun || new Date().getFullYear();

        // All items
        const [semuaBarang] = await db.query('SELECT * FROM barang_persediaan ORDER BY nama_barang ASC');

        const bulanNama = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

        // Helper: get mutasi for a specific month
        const getMutasiBulan = async (barangId, month) => {
            const startDate = `${thn}-${String(month).padStart(2,'0')}-01`;
            const endDate = new Date(thn, month, 0).toISOString().split('T')[0]; // last day of month

            // Pembelian (barang masuk)
            const [beli] = await db.query(
                'SELECT COALESCE(SUM(jumlah),0) as total FROM barang_masuk WHERE barang_id=? AND status="disetujui" AND tanggal_pembelian >= ? AND tanggal_pembelian <= ?',
                [barangId, startDate, endDate]
            );
            // Pemakaian (permintaan diserahkan)
            const [pakai] = await db.query(
                'SELECT COALESCE(SUM(jumlah),0) as total FROM permintaan_barang WHERE barang_id=? AND status="diserahkan" AND DATE(delivered_at) >= ? AND DATE(delivered_at) <= ?',
                [barangId, startDate, endDate]
            );
            // Saldo awal bulan ini: stok sebelum startDate
            const [masukSebelum] = await db.query(
                'SELECT COALESCE(SUM(jumlah),0) as total FROM barang_masuk WHERE barang_id=? AND status="disetujui" AND tanggal_pembelian < ?', [barangId, startDate]
            );
            const [keluarSebelum] = await db.query(
                'SELECT COALESCE(SUM(jumlah),0) as total FROM permintaan_barang WHERE barang_id=? AND status="diserahkan" AND DATE(delivered_at) < ?', [barangId, startDate]
            );
            // Saldo awal = stok terakhir sebelum bulan ini
            // Ambil saldo dari tabel barang_persediaan lalu kurangi mutasi bulan ini
            const stokSaatIni = 0; // fallback — akan dihitung per kolom
            return {
                pembelian: Number(beli[0].total),
                pemakaian: Number(pakai[0].total),
                saldo_awal: Number(masukSebelum[0].total) - Number(keluarSebelum[0].total),
            };
        };

        // Build header
        const headerRow = ['Nama Barang', 'Jenis', 'Kategori', 'Satuan'];
        for (let m = 1; m <= 12; m++) {
            const bln = bulanNama[m-1];
            headerRow.push(`${bln}-Pembelian`, `${bln}-Pemakaian`, `${bln}-Saldo`);
        }

        const wsData = [headerRow];

        for (const b of semuaBarang) {
            const row = [b.nama_barang, b.jenis || '', b.kategori || '', b.satuan];
            // Track cumulative saldo
            let saldoKumulatif = 0;
            // Hitung saldo awal tahun (sebelum Jan)
            const [mskThn] = await db.query(
                "SELECT COALESCE(SUM(jumlah),0) as total FROM barang_masuk WHERE barang_id=? AND status='disetujui' AND tanggal_pembelian < ?",
                [b.id, `${thn}-01-01`]
            );
            const [klrThn] = await db.query(
                "SELECT COALESCE(SUM(jumlah),0) as total FROM permintaan_barang WHERE barang_id=? AND status='diserahkan' AND DATE(delivered_at) < ?",
                [b.id, `${thn}-01-01`]
            );
            // Saldo akhir tahun sebelumnya = stok saat ini - mutasi tahun ini
            // Lebih sederhana: gunakan saldo dari tabel
            const [stokInfo] = await db.query('SELECT saldo FROM barang_persediaan WHERE id=?', [b.id]);
            const stokSekarang = Number(stokInfo[0]?.saldo || 0);
            // Hitung total masuk & keluar tahun ini
            const [mskThnIni] = await db.query(
                "SELECT COALESCE(SUM(jumlah),0) as total FROM barang_masuk WHERE barang_id=? AND status='disetujui' AND tanggal_pembelian >= ?",
                [b.id, `${thn}-01-01`]
            );
            const [klrThnIni] = await db.query(
                "SELECT COALESCE(SUM(jumlah),0) as total FROM permintaan_barang WHERE barang_id=? AND status='diserahkan' AND DATE(delivered_at) >= ?",
                [b.id, `${thn}-01-01`]
            );
            saldoKumulatif = stokSekarang - Number(mskThnIni[0].total) + Number(klrThnIni[0].total);

            for (let m = 1; m <= 12; m++) {
                const startDate = `${thn}-${String(m).padStart(2,'0')}-01`;
                const endDate = new Date(thn, m, 0).toISOString().split('T')[0];

                const [beli] = await db.query(
                    'SELECT COALESCE(SUM(jumlah),0) as total FROM barang_masuk WHERE barang_id=? AND status="disetujui" AND tanggal_pembelian >= ? AND tanggal_pembelian <= ?',
                    [b.id, startDate, endDate]
                );
                const [pakai] = await db.query(
                    'SELECT COALESCE(SUM(jumlah),0) as total FROM permintaan_barang WHERE barang_id=? AND status="diserahkan" AND DATE(delivered_at) >= ? AND DATE(delivered_at) <= ?',
                    [b.id, startDate, endDate]
                );
                const pembelian = Number(beli[0].total);
                const pemakaian = Number(pakai[0].total);
                // Saldo = saldo_kumulatif + pembelian - pemakaian
                const saldoAkhir = saldoKumulatif + pembelian - pemakaian;
                row.push(pembelian, pemakaian, Math.max(0, saldoAkhir));
                saldoKumulatif = saldoAkhir;
            }
            wsData.push(row);
        }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Column widths
        const colWidths = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 10 }];
        for (let m = 0; m < 12; m++) colWidths.push({ wch: 16 }, { wch: 14 }, { wch: 10 });
        ws['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(wb, ws, 'Mutasi Stok');

        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=mutasi_stok_${thn}.xlsx`);
        res.send(buf);
    } catch (error) {
        console.error('Error export mutasi:', error);
        res.status(500).json({ success: false, message: 'Gagal export', error: error.message });
    }
});
router.post('/barang/import-xlsx', keycloakAuth, async (req, res) => {
    if (!hasRole(req, ['pic_gudang', 'admin', 'superadmin'])) {
        return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }
    try {
        if (!XLSX) return res.status(500).json({ success: false, message: 'xlsx package tidak tersedia' });

        const { fileBase64 } = req.body;
        if (!fileBase64) return res.status(400).json({ success: false, message: 'File tidak ditemukan' });

        const buf = Buffer.from(fileBase64, 'base64');
        const wb = XLSX.read(buf, { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (rows.length === 0) return res.status(400).json({ success: false, message: 'File kosong atau format salah' });

        const username = getUsername(req);
        let success = 0, failed = 0, errors = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const nama_barang = (row.nama_barang || '').trim();
            const satuan = (row.satuan || '').trim();

            if (!nama_barang || !satuan) {
                failed++;
                errors.push(`Baris ${i + 2}: Nama barang atau satuan kosong`);
                continue;
            }

            const saldo = parseInt(row.saldo_awal) || 0;
            try {
                await db.query(
                    'INSERT INTO barang_persediaan (nama_barang, jenis, kategori, satuan, saldo, created_by) VALUES (?, ?, ?, ?, ?, ?)',
                    [nama_barang, (row.jenis || '').trim(), (row.kategori || '').trim(), satuan, saldo, username]
                );
                success++;
            } catch (e) {
                failed++;
                errors.push(`Baris ${i + 2}: ${e.message}`);
            }
        }

        res.json({ success: true, message: `${success} berhasil, ${failed} gagal`, data: { success, failed, errors } });
    } catch (error) {
        console.error('Error import xlsx:', error);
        res.status(500).json({ success: false, message: 'Gagal import file', error: error.message });
    }
});

// POST create barang persediaan
router.post('/barang', keycloakAuth, async (req, res) => {
    if (!hasRole(req, ['pic_gudang', 'admin', 'superadmin', 'kabag_tu'])) {
        return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }
    try {
        const { nama_barang, jenis, kategori, satuan, saldo_awal } = req.body;
        if (!nama_barang || !satuan) {
            return res.status(400).json({ success: false, message: 'Nama barang dan satuan wajib diisi' });
        }
        const saldo = parseInt(saldo_awal) || 0;
        const username = getUsername(req);
        const [result] = await db.query(
            'INSERT INTO barang_persediaan (nama_barang, jenis, kategori, satuan, saldo, created_by) VALUES (?, ?, ?, ?, ?, ?)',
            [nama_barang, jenis || '', kategori || '', satuan, saldo, username]
        );
        res.json({ success: true, data: { id: result.insertId }, message: 'Barang berhasil ditambahkan' });
    } catch (error) {
        console.error('Error create barang:', error);
        res.status(500).json({ success: false, message: 'Gagal menambah barang', error: error.message });
    }
});

// PUT update barang persediaan
router.put('/barang/:id', keycloakAuth, async (req, res) => {
    if (!hasRole(req, ['pic_gudang', 'admin', 'superadmin', 'kabag_tu'])) {
        return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }
    try {
        const { id } = req.params;
        const { nama_barang, jenis, kategori, satuan } = req.body;
        await db.query(
            'UPDATE barang_persediaan SET nama_barang=?, jenis=?, kategori=?, satuan=? WHERE id=?',
            [nama_barang, jenis || '', kategori || '', satuan, id]
        );
        res.json({ success: true, message: 'Barang berhasil diupdate' });
    } catch (error) {
        console.error('Error update barang:', error);
        res.status(500).json({ success: false, message: 'Gagal update barang', error: error.message });
    }
});

// DELETE barang persediaan
router.delete('/barang/:id', keycloakAuth, async (req, res) => {
    if (!hasRole(req, ['pic_gudang', 'admin', 'superadmin'])) {
        return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }
    try {
        const { id } = req.params;
        await db.query('DELETE FROM barang_persediaan WHERE id=?', [id]);
        res.json({ success: true, message: 'Barang berhasil dihapus' });
    } catch (error) {
        console.error('Error delete barang:', error);
        res.status(500).json({ success: false, message: 'Gagal hapus barang', error: error.message });
    }
});

// ========== BARANG MASUK (User Gudang upload kuitansi → Kabag TU approve) ==========

// GET all barang masuk
router.get('/barang-masuk', keycloakAuth, async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [countResult] = await db.query('SELECT COUNT(*) as total FROM barang_masuk');
        const total = countResult[0]?.total || 0;

        const [rows] = await db.query(`
            SELECT bm.*, bp.nama_barang, bp.satuan
            FROM barang_masuk bm
            LEFT JOIN barang_persediaan bp ON bm.barang_id = bp.id
            ORDER BY bm.created_at DESC
            LIMIT ? OFFSET ?
        `, [parseInt(limit), parseInt(offset)]);
        res.json({
            success: true,
            data: rows,
            total,
            pagination: {
                currentPage: parseInt(page),
                perPage: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit) || 1
            }
        });
    } catch (error) {
        console.error('Error fetch barang masuk:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data', error: error.message });
    }
});

// POST create barang masuk (user gudang) — LANGSUNG TAMBAH STOK
router.post('/barang-masuk', keycloakAuth, async (req, res) => {
    if (!hasRole(req, ['pic_gudang', 'admin', 'superadmin'])) {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya pic_gudang yang dapat menambah barang masuk.' });
    }
    const conn = await db.pool.getConnection();
    try {
        await conn.beginTransaction();
        const { barang_id, jumlah, kuitansi_url, catatan, tanggal_pembelian } = req.body;
        if (!barang_id || !jumlah || !kuitansi_url) {
            await conn.rollback(); conn.release();
            return res.status(400).json({ success: false, message: 'Barang, jumlah, dan kuitansi wajib diisi' });
        }
        const username = getUsername(req);
        // Insert record
        await conn.query(
            'INSERT INTO barang_masuk (barang_id, jumlah, kuitansi_url, catatan, status, created_by, tanggal_pembelian) VALUES (?, ?, ?, ?, "disetujui", ?, ?)',
            [barang_id, jumlah, kuitansi_url, catatan || '', username, tanggal_pembelian || null]
        );
        // Langsung tambah stok
        await conn.query('UPDATE barang_persediaan SET saldo = saldo + ? WHERE id=?', [jumlah, barang_id]);
        await conn.commit();
        res.json({ success: true, message: 'Barang masuk berhasil, stok bertambah' });
    } catch (error) {
        await conn.rollback();
        console.error('Error create barang masuk:', error);
        res.status(500).json({ success: false, message: 'Gagal mencatat barang masuk', error: error.message });
    } finally {
        conn.release();
    }
});

// POST batch barang masuk (satu nota untuk banyak barang) — LANGSUNG TAMBAH STOK
router.post('/barang-masuk/batch', keycloakAuth, async (req, res) => {
    if (!hasRole(req, ['pic_gudang', 'admin', 'superadmin'])) {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya pic_gudang yang dapat menambah barang masuk.' });
    }
    const conn = await db.pool.getConnection();
    try {
        await conn.beginTransaction();
        const { kuitansi_url, items, catatan_global, tanggal_pembelian } = req.body;
        if (!kuitansi_url || !items || !Array.isArray(items) || items.length === 0) {
            await conn.rollback(); conn.release();
            return res.status(400).json({ success: false, message: 'Kuitansi dan daftar barang wajib diisi' });
        }
        const username = getUsername(req);
        let inserted = 0;
        for (const item of items) {
            if (!item.barang_id || !item.jumlah) continue;
            await conn.query(
                'INSERT INTO barang_masuk (barang_id, jumlah, kuitansi_url, catatan, status, created_by, tanggal_pembelian) VALUES (?, ?, ?, ?, "disetujui", ?, ?)',
                [item.barang_id, item.jumlah, kuitansi_url, item.catatan || catatan_global || '', username, tanggal_pembelian || null]
            );
            // Langsung tambah stok
            await conn.query('UPDATE barang_persediaan SET saldo = saldo + ? WHERE id=?', [item.jumlah, item.barang_id]);
            inserted++;
        }
        await conn.commit();
        res.json({ success: true, message: `${inserted} barang masuk berhasil, stok bertambah`, data: { inserted } });
    } catch (error) {
        await conn.rollback();
        console.error('Error batch barang masuk:', error);
        res.status(500).json({ success: false, message: 'Gagal', error: error.message });
    } finally {
        conn.release();
    }
});

// PUT approve semua barang masuk berdasarkan kuitansi_url (batch approve)
router.put('/barang-masuk/approve-batch', keycloakAuth, async (req, res) => {
    if (!hasRole(req, ['kabag_tu', 'admin', 'superadmin'])) {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya kabag_tu yang dapat approve.' });
    }
    const conn = await db.pool.getConnection();
    try {
        await conn.beginTransaction();
        const { kuitansi_url } = req.body;
        if (!kuitansi_url) { await conn.rollback(); conn.release(); return res.status(400).json({ success: false, message: 'kuitansi_url wajib diisi' }); }

        // Get all pending items with this kuitansi_url
        const [rows] = await conn.query('SELECT * FROM barang_masuk WHERE kuitansi_url=? AND status="diajukan"', [kuitansi_url]);
        if (rows.length === 0) { await conn.rollback(); conn.release(); return res.status(404).json({ success: false, message: 'Tidak ada barang yang menunggu approve untuk nota ini' }); }

        // Update all to approved
        await conn.query(
            'UPDATE barang_masuk SET status="disetujui" WHERE kuitansi_url=? AND status="diajukan"',
            [kuitansi_url]
        );

        // Add stock for each item
        for (const row of rows) {
            await conn.query('UPDATE barang_persediaan SET saldo = saldo + ? WHERE id=?', [row.jumlah, row.barang_id]);
        }

        await conn.commit();
        res.json({ success: true, message: `${rows.length} barang disetujui, stok bertambah` });
    } catch (error) {
        await conn.rollback();
        console.error('Error batch approve:', error);
        res.status(500).json({ success: false, message: 'Gagal approve batch', error: error.message });
    } finally {
        conn.release();
    }
});

// PUT approve barang masuk (Kabag TU) — single item
router.put('/barang-masuk/:id/approve', keycloakAuth, async (req, res) => {
    if (!hasRole(req, ['kabag_tu', 'admin', 'superadmin'])) {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya kabag_tu yang dapat approve.' });
    }
    const conn = await db.pool.getConnection();
    try {
        await conn.beginTransaction();
        const { id } = req.params;

        // Get barang masuk data
        const [rows] = await conn.query('SELECT * FROM barang_masuk WHERE id=?', [id]);
        if (rows.length === 0) { await conn.rollback(); conn.release(); return res.status(404).json({ success: false, message: 'Data tidak ditemukan' }); }

        // Update status barang_masuk
        await conn.query(
            'UPDATE barang_masuk SET status="disetujui" WHERE id=?',
            [id]
        );

        // Tambah saldo barang_persediaan
        await conn.query(
            'UPDATE barang_persediaan SET saldo = saldo + ? WHERE id=?',
            [rows[0].jumlah, rows[0].barang_id]
        );

        await conn.commit();
        res.json({ success: true, message: 'Barang masuk disetujui, stok bertambah' });
    } catch (error) {
        await conn.rollback();
        console.error('Error approve barang masuk:', error);
        res.status(500).json({ success: false, message: 'Gagal approve', error: error.message });
    } finally {
        conn.release();
    }
});

// PUT tolak barang masuk
router.put('/barang-masuk/:id/tolak', keycloakAuth, async (req, res) => {
    if (!hasRole(req, ['kabag_tu', 'admin', 'superadmin'])) {
        return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }
    try {
        const { id } = req.params;
        const { alasan } = req.body;
        await db.query('UPDATE barang_masuk SET status="ditolak", catatan=CONCAT(catatan, ?) WHERE id=?',
            [` | Ditolak: ${alasan || ''}`, id]);
        res.json({ success: true, message: 'Barang masuk ditolak' });
    } catch (error) {
        console.error('Error tolak barang masuk:', error);
        res.status(500).json({ success: false, message: 'Gagal', error: error.message });
    }
});

// ========== PERMINTAAN BARANG (PIC Persediaan request → Katim → Kabag → PIC Gudang deliver) ==========

// GET all permintaan — grouped by group_id
router.get('/permintaan', keycloakAuth, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT p.*, bp.nama_barang, bp.satuan
            FROM permintaan_barang p
            LEFT JOIN barang_persediaan bp ON p.barang_id = bp.id
            ORDER BY p.created_at DESC
        `);

        // Group by group_id
        const groups = {};
        for (const r of rows) {
            const gid = r.group_id || `sg-${r.id}`;
            if (!groups[gid]) {
                groups[gid] = {
                    group_id: gid,
                    tanggal_permintaan: r.tanggal_permintaan,
                    requested_by: r.requested_by,
                    catatan: r.catatan,
                    status: r.status,
                    created_at: r.created_at,
                    katim_id: r.katim_id,
                    katim_nama: r.katim_nama,
                    approved_katim_by: r.approved_katim_by,
                    approved_katim_at: r.approved_katim_at,
                    approved_kabag_by: r.approved_kabag_by,
                    approved_kabag_at: r.approved_kabag_at,
                    delivered_by: r.delivered_by,
                    delivered_at: r.delivered_at,
                    items: []
                };
            }
            groups[gid].items.push({
                id: r.id,
                barang_id: r.barang_id,
                nama_barang: r.nama_barang,
                jumlah: r.jumlah,
                satuan: r.satuan,
                catatan_item: r.catatan,
                status: r.status
            });
        }

        // Derive group status from all items + summary counts
        for (const gid of Object.keys(groups)) {
            const group = groups[gid];
            const itemStatuses = group.items.map(i => i.status);
            const uniqueStatuses = [...new Set(itemStatuses)];
            group.diserahkan_count = itemStatuses.filter(s => s === 'diserahkan').length;
            group.ditolak_count = itemStatuses.filter(s => s === 'ditolak').length;
            if (uniqueStatuses.length > 1) {
                group.status = 'diserahkan_sebagian';
            }
        }

        res.json({
            success: true,
            data: Object.values(groups),
            total: Object.keys(groups).length
        });
    } catch (error) {
        console.error('Error fetch permintaan:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data', error: error.message });
    }
});

// POST create permintaan (PIC Persediaan) — multiple items in one group (max 5)
router.post('/permintaan', keycloakAuth, async (req, res) => {
    if (!hasRole(req, ['pic_persediaan', 'admin', 'superadmin'])) {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya pic_persediaan yang dapat request barang.' });
    }
    try {
        const { items, catatan, tanggal } = req.body;
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Minimal 1 item barang harus dipilih' });
        }
        if (items.length > 5) {
            return res.status(400).json({ success: false, message: 'Maksimal 5 item barang per permintaan' });
        }
        const username = getUsername(req);
        const { v4: uuidv4 } = require('uuid');
        const groupId = uuidv4();
        const tgl = tanggal || new Date().toISOString().split('T')[0];

        // Cek stok untuk setiap item
        for (const item of items) {
            if (!item.barang_id || !item.jumlah) continue;
            const [barang] = await db.query('SELECT saldo, nama_barang FROM barang_persediaan WHERE id=?', [item.barang_id]);
            if (barang.length === 0) {
                return res.status(400).json({ success: false, message: `Barang ID ${item.barang_id} tidak ditemukan` });
            }
            const stok = Number(barang[0].saldo);
            const minta = Number(item.jumlah);
            if (stok <= 0) {
                return res.status(400).json({ success: false, message: `"${barang[0].nama_barang}" stok habis (0), tidak bisa diajukan` });
            }
            if (minta > stok) {
                return res.status(400).json({ success: false, message: `"${barang[0].nama_barang}" stok tersisa ${stok}, tidak mencukupi permintaan ${minta}` });
            }
        }

        const results = [];
        for (const item of items) {
            if (!item.barang_id || !item.jumlah) continue;
            const [result] = await db.query(
                'INSERT INTO permintaan_barang (group_id, tanggal_permintaan, barang_id, jumlah, catatan, status, requested_by) VALUES (?, ?, ?, ?, ?, "draft", ?)',
                [groupId, tgl, item.barang_id, item.jumlah, item.catatan || catatan || '', username]
            );
            results.push(result.insertId);
        }
        res.json({ success: true, data: { group_id: groupId, ids: results }, message: `Permintaan ${results.length} item disimpan sebagai draft` });
    } catch (error) {
        console.error('Error create permintaan:', error);
        res.status(500).json({ success: false, message: 'Gagal membuat permintaan', error: error.message });
    }
});

// PUT kirim ke katim — update all items in a group
router.put('/permintaan/:groupId/kirim-ke-katim', keycloakAuth, async (req, res) => {
    try {
        const { groupId } = req.params;
        const { katim_id, katim_nama } = req.body;
        if (!katim_id) return res.status(400).json({ success: false, message: 'Pilih Katim terlebih dahulu' });

        // Count items in group
        const [items] = await db.query('SELECT COUNT(*) as cnt FROM permintaan_barang WHERE group_id=?', [groupId]);
        if (items.length === 0 || items[0].cnt === 0) {
            return res.status(404).json({ success: false, message: 'Group permintaan tidak ditemukan' });
        }

        await db.query(
            'UPDATE permintaan_barang SET katim_id=?, katim_nama=?, status="menunggu_katim" WHERE group_id=? AND (status="draft" OR status="diajukan")',
            [katim_id, katim_nama || '', groupId]
        );
        // Notif ke Katim
        await createNotif(katim_id, 'katim', 'Permintaan Barang Baru',
            `Ada permintaan barang dari ${getUsername(req)} yang perlu disetujui`, `/persediaan`);
        res.json({ success: true, message: `Permintaan dikirim ke ${katim_nama || 'Katim'}` });
    } catch (error) {
        console.error('Error kirim ke katim:', error);
        res.status(500).json({ success: false, message: 'Gagal', error: error.message });
    }
});

// PUT approve katim — approve all items in a group
router.put('/permintaan/:groupId/approve-katim', keycloakAuth, async (req, res) => {
    if (!hasRole(req, ['katim', 'admin', 'superadmin'])) {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya katim yang dapat approve.' });
    }
    try {
        const { groupId } = req.params;
        const username = getUsername(req);
        await db.query(
            'UPDATE permintaan_barang SET status="disetujui_katim", approved_katim_by=?, approved_katim_at=NOW() WHERE group_id=? AND (status="diajukan" OR status="menunggu_katim")',
            [username, groupId]
        );
        await createNotif('', 'kabag_tu', 'Permintaan Disetujui Katim',
            `Permintaan barang telah disetujui oleh Katim, menunggu persetujuan Kabag TU`, `/persediaan`);
        res.json({ success: true, message: 'Disetujui Katim, menunggu persetujuan Kabag TU' });
    } catch (error) {
        console.error('Error approve katim:', error);
        res.status(500).json({ success: false, message: 'Gagal', error: error.message });
    }
});

// PUT approve kabag — approve all items in a group
router.put('/permintaan/:groupId/approve-kabag', keycloakAuth, async (req, res) => {
    if (!hasRole(req, ['kabag_tu', 'admin', 'superadmin'])) {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya kabag_tu yang dapat approve.' });
    }
    try {
        const { groupId } = req.params;
        const username = getUsername(req);
        await db.query(
            'UPDATE permintaan_barang SET status="disetujui_kabag", approved_kabag_by=?, approved_kabag_at=NOW() WHERE group_id=? AND status="disetujui_katim"',
            [username, groupId]
        );
        await createNotif('', 'pic_gudang', 'Permintaan Siap Diserahkan',
            `Permintaan barang telah disetujui Kabag TU, silakan proses penyerahan barang`, `/persediaan`);
        res.json({ success: true, message: 'Disetujui Kabag TU, siap diproses PIC Gudang' });
    } catch (error) {
        console.error('Error approve kabag:', error);
        res.status(500).json({ success: false, message: 'Gagal', error: error.message });
    }
});

// POST proses-items (PIC Gudang) — serahkan per item, bisa koreksi jumlah & tolak per item
router.post('/permintaan/:groupId/proses-items', keycloakAuth, async (req, res) => {
    if (!hasRole(req, ['pic_gudang', 'admin', 'superadmin'])) {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya pic_gudang yang dapat memproses.' });
    }
    const conn = await db.pool.getConnection();
    try {
        await conn.beginTransaction();
        const { groupId } = req.params;
        const { items } = req.body; // [{id, jumlah_serahkan, ditolak, alasan}]
        const username = getUsername(req);

        if (!items || !Array.isArray(items) || items.length === 0) {
            await conn.rollback(); conn.release();
            return res.status(400).json({ success: false, message: 'Tidak ada item yang diproses' });
        }

        let serahCount = 0, tolakCount = 0;

        for (const item of items) {
            // Ambil data permintaan & stok
            const [rows] = await conn.query('SELECT p.*, bp.saldo as stok_tersedia, bp.nama_barang FROM permintaan_barang p LEFT JOIN barang_persediaan bp ON p.barang_id = bp.id WHERE p.id=? AND p.group_id=?', [item.id, groupId]);
            if (rows.length === 0) continue;
            const p = rows[0];

            if (item.ditolak) {
                // Tolak item
                await conn.query(
                    'UPDATE permintaan_barang SET status="ditolak", catatan=CONCAT(IFNULL(catatan,""), ?) WHERE id=?',
                    [` | Ditolak oleh ${username}: ${item.alasan || 'Stok tidak tersedia'}`, item.id]
                );
                tolakCount++;
            } else {
                // Serahkan dengan jumlah yang sudah dikoreksi
                const jumlahSerah = Math.min(Number(item.jumlah_serahkan) || 0, Number(p.jumlah), Number(p.stok_tersedia));
                if (jumlahSerah <= 0) {
                    // Jika setelah koreksi jadi 0, anggap ditolak
                    await conn.query(
                        'UPDATE permintaan_barang SET status="ditolak", catatan=CONCAT(IFNULL(catatan,""), ?) WHERE id=?',
                        [` | Ditolak oleh ${username}: Stok tidak mencukupi`, item.id]
                    );
                    tolakCount++;
                    continue;
                }

                // Update jumlah & status
                await conn.query(
                    'UPDATE permintaan_barang SET jumlah=?, status="diserahkan", delivered_by=?, delivered_at=NOW() WHERE id=?',
                    [jumlahSerah, username, item.id]
                );

                // Kurangi stok
                await conn.query(
                    'UPDATE barang_persediaan SET saldo = saldo - ? WHERE id=?',
                    [jumlahSerah, p.barang_id]
                );

                serahCount++;
            }
        }

        await conn.commit();
        const msgParts = [];
        if (serahCount > 0) msgParts.push(`${serahCount} item diserahkan`);
        if (tolakCount > 0) msgParts.push(`${tolakCount} item ditolak`);
        res.json({ success: true, message: msgParts.join(', ') + (serahCount > 0 ? ', stok berkurang' : '') });
    } catch (error) {
        await conn.rollback();
        console.error('Error proses items:', error);
        res.status(500).json({ success: false, message: 'Gagal memproses', error: error.message });
    } finally {
        conn.release();
    }
});

// DELETE all items in a permintaan group (only if all draft)
router.delete('/permintaan/:groupId', keycloakAuth, async (req, res) => {
    try {
        const { groupId } = req.params;
        const [rows] = await db.query('SELECT status FROM permintaan_barang WHERE group_id=?', [groupId]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
        const allDraft = rows.every(r => r.status === 'draft');
        if (!allDraft) return res.status(400).json({ success: false, message: 'Hanya draft yang bisa dihapus' });
        await db.query('DELETE FROM permintaan_barang WHERE group_id=?', [groupId]);
        res.json({ success: true, message: 'Permintaan dihapus' });
    } catch (error) {
        console.error('Error delete permintaan:', error);
        res.status(500).json({ success: false, message: 'Gagal', error: error.message });
    }
});

// PUT tolak permintaan — group level, all items
router.put('/permintaan/:groupId/tolak', keycloakAuth, async (req, res) => {
    try {
        const { groupId } = req.params;
        const { alasan } = req.body;
        const username = getUsername(req);
        await db.query(
            'UPDATE permintaan_barang SET status="ditolak", catatan=CONCAT(IFNULL(catatan,""), ?) WHERE group_id=? AND status!="diserahkan" AND status!="ditolak"',
            [` | Ditolak oleh ${username}: ${alasan || ''}`, groupId]
        );
        res.json({ success: true, message: `Permintaan ditolak${alasan ? ': ' + alasan : ''}` });
    } catch (error) {
        console.error('Error tolak permintaan:', error);
        res.status(500).json({ success: false, message: 'Gagal', error: error.message });
    }
});

// ========== STOK OPNAME ==========

// GET all stok opname
router.get('/opname', keycloakAuth, async (req, res) => {
    try {
        const { tanggal_mulai, tanggal_akhir } = req.query;
        let query = `
            SELECT so.*, bp.nama_barang, bp.satuan
            FROM stok_opname so
            LEFT JOIN barang_persediaan bp ON so.barang_id = bp.id
            WHERE 1=1
        `;
        const params = [];
        if (tanggal_mulai) { query += ' AND so.tanggal >= ?'; params.push(tanggal_mulai); }
        if (tanggal_akhir) { query += ' AND so.tanggal <= ?'; params.push(tanggal_akhir); }
        query += ' ORDER BY so.tanggal DESC, so.created_at DESC';
        const [rows] = await db.query(query, params);
        res.json({ success: true, data: rows, total: rows.length });
    } catch (error) {
        console.error('Error fetch opname:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data opname', error: error.message });
    }
});

// GET mutasi stok — semua barang + mutasi masuk/keluar dalam range tanggal
router.get('/opname/mutasi', keycloakAuth, async (req, res) => {
    try {
        const { tanggal_mulai, tanggal_akhir } = req.query;

        // All items with current stock
        const [semuaBarang] = await db.query('SELECT * FROM barang_persediaan ORDER BY nama_barang ASC');

        // Mutasi masuk dalam range (filter pakai tanggal_pembelian)
        let masukQuery = 'SELECT barang_id, SUM(jumlah) as total_masuk FROM barang_masuk WHERE status="disetujui"';
        const masukParams = [];
        if (tanggal_mulai) { masukQuery += ' AND tanggal_pembelian >= ?'; masukParams.push(tanggal_mulai); }
        if (tanggal_akhir) { masukQuery += ' AND tanggal_pembelian <= ?'; masukParams.push(tanggal_akhir); }
        masukQuery += ' GROUP BY barang_id';
        const [masukRows] = await db.query(masukQuery, masukParams);
        const masukMap = {};
        masukRows.forEach(r => { masukMap[r.barang_id] = r.total_masuk; });

        // Mutasi keluar dalam range
        let keluarQuery = 'SELECT barang_id, SUM(jumlah) as total_keluar FROM permintaan_barang WHERE status="diserahkan"';
        const keluarParams = [];
        if (tanggal_mulai) { keluarQuery += ' AND delivered_at >= ?'; keluarParams.push(tanggal_mulai); }
        if (tanggal_akhir) { keluarQuery += ' AND delivered_at <= ?'; keluarParams.push(tanggal_akhir + ' 23:59:59'); }
        keluarQuery += ' GROUP BY barang_id';
        const [keluarRows] = await db.query(keluarQuery, keluarParams);
        const keluarMap = {};
        keluarRows.forEach(r => { keluarMap[r.barang_id] = r.total_keluar; });

        // Mutasi masuk SETELAH range (untuk kalkulasi stok_awal)
        let masukSetelahMap = {};
        if (tanggal_akhir) {
            let q = 'SELECT barang_id, SUM(jumlah) as total FROM barang_masuk WHERE status="disetujui" AND tanggal_pembelian > ?';
            const p = [tanggal_akhir];
            q += ' GROUP BY barang_id';
            const [rows] = await db.query(q, p);
            rows.forEach(r => { masukSetelahMap[r.barang_id] = r.total; });
        }

        // Mutasi keluar SETELAH range
        let keluarSetelahMap = {};
        if (tanggal_akhir) {
            let q = 'SELECT barang_id, SUM(jumlah) as total FROM permintaan_barang WHERE status="diserahkan" AND delivered_at > ?';
            const p = [tanggal_akhir + ' 23:59:59'];
            q += ' GROUP BY barang_id';
            const [rows] = await db.query(q, p);
            rows.forEach(r => { keluarSetelahMap[r.barang_id] = r.total; });
        }

        // Gabungkan (pake Number() biar gak concatenation string)
        const data = semuaBarang.map(b => {
            const masuk = Number(masukMap[b.id]) || 0;
            const keluar = Number(keluarMap[b.id]) || 0;
            const masukStlh = Number(masukSetelahMap[b.id]) || 0;
            const keluarStlh = Number(keluarSetelahMap[b.id]) || 0;
            const saldo = Number(b.saldo) || 0;
            const stok_awal = saldo - masuk + keluar - masukStlh + keluarStlh;
            const stok_akhir = stok_awal + masuk - keluar;
            return {
                id: b.id,
                nama_barang: b.nama_barang,
                jenis: b.jenis,
                kategori: b.kategori,
                satuan: b.satuan,
                stok_awal,
                masuk,
                keluar,
                stok_akhir,
            };
        });

        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetch mutasi:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil mutasi stok', error: error.message });
    }
});

// GET detail transaksi suatu barang (masuk/keluar) dalam range tanggal
router.get('/opname/mutasi/:barang_id/detail', keycloakAuth, async (req, res) => {
    try {
        const { barang_id } = req.params;
        const { tanggal_mulai, tanggal_akhir, jenis } = req.query; // jenis = 'masuk' | 'keluar'

        let result = [];
        if (!jenis || jenis === 'masuk') {
            let q = `SELECT bm.id, bm.jumlah, bm.tanggal_pembelian, bm.kuitansi_url, bm.catatan, bm.created_by,
                     bp.nama_barang, bp.satuan FROM barang_masuk bm
                     LEFT JOIN barang_persediaan bp ON bm.barang_id = bp.id
                     WHERE bm.barang_id = ? AND bm.status="disetujui"`;
            const p = [barang_id];
            if (tanggal_mulai) { q += ' AND bm.tanggal_pembelian >= ?'; p.push(tanggal_mulai); }
            if (tanggal_akhir) { q += ' AND bm.tanggal_pembelian <= ?'; p.push(tanggal_akhir); }
            q += ' ORDER BY bm.tanggal_pembelian DESC';
            const [rows] = await db.query(q, p);
            result = [...result, ...rows.map(r => ({ ...r, tipe: 'masuk' }))];
        }

        if (!jenis || jenis === 'keluar') {
            let q = `SELECT p.id, p.jumlah, p.delivered_at as tanggal, p.catatan, p.requested_by, p.delivered_by,
                     bp.nama_barang, bp.satuan FROM permintaan_barang p
                     LEFT JOIN barang_persediaan bp ON p.barang_id = bp.id
                     WHERE p.barang_id = ? AND p.status="diserahkan"`;
            const p = [barang_id];
            if (tanggal_mulai) { q += ' AND p.delivered_at >= ?'; p.push(tanggal_mulai); }
            if (tanggal_akhir) { q += ' AND p.delivered_at <= ?'; p.push(tanggal_akhir + ' 23:59:59'); }
            q += ' ORDER BY p.delivered_at DESC';
            const [rows] = await db.query(q, p);
            result = [...result, ...rows.map(r => ({ ...r, tipe: 'keluar' }))];
        }

        // Sortir by tanggal (desc)
        result.sort((a, b) => {
            const da = new Date(a.tanggal_pembelian || a.tanggal || 0).getTime();
            const db = new Date(b.tanggal_pembelian || b.tanggal || 0).getTime();
            return db - da;
        });

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error fetch detail mutasi:', error);
        res.status(500).json({ success: false, message: 'Gagal', error: error.message });
    }
});

// POST create stok opname
router.post('/opname', keycloakAuth, async (req, res) => {
    if (!hasRole(req, ['pic_gudang', 'admin', 'superadmin', 'kabag_tu'])) {
        return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }
    const conn = await db.pool.getConnection();
    try {
        await conn.beginTransaction();
        const { barang_id, stok_nyata, tanggal, catatan } = req.body;
        if (!barang_id || stok_nyata === undefined || !tanggal) {
            await conn.rollback(); conn.release();
            return res.status(400).json({ success: false, message: 'Barang, stok nyata, dan tanggal wajib diisi' });
        }

        const username = getUsername(req);

        // Ambil stok sistem saat ini
        const [barang] = await conn.query('SELECT saldo FROM barang_persediaan WHERE id=?', [barang_id]);
        if (barang.length === 0) { await conn.rollback(); conn.release(); return res.status(404).json({ success: false, message: 'Barang tidak ditemukan' }); }

        const stok_sistem = barang[0].saldo;
        const selisih = stok_nyata - stok_sistem;

        // Simpan opname
        await conn.query(
            'INSERT INTO stok_opname (barang_id, stok_sistem, stok_nyata, selisih, tanggal, catatan, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [barang_id, stok_sistem, stok_nyata, selisih, tanggal, catatan || '', username]
        );

        // Update saldo berdasarkan stok nyata
        await conn.query('UPDATE barang_persediaan SET saldo=? WHERE id=?', [stok_nyata, barang_id]);

        await conn.commit();
        res.json({ success: true, message: `Stok opname dicatat. Selisih: ${selisih >= 0 ? '+' : ''}${selisih}` });
    } catch (error) {
        await conn.rollback();
        console.error('Error create opname:', error);
        res.status(500).json({ success: false, message: 'Gagal mencatat opname', error: error.message });
    } finally {
        conn.release();
    }
});

module.exports = router;
