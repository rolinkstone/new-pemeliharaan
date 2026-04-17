// backend/routes/laporansRusak.js

const express = require('express');
const router = express.Router();

const db = require('../db');
const { keycloakAuth } = require('../middleware/keycloakAuth');
const { getPICUsersFromKeycloak } = require('../utils/keycloakHelpers');

function getUsernameFromToken(user) {
    return user?.preferred_username || user?.username || 'unknown';
}

// Helper function untuk generate nomor laporan
async function generateNomorLaporan() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    const [rows] = await db.query(
        `SELECT COUNT(*) as total FROM laporan_rusak 
         WHERE nomor_laporan LIKE ?`,
        [`LR/${year}${month}/%`]
    );
    
    const nextNumber = (rows[0]?.total || 0) + 1;
    const nomorUrut = String(nextNumber).padStart(3, '0');
    
    return `LR/${year}${month}/${nomorUrut}`;
}

// Helper function untuk format tanggal
const formatDateForMySQL = (dateValue) => {
    if (!dateValue) return null;
    
    if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        return dateValue;
    }
    
    if (typeof dateValue === 'string' && dateValue.includes('T')) {
        return dateValue.split('T')[0];
    }
    
    try {
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) return null;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch {
        return null;
    }
};

// ========== GET ALL LAPORAN RUSAK ==========
router.get('/', keycloakAuth, async (req, res) => {
    try {
        const { 
            status, prioritas, aset_id, ruangan_id, pelapor_id, 
            search, page = 1, limit = 10 
        } = req.query;
        const offset = (page - 1) * limit;
        
        let query = `
            SELECT 
                lr.*, 
                a.kode_barang as aset_kode, 
                a.nama_barang as aset_nama, 
                a.merk as aset_merk,
                r.kode_ruangan, 
                r.nama_ruangan, 
                r.lokasi,
                pr.id as pic_id,
                pr.user_id as pic_user_id,
                pr.user_name as pic_user_name,
                pr.tgl_penugasan as pic_tgl_penugasan,
                pr.status as pic_status,
                dp.id as detail_perbaikan_id,
                dp.hasil_perbaikan,
                dp.tanggal_selesai,
                dp.rating,
                dp.biaya_aktual,
                dp.dokumentasi,
                dp.rekomendasi,
                dp.nama_vendor,
                dp.no_kontrak
            FROM laporan_rusak lr
            LEFT JOIN master_aset a ON lr.aset_id = a.id
            LEFT JOIN ruangan r ON lr.ruangan_id = r.id
            LEFT JOIN pic_ruangan pr ON lr.ruangan_id = pr.ruangan_id AND pr.status = 'aktif'
            LEFT JOIN detail_perbaikan dp ON lr.id = dp.laporan_id
            WHERE 1=1
        `;
        const params = [];
        
        if (status) {
            query += ' AND lr.status = ?';
            params.push(status);
        }
        
        if (prioritas) {
            query += ' AND lr.prioritas = ?';
            params.push(prioritas);
        }
        
        if (aset_id) {
            query += ' AND lr.aset_id = ?';
            params.push(aset_id);
        }
        
        if (ruangan_id) {
            query += ' AND lr.ruangan_id = ?';
            params.push(ruangan_id);
        }
        
        if (pelapor_id) {
            query += ' AND lr.pelapor_id = ?';
            params.push(pelapor_id);
        }
        
        if (search) {
            query += ` AND (lr.nomor_laporan LIKE ? OR lr.deskripsi LIKE ? OR a.nama_barang LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }
        
        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total
            FROM laporan_rusak lr
            WHERE 1=1
            ${status ? ' AND lr.status = ?' : ''}
            ${prioritas ? ' AND lr.prioritas = ?' : ''}
            ${aset_id ? ' AND lr.aset_id = ?' : ''}
            ${ruangan_id ? ' AND lr.ruangan_id = ?' : ''}
            ${pelapor_id ? ' AND lr.pelapor_id = ?' : ''}
        `;
        const countParams = [];
        if (status) countParams.push(status);
        if (prioritas) countParams.push(prioritas);
        if (aset_id) countParams.push(aset_id);
        if (ruangan_id) countParams.push(ruangan_id);
        if (pelapor_id) countParams.push(pelapor_id);
        
        const [countResult] = await db.query(countQuery, countParams);
        const total = countResult && countResult[0] ? countResult[0].total : 0;
        
        query += ' ORDER BY lr.tgl_laporan DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const [rows] = await db.query(query, params);
        
        // Get user details from Keycloak
        let userMap = {};
        try {
            const users = await getPICUsersFromKeycloak();
            users.forEach(user => {
                userMap[user.user_id] = user;
            });
        } catch (error) {
            console.error('Error fetching users from Keycloak:', error);
        }
        
        const laporanMap = new Map();
        
        rows.forEach(row => {
            if (!laporanMap.has(row.id)) {
                laporanMap.set(row.id, {
                    id: row.id,
                    nomor_laporan: row.nomor_laporan,
                    aset_id: row.aset_id,
                    ruangan_id: row.ruangan_id,
                    pelapor_id: row.pelapor_id,
                    tgl_laporan: row.tgl_laporan,
                    deskripsi: row.deskripsi,
                    foto_kerusakan: row.foto_kerusakan,
                    prioritas: row.prioritas,
                    status: row.status,
                    is_active: row.is_active,
                    created_at: row.created_at,
                    updated_at: row.updated_at,
                    estimasi_biaya: row.estimasi_biaya,
                    
                    aset_nama: row.aset_nama || `Aset ID: ${row.aset_id}`,
                    aset_kode: row.aset_kode || '',
                    aset_merk: row.aset_merk || '',
                    ruangan_nama: row.nama_ruangan || `Ruangan ID: ${row.ruangan_id}`,
                    ruangan_kode: row.kode_ruangan || '',
                    ruangan_lokasi: row.lokasi || '',
                    
                    pic_ruangan: row.pic_user_name || null,
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
                        no_kontrak: row.no_kontrak
                    } : null
                });
            }
        });
        
        const laporanList = Array.from(laporanMap.values()).map(item => {
            let fotoKerusakan = [];
            try {
                if (item.foto_kerusakan) {
                    if (typeof item.foto_kerusakan === 'string') {
                        try {
                            const parsed = JSON.parse(item.foto_kerusakan);
                            fotoKerusakan = Array.isArray(parsed) ? parsed : [parsed];
                        } catch {
                            fotoKerusakan = [item.foto_kerusakan];
                        }
                    } else if (Array.isArray(item.foto_kerusakan)) {
                        fotoKerusakan = item.foto_kerusakan;
                    }
                }
            } catch (e) {
                console.warn(`Error parsing foto_kerusakan for laporan ${item.id}:`, e.message);
                fotoKerusakan = [];
            }
            
            return {
                ...item,
                foto_kerusakan: fotoKerusakan,
                pelapor_nama: userMap[item.pelapor_id]?.nama || item.pelapor_id,
                pelapor_email: userMap[item.pelapor_id]?.email || '-'
            };
        });
        
        res.json({
            success: true,
            data: laporanList,
            pagination: {
                currentPage: parseInt(page),
                perPage: parseInt(limit),
                total: total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching laporan rusak:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal mengambil data laporan',
            error: error.message 
        });
    }
});

// ========== GET LAPORAN BY ID ==========
router.get('/:id', keycloakAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Query lengkap dengan JOIN ke pic_ruangan
        const [rows] = await db.query(`
            SELECT 
                lr.*, 
                a.kode_barang as aset_kode, 
                a.nama_barang as aset_nama,
                r.kode_ruangan, 
                r.nama_ruangan,
                pr.user_id as pic_ruangan_id,
                pr.user_name as pic_ruangan_nama,
                pr.tgl_penugasan as pic_tgl_penugasan,
                dp.id as detail_perbaikan_id,
                dp.hasil_perbaikan,
                dp.tanggal_selesai,
                dp.rating,
                dp.biaya_aktual,
                dp.dokumentasi,
                dp.rekomendasi,
                dp.nama_vendor,
                dp.no_kontrak
            FROM laporan_rusak lr
            LEFT JOIN master_aset a ON lr.aset_id = a.id
            LEFT JOIN ruangan r ON lr.ruangan_id = r.id
            LEFT JOIN pic_ruangan pr ON lr.ruangan_id = pr.ruangan_id AND pr.status = 'aktif'
            LEFT JOIN detail_perbaikan dp ON lr.id = dp.laporan_id
            WHERE lr.id = ?
        `, [id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Laporan tidak ditemukan' 
            });
        }
        
        const row = rows[0];
        
        let fotoKerusakan = [];
        try {
            if (row.foto_kerusakan) {
                fotoKerusakan = JSON.parse(row.foto_kerusakan);
            }
        } catch (e) {
            console.warn(`Error parsing foto_kerusakan for laporan ${row.id}:`, e.message);
            fotoKerusakan = [];
        }
        
        // Get user details from Keycloak untuk pelapor
        let pelaporDetail = null;
        let picRuanganDetail = null;
        try {
            const users = await getPICUsersFromKeycloak();
            pelaporDetail = users.find(u => u.user_id === row.pelapor_id) || null;
            
            // Ambil detail PIC ruangan dari Keycloak jika ada
            if (row.pic_ruangan_id) {
                picRuanganDetail = users.find(u => u.user_id === row.pic_ruangan_id) || null;
            }
        } catch (error) {
            console.error('Error fetching user from Keycloak:', error);
        }
        
        res.json({
            success: true,
            data: {
                id: row.id,
                nomor_laporan: row.nomor_laporan,
                aset_id: row.aset_id,
                ruangan_id: row.ruangan_id,
                pelapor_id: row.pelapor_id,
                tgl_laporan: row.tgl_laporan,
                deskripsi: row.deskripsi,
                foto_kerusakan: fotoKerusakan,
                prioritas: row.prioritas,
                status: row.status,
                is_active: row.is_active,
                created_at: row.created_at,
                updated_at: row.updated_at,
                estimasi_biaya: row.estimasi_biaya,
                
                aset_nama: row.aset_nama,
                aset_kode: row.aset_kode,
                ruangan_nama: row.nama_ruangan,
                ruangan_kode: row.kode_ruangan,
                pelapor_nama: pelaporDetail?.nama || row.pelapor_id,
                pelapor_email: pelaporDetail?.email || '-',
                
                // DATA PIC RUANGAN YANG BENAR (dari tabel pic_ruangan)
                pic_ruangan: row.pic_ruangan_nama || null,
                pic_ruangan_id: row.pic_ruangan_id || null,
                pic_ruangan_nama: row.pic_ruangan_nama || null,
                pic_ruangan_tgl_penugasan: row.pic_tgl_penugasan || null,
                
                // Data detail perbaikan
                detail_perbaikan: row.detail_perbaikan_id ? {
                    id: row.detail_perbaikan_id,
                    hasil_perbaikan: row.hasil_perbaikan,
                    tanggal_selesai: row.tanggal_selesai,
                    rating: row.rating,
                    biaya_aktual: row.biaya_aktual,
                    dokumentasi: row.dokumentasi,
                    rekomendasi: row.rekomendasi,
                    nama_vendor: row.nama_vendor,
                    no_kontrak: row.no_kontrak
                } : null
            }
        });
    } catch (error) {
        console.error('Error fetching laporan:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== CREATE LAPORAN ==========
router.post('/', keycloakAuth, async (req, res) => {
    try {
        let { 
            aset_id, ruangan_id, pelapor_id, tgl_laporan, 
            deskripsi, foto_kerusakan, prioritas, status 
        } = req.body;

        const reqSize = JSON.stringify(req.body).length;
        console.log(`📦 POST /laporansrusak - Body size: ${(reqSize / 1024).toFixed(2)} KB`);

        if (!aset_id || !ruangan_id || !pelapor_id || !deskripsi) {
            return res.status(400).json({ 
                success: false, 
                message: 'Aset, ruangan, pelapor, dan deskripsi harus diisi' 
            });
        }

        const nomor_laporan = await generateNomorLaporan();
        const formattedTglLaporan = formatDateForMySQL(tgl_laporan) || formatDateForMySQL(new Date());
        const username = getUsernameFromToken(req.user);

        const fotoKerusakanJson = Array.isArray(foto_kerusakan) && foto_kerusakan.length > 0
            ? JSON.stringify(foto_kerusakan) 
            : null;

        const [result] = await db.query(
            `INSERT INTO laporan_rusak (
                nomor_laporan, aset_id, ruangan_id, pelapor_id, 
                tgl_laporan, deskripsi, foto_kerusakan, prioritas, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                nomor_laporan, aset_id, ruangan_id, pelapor_id,
                formattedTglLaporan, deskripsi, 
                fotoKerusakanJson,
                prioritas || 'sedang', status || 'menunggu_verifikasi_pic'
            ]
        );

        res.status(201).json({
            success: true,
            message: 'Laporan berhasil dibuat',
            data: {
                id: result.insertId,
                nomor_laporan,
                aset_id,
                ruangan_id,
                pelapor_id,
                tgl_laporan: formattedTglLaporan
            },
            createdBy: username
        });
    } catch (error) {
        console.error('Error creating laporan:', error);
        
        if (error.type === 'entity.too.large') {
            return res.status(413).json({ 
                success: false, 
                message: 'Ukuran file terlalu besar. Maksimal 100MB.' 
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Gagal membuat laporan',
            error: error.message 
        });
    }
});

// ========== UPDATE LAPORAN ==========
router.put('/:id', keycloakAuth, async (req, res) => {
    try {
        const { id } = req.params;
        let { 
            aset_id, ruangan_id, deskripsi, foto_kerusakan, 
            prioritas, status 
        } = req.body;

        const [existing] = await db.query('SELECT id FROM laporan_rusak WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Laporan tidak ditemukan' 
            });
        }

        const username = getUsernameFromToken(req.user);

        const fotoKerusakanJson = Array.isArray(foto_kerusakan) 
            ? JSON.stringify(foto_kerusakan) 
            : null;

        await db.query(
            `UPDATE laporan_rusak 
             SET aset_id = ?, ruangan_id = ?, deskripsi = ?, 
                 foto_kerusakan = ?, prioritas = ?, status = ?
             WHERE id = ?`,
            [
                aset_id, ruangan_id, deskripsi,
                fotoKerusakanJson,
                prioritas, status, id
            ]
        );

        res.json({
            success: true,
            message: 'Laporan berhasil diperbarui',
            updatedBy: username
        });
    } catch (error) {
        console.error('Error updating laporan:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal memperbarui laporan',
            error: error.message 
        });
    }
});

// ========== DELETE LAPORAN ==========
router.delete('/:id', keycloakAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await db.query('DELETE FROM laporan_rusak WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Laporan tidak ditemukan' 
            });
        }

        const username = getUsernameFromToken(req.user);

        res.json({
            success: true,
            message: 'Laporan berhasil dihapus',
            deletedBy: username
        });
    } catch (error) {
        console.error('Error deleting laporan:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal menghapus laporan',
            error: error.message 
        });
    }
});

// ============================================
// ENDPOINT VERIFIKASI LAPORAN (PIC)
// ============================================
router.post('/:id/verifikasi', keycloakAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { keputusan, catatan, alur, estimasi_biaya } = req.body;

        console.log('📥 Verifikasi request:', { id, keputusan, catatan, alur, estimasi_biaya });

        const [existing] = await db.query(
            'SELECT id, status FROM laporan_rusak WHERE id = ?', 
            [id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Laporan tidak ditemukan' 
            });
        }

        const currentStatus = existing[0].status;

        if (currentStatus !== 'menunggu_verifikasi_pic') {
            return res.status(400).json({
                success: false,
                message: `Laporan tidak dalam status menunggu verifikasi PIC. Status saat ini: ${currentStatus}`
            });
        }

        let newStatus;
        let statusMessage;

        if (keputusan === 'setuju') {
            if (alur === 'langsung') {
                newStatus = 'selesai';
                statusMessage = 'Disetujui dan langsung selesai (perbaikan tanpa anggaran)';
            } else {
                newStatus = 'menunggu_disposisi';
                statusMessage = 'Disetujui, menunggu disposisi Kabag TU';
                
                if (!estimasi_biaya || parseFloat(estimasi_biaya) <= 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Estimasi biaya wajib diisi dan harus lebih dari 0 untuk alur dengan anggaran'
                    });
                }
            }
        } else if (keputusan === 'tolak') {
            newStatus = 'ditolak';
            statusMessage = 'Ditolak';
        } else {
            return res.status(400).json({
                success: false,
                message: 'Keputusan tidak valid. Gunakan "setuju" atau "tolak"'
            });
        }

        const catatanLengkap = `[Verifikasi PIC - ${statusMessage}] ${catatan || ''}`.trim();
        
        if (estimasi_biaya && keputusan === 'setuju' && alur !== 'langsung') {
            await db.query(
                `UPDATE laporan_rusak 
                 SET status = ?, 
                     estimasi_biaya = ?,
                     deskripsi = CONCAT(deskripsi, '\n\n', ?),
                     updated_at = NOW()
                 WHERE id = ?`,
                [newStatus, parseFloat(estimasi_biaya), catatanLengkap, id]
            );
        } else {
            await db.query(
                `UPDATE laporan_rusak 
                 SET status = ?, 
                     deskripsi = CONCAT(deskripsi, '\n\n', ?),
                     updated_at = NOW()
                 WHERE id = ?`,
                [newStatus, catatanLengkap, id]
            );
        }

        res.json({
            success: true,
            message: `Laporan berhasil diverifikasi`,
            data: { 
                newStatus,
                oldStatus: currentStatus,
                alur,
                estimasi_biaya: estimasi_biaya || null
            }
        });

    } catch (error) {
        console.error('❌ Error verifikasi laporan:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal memproses verifikasi laporan',
            error: error.message 
        });
    }
});

// ============================================
// ENDPOINT DISPOSISI OLEH KABAG TU
// ============================================
router.post('/:id/disposisi', keycloakAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { tujuan, catatan, estimasi_biaya } = req.body;
        const userId = req.user?.sub || req.user?.id;

        console.log('📥 Disposisi request:', { id, tujuan, catatan, estimasi_biaya });

        if (tujuan !== 'ppk') {
            return res.status(400).json({
                success: false,
                message: 'Tujuan disposisi harus ppk'
            });
        }

        if (!estimasi_biaya || estimasi_biaya <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Estimasi biaya harus diisi dengan nilai yang valid'
            });
        }

        const [existing] = await db.query(
            'SELECT * FROM laporan_rusak WHERE id = ?', 
            [id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Laporan tidak ditemukan' 
            });
        }

        const laporan = existing[0];

        if (laporan.status !== 'menunggu_disposisi') {
            return res.status(400).json({
                success: false,
                message: `Laporan tidak dalam status menunggu disposisi. Status saat ini: ${laporan.status}`
            });
        }

        await db.query(
            `INSERT INTO disposisi 
             (laporan_id, kabag_id, tgl_disposisi, tujuan, catatan, estimasi_biaya) 
             VALUES (?, ?, NOW(), ?, ?, ?)`,
            [id, userId, tujuan, catatan || '', estimasi_biaya]
        );

        const newStatus = 'menunggu_verifikasi_ppk';
        const statusMessage = 'Diteruskan ke PPK untuk verifikasi anggaran';
        const catatanLengkap = `[Disposisi oleh Kabag TU] ${statusMessage}. Estimasi biaya: Rp ${parseFloat(estimasi_biaya).toLocaleString()}. ${catatan || ''}`.trim();

        await db.query(
            `UPDATE laporan_rusak 
             SET status = ?, 
                 deskripsi = CONCAT(deskripsi, '\n\n', ?),
                 updated_at = NOW()
             WHERE id = ?`,
            [newStatus, catatanLengkap, id]
        );

        res.json({
            success: true,
            message: 'Disposisi berhasil dikirim ke PPK',
            data: { newStatus, tujuan, estimasi_biaya }
        });

    } catch (error) {
        console.error('❌ Error disposisi:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal disposisi laporan',
            error: error.message 
        });
    }
});

// ============================================
// ENDPOINT VERIFIKASI PPK
// ============================================
router.post('/:id/verifikasi-ppk', keycloakAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { hasil_verifikasi, catatan } = req.body;
        const userId = req.user?.sub || req.user?.id;

        console.log('📥 Verifikasi PPK request:', { id, hasil_verifikasi, catatan });

        if (!hasil_verifikasi || (hasil_verifikasi !== 'disetujui' && hasil_verifikasi !== 'ditolak')) {
            return res.status(400).json({
                success: false,
                message: 'Hasil verifikasi harus "disetujui" atau "ditolak"'
            });
        }

        const [existing] = await db.query(
            'SELECT * FROM laporan_rusak WHERE id = ?', 
            [id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Laporan tidak ditemukan' 
            });
        }

        const laporan = existing[0];

        if (laporan.status !== 'menunggu_verifikasi_ppk') {
            return res.status(400).json({
                success: false,
                message: `Laporan tidak dalam status menunggu verifikasi PPK. Status saat ini: ${laporan.status}`
            });
        }

        let newStatus;
        let statusMessage;

        if (hasil_verifikasi === 'disetujui') {
            newStatus = 'dalam_perbaikan';
            statusMessage = 'Anggaran disetujui, siap untuk perbaikan';
        } else {
            newStatus = 'ditolak';
            statusMessage = 'Anggaran ditolak';
        }

        const catatanLengkap = `[Verifikasi PPK] ${statusMessage}. ${catatan || ''}`.trim();

        await db.query(
            `UPDATE laporan_rusak 
             SET status = ?, 
                 deskripsi = CONCAT(deskripsi, '\n\n', ?),
                 updated_at = NOW()
             WHERE id = ?`,
            [newStatus, catatanLengkap, id]
        );

        res.json({
            success: true,
            message: 'Verifikasi PPK berhasil',
            data: { newStatus }
        });

    } catch (error) {
        console.error('❌ Error verifikasi PPK:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal verifikasi PPK',
            error: error.message 
        });
    }
});

// ============================================
// ENDPOINT SELESAIKAN PERBAIKAN
// ============================================
router.post('/:id/selesaikan-perbaikan', keycloakAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            hasil_perbaikan, catatan, tanggal_selesai, rating,
            biaya_aktual, dokumentasi, rekomendasi, nama_vendor, no_kontrak
        } = req.body;

        console.log('🔧 SELESAIKAN PERBAIKAN:', { id, hasil_perbaikan, tanggal_selesai });

        if (!hasil_perbaikan) {
            return res.status(400).json({ success: false, message: 'Hasil perbaikan harus diisi' });
        }

        const validHasil = ['internal', 'eksternal', 'gagal'];
        if (!validHasil.includes(hasil_perbaikan)) {
            return res.status(400).json({ success: false, message: 'Hasil perbaikan tidak valid' });
        }

        if (hasil_perbaikan === 'eksternal' && !nama_vendor) {
            return res.status(400).json({ success: false, message: 'Nama vendor wajib diisi untuk perbaikan eksternal' });
        }

        const [existing] = await db.query('SELECT * FROM laporan_rusak WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan' });
        }

        const laporan = existing[0];

        if (laporan.status !== 'dalam_perbaikan') {
            return res.status(400).json({ success: false, message: 'Laporan tidak dalam status dalam_perbaikan' });
        }

        const [existingDetail] = await db.query('SELECT id FROM detail_perbaikan WHERE laporan_id = ?', [id]);
        const tanggalSelesaiFormatted = tanggal_selesai || formatDateForMySQL(new Date());
        const biayaAktualValue = biaya_aktual ? parseFloat(biaya_aktual) : null;

        if (existingDetail.length > 0) {
            await db.query(`UPDATE detail_perbaikan SET hasil_perbaikan=?, tanggal_selesai=?, rating=?, biaya_aktual=?, dokumentasi=?, rekomendasi=?, nama_vendor=?, no_kontrak=?, updated_at=NOW() WHERE laporan_id=?`, [hasil_perbaikan, tanggalSelesaiFormatted, rating || null, biayaAktualValue, dokumentasi || null, rekomendasi || null, nama_vendor || null, no_kontrak || null, id]);
        } else {
            await db.query(`INSERT INTO detail_perbaikan (laporan_id, hasil_perbaikan, tanggal_selesai, rating, biaya_aktual, dokumentasi, rekomendasi, nama_vendor, no_kontrak) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, hasil_perbaikan, tanggalSelesaiFormatted, rating || null, biayaAktualValue, dokumentasi || null, rekomendasi || null, nama_vendor || null, no_kontrak || null]);
        }

        let newStatus, statusMessage;
        if (hasil_perbaikan === 'internal' || hasil_perbaikan === 'eksternal') {
            newStatus = 'selesai';
            statusMessage = `Perbaikan berhasil oleh ${hasil_perbaikan === 'internal' ? 'tim internal' : 'vendor eksternal'}`;
        } else {
            newStatus = 'dalam_perbaikan';
            statusMessage = 'Perbaikan gagal, perlu evaluasi lebih lanjut';
        }

        let catatanLengkap = `[Selesaikan Perbaikan - ${hasil_perbaikan === 'internal' ? 'Tim Internal' : hasil_perbaikan === 'eksternal' ? 'Vendor Eksternal' : 'Gagal'}] ${statusMessage}. ${catatan || ''}`;
        if (hasil_perbaikan === 'eksternal' && nama_vendor) catatanLengkap += `\nVendor: ${nama_vendor}`;
        if (biayaAktualValue) catatanLengkap += `\nBiaya Aktual: Rp ${biayaAktualValue.toLocaleString()}`;
        if (rating) catatanLengkap += `\nRating: ${rating}/5`;

        await db.query(`UPDATE laporan_rusak SET status=?, deskripsi=CONCAT(deskripsi, '\n\n', ?), updated_at=NOW() WHERE id=?`, [newStatus, catatanLengkap, id]);

        res.json({ success: true, message: 'Laporan perbaikan berhasil diselesaikan', data: { newStatus, hasil_perbaikan } });

    } catch (error) {
        console.error('❌ Error selesaikan perbaikan:', error);
        res.status(500).json({ success: false, message: 'Gagal menyelesaikan perbaikan', error: error.message });
    }
});

// ========== GET STATISTICS ==========
router.get('/statistics', keycloakAuth, async (req, res) => {
    try {
        const [total] = await db.query('SELECT COUNT(*) as total FROM laporan_rusak');
        const [draft] = await db.query('SELECT COUNT(*) as total FROM laporan_rusak WHERE status = "draft"');
        const [menungguVerifikasiPIC] = await db.query('SELECT COUNT(*) as total FROM laporan_rusak WHERE status = "menunggu_verifikasi_pic"');
        const [menungguDisposisi] = await db.query('SELECT COUNT(*) as total FROM laporan_rusak WHERE status = "menunggu_disposisi"');
        const [menungguVerifikasiPPK] = await db.query('SELECT COUNT(*) as total FROM laporan_rusak WHERE status = "menunggu_verifikasi_ppk"');
        const [diverifikasiPPK] = await db.query('SELECT COUNT(*) as total FROM laporan_rusak WHERE status = "diverifikasi_ppk"');
        const [dalamPerbaikan] = await db.query('SELECT COUNT(*) as total FROM laporan_rusak WHERE status = "dalam_perbaikan"');
        const [selesai] = await db.query('SELECT COUNT(*) as total FROM laporan_rusak WHERE status = "selesai"');
        const [ditolak] = await db.query('SELECT COUNT(*) as total FROM laporan_rusak WHERE status = "ditolak"');
        
        res.json({
            success: true,
            data: {
                total: total[0]?.total || 0,
                draft: draft[0]?.total || 0,
                menunggu_verifikasi_pic: menungguVerifikasiPIC[0]?.total || 0,
                menunggu_disposisi: menungguDisposisi[0]?.total || 0,
                menunggu_verifikasi_ppk: menungguVerifikasiPPK[0]?.total || 0,
                diverifikasi_ppk: diverifikasiPPK[0]?.total || 0,
                dalam_perbaikan: dalamPerbaikan[0]?.total || 0,
                selesai: selesai[0]?.total || 0,
                ditolak: ditolak[0]?.total || 0
            }
        });
    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil statistik', error: error.message });
    }
});

// ========== GET ASET BY RUANGAN ==========
router.get('/aset-berdasarkan-ruangan/:ruanganId', keycloakAuth, async (req, res) => {
    try {
        const { ruanganId } = req.params;
        const ruanganIdInt = parseInt(ruanganId, 10);

        const query = `
            SELECT 
                ma.id, ma.kode_barang, ma.nama_barang, ma.merk, ma.tipe,
                ma.kondisi, ma.status_bmn, ma.tanggal_perolehan, ma.is_active as is_active_aset,
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

// ========== ENDPOINT RUANGAN ==========
router.get('/ruangan', keycloakAuth, async (req, res) => {
    try {
        const { user_id, has_pic } = req.query;
        
        let query = `
            SELECT 
                r.id, r.kode_ruangan, r.nama_ruangan, r.deskripsi, r.lokasi, r.is_active,
                pr.user_id as pic_user_id, pr.user_name as pic_user_name,
                pr.tgl_penugasan, pr.tgl_berakhir
            FROM ruangan r
        `;
        const params = [];
        
        if (user_id && has_pic === 'true') {
            query += ` INNER JOIN pic_ruangan pr ON r.id = pr.ruangan_id
                       WHERE pr.user_id = ? AND pr.status = 'aktif' AND r.is_active = 1`;
            params.push(user_id);
        } else {
            query += ` WHERE r.is_active = 1`;
        }
        
        query += ' ORDER BY r.kode_ruangan ASC';
        
        const [rows] = await db.query(query, params);
        
        res.json({ success: true, data: rows, message: 'Data ruangan berhasil dimuat' });
    } catch (error) {
        console.error('❌ Error fetching ruangan:', error);
        res.status(500).json({ success: false, message: error.message, data: [] });
    }
});

// ========== ENDPOINT PIC RUANGAN ==========
router.get('/picruangan', keycloakAuth, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT id, user_id, user_name, ruangan_id, tgl_penugasan, tgl_berakhir, status, created_at
            FROM pic_ruangan WHERE status = 'aktif' ORDER BY ruangan_id, user_name
        `);
        
        res.json({ success: true, data: rows, message: 'Data PIC ruangan berhasil dimuat' });
    } catch (error) {
        console.error('❌ Error fetching PIC ruangan:', error);
        res.status(500).json({ success: false, message: error.message, data: [] });
    }
});

module.exports = router;