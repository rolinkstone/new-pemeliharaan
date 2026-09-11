// backend/routes/pencatatan.js
// =====================================================================
// PENCATATAN BARANG SEMENTARA
// Mendokumentasikan barang yang sudah diterima/diambil tetapi belum
// diinput oleh bagian keuangan (belum tersedia sebagai transaksi sistem).
//   tipe 'diterima' : diterima fisik, belum diinput keuangan
//   tipe 'diambil'  : diambil/diminta user sebelum input keuangan
// Counter = jumlah record dengan status 'belum' (perlu tindak lanjut).
// Mutasi hanya oleh PIC Gudang / Admin. Lihat: semua user login.
// =====================================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { keycloakAuth } = require('../middleware/keycloakAuth');
const { hasRole } = require('../utils/routeHelpers');

const getUsername = (req) => req.user?.name || req.user?.preferred_username || req.user?.username || req.user?.email || 'system';

const canManage = (req) => hasRole(req, ['pic_gudang', 'admin', 'superadmin', 'admin_pemeliharaan']);

const TIPE_VALID = ['diterima', 'diambil'];
const STATUS_VALID = ['belum', 'selesai'];

// ========== GET LIST ==========
router.get('/', keycloakAuth, async (req, res) => {
    try {
        const { tipe, status, search, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        let where = ' WHERE 1=1';
        const params = [];
        if (tipe && TIPE_VALID.includes(tipe)) { where += ' AND tipe = ?'; params.push(tipe); }
        if (status && STATUS_VALID.includes(status)) { where += ' AND status = ?'; params.push(status); }
        if (search) {
            where += ' AND (nama_barang LIKE ? OR jenis LIKE ? OR kategori LIKE ? OR sumber LIKE ? OR penerima LIKE ? OR catatan LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s, s, s, s, s);
        }

        const [countRes] = await db.query(`SELECT COUNT(*) as total FROM pencatatan_barang_sementara${where}`, params);
        const total = countRes[0]?.total || 0;

        const [rows] = await db.query(
            `SELECT * FROM pencatatan_barang_sementara${where}
             ORDER BY (status = 'belum') DESC, tanggal DESC, id DESC
             LIMIT ? OFFSET ?`,
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
        console.error('Error fetch pencatatan:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data pencatatan', error: error.message });
    }
});

// ========== GET COUNTER (untuk badge sub-menu) ==========
router.get('/counter', keycloakAuth, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT tipe, status, COUNT(*) as cnt
             FROM pencatatan_barang_sementara
             GROUP BY tipe, status`
        );
        const result = { diterima: { belum: 0, selesai: 0 }, diambil: { belum: 0, selesai: 0 } };
        rows.forEach(r => {
            if (result[r.tipe]) result[r.tipe][r.status] = r.cnt;
        });
        res.json({
            success: true,
            data: {
                diterima_belum: result.diterima.belum,
                diambil_belum: result.diambil.belum,
                diterima_total: result.diterima.belum + result.diterima.selesai,
                diambil_total: result.diambil.belum + result.diambil.selesai,
            }
        });
    } catch (error) {
        console.error('Error fetch counter pencatatan:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil counter', error: error.message });
    }
});

// ========== CREATE ==========
router.post('/', keycloakAuth, async (req, res) => {
    if (!canManage(req)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya PIC Gudang/Admin yang dapat mencatat.' });
    }
    try {
        const { tipe, nama_barang, jenis, kategori, jumlah, satuan, tanggal, sumber, penerima, penerima_id, catatan } = req.body;

        if (!tipe || !TIPE_VALID.includes(tipe)) {
            return res.status(400).json({ success: false, message: 'Tipe harus diterima atau diambil' });
        }
        if (!nama_barang || !String(nama_barang).trim()) {
            return res.status(400).json({ success: false, message: 'Nama barang wajib diisi' });
        }
        const jml = jumlah !== undefined && jumlah !== '' ? parseInt(jumlah, 10) : 1;
        if (isNaN(jml) || jml < 1) {
            return res.status(400).json({ success: false, message: 'Jumlah harus bilangan bulat >= 1' });
        }

        const username = getUsername(req);
        const [result] = await db.query(
            `INSERT INTO pencatatan_barang_sementara
             (tipe, nama_barang, jenis, kategori, jumlah, satuan, tanggal, sumber, penerima, penerima_id, catatan, status, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'belum', ?)`,
            [tipe, String(nama_barang).trim(), jenis || null, kategori || null, jml, satuan || 'pcs',
             tanggal || null, sumber || null, penerima || null, penerima_id || null, catatan || null, username]
        );
        res.status(201).json({ success: true, message: 'Pencatatan berhasil disimpan', data: { id: result.insertId } });
    } catch (error) {
        console.error('Error create pencatatan:', error);
        res.status(500).json({ success: false, message: 'Gagal menyimpan pencatatan', error: error.message });
    }
});

// ========== UPDATE ==========
router.put('/:id', keycloakAuth, async (req, res) => {
    if (!canManage(req)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak.' });
    }
    try {
        const { id } = req.params;
        const [existing] = await db.query('SELECT id FROM pencatatan_barang_sementara WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
        }

        const { tipe, nama_barang, jenis, kategori, jumlah, satuan, tanggal, sumber, penerima, penerima_id, catatan } = req.body;
        if (!nama_barang || !String(nama_barang).trim()) {
            return res.status(400).json({ success: false, message: 'Nama barang wajib diisi' });
        }
        const jml = jumlah !== undefined && jumlah !== '' ? parseInt(jumlah, 10) : 1;
        if (isNaN(jml) || jml < 1) {
            return res.status(400).json({ success: false, message: 'Jumlah harus bilangan bulat >= 1' });
        }

        await db.query(
            `UPDATE pencatatan_barang_sementara
             SET tipe = ?, nama_barang = ?, jenis = ?, kategori = ?, jumlah = ?, satuan = ?,
                 tanggal = ?, sumber = ?, penerima = ?, penerima_id = ?, catatan = ?, updated_at = NOW()
             WHERE id = ?`,
            [tipe || 'diterima', String(nama_barang).trim(), jenis || null, kategori || null, jml, satuan || 'pcs',
             tanggal || null, sumber || null, penerima || null, penerima_id || null, catatan || null, id]
        );
        res.json({ success: true, message: 'Pencatatan berhasil diperbarui' });
    } catch (error) {
        console.error('Error update pencatatan:', error);
        res.status(500).json({ success: false, message: 'Gagal memperbarui pencatatan', error: error.message });
    }
});

// ========== MARK SELESAI (tindak lanjut selesai) ==========
router.put('/:id/selesai', keycloakAuth, async (req, res) => {
    if (!canManage(req)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak.' });
    }
    try {
        const { id } = req.params;
        const { status_catatan } = req.body;
        const [existing] = await db.query('SELECT id, status FROM pencatatan_barang_sementara WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
        }
        await db.query(
            'UPDATE pencatatan_barang_sementara SET status = "selesai", status_catatan = ?, updated_at = NOW() WHERE id = ?',
            [status_catatan || null, id]
        );
        res.json({ success: true, message: 'Tindak lanjut ditandai selesai' });
    } catch (error) {
        console.error('Error selesai pencatatan:', error);
        res.status(500).json({ success: false, message: 'Gagal menandai selesai', error: error.message });
    }
});

// ========== REOPEN (kembalikan ke belum) ==========
router.put('/:id/buka', keycloakAuth, async (req, res) => {
    if (!canManage(req)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak.' });
    }
    try {
        const { id } = req.params;
        const [existing] = await db.query('SELECT id FROM pencatatan_barang_sementara WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
        }
        await db.query('UPDATE pencatatan_barang_sementara SET status = "belum", status_catatan = NULL, updated_at = NOW() WHERE id = ?', [id]);
        res.json({ success: true, message: 'Data dikembalikan ke daftar tindak lanjut' });
    } catch (error) {
        console.error('Error buka pencatatan:', error);
        res.status(500).json({ success: false, message: 'Gagal membuka kembali', error: error.message });
    }
});

// ========== DELETE ==========
router.delete('/:id', keycloakAuth, async (req, res) => {
    if (!canManage(req)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak.' });
    }
    try {
        const { id } = req.params;
        const [existing] = await db.query('SELECT id FROM pencatatan_barang_sementara WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
        }
        await db.query('DELETE FROM pencatatan_barang_sementara WHERE id = ?', [id]);
        res.json({ success: true, message: 'Data pencatatan dihapus' });
    } catch (error) {
        console.error('Error delete pencatatan:', error);
        res.status(500).json({ success: false, message: 'Gagal menghapus pencatatan', error: error.message });
    }
});

module.exports = router;
