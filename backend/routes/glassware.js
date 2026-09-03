// backend/routes/glassware.js
// ============================================================
// PERSEDIAAN GLASSWARE (Laboratorium)
//
// v2: Barang masuk & glassware pecah adalah TRANSAKSI yang boleh
// terjadi LEBIH DARI 1 KALI per item per periode (menyamakan pola
// "Barang Masuk" ATK/Reagen).
//   - glassware_masuk  : daftar transaksi barang masuk (tanggal, jumlah)
//   - glassware_pecah  : daftar transaksi glassware pecah (tanggal, jumlah)
//   - stok_opname_glassware : stok_sebelumnya per (periode, lab, item)
//   - stok saat ini = stok_sebelumnya + SUM(masuk) - SUM(pecah)
//
// Semua user login bisa melihat; perubahan (tambah/hapus) hanya role:
// pic_gudang, pic_lab, admin, superadmin
// ============================================================
const express = require('express');
const router = express.Router();
const db = require('../db');
const { keycloakAuth } = require('../middleware/keycloakAuth');
const { hasRole } = require('../utils/routeHelpers');

const EDIT_ROLES = ['pic_gudang', 'pic_lab', 'admin', 'superadmin'];
// Menambah periode & master glassware: pic_lab TIDAK boleh
const MANAGE_ROLES = ['pic_gudang', 'admin', 'superadmin'];
const getUsername = (req) => req.user?.name || req.user?.username || req.user?.preferred_username || req.user?.email || 'system';
const toInt = (v, def = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : def;
};
const toDate = (v) => {
    if (!v) return null;
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (s.includes('T')) return s.split('T')[0];
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmtDateOut = (v) => {
    if (!v) return null;
    if (v instanceof Date && !isNaN(v.getTime())) {
        return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
    }
    const s = String(v);
    const mm = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return mm ? mm[0] : s.slice(0, 10);
};

// ========== LABORATORIUM / JENIS / MASTER ==========
router.get('/laboratorium', keycloakAuth, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id, kode, nama FROM laboratorium ORDER BY id ASC');
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetch laboratorium:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data laboratorium', error: error.message });
    }
});

router.get('/jenis', keycloakAuth, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id, kode, nama FROM jenis_glassware ORDER BY id ASC');
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetch jenis glassware:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data jenis glassware', error: error.message });
    }
});

router.get('/master', keycloakAuth, async (req, res) => {
    try {
        const { jenis_id, search } = req.query;
        let where = ' WHERE 1=1';
        const params = [];
        if (jenis_id) { where += ' AND m.jenis_id = ?'; params.push(jenis_id); }
        if (search) {
            where += ' AND (m.nama LIKE ? OR m.nomor_kontrol LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s);
        }
        const [rows] = await db.query(
            `SELECT m.id, m.nomor_kontrol, m.nama, m.ukuran, m.satuan, m.jenis_id, j.kode AS jenis_kode
             FROM master_glassware m
             LEFT JOIN jenis_glassware j ON j.id = m.jenis_id
             ${where} ORDER BY m.jenis_id ASC, m.id ASC LIMIT 500`,
            params
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetch master glassware:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data glassware', error: error.message });
    }
});

// ========== PERIODE ==========
router.get('/periode', keycloakAuth, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id, nama, tanggal, keterangan, created_at FROM periode_stok_opname ORDER BY tanggal DESC, id DESC');
        res.json({ success: true, data: rows.map(r => ({ ...r, tanggal: fmtDateOut(r.tanggal) })) });
    } catch (error) {
        console.error('Error fetch periode:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data periode', error: error.message });
    }
});

// POST buat periode baru + salin stok periode sebelumnya (carryover)
// stok_sebelumnya(baru) = stok_saat_ini(lama) = stok_sebelumnya + sum(masuk) - sum(pecah)
router.post('/periode', keycloakAuth, async (req, res) => {
    if (!hasRole(req, MANAGE_ROLES)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya pic_gudang/admin yang dapat membuat periode.' });
    }
    const conn = await db.pool.getConnection();
    try {
        await conn.beginTransaction();
        const { nama, tanggal, keterangan } = req.body;
        const tgl = toDate(tanggal);
        if (!nama || !tgl) {
            await conn.rollback(); conn.release();
            return res.status(400).json({ success: false, message: 'Nama periode dan tanggal wajib diisi' });
        }
        const [prevRows] = await conn.query('SELECT id FROM periode_stok_opname ORDER BY id DESC LIMIT 1');
        const prevId = prevRows.length ? prevRows[0].id : null;

        const [ins] = await conn.query(
            'INSERT INTO periode_stok_opname (nama, tanggal, keterangan) VALUES (?, ?, ?)',
            [nama, tgl, keterangan || '']
        );
        const newId = ins.insertId;

        if (prevId) {
            // Salin tiap item lab dari periode sebelumnya, stok_sebelumnya = stok saat ini periode lama
            await conn.query(
                `INSERT INTO stok_opname_glassware
                   (periode_id, laboratorium_id, glassware_id, stok_sebelumnya,
                    tanggal_masuk, jumlah_masuk, tanggal_pecah, jumlah_pecah, stok_saat_ini, keterangan)
                 SELECT ?, so.laboratorium_id, so.glassware_id,
                        COALESCE(so.stok_sebelumnya, 0)
                          + COALESCE((SELECT SUM(gm.jumlah) FROM glassware_masuk gm WHERE gm.periode_id = ? AND gm.laboratorium_id = so.laboratorium_id AND gm.glassware_id = so.glassware_id), 0)
                          - COALESCE((SELECT SUM(gp.jumlah) FROM glassware_pecah gp WHERE gp.periode_id = ? AND gp.laboratorium_id = so.laboratorium_id AND gp.glassware_id = so.glassware_id), 0),
                        NULL, 0, NULL, 0, 0, NULL
                 FROM stok_opname_glassware so
                 WHERE so.periode_id = ?`,
                [newId, prevId, prevId, prevId]
            );
        }
        await conn.commit();
        res.json({ success: true, message: 'Periode baru berhasil dibuat (stok sebelumnya disalin)', data: { id: newId } });
    } catch (error) {
        await conn.rollback();
        console.error('Error create periode glassware:', error);
        res.status(500).json({ success: false, message: 'Gagal membuat periode', error: error.message });
    } finally {
        conn.release();
    }
});

// ========== REKAP STOK (per periode + lab + jenis) ==========
router.get('/stok', keycloakAuth, async (req, res) => {
    try {
        const { periode_id, lab, jenis } = req.query;
        if (!periode_id || !lab || !jenis) {
            return res.status(400).json({ success: false, message: 'periode_id, lab, dan jenis wajib diisi' });
        }
        const [rows] = await db.query(
            `SELECT m.id AS glassware_id, m.nomor_kontrol, m.nama, m.ukuran, m.satuan,
                    COALESCE(so.stok_sebelumnya, 0) AS stok_sebelumnya,
                    COALESCE((SELECT SUM(gm.jumlah) FROM glassware_masuk gm
                               WHERE gm.periode_id = ? AND gm.laboratorium_id = ? AND gm.glassware_id = m.id), 0) AS total_masuk,
                    (SELECT COUNT(*) FROM glassware_masuk gm
                               WHERE gm.periode_id = ? AND gm.laboratorium_id = ? AND gm.glassware_id = m.id) AS jml_transaksi_masuk,
                    COALESCE((SELECT SUM(gp.jumlah) FROM glassware_pecah gp
                               WHERE gp.periode_id = ? AND gp.laboratorium_id = ? AND gp.glassware_id = m.id), 0) AS total_pecah,
                    (SELECT COUNT(*) FROM glassware_pecah gp
                               WHERE gp.periode_id = ? AND gp.laboratorium_id = ? AND gp.glassware_id = m.id) AS jml_transaksi_pecah
             FROM master_glassware m
             JOIN (SELECT DISTINCT glassware_id FROM stok_opname_glassware WHERE laboratorium_id = ?) lm
               ON lm.glassware_id = m.id
             LEFT JOIN stok_opname_glassware so
               ON so.glassware_id = m.id AND so.periode_id = ? AND so.laboratorium_id = ?
             WHERE m.jenis_id = ?
             ORDER BY m.id ASC`,
            [periode_id, lab, periode_id, lab, periode_id, lab, periode_id, lab, lab, periode_id, lab, jenis]
        );
        const data = rows.map(r => ({
            ...r,
            total_masuk: Number(r.total_masuk) || 0,
            total_pecah: Number(r.total_pecah) || 0,
            jml_transaksi_masuk: Number(r.jml_transaksi_masuk) || 0,
            jml_transaksi_pecah: Number(r.jml_transaksi_pecah) || 0,
            stok_sebelumnya: Number(r.stok_sebelumnya) || 0,
            stok_saat_ini: (Number(r.stok_sebelumnya) || 0) + (Number(r.total_masuk) || 0) - (Number(r.total_pecah) || 0),
        }));
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetch rekap glassware:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data rekap glassware', error: error.message });
    }
});

// ========== LIST TRANSAKSI (masuk / pecah) ==========
const TRANS_LIST = (jenisTable) => `
    SELECT t.id, t.periode_id, t.laboratorium_id, t.glassware_id,
           m.nomor_kontrol, m.nama, m.ukuran, m.satuan, m.jenis_id,
           DATE_FORMAT(t.tanggal, '%Y-%m-%d') AS tanggal,
           t.jumlah, t.keterangan, t.created_by, t.created_at
    FROM ${jenisTable} t
    LEFT JOIN master_glassware m ON m.id = t.glassware_id
    WHERE t.periode_id = ? AND t.laboratorium_id = ? AND m.jenis_id = ?
    ORDER BY t.tanggal DESC, t.id DESC
`;

router.get('/masuk', keycloakAuth, async (req, res) => {
    try {
        const { periode_id, lab, jenis } = req.query;
        if (!periode_id || !lab || !jenis) return res.status(400).json({ success: false, message: 'periode_id, lab, jenis wajib diisi' });
        const [rows] = await db.query(TRANS_LIST('glassware_masuk'), [periode_id, lab, jenis]);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetch masuk glassware:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data barang masuk', error: error.message });
    }
});

router.get('/pecah', keycloakAuth, async (req, res) => {
    try {
        const { periode_id, lab, jenis } = req.query;
        if (!periode_id || !lab || !jenis) return res.status(400).json({ success: false, message: 'periode_id, lab, jenis wajib diisi' });
        const [rows] = await db.query(TRANS_LIST('glassware_pecah'), [periode_id, lab, jenis]);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetch pecah glassware:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data pecah', error: error.message });
    }
});

// ========== TAMBAH TRANSAKSI ==========
// Pastikan stok periode berjalan tidak negatif & baris stok opname tersedia
const ensureStokRow = async (conn, periode_id, laboratorium_id, glassware_id) => {
    const [ex] = await conn.query(
        'SELECT id FROM stok_opname_glassware WHERE periode_id=? AND laboratorium_id=? AND glassware_id=?',
        [periode_id, laboratorium_id, glassware_id]
    );
    if (ex.length === 0) {
        await conn.query(
            `INSERT INTO stok_opname_glassware
               (periode_id, laboratorium_id, glassware_id, stok_sebelumnya,
                tanggal_masuk, jumlah_masuk, tanggal_pecah, jumlah_pecah, stok_saat_ini, keterangan)
             VALUES (?, ?, ?, 0, NULL, 0, NULL, 0, 0, NULL)`,
            [periode_id, laboratorium_id, glassware_id]
        );
    }
};

const computeStokAfter = async (conn, periode_id, laboratorium_id, glassware_id, delta) => {
    const [base] = await conn.query(
        'SELECT COALESCE(stok_sebelumnya,0) stok_sebelumnya FROM stok_opname_glassware WHERE periode_id=? AND laboratorium_id=? AND glassware_id=?',
        [periode_id, laboratorium_id, glassware_id]
    );
    const stokSblm = base.length ? Number(base[0].stok_sebelumnya) || 0 : 0;
    const [[m]] = await conn.query('SELECT COALESCE(SUM(jumlah),0) s FROM glassware_masuk WHERE periode_id=? AND laboratorium_id=? AND glassware_id=?', [periode_id, laboratorium_id, glassware_id]);
    const [[p]] = await conn.query('SELECT COALESCE(SUM(jumlah),0) s FROM glassware_pecah WHERE periode_id=? AND laboratorium_id=? AND glassware_id=?', [periode_id, laboratorium_id, glassware_id]);
    return stokSblm + Number(m.s || 0) - Number(p.s || 0) + delta;
};

router.post('/masuk', keycloakAuth, async (req, res) => {
    if (!hasRole(req, EDIT_ROLES)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya pic_gudang/pic_lab/admin yang dapat menambah barang masuk.' });
    }
    const conn = await db.pool.getConnection();
    try {
        await conn.beginTransaction();
        const { periode_id, laboratorium_id, glassware_id, tanggal, jumlah, keterangan } = req.body;
        const tgl = toDate(tanggal);
        const jml = toInt(jumlah);
        if (!periode_id || !laboratorium_id || !glassware_id || !tgl || jml <= 0) {
            await conn.rollback(); conn.release();
            return res.status(400).json({ success: false, message: 'Item, tanggal, dan jumlah (>0) wajib diisi' });
        }
        await ensureStokRow(conn, periode_id, laboratorium_id, glassware_id);
        const [ins] = await conn.query(
            `INSERT INTO glassware_masuk (periode_id, laboratorium_id, glassware_id, tanggal, jumlah, keterangan, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [periode_id, laboratorium_id, glassware_id, tgl, jml, keterangan || null, getUsername(req)]
        );
        await conn.commit();
        res.json({ success: true, message: 'Barang masuk berhasil dicatat', data: { id: ins.insertId } });
    } catch (error) {
        await conn.rollback();
        console.error('Error tambah masuk glassware:', error);
        res.status(500).json({ success: false, message: 'Gagal mencatat barang masuk', error: error.message });
    } finally {
        conn.release();
    }
});

router.post('/pecah', keycloakAuth, async (req, res) => {
    if (!hasRole(req, EDIT_ROLES)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya pic_gudang/pic_lab/admin yang dapat mencatat pecah.' });
    }
    const conn = await db.pool.getConnection();
    try {
        await conn.beginTransaction();
        const { periode_id, laboratorium_id, glassware_id, tanggal, jumlah, keterangan } = req.body;
        const tgl = toDate(tanggal);
        const jml = toInt(jumlah);
        if (!periode_id || !laboratorium_id || !glassware_id || !tgl || jml <= 0) {
            await conn.rollback(); conn.release();
            return res.status(400).json({ success: false, message: 'Item, tanggal, dan jumlah (>0) wajib diisi' });
        }
        await ensureStokRow(conn, periode_id, laboratorium_id, glassware_id);
        // Validasi stok tidak boleh negatif setelah pecah
        const stokAfter = await computeStokAfter(conn, periode_id, laboratorium_id, glassware_id, -jml);
        if (stokAfter < 0) {
            await conn.rollback(); conn.release();
            return res.status(400).json({ success: false, message: 'Stok tidak boleh negatif (pecah melebihi stok tersedia)' });
        }
        const [ins] = await conn.query(
            `INSERT INTO glassware_pecah (periode_id, laboratorium_id, glassware_id, tanggal, jumlah, keterangan, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [periode_id, laboratorium_id, glassware_id, tgl, jml, keterangan || null, getUsername(req)]
        );
        await conn.commit();
        res.json({ success: true, message: 'Glassware pecah berhasil dicatat', data: { id: ins.insertId } });
    } catch (error) {
        await conn.rollback();
        console.error('Error tambah pecah glassware:', error);
        res.status(500).json({ success: false, message: 'Gagal mencatat pecah', error: error.message });
    } finally {
        conn.release();
    }
});

// ========== HAPUS TRANSAKSI ==========
const delTrans = async (req, res, table, label) => {
    if (!hasRole(req, EDIT_ROLES)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya pic_gudang/pic_lab/admin yang dapat menghapus data.' });
    }
    const conn = await db.pool.getConnection();
    try {
        await conn.beginTransaction();
        const { id } = req.params;
        const [ex] = await conn.query(`SELECT id FROM ${table} WHERE id=?`, [id]);
        if (ex.length === 0) {
            await conn.rollback(); conn.release();
            return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
        }
        await conn.query(`DELETE FROM ${table} WHERE id=?`, [id]);
        await conn.commit();
        res.json({ success: true, message: `${label} berhasil dihapus` });
    } catch (error) {
        await conn.rollback();
        console.error(`Error hapus ${label}:`, error);
        res.status(500).json({ success: false, message: `Gagal menghapus ${label}`, error: error.message });
    } finally {
        conn.release();
    }
};

router.delete('/masuk/:id', keycloakAuth, (req, res) => delTrans(req, res, 'glassware_masuk', 'Barang masuk'));
router.delete('/pecah/:id', keycloakAuth, (req, res) => delTrans(req, res, 'glassware_pecah', 'Glassware pecah'));

// ========== PEMANTAUAN GLASSWARE TIDAK BERGERAK ==========
// Glassware di suatu lab yang tidak mengalami pergerakan (barang masuk / pecah)
// dalam jangka waktu lama. Pergerakan dihitung dari seluruh periode.
router.get('/movement', keycloakAuth, async (req, res) => {
    try {
        const { lab, jenis } = req.query;
        if (!lab) return res.status(400).json({ success: false, message: 'Parameter lab wajib diisi' });

        const [rows] = await db.query(
            `SELECT g.id AS glassware_id, g.nomor_kontrol, g.nama, g.ukuran, g.satuan,
                    l.kode AS lab_kode, j.kode AS jenis_kode,
                    (SELECT DATE_FORMAT(MAX(tanggal), '%Y-%m-%d') FROM glassware_masuk gm
                      WHERE gm.glassware_id = g.id AND gm.laboratorium_id = ?) AS last_masuk,
                    (SELECT DATE_FORMAT(MAX(tanggal), '%Y-%m-%d') FROM glassware_pecah gp
                      WHERE gp.glassware_id = g.id AND gp.laboratorium_id = ?) AS last_keluar,
                    (SELECT COALESCE(so2.stok_sebelumnya, 0)
                        + (SELECT COALESCE(SUM(jumlah), 0) FROM glassware_masuk gm2
                            WHERE gm2.periode_id = so2.periode_id AND gm2.laboratorium_id = so2.laboratorium_id AND gm2.glassware_id = so2.glassware_id)
                        - (SELECT COALESCE(SUM(jumlah), 0) FROM glassware_pecah gp2
                            WHERE gp2.periode_id = so2.periode_id AND gp2.laboratorium_id = so2.laboratorium_id AND gp2.glassware_id = so2.glassware_id)
                      FROM stok_opname_glassware so2
                      WHERE so2.laboratorium_id = ? AND so2.glassware_id = g.id
                      ORDER BY so2.periode_id DESC LIMIT 1) AS stok
             FROM master_glassware g
             JOIN (SELECT DISTINCT glassware_id FROM stok_opname_glassware WHERE laboratorium_id = ?) lm
               ON lm.glassware_id = g.id
             LEFT JOIN laboratorium l ON l.id = ?
             LEFT JOIN jenis_glassware j ON j.id = g.jenis_id
             WHERE (? IS NULL OR g.jenis_id = ?)
             ORDER BY g.jenis_id ASC, g.id ASC`,
            [lab, lab, lab, lab, lab, jenis || null, jenis || null]
        );

        const now = new Date();
        const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
        const parseUTC = (s) => {
            const p = String(s).split('-').map(Number);
            return Date.UTC(p[0], p[1] - 1, p[2]);
        };
        const diffDays = (dateStr) => {
            try { return Math.max(0, Math.floor((todayUTC - parseUTC(dateStr)) / 86400000)); }
            catch (e) { return null; }
        };

        const data = rows.map(r => {
            const lastMasuk = r.last_masuk || null;
            const lastKeluar = r.last_keluar || null;
            const lastMovement = [lastMasuk, lastKeluar].filter(Boolean).sort().pop() || null;
            return {
                id: r.glassware_id,
                kode_barang: r.nomor_kontrol,
                nama_barang: r.nama,
                jenis: r.lab_kode,
                kategori: r.jenis_kode,
                satuan: r.satuan || '-',
                stok: Number(r.stok) || 0,
                last_masuk: lastMasuk,
                last_keluar: lastKeluar,
                last_movement: lastMovement,
                hari_tidak_bergerak: lastMovement ? diffDays(lastMovement) : null,
                pernah_bergerak: !!lastMovement,
            };
        });

        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetch movement glassware:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data pemantauan glassware tidak bergerak', error: error.message });
    }
});

// ========== HAPUS PERIODE ==========
// Hapus periode beserta seluruh data terkait: stok opname & transaksi masuk/pecah
router.delete('/periode/:id', keycloakAuth, async (req, res) => {
    if (!hasRole(req, ['admin', 'superadmin'])) {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya admin yang dapat menghapus periode.' });
    }
    const conn = await db.pool.getConnection();
    try {
        await conn.beginTransaction();
        const { id } = req.params;
        const [ex] = await conn.query('SELECT id FROM periode_stok_opname WHERE id=?', [id]);
        if (ex.length === 0) {
            await conn.rollback(); conn.release();
            return res.status(404).json({ success: false, message: 'Periode tidak ditemukan' });
        }
        await conn.query('DELETE FROM glassware_masuk WHERE periode_id=?', [id]);
        await conn.query('DELETE FROM glassware_pecah WHERE periode_id=?', [id]);
        await conn.query('DELETE FROM stok_opname_glassware WHERE periode_id=?', [id]);
        await conn.query('DELETE FROM periode_stok_opname WHERE id=?', [id]);
        await conn.commit();
        res.json({ success: true, message: 'Periode beserta data stok & transaksinya berhasil dihapus' });
    } catch (error) {
        await conn.rollback();
        console.error('Error hapus periode glassware:', error);
        res.status(500).json({ success: false, message: 'Gagal menghapus periode', error: error.message });
    } finally {
        conn.release();
    }
});

// ========== TAMBAH MASTER GLASSWARE ==========
// Tambah item master glassware baru. Bila diberi periode_id + laboratorium_id,
// item juga didaftarkan ke lab/p Periode tsb (baris stok dibuat) & stok_awal
// (opsional) dicatat sebagai transaksi barang masuk pada tanggal yg ditentukan.
router.post('/master', keycloakAuth, async (req, res) => {
    if (!hasRole(req, MANAGE_ROLES)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya pic_gudang/admin yang dapat menambah glassware.' });
    }
    const { nomor_kontrol, nama, jenis_id, ukuran, satuan, periode_id, laboratorium_id, stok_awal, tanggal } = req.body;
    if (!nama || !jenis_id) {
        return res.status(400).json({ success: false, message: 'Nama dan jenis glassware wajib diisi' });
    }
    const conn = await db.pool.getConnection();
    try {
        await conn.beginTransaction();
        const [ins] = await conn.query(
            'INSERT INTO master_glassware (nomor_kontrol, nama, jenis_id, ukuran, satuan) VALUES (?, ?, ?, ?, ?)',
            [nomor_kontrol || null, nama, jenis_id, (ukuran && String(ukuran).trim()) ? String(ukuran).trim() : '-', (satuan && String(satuan).trim()) ? String(satuan).trim() : '-']
        );
        const newId = ins.insertId;

        if (periode_id && laboratorium_id) {
            await ensureStokRow(conn, periode_id, laboratorium_id, newId);
            const awal = toInt(stok_awal);
            if (awal > 0) {
                const tgl = toDate(tanggal) || new Date().toISOString().slice(0, 10);
                await conn.query(
                    `INSERT INTO glassware_masuk (periode_id, laboratorium_id, glassware_id, tanggal, jumlah, keterangan, created_by)
                     VALUES (?, ?, ?, ?, ?, 'Stok awal glassware baru', ?)`,
                    [periode_id, laboratorium_id, newId, tgl, awal, getUsername(req)]
                );
            }
        }
        await conn.commit();
        res.json({ success: true, message: 'Glassware baru berhasil ditambahkan', data: { id: newId } });
    } catch (error) {
        await conn.rollback();
        console.error('Error tambah master glassware:', error);
        res.status(500).json({ success: false, message: 'Gagal menambah glassware', error: error.message });
    } finally {
        conn.release();
    }
});

module.exports = router;
