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
// Pemantauan glassware tidak bergerak: khusus admin
const ADMIN_ROLES = ['admin', 'superadmin'];
// Pengajuan semester ke MT: pic_lab yang mengirim; MT yang menyetujui
const SUBMIT_ROLES = ['pic_lab', 'admin', 'superadmin'];
const MT_ROLES = ['mt', 'admin', 'superadmin'];
// Status yang mengunci catatan periode+lab
const LOCKED_STATUS = ['menunggu_mt', 'disetujui'];
const getUsername = (req) => req.user?.name || req.user?.username || req.user?.preferred_username || req.user?.email || 'system';
const getUserId = (req) => req.user?.user_id || req.user?.sub || req.user?.id || '';
const createNotif = async (userId, userRole, title, message, link) => {
    try {
        await db.query(
            'INSERT INTO notifications (user_id, user_role, title, message, link) VALUES (?, ?, ?, ?, ?)',
            [userId || '', userRole, title, message, link || '/persediaan/glassware']
        );
    } catch (e) { console.error('Notif glassware error:', e.message); }
};
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

// Status pengajuan periode+lab yang mengunci catatan (menunggu_mt / disetujui)
const pengajuanLocked = async (conn, periodeId, labId) => {
    if (!periodeId || !labId) return null;
    const [rows] = await conn.query(
        'SELECT status FROM glassware_pengajuan_mt WHERE periode_id=? AND laboratorium_id=? LIMIT 1',
        [periodeId, labId]
    );
    if (rows.length && LOCKED_STATUS.includes(rows[0].status)) return rows[0].status;
    return null;
};
const lockMsg = (status) => status === 'disetujui'
    ? 'Catatan periode ini sudah disetujui MT — transaksi terkunci.'
    : 'Catatan periode ini sedang menunggu persetujuan MT — transaksi terkunci.';

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
        const locked = await pengajuanLocked(conn, periode_id, laboratorium_id);
        if (locked) {
            await conn.rollback(); conn.release();
            return res.status(409).json({ success: false, message: lockMsg(locked) });
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
        const locked = await pengajuanLocked(conn, periode_id, laboratorium_id);
        if (locked) {
            await conn.rollback(); conn.release();
            return res.status(409).json({ success: false, message: lockMsg(locked) });
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
        const [ex] = await conn.query(`SELECT id, periode_id, laboratorium_id FROM ${table} WHERE id=?`, [id]);
        if (ex.length === 0) {
            await conn.rollback(); conn.release();
            return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
        }
        const locked = await pengajuanLocked(conn, ex[0].periode_id, ex[0].laboratorium_id);
        if (locked) {
            await conn.rollback(); conn.release();
            return res.status(409).json({ success: false, message: lockMsg(locked) });
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
    if (!hasRole(req, ['mt', 'admin', 'superadmin'])) {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya admin/MT yang dapat melihat pemantauan glassware tidak bergerak.' });
    }
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
        await conn.query('DELETE FROM glassware_pengajuan_mt WHERE periode_id=?', [id]);
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
            const locked = await pengajuanLocked(conn, periode_id, laboratorium_id);
            if (locked) {
                await conn.rollback(); conn.release();
                return res.status(409).json({ success: false, message: lockMsg(locked) });
            }
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

// ============================================================
// PENGAJUAN SEMESTER KE MT (akhir semester)
//
// Alur: pic_lab mencatat transaksi masuk/pecah selama satu periode
// (satu periode_stok_opname = satu semester). Di akhir semester
// pic_lab mengirim catatan periode+lab ke MT (user role "mt" yang
// dipilih): (belum ada) -> menunggu_mt -> disetujui / ditolak.
// Saat status 'menunggu_mt' / 'disetujui' catatan terkunci.
// ============================================================

// GET status pengajuan utk satu (periode, lab)
router.get('/pengajuan', keycloakAuth, async (req, res) => {
    try {
        const { periode_id, lab } = req.query;
        if (!periode_id || !lab) return res.status(400).json({ success: false, message: 'periode_id dan lab wajib diisi' });
        const [rows] = await db.query(
            `SELECT id, periode_id, laboratorium_id, status, catatan,
                    mt_id, mt_nama, diajukan_by,
                    DATE_FORMAT(diajukan_at, '%Y-%m-%d %H:%i') AS diajukan_at,
                    disetujui_by,
                    DATE_FORMAT(disetujui_at, '%Y-%m-%d %H:%i') AS disetujui_at,
                    ditolak_by,
                    DATE_FORMAT(ditolak_at, '%Y-%m-%d %H:%i') AS ditolak_at,
                    catatan_tolak
             FROM glassware_pengajuan_mt
             WHERE periode_id = ? AND laboratorium_id = ? LIMIT 1`,
            [periode_id, lab]
        );
        res.json({ success: true, data: rows.length ? rows[0] : null });
    } catch (error) {
        console.error('Error fetch pengajuan glassware:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil status pengajuan', error: error.message });
    }
});

// GET ringkasan transaksi utk pengajuan (periode, lab) — mencakup SEMUA jenis
router.get('/pengajuan/summary', keycloakAuth, async (req, res) => {
    try {
        const { periode_id, lab } = req.query;
        if (!periode_id || !lab) return res.status(400).json({ success: false, message: 'periode_id dan lab wajib diisi' });
        const [[m]] = await db.query(
            'SELECT COUNT(*) AS txn, COALESCE(SUM(jumlah),0) AS qty FROM glassware_masuk WHERE periode_id=? AND laboratorium_id=?',
            [periode_id, lab]
        );
        const [[p]] = await db.query(
            'SELECT COUNT(*) AS txn, COALESCE(SUM(jumlah),0) AS qty FROM glassware_pecah WHERE periode_id=? AND laboratorium_id=?',
            [periode_id, lab]
        );
        const [[it]] = await db.query(
            'SELECT COUNT(DISTINCT glassware_id) AS n FROM stok_opname_glassware WHERE periode_id=? AND laboratorium_id=?',
            [periode_id, lab]
        );
        res.json({
            success: true,
            data: {
                total_item: Number(it.n) || 0,
                total_masuk_txn: Number(m.txn) || 0,
                total_masuk: Number(m.qty) || 0,
                total_pecah_txn: Number(p.txn) || 0,
                total_pecah: Number(p.qty) || 0,
            },
        });
    } catch (error) {
        console.error('Error fetch summary pengajuan glassware:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil ringkasan pengajuan', error: error.message });
    }
});

// GET daftar pengajuan — di-scope per role:
//   admin/superadmin: semua | mt: yang ditujukan ke dirinya | pic_lab: yang dia ajukan
router.get('/pengajuan/list', keycloakAuth, async (req, res) => {
    try {
        const { status } = req.query;
        const isAdminRole = hasRole(req, ['admin', 'superadmin']);
        const isMtRole = hasRole(req, ['mt']);
        let where = ' WHERE 1=1';
        const params = [];
        if (status) { where += ' AND p.status = ?'; params.push(status); }
        if (!isAdminRole) {
            if (isMtRole) {
                where += ' AND p.mt_id = ?';
                params.push(getUserId(req));
            } else if (hasRole(req, ['pic_lab'])) {
                where += ' AND p.diajukan_by = ?';
                params.push(getUsername(req));
            } else {
                where += ' AND 1=0';
            }
        }
        const [rows] = await db.query(
            `SELECT p.id, p.periode_id, p.laboratorium_id, p.status, p.catatan, p.mt_id, p.mt_nama,
                    p.diajukan_by,
                    DATE_FORMAT(p.diajukan_at, '%Y-%m-%d %H:%i') AS diajukan_at,
                    p.disetujui_by,
                    DATE_FORMAT(p.disetujui_at, '%Y-%m-%d %H:%i') AS disetujui_at,
                    p.ditolak_by,
                    DATE_FORMAT(p.ditolak_at, '%Y-%m-%d %H:%i') AS ditolak_at,
                    p.catatan_tolak,
                    po.nama AS periode_nama,
                    DATE_FORMAT(po.tanggal, '%Y-%m-%d') AS periode_tanggal,
                    l.kode AS lab_kode, l.nama AS lab_nama
             FROM glassware_pengajuan_mt p
             JOIN periode_stok_opname po ON po.id = p.periode_id
             JOIN laboratorium l ON l.id = p.laboratorium_id
             ${where}
             ORDER BY p.diajukan_at DESC, p.id DESC`,
            params
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetch list pengajuan glassware:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil daftar pengajuan', error: error.message });
    }
});

// POST kirim pengajuan ke MT (pic_lab/admin)
router.post('/pengajuan/kirim', keycloakAuth, async (req, res) => {
    if (!hasRole(req, SUBMIT_ROLES)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya pic_lab/admin yang dapat mengirim pengajuan ke MT.' });
    }
    const conn = await db.pool.getConnection();
    try {
        await conn.beginTransaction();
        const { periode_id, laboratorium_id, mt_id, mt_nama, catatan } = req.body;
        if (!periode_id || !laboratorium_id || !mt_id || !mt_nama) {
            await conn.rollback(); conn.release();
            return res.status(400).json({ success: false, message: 'Periode, lab, dan MT tujuan wajib dipilih' });
        }
        const [rows] = await conn.query(
            'SELECT id, status FROM glassware_pengajuan_mt WHERE periode_id=? AND laboratorium_id=? LIMIT 1',
            [periode_id, laboratorium_id]
        );
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const nowStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        if (rows.length) {
            const cur = rows[0];
            if (LOCKED_STATUS.includes(cur.status)) {
                await conn.rollback(); conn.release();
                return res.status(409).json({ success: false, message: 'Pengajuan periode ini sudah menunggu / disetujui MT, tidak bisa dikirim ulang.' });
            }
            await conn.query(
                `UPDATE glassware_pengajuan_mt
                 SET status='menunggu_mt', mt_id=?, mt_nama=?, catatan=?,
                     diajukan_by=?, diajukan_at=?, disetujui_by=NULL, disetujui_at=NULL,
                     ditolak_by=NULL, ditolak_at=NULL, catatan_tolak=NULL
                 WHERE id=?`,
                [mt_id, mt_nama, catatan || null, getUsername(req), nowStr, cur.id]
            );
        } else {
            await conn.query(
                `INSERT INTO glassware_pengajuan_mt
                   (periode_id, laboratorium_id, status, catatan, mt_id, mt_nama, diajukan_by, diajukan_at)
                 VALUES (?, ?, 'menunggu_mt', ?, ?, ?, ?, ?)`,
                [periode_id, laboratorium_id, catatan || null, mt_id, mt_nama, getUsername(req), nowStr]
            );
        }
        await conn.commit();
        await createNotif(mt_id, 'mt', 'Pengajuan Glassware Semester Masuk',
            `Catatan glassware periode ${periode_id} dikirim oleh ${getUsername(req)} untuk disetujui.`, '/persediaan/glassware');
        res.json({ success: true, message: `Pengajuan berhasil dikirim ke MT (${mt_nama})` });
    } catch (error) {
        await conn.rollback();
        console.error('Error kirim pengajuan glassware:', error);
        res.status(500).json({ success: false, message: 'Gagal mengirim pengajuan ke MT', error: error.message });
    } finally {
        conn.release();
    }
});

// PUT setujui oleh MT
router.put('/pengajuan/:id/setujui', keycloakAuth, async (req, res) => {
    if (!hasRole(req, MT_ROLES)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya MT yang dapat menyetujui pengajuan.' });
    }
    try {
        const { id } = req.params;
        const [rows] = await db.query(
            `SELECT p.*, po.nama AS periode_nama, l.nama AS lab_nama
             FROM glassware_pengajuan_mt p
             JOIN periode_stok_opname po ON po.id = p.periode_id
             JOIN laboratorium l ON l.id = p.laboratorium_id
             WHERE p.id = ?`,
            [id]
        );
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan' });
        const p = rows[0];
        if (p.status !== 'menunggu_mt') {
            return res.status(400).json({ success: false, message: 'Hanya pengajuan berstatus menunggu MT yang dapat disetujui' });
        }
        const isAdminRole = hasRole(req, ['admin', 'superadmin']);
        if (!isAdminRole && String(p.mt_id) !== String(getUserId(req))) {
            return res.status(403).json({ success: false, message: 'Pengajuan ini ditujukan untuk MT lain' });
        }
        await db.query(
            `UPDATE glassware_pengajuan_mt
             SET status='disetujui', disetujui_by=?, disetujui_at=NOW(),
                 ditolak_by=NULL, ditolak_at=NULL, catatan_tolak=NULL
             WHERE id=?`,
            [getUsername(req), id]
        );
        await createNotif('', 'pic_lab', 'Pengajuan Glassware Disetujui MT',
            `Catatan glassware ${p.periode_nama} (${p.lab_nama}) telah disetujui MT.`, '/persediaan/glassware');
        res.json({ success: true, message: 'Pengajuan disetujui. Catatan periode terkunci.' });
    } catch (error) {
        console.error('Error setujui pengajuan glassware:', error);
        res.status(500).json({ success: false, message: 'Gagal menyetujui pengajuan', error: error.message });
    }
});

// PUT tolak oleh MT (dengan alasan)
router.put('/pengajuan/:id/tolak', keycloakAuth, async (req, res) => {
    if (!hasRole(req, MT_ROLES)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya MT yang dapat menolak pengajuan.' });
    }
    try {
        const { id } = req.params;
        const { catatan_tolak } = req.body;
        if (!catatan_tolak || !String(catatan_tolak).trim()) {
            return res.status(400).json({ success: false, message: 'Alasan penolakan wajib diisi' });
        }
        const [rows] = await db.query(
            `SELECT p.*, po.nama AS periode_nama, l.nama AS lab_nama
             FROM glassware_pengajuan_mt p
             JOIN periode_stok_opname po ON po.id = p.periode_id
             JOIN laboratorium l ON l.id = p.laboratorium_id
             WHERE p.id = ?`,
            [id]
        );
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan' });
        const p = rows[0];
        if (p.status !== 'menunggu_mt') {
            return res.status(400).json({ success: false, message: 'Hanya pengajuan berstatus menunggu MT yang dapat ditolak' });
        }
        const isAdminRole = hasRole(req, ['admin', 'superadmin']);
        if (!isAdminRole && String(p.mt_id) !== String(getUserId(req))) {
            return res.status(403).json({ success: false, message: 'Pengajuan ini ditujukan untuk MT lain' });
        }
        await db.query(
            `UPDATE glassware_pengajuan_mt
             SET status='ditolak', catatan_tolak=?, ditolak_by=?, ditolak_at=NOW(),
                 disetujui_by=NULL, disetujui_at=NULL
             WHERE id=?`,
            [String(catatan_tolak).trim(), getUsername(req), id]
        );
        await createNotif('', 'pic_lab', 'Pengajuan Glassware Ditolak MT',
            `Catatan glassware ${p.periode_nama} (${p.lab_nama}) ditolak MT. Alasan: ${String(catatan_tolak).trim()}`, '/persediaan/glassware');
        res.json({ success: true, message: 'Pengajuan ditolak. Silakan perbaiki catatan lalu kirim ulang.' });
    } catch (error) {
        console.error('Error tolak pengajuan glassware:', error);
        res.status(500).json({ success: false, message: 'Gagal menolak pengajuan', error: error.message });
    }
});

// DELETE hapus pengajuan dari riwayat — khusus admin/superadmin
// Catatan: bila pengajuan berstatus menunggu_mt/disetujui, menghapusnya
// akan MEMBUKA KEMBALI catatan transaksi periode+lab tsb.
router.delete('/pengajuan/:id', keycloakAuth, async (req, res) => {
    if (!hasRole(req, ADMIN_ROLES)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya admin yang dapat menghapus pengajuan MT.' });
    }
    try {
        const { id } = req.params;
        const [rows] = await db.query(
            `SELECT p.*, po.nama AS periode_nama, l.nama AS lab_nama
             FROM glassware_pengajuan_mt p
             JOIN periode_stok_opname po ON po.id = p.periode_id
             JOIN laboratorium l ON l.id = p.laboratorium_id
             WHERE p.id = ?`,
            [id]
        );
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan' });
        const p = rows[0];
        await db.query('DELETE FROM glassware_pengajuan_mt WHERE id=?', [id]);
        res.json({
            success: true,
            message: `Pengajuan ${p.periode_nama} (${p.lab_nama}) berhasil dihapus dari riwayat.${LOCKED_STATUS.includes(p.status) ? ' Catatan transaksi periode tersebut terbuka kembali.' : ''}`,
        });
    } catch (error) {
        console.error('Error hapus pengajuan glassware:', error);
        res.status(500).json({ success: false, message: 'Gagal menghapus pengajuan', error: error.message });
    }
});

module.exports = router;
