// backend/routes/laporanrusak.js
// =====================================================================
// ALUR BARU LAPORAN RUSAK BMN (v2 - 2026-09-01)
//   1. User membuat laporan                       -> status 'diajukan'
//   2. PIC Ruangan cek fisik BMN (detail + anggaran?):
//        - bisa diperbaiki internal  -> 'selesai'
//        - pakai anggaran            -> 'menunggu_katim' (pilih Katim)
//        - tolak                     -> 'ditolak'
//   3. Katim mengetahui & kirim ke PPK (pilih PPK) -> 'menunggu_ppk'
//   4. PPK mengetahui + kisaran biaya              -> 'dalam_perbaikan' | 'ditolak'
//   5. PIC/Admin catat perbaikan selesai           -> 'menunggu_konfirmasi_kabag'
//   6. Kabag TU konfirmasi                         -> 'menunggu_konfirmasi_user'
//   7. User (pelapor) konfirmasi                   -> 'selesai'
// =====================================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { keycloakAuth } = require('../middleware/keycloakAuth');
const { getPICUsersFromKeycloak } = require('../utils/keycloakHelpers');
const { getUsernameFromToken, formatDateForMySQL, hasRole } = require('../utils/routeHelpers');

const STATUS = {
  DIAJUKAN: 'diajukan',
  MENUNGGU_KATIM: 'menunggu_katim',
  MENUNGGU_PPK: 'menunggu_ppk',
  DALAM_PERBAIKAN: 'dalam_perbaikan',
  MENUNGGU_KONFIRMASI_KABAG: 'menunggu_konfirmasi_kabag',
  MENUNGGU_KONFIRMASI_USER: 'menunggu_konfirmasi_user',
  SELESAI: 'selesai',
  DITOLAK: 'ditolak',
};

const getUsername = (req) => req.user?.name || req.user?.preferred_username || req.user?.username || req.user?.email || 'system';
const getUserId = (req) => req.user?.user_id || req.user?.sub || req.user?.id || '';

const isAdminRole = (req) => hasRole(req, ['admin', 'superadmin', 'admin_pemeliharaan']);
const isPicRuangan = (req) => hasRole(req, ['pic_ruangan', 'pic']);
const isKatim = (req) => hasRole(req, ['katim']);
const isPPK = (req) => hasRole(req, ['ppk']);
const isKabagTU = (req) => hasRole(req, ['kabag_tu']);

// Helper untuk generate nomor laporan
async function generateNomorLaporan() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const prefix = `LR/${year}${month}/`;

    // Ambil nomor urut TERTINGGI (bukan COUNT) untuk bulan ini
    const [rows] = await db.query(
        `SELECT nomor_laporan FROM laporan_rusak 
         WHERE nomor_laporan LIKE ? 
         ORDER BY nomor_laporan DESC 
         LIMIT 1`,
        [`${prefix}%`]
    );

    let nextNumber = 1;
    if (rows.length > 0) {
        const lastNomor = rows[0].nomor_laporan;
        const lastNumberStr = lastNomor.split('/').pop();
        const lastNumber = parseInt(lastNumberStr, 10);
        if (!isNaN(lastNumber)) {
            nextNumber = lastNumber + 1;
        }
    }

    const nomorUrut = String(nextNumber).padStart(3, '0');
    return `${prefix}${nomorUrut}`;
}

const appendCatatan = (deskripsi, note) => {
    const d = deskripsi || '';
    return `${d}${d ? '\n\n' : ''}${note}`;
};

const parseFoto = (foto) => {
    try {
        if (!foto) return [];
        if (typeof foto === 'string') {
            const parsed = JSON.parse(foto);
            return Array.isArray(parsed) ? parsed : [parsed];
        }
        return Array.isArray(foto) ? foto : [foto];
    } catch (e) {
        return typeof foto === 'string' ? [foto] : [];
    }
};

const mapLaporan = (row, userMap) => ({
    id: row.id,
    nomor_laporan: row.nomor_laporan,
    aset_id: row.aset_id,
    ruangan_id: row.ruangan_id,
    pelapor_id: row.pelapor_id,
    tgl_laporan: row.tgl_laporan,
    deskripsi: row.deskripsi,
    foto_kerusakan: parseFoto(row.foto_kerusakan),
    prioritas: row.prioritas,
    status: row.status,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
    estimasi_biaya: row.estimasi_biaya,
    // Pelacak alur baru
    verified_by: row.verified_by,
    verified_at: row.verified_at,
    verified_catatan: row.verified_catatan,
    katim_id: row.katim_id,
    katim_nama: row.katim_nama,
    katim_confirm_by: row.katim_confirm_by,
    katim_confirm_at: row.katim_confirm_at,
    ppk_id: row.ppk_id,
    ppk_nama: row.ppk_nama,
    ppk_confirm_by: row.ppk_confirm_by,
    ppk_confirm_at: row.ppk_confirm_at,
    kisaran_biaya: row.kisaran_biaya,
    perbaikan_done_by: row.perbaikan_done_by,
    perbaikan_done_at: row.perbaikan_done_at,
    kabag_confirm_by: row.kabag_confirm_by,
    kabag_confirm_at: row.kabag_confirm_at,
    user_confirm_by: row.user_confirm_by,
    user_confirm_at: row.user_confirm_at,
    // Relasi
    aset_nama: row.aset_nama,
    aset_kode: row.aset_kode,
    ruangan_nama: row.nama_ruangan,
    ruangan_kode: row.kode_ruangan,
    pelapor_nama: userMap[row.pelapor_id]?.nama || row.pelapor_id,
    pelapor_email: userMap[row.pelapor_id]?.email || '-',
    pic_ruangan_nama: row.pic_user_name || null,
    pic_ruangan_id: row.pic_user_id || null,
    detail_perbaikan: row.detail_perbaikan_id ? {
        id: row.detail_perbaikan_id,
        hasil_perbaikan: row.hasil_perbaikan,
        tanggal_selesai: row.tanggal_selesai,
        rating: row.rating,
        biaya_aktual: row.biaya_aktual,
        dokumentasi: row.dokumentasi,
        rekomendasi: row.rekomendasi,
        nama_vendor: row.nama_vendor,
        no_kontrak: row.no_kontrak,
        catatan: row.detail_catatan
    } : null,
});

// ========== GET ALL LAPORAN ==========
router.get('/', keycloakAuth, async (req, res) => {
    try {
        const { status, prioritas, aset_id, ruangan_id, pelapor_id, search, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        const userId = getUserId(req);

        const isAdmin = isAdminRole(req);
        const isPIC = isPicRuangan(req);
        const isKatimRole = isKatim(req);
        const isPPKRole = isPPK(req);
        const isKabag = isKabagTU(req);

        let query = `
            SELECT 
                lr.*, 
                a.kode_barang as aset_kode, 
                a.nama_barang as aset_nama, 
                a.merk as aset_merk,
                r.kode_ruangan, 
                r.nama_ruangan, 
                r.lokasi,
                pr.user_id as pic_user_id,
                pr.user_name as pic_user_name,
                dp.id as detail_perbaikan_id,
                dp.hasil_perbaikan,
                dp.tanggal_selesai,
                dp.rating,
                dp.biaya_aktual,
                dp.dokumentasi,
                dp.rekomendasi,
                dp.nama_vendor,
                dp.no_kontrak,
                dp.catatan as detail_catatan
            FROM laporan_rusak lr
            LEFT JOIN master_aset a ON lr.aset_id = a.id
            LEFT JOIN ruangan r ON lr.ruangan_id = r.id
            LEFT JOIN pic_ruangan pr ON lr.ruangan_id = pr.ruangan_id AND pr.status = 'aktif'
            LEFT JOIN detail_perbaikan dp ON lr.id = dp.laporan_id
            WHERE 1=1
        `;
        const params = [];

        // ========== FILTER BERDASARKAN ROLE ==========
        if (isAdmin || isPIC || isKabag) {
            // Admin / PIC Ruangan / Kabag TU: melihat semua
        } else if (isKatimRole) {
            query += ' AND lr.katim_id = ?';
            params.push(userId);
        } else if (isPPKRole) {
            query += ' AND lr.ppk_id = ?';
            params.push(userId);
        } else {
            // User biasa: hanya laporan miliknya sendiri
            query += ' AND lr.pelapor_id = ?';
            params.push(userId);
        }

        if (status) { query += ' AND lr.status = ?'; params.push(status); }
        if (prioritas) { query += ' AND lr.prioritas = ?'; params.push(prioritas); }
        if (aset_id) { query += ' AND lr.aset_id = ?'; params.push(aset_id); }
        if (ruangan_id) { query += ' AND lr.ruangan_id = ?'; params.push(ruangan_id); }
        if (pelapor_id) { query += ' AND lr.pelapor_id = ?'; params.push(pelapor_id); }
        if (search) {
            query += ' AND (lr.nomor_laporan LIKE ? OR lr.deskripsi LIKE ? OR a.nama_barang LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s, s);
        }

        let countQuery = `SELECT COUNT(DISTINCT lr.id) as total FROM laporan_rusak lr
            LEFT JOIN master_aset a ON lr.aset_id = a.id WHERE 1=1`;
        const countParams = [];
        if (!(isAdmin || isPIC || isKabag)) {
            if (isKatimRole) { countQuery += ' AND lr.katim_id = ?'; countParams.push(userId); }
            else if (isPPKRole) { countQuery += ' AND lr.ppk_id = ?'; countParams.push(userId); }
            else { countQuery += ' AND lr.pelapor_id = ?'; countParams.push(userId); }
        }
        if (status) { countQuery += ' AND lr.status = ?'; countParams.push(status); }
        if (prioritas) { countQuery += ' AND lr.prioritas = ?'; countParams.push(prioritas); }
        if (aset_id) { countQuery += ' AND lr.aset_id = ?'; countParams.push(aset_id); }
        if (ruangan_id) { countQuery += ' AND lr.ruangan_id = ?'; countParams.push(ruangan_id); }
        if (pelapor_id) { countQuery += ' AND lr.pelapor_id = ?'; countParams.push(pelapor_id); }
        if (search) { countQuery += ' AND (lr.nomor_laporan LIKE ? OR lr.deskripsi LIKE ? OR a.nama_barang LIKE ?)'; const s = `%${search}%`; countParams.push(s, s, s); }

        const [countResult] = await db.query(countQuery, countParams);
        const total = countResult && countResult[0] ? countResult[0].total : 0;

        query += ' ORDER BY lr.tgl_laporan DESC, lr.id DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await db.query(query, params);

        let userMap = {};
        try {
            const users = await getPICUsersFromKeycloak();
            users.forEach(user => { userMap[user.user_id] = user; });
        } catch (error) {
            console.error('Error fetching users from Keycloak:', error);
        }

        const laporanList = rows.map(row => mapLaporan(row, userMap));

        res.json({
            success: true,
            data: laporanList,
            pagination: {
                currentPage: parseInt(page),
                perPage: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching laporan rusak:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data laporan', error: error.message });
    }
});

// ========== GET STATISTICS ==========
router.get('/statistics', keycloakAuth, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'diajukan' THEN 1 ELSE 0 END) as diajukan,
                SUM(CASE WHEN status = 'menunggu_katim' THEN 1 ELSE 0 END) as menunggu_katim,
                SUM(CASE WHEN status = 'menunggu_ppk' THEN 1 ELSE 0 END) as menunggu_ppk,
                SUM(CASE WHEN status = 'dalam_perbaikan' THEN 1 ELSE 0 END) as dalam_perbaikan,
                SUM(CASE WHEN status = 'menunggu_konfirmasi_kabag' THEN 1 ELSE 0 END) as menunggu_konfirmasi_kabag,
                SUM(CASE WHEN status = 'menunggu_konfirmasi_user' THEN 1 ELSE 0 END) as menunggu_konfirmasi_user,
                SUM(CASE WHEN status = 'selesai' THEN 1 ELSE 0 END) as selesai,
                SUM(CASE WHEN status = 'ditolak' THEN 1 ELSE 0 END) as ditolak
            FROM laporan_rusak
        `);
        const s = rows[0] || {};
        res.json({
            success: true,
            data: {
                total: s.total || 0,
                diajukan: s.diajukan || 0,
                menunggu_katim: s.menunggu_katim || 0,
                menunggu_ppk: s.menunggu_ppk || 0,
                dalam_perbaikan: s.dalam_perbaikan || 0,
                menunggu_konfirmasi_kabag: s.menunggu_konfirmasi_kabag || 0,
                menunggu_konfirmasi_user: s.menunggu_konfirmasi_user || 0,
                selesai: s.selesai || 0,
                ditolak: s.ditolak || 0
            }
        });
    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil statistik', error: error.message });
    }
});

// ========== GET RUANGAN ==========
router.get('/ruangan', keycloakAuth, async (req, res) => {
    try {
        const { user_id, has_pic } = req.query;
        let query = `
            SELECT r.id, r.kode_ruangan, r.nama_ruangan, r.deskripsi, r.lokasi, r.is_active,
                   pr.user_id as pic_user_id, pr.tgl_penugasan, pr.tgl_berakhir
            FROM ruangan r
        `;
        const params = [];
        if (user_id && has_pic === 'true') {
            query += ` INNER JOIN pic_ruangan pr ON r.id = pr.ruangan_id
                WHERE pr.user_id = ? AND pr.status = 'aktif' AND r.is_active = 1`;
            params.push(user_id);
        } else {
            query += ' WHERE r.is_active = 1';
        }
        query += ' ORDER BY r.kode_ruangan ASC';
        const [rows] = await db.query(query, params);
        res.json({ success: true, data: rows, message: 'Data ruangan berhasil dimuat' });
    } catch (error) {
        console.error('❌ Error fetching ruangan:', error);
        res.status(500).json({ success: false, message: error.message, data: [] });
    }
});

// ========== GET LAPORAN BY ID ==========
router.get('/:id', keycloakAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query(`
            SELECT 
                lr.*, 
                a.kode_barang as aset_kode, 
                a.nama_barang as aset_nama,
                r.kode_ruangan, 
                r.nama_ruangan,
                pr.id as pic_ruangan_id,
                pr.user_id as pic_ruangan_user_id,
                pr.user_name as pic_ruangan_nama,
                pr.status as pic_ruangan_status,
                dp.id as detail_perbaikan_id,
                dp.hasil_perbaikan,
                dp.tanggal_selesai,
                dp.rating,
                dp.biaya_aktual,
                dp.dokumentasi,
                dp.rekomendasi,
                dp.nama_vendor,
                dp.no_kontrak,
                dp.catatan as detail_catatan
            FROM laporan_rusak lr
            LEFT JOIN master_aset a ON lr.aset_id = a.id
            LEFT JOIN ruangan r ON lr.ruangan_id = r.id
            LEFT JOIN pic_ruangan pr ON lr.ruangan_id = pr.ruangan_id AND pr.status = 'aktif'
            LEFT JOIN detail_perbaikan dp ON lr.id = dp.laporan_id
            WHERE lr.id = ?
        `, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan' });
        }
        const row = rows[0];

        let userMap = {};
        try {
            const users = await getPICUsersFromKeycloak();
            users.forEach(user => { userMap[user.user_id] = user; });
        } catch (e) { console.error('Error fetching users:', e); }

        res.json({ success: true, data: mapLaporan(row, userMap) });
    } catch (error) {
        console.error('Error fetching laporan:', error);
        res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
});

// ========== GET DETAIL PERBAIKAN BY LAPORAN ==========
router.get('/:id/detail-perbaikan', keycloakAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT * FROM detail_perbaikan WHERE laporan_id = ? ORDER BY id DESC LIMIT 1', [id]);
        res.json({ success: true, data: rows[0] || null });
    } catch (error) {
        console.error('Error fetching detail perbaikan:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil detail perbaikan', error: error.message });
    }
});

// ========== CREATE LAPORAN ==========
router.post('/', keycloakAuth, async (req, res) => {
    try {
        let { aset_id, ruangan_id, pelapor_id, tgl_laporan, deskripsi, foto_kerusakan, prioritas } = req.body;

        if (!aset_id || !ruangan_id || !pelapor_id || !deskripsi) {
            return res.status(400).json({ success: false, message: 'Aset, ruangan, pelapor, dan deskripsi harus diisi' });
        }

        const nomor_laporan = await generateNomorLaporan();
        const formattedTglLaporan = formatDateForMySQL(tgl_laporan) || formatDateForMySQL(new Date());
        const username = getUsernameFromToken(req.user);
        const fotoKerusakanJson = Array.isArray(foto_kerusakan) && foto_kerusakan.length > 0
            ? JSON.stringify(foto_kerusakan) : null;

        const [result] = await db.query(
            `INSERT INTO laporan_rusak (
                nomor_laporan, aset_id, ruangan_id, pelapor_id, 
                tgl_laporan, deskripsi, foto_kerusakan, prioritas, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                nomor_laporan, aset_id, ruangan_id, pelapor_id,
                formattedTglLaporan, deskripsi, fotoKerusakanJson,
                prioritas || 'sedang', STATUS.DIAJUKAN
            ]
        );

        res.status(201).json({
            success: true,
            message: 'Laporan berhasil dibuat',
            data: { id: result.insertId, nomor_laporan, aset_id, ruangan_id, pelapor_id, tgl_laporan: formattedTglLaporan, status: STATUS.DIAJUKAN },
            createdBy: username
        });
    } catch (error) {
        console.error('Error creating laporan:', error);
        if (error.type === 'entity.too.large') {
            return res.status(413).json({ success: false, message: 'Ukuran file terlalu besar. Maksimal 100MB.' });
        }
        res.status(500).json({ success: false, message: 'Gagal membuat laporan', error: error.message });
    }
});

// ========== UPDATE LAPORAN ==========
router.put('/:id', keycloakAuth, async (req, res) => {
    try {
        const { id } = req.params;
        let { aset_id, ruangan_id, deskripsi, foto_kerusakan, prioritas, status } = req.body;

        const [existing] = await db.query('SELECT id, status FROM laporan_rusak WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan' });
        }
        if (existing[0].status !== STATUS.DIAJUKAN) {
            return res.status(400).json({ success: false, message: 'Laporan sudah diproses, tidak dapat diedit' });
        }

        const fotoKerusakanJson = Array.isArray(foto_kerusakan) ? JSON.stringify(foto_kerusakan) : null;
        await db.query(
            `UPDATE laporan_rusak 
             SET aset_id = ?, ruangan_id = ?, deskripsi = ?, foto_kerusakan = ?, prioritas = ?
             WHERE id = ?`,
            [aset_id, ruangan_id, deskripsi, fotoKerusakanJson, prioritas, id]
        );
        res.json({ success: true, message: 'Laporan berhasil diperbarui', updatedBy: getUsernameFromToken(req.user) });
    } catch (error) {
        console.error('Error updating laporan:', error);
        res.status(500).json({ success: false, message: 'Gagal memperbarui laporan', error: error.message });
    }
});

// ========== DELETE LAPORAN ==========
router.delete('/:id', keycloakAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const [existing] = await db.query('SELECT status, pelapor_id FROM laporan_rusak WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan' });
        }
        const laporan = existing[0];
        if (laporan.status !== STATUS.DIAJUKAN) {
            return res.status(400).json({
                success: false,
                message: `Laporan sudah ditindaklanjuti (${laporan.status}) dan tidak dapat dihapus`
            });
        }
        await db.query('DELETE FROM laporan_rusak WHERE id = ?', [id]);
        res.json({ success: true, message: 'Laporan berhasil dihapus', deletedBy: getUsernameFromToken(req.user) });
    } catch (error) {
        console.error('Error deleting laporan:', error);
        res.status(500).json({ success: false, message: 'Gagal menghapus laporan', error: error.message });
    }
});

// =====================================================================
// ENDPOINT 2: VERIFIKASI / CEK FISIK OLEH PIC RUANGAN
// Body: { keputusan: 'internal' | 'anggaran' | 'tolak', catatan (detail kerusakan),
//         katim_id, katim_nama, estimasi_biaya }
// =====================================================================
router.post('/:id/verifikasi', keycloakAuth, async (req, res) => {
    if (!isAdminRole(req) && !isPicRuangan(req)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya PIC Ruangan yang dapat melakukan pengecekan fisik.' });
    }
    const conn = await db.pool.getConnection();
    try {
        await conn.beginTransaction();
        const { id } = req.params;
        const { keputusan, catatan, katim_id, katim_nama, estimasi_biaya } = req.body;

        const [existing] = await conn.query('SELECT * FROM laporan_rusak WHERE id = ?', [id]);
        if (existing.length === 0) { await conn.rollback(); conn.release(); return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan' }); }
        const laporan = existing[0];
        if (laporan.status !== STATUS.DIAJUKAN) {
            await conn.rollback(); conn.release();
            return res.status(400).json({ success: false, message: `Laporan tidak dalam status diajukan. Status saat ini: ${laporan.status}` });
        }
        if (!['internal', 'anggaran', 'tolak'].includes(keputusan)) {
            await conn.rollback(); conn.release();
            return res.status(400).json({ success: false, message: 'Keputusan harus "internal", "anggaran", atau "tolak"' });
        }

        const username = getUsername(req);
        const userId = getUserId(req);
        const catatanLengkap = `[Cek Fisik - PIC] ${keputusan === 'internal' ? 'Dapat diperbaiki tim internal' : keputusan === 'anggaran' ? 'Perlu anggaran, diteruskan ke Katim' : 'Ditolak pada pengecekan fisik'}${catatan ? ': ' + catatan : ''}`;

        if (keputusan === 'anggaran' && !katim_id) {
            await conn.rollback(); conn.release();
            return res.status(400).json({ success: false, message: 'Katim tujuan wajib dipilih untuk alur dengan anggaran' });
        }

        // Update field pelacak + status
        await conn.query(
            `UPDATE laporan_rusak 
             SET status = ?, 
                 verified_by = ?, verified_at = NOW(), verified_catatan = ?,
                 katim_id = ?, katim_nama = ?,
                 estimasi_biaya = ?,
                 deskripsi = CONCAT(deskripsi, '\n\n', ?),
                 updated_at = NOW()
             WHERE id = ?`,
            [
                keputusan === 'internal' ? STATUS.SELESAI : keputusan === 'anggaran' ? STATUS.MENUNGGU_KATIM : STATUS.DITOLAK,
                username, catatan || null,
                keputusan === 'anggaran' ? katim_id : null,
                keputusan === 'anggaran' ? (katim_nama || null) : null,
                (keputusan === 'anggaran' && estimasi_biaya) ? parseFloat(estimasi_biaya) : null,
                catatanLengkap,
                id
            ]
        );

        // Jika perbaikan internal -> langsung selesai, catat di detail_perbaikan
        if (keputusan === 'internal') {
            await conn.query(
                `INSERT INTO detail_perbaikan (laporan_id, hasil_perbaikan, tanggal_selesai, catatan, rekomendasi)
                 VALUES (?, 'internal', CURDATE(), ?, ?)`,
                [id, catatan || null, `Perbaikan dilakukan oleh tim internal. Diverifikasi oleh ${username}.`]
            );
            await conn.query(
                'UPDATE laporan_rusak SET perbaikan_done_by = ?, perbaikan_done_at = NOW() WHERE id = ?',
                [username, id]
            );
        }

        await conn.commit();
        res.json({
            success: true,
            message: keputusan === 'internal' ? 'Laporan diselesaikan (perbaikan tim internal)' : keputusan === 'anggaran' ? 'Laporan diteruskan ke Katim' : 'Laporan ditolak',
            data: { newStatus: keputusan === 'internal' ? STATUS.SELESAI : keputusan === 'anggaran' ? STATUS.MENUNGGU_KATIM : STATUS.DITOLAK }
        });
    } catch (error) {
        await conn.rollback();
        console.error('❌ Error verifikasi (cek fisik):', error);
        res.status(500).json({ success: false, message: 'Gagal memproses pengecekan fisik', error: error.message });
    } finally {
        conn.release();
    }
});

// =====================================================================
// ENDPOINT 3: KATIM MENGETAHUI & MENGIRIM KE PPK
// Body: { ppk_id, ppk_nama, catatan }
// =====================================================================
router.post('/:id/katim-verifikasi', keycloakAuth, async (req, res) => {
    if (!isAdminRole(req) && !isKatim(req)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya Katim yang dapat melakukan ini.' });
    }
    try {
        const { id } = req.params;
        const { ppk_id, ppk_nama, catatan } = req.body;
        if (!ppk_id) {
            return res.status(400).json({ success: false, message: 'PPK tujuan wajib dipilih' });
        }

        const [existing] = await db.query('SELECT * FROM laporan_rusak WHERE id = ?', [id]);
        if (existing.length === 0) { return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan' }); }
        const laporan = existing[0];
        if (laporan.status !== STATUS.MENUNGGU_KATIM) {
            return res.status(400).json({ success: false, message: `Laporan tidak dalam status menunggu_katim. Status saat ini: ${laporan.status}` });
        }

        const username = getUsername(req);
        const catatanLengkap = `[Katim Mengetahui] Diteruskan ke PPK ${ppk_nama || ppk_id}${catatan ? ': ' + catatan : ''}`;

        await db.query(
            `UPDATE laporan_rusak 
             SET status = ?, 
                 katim_confirm_by = ?, katim_confirm_at = NOW(),
                 ppk_id = ?, ppk_nama = ?,
                 deskripsi = CONCAT(deskripsi, '\n\n', ?),
                 updated_at = NOW()
             WHERE id = ?`,
            [STATUS.MENUNGGU_PPK, username, ppk_id, ppk_nama || null, catatanLengkap, id]
        );
        res.json({ success: true, message: 'Diteruskan ke PPK', data: { newStatus: STATUS.MENUNGGU_PPK, ppk_id, ppk_nama } });
    } catch (error) {
        console.error('❌ Error katim verifikasi:', error);
        res.status(500).json({ success: false, message: 'Gagal memproses verifikasi Katim', error: error.message });
    }
});

// =====================================================================
// ENDPOINT 4: PPK MENGETAHUI + KISARAN BIAYA PERBAIKAN
// Body: { keputusan: 'setuju' | 'tolak', kisaran_biaya, estimasi_biaya, catatan }
// =====================================================================
router.post('/:id/ppk-verifikasi', keycloakAuth, async (req, res) => {
    if (!isAdminRole(req) && !isPPK(req)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya PPK yang dapat melakukan ini.' });
    }
    try {
        const { id } = req.params;
        const { keputusan, kisaran_biaya, estimasi_biaya, catatan } = req.body;
        if (!['setuju', 'tolak'].includes(keputusan)) {
            return res.status(400).json({ success: false, message: 'Keputusan harus "setuju" atau "tolak"' });
        }

        const [existing] = await db.query('SELECT * FROM laporan_rusak WHERE id = ?', [id]);
        if (existing.length === 0) { return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan' }); }
        const laporan = existing[0];
        if (laporan.status !== STATUS.MENUNGGU_PPK) {
            return res.status(400).json({ success: false, message: `Laporan tidak dalam status menunggu_ppk. Status saat ini: ${laporan.status}` });
        }

        const username = getUsername(req);
        const estimasiValue = estimasi_biaya ? parseFloat(estimasi_biaya) : null;
        const catatanLengkap = `[Verifikasi PPK] ${keputusan === 'setuju' ? 'Disetujui, siap dilaksanakan' : 'Ditolak PPK'}${catatan ? ': ' + catatan : ''}${kisaran_biaya ? '\nKisaran biaya perbaikan: ' + kisaran_biaya : ''}`;

        await db.query(
            `UPDATE laporan_rusak 
             SET status = ?, 
                 ppk_confirm_by = ?, ppk_confirm_at = NOW(),
                 kisaran_biaya = ?, estimasi_biaya = ?,
                 deskripsi = CONCAT(deskripsi, '\n\n', ?),
                 updated_at = NOW()
             WHERE id = ?`,
            [keputusan === 'setuju' ? STATUS.DALAM_PERBAIKAN : STATUS.DITOLAK,
             username, kisaran_biaya || null, estimasiValue, catatanLengkap, id]
        );
        res.json({
            success: true,
            message: keputusan === 'setuju' ? 'Disetujui PPK, masuk dalam perbaikan' : 'Ditolak PPK',
            data: { newStatus: keputusan === 'setuju' ? STATUS.DALAM_PERBAIKAN : STATUS.DITOLAK }
        });
    } catch (error) {
        console.error('❌ Error verifikasi PPK:', error);
        res.status(500).json({ success: false, message: 'Gagal verifikasi PPK', error: error.message });
    }
});

// =====================================================================
// ENDPOINT 5: CATAT PERBAIKAN SELESAI (PIC / ADMIN)
// Body: { hasil_perbaikan, tanggal_selesai, rating, biaya_aktual, dokumentasi,
//         rekomendasi, nama_vendor, no_kontrak, catatan }
// =====================================================================
router.post('/:id/catat-perbaikan', keycloakAuth, async (req, res) => {
    if (!isAdminRole(req) && !isPicRuangan(req)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya PIC Ruangan/Admin yang dapat mencatat perbaikan.' });
    }
    try {
        const { id } = req.params;
        const { hasil_perbaikan, tanggal_selesai, rating, biaya_aktual, dokumentasi, rekomendasi, nama_vendor, no_kontrak, catatan } = req.body;

        if (!hasil_perbaikan) {
            return res.status(400).json({ success: false, message: 'Hasil perbaikan harus diisi' });
        }
        const validHasil = ['internal', 'eksternal', 'gagal'];
        if (!validHasil.includes(hasil_perbaikan)) {
            return res.status(400).json({ success: false, message: 'Hasil perbaikan tidak valid. Gunakan: internal, eksternal, atau gagal' });
        }
        if (hasil_perbaikan === 'eksternal' && !nama_vendor) {
            return res.status(400).json({ success: false, message: 'Nama vendor wajib diisi untuk perbaikan eksternal' });
        }

        const [existing] = await db.query('SELECT * FROM laporan_rusak WHERE id = ?', [id]);
        if (existing.length === 0) { return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan' }); }
        const laporan = existing[0];
        if (laporan.status !== STATUS.DALAM_PERBAIKAN) {
            return res.status(400).json({ success: false, message: `Laporan tidak dalam status dalam_perbaikan. Status saat ini: ${laporan.status}` });
        }

        const username = getUsername(req);
        const tanggalSelesaiFormatted = tanggal_selesai || formatDateForMySQL(new Date());
        const biayaAktualValue = biaya_aktual ? parseFloat(biaya_aktual) : null;

        const [existingDetail] = await db.query('SELECT id FROM detail_perbaikan WHERE laporan_id = ?', [id]);
        if (existingDetail.length > 0) {
            await db.query(
                `UPDATE detail_perbaikan 
                 SET hasil_perbaikan = ?, tanggal_selesai = ?, rating = ?, biaya_aktual = ?,
                     dokumentasi = ?, rekomendasi = ?, nama_vendor = ?, no_kontrak = ?, catatan = ?, updated_at = NOW()
                 WHERE laporan_id = ?`,
                [hasil_perbaikan, tanggalSelesaiFormatted, rating || null, biayaAktualValue,
                 dokumentasi || null, rekomendasi || null, nama_vendor || null, no_kontrak || null, catatan || null, id]
            );
        } else {
            await db.query(
                `INSERT INTO detail_perbaikan 
                 (laporan_id, hasil_perbaikan, tanggal_selesai, rating, biaya_aktual, dokumentasi, rekomendasi, nama_vendor, no_kontrak, catatan)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, hasil_perbaikan, tanggalSelesaiFormatted, rating || null, biayaAktualValue,
                 dokumentasi || null, rekomendasi || null, nama_vendor || null, no_kontrak || null, catatan || null]
            );
        }

        const catatanLengkap = `[Perbaikan Selesai] ${hasil_perbaikan === 'internal' ? 'Tim internal' : hasil_perbaikan === 'eksternal' ? 'Vendor eksternal: ' + (nama_vendor || '') : 'Gagal'}${catatan ? ' - ' + catatan : ''}${biayaAktualValue ? '\nBiaya aktual: Rp ' + biayaAktualValue.toLocaleString() : ''}`;

        await db.query(
            `UPDATE laporan_rusak 
             SET status = ?, 
                 perbaikan_done_by = ?, perbaikan_done_at = NOW(),
                 deskripsi = CONCAT(deskripsi, '\n\n', ?),
                 updated_at = NOW()
             WHERE id = ?`,
            [STATUS.MENUNGGU_KONFIRMASI_KABAG, username, catatanLengkap, id]
        );

        res.json({ success: true, message: 'Perbaikan dicatat selesai, menunggu konfirmasi Kabag TU & User', data: { newStatus: STATUS.MENUNGGU_KONFIRMASI_KABAG } });
    } catch (error) {
        console.error('❌ Error catat perbaikan:', error);
        res.status(500).json({ success: false, message: 'Gagal mencatat perbaikan', error: error.message });
    }
});

// =====================================================================
// ENDPOINT 6: KONFIRMASI KABAG TU
// Body: { catatan }
// =====================================================================
router.post('/:id/konfirmasi-kabag', keycloakAuth, async (req, res) => {
    if (!isAdminRole(req) && !isKabagTU(req)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya Kabag TU yang dapat mengonfirmasi.' });
    }
    try {
        const { id } = req.params;
        const { catatan } = req.body;
        const [existing] = await db.query('SELECT * FROM laporan_rusak WHERE id = ?', [id]);
        if (existing.length === 0) { return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan' }); }
        const laporan = existing[0];
        if (laporan.status !== STATUS.MENUNGGU_KONFIRMASI_KABAG) {
            return res.status(400).json({ success: false, message: `Laporan tidak dalam status menunggu konfirmasi Kabag TU. Status saat ini: ${laporan.status}` });
        }
        const username = getUsername(req);
        const catatanLengkap = `[Konfirmasi Kabag TU] ${catatan || 'Perbaikan dikonfirmasi Kabag TU'}`;
        await db.query(
            `UPDATE laporan_rusak 
             SET status = ?, kabag_confirm_by = ?, kabag_confirm_at = NOW(),
                 deskripsi = CONCAT(deskripsi, '\n\n', ?), updated_at = NOW()
             WHERE id = ?`,
            [STATUS.MENUNGGU_KONFIRMASI_USER, username, catatanLengkap, id]
        );
        res.json({ success: true, message: 'Dikonfirmasi Kabag TU, menunggu konfirmasi User', data: { newStatus: STATUS.MENUNGGU_KONFIRMASI_USER } });
    } catch (error) {
        console.error('❌ Error konfirmasi kabag:', error);
        res.status(500).json({ success: false, message: 'Gagal konfirmasi Kabag TU', error: error.message });
    }
});

// =====================================================================
// ENDPOINT 7: KONFIRMASI USER (PELAPOR)
// Body: { catatan }
// =====================================================================
router.post('/:id/konfirmasi-user', keycloakAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { catatan } = req.body;
        const userId = getUserId(req);
        const isAdmin = isAdminRole(req);

        const [existing] = await db.query('SELECT * FROM laporan_rusak WHERE id = ?', [id]);
        if (existing.length === 0) { return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan' }); }
        const laporan = existing[0];
        if (laporan.status !== STATUS.MENUNGGU_KONFIRMASI_USER) {
            return res.status(400).json({ success: false, message: `Laporan tidak dalam status menunggu konfirmasi User. Status saat ini: ${laporan.status}` });
        }
        // Hanya pelapor atau admin yang bisa konfirmasi final
        if (!isAdmin && String(laporan.pelapor_id) !== String(userId)) {
            return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya pelapor yang dapat mengonfirmasi penyelesaian.' });
        }
        const username = getUsername(req);
        const catatanLengkap = `[Konfirmasi User] ${catatan || 'Laporan dikonfirmasi selesai oleh pelapor'}`;
        await db.query(
            `UPDATE laporan_rusak 
             SET status = ?, user_confirm_by = ?, user_confirm_at = NOW(),
                 deskripsi = CONCAT(deskripsi, '\n\n', ?), updated_at = NOW()
             WHERE id = ?`,
            [STATUS.SELESAI, username, catatanLengkap, id]
        );
        res.json({ success: true, message: 'Laporan selesai', data: { newStatus: STATUS.SELESAI } });
    } catch (error) {
        console.error('❌ Error konfirmasi user:', error);
        res.status(500).json({ success: false, message: 'Gagal konfirmasi User', error: error.message });
    }
});

// ========== GET ASET BY RUANGAN ==========
router.get('/aset-berdasarkan-ruangan/:ruanganId', keycloakAuth, async (req, res) => {
    try {
        const { ruanganId } = req.params;
        const ruanganIdInt = parseInt(ruanganId, 10);
        const query = `
            SELECT 
                ma.id, ma.kode_barang, ma.nama_barang, ma.merk, ma.tipe, ma.kondisi,
                ma.status_bmn, ma.tanggal_perolehan, ma.is_active as is_active_aset,
                ar.id as aset_ruangan_id, ar.ruangan_id, ar.tgl_masuk, ar.tgl_keluar,
                ar.status as status_ruangan, ar.keterangan
            FROM master_aset ma
            INNER JOIN aset_ruangan ar ON ma.id = ar.aset_id
            WHERE ar.ruangan_id = ? AND ar.status = 'aktif' AND ma.is_active = 1
            ORDER BY ma.kode_barang ASC
        `;
        const [rows] = await db.query(query, [ruanganIdInt]);
        res.json({ success: true, data: rows, message: `Data aset untuk ruangan ID ${ruanganIdInt} berhasil dimuat` });
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ success: false, message: error.message, data: [] });
    }
});

module.exports = router;
