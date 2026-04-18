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
// Helper function untuk generate nomor laporan
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

// backend/routes/laporansRusak.js - Endpoint GET /

router.get('/', keycloakAuth, async (req, res) => {
    try {
        const { 
            status, prioritas, aset_id, ruangan_id, pelapor_id, 
            search, page = 1, limit = 10 
        } = req.query;
        const offset = (page - 1) * limit;
        
        // Dapatkan user ID dari token
        const userId = req.user?.id;
        const userRoles = req.user?.roles || [];
        
        // Cek role user
        const isAdmin = userRoles.includes('admin') || userRoles.includes('superadmin');
        const isPPK = userRoles.includes('ppk');
        const isKabagTU = userRoles.includes('kabag_tu');
        const isPICRuangan = userRoles.includes('pic_ruangan') || userRoles.includes('pic');
        
        console.log('🔐 User:', { userId, isAdmin, isPPK, isKabagTU, isPICRuangan });
        
        // Query dasar dengan JOIN
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
                dp.no_kontrak,
                -- Data disposisi untuk filter PPK
                d.id as disposisi_id,
                d.kabag_id,
                d.ppk_id
            FROM laporan_rusak lr
            LEFT JOIN master_aset a ON lr.aset_id = a.id
            LEFT JOIN ruangan r ON lr.ruangan_id = r.id
            LEFT JOIN pic_ruangan pr ON lr.ruangan_id = pr.ruangan_id AND pr.status = 'aktif'
            LEFT JOIN detail_perbaikan dp ON lr.id = dp.laporan_id
            LEFT JOIN disposisi d ON lr.id = d.laporan_id
            WHERE 1=1
        `;
        
        const params = [];
        
        // ========== FILTER BERDASARKAN ROLE ==========
        
        // Admin: bisa melihat semua data
        if (isAdmin) {
            // Tidak ada filter tambahan
            console.log('👑 Admin: melihat semua data');
        }
        // PPK: hanya melihat laporan yang disposisi kepadanya
        else if (isPPK) {
            query += ` AND d.ppk_id = ?`;
            params.push(userId);
            console.log('📋 PPK: hanya melihat laporan yang disposisi kepadanya');
        }
        // Kabag TU: hanya melihat laporan yang sudah diverifikasi PIC dan butuh disposisi
        else if (isKabagTU) {
            query += ` AND lr.status = 'menunggu_disposisi'`;
            console.log('📋 Kabag TU: hanya melihat laporan menunggu disposisi');
        }
        // PIC Ruangan: hanya melihat laporan dari ruangan yang menjadi tanggung jawabnya
        else if (isPICRuangan) {
            query += ` AND pr.user_id = ?`;
            params.push(userId);
            console.log('📋 PIC Ruangan: hanya melihat laporan dari ruangan yang ditangani');
        }
        // User biasa: hanya melihat laporan yang dibuat sendiri
        else {
            query += ` AND lr.pelapor_id = ?`;
            params.push(userId);
            console.log('📋 User biasa: hanya melihat laporan sendiri');
        }
        
        // Filter tambahan
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
        
        // Get total count dengan filter yang sama
        const countQuery = `
            SELECT COUNT(*) as total
            FROM laporan_rusak lr
            LEFT JOIN disposisi d ON lr.id = d.laporan_id
            WHERE 1=1
            ${isAdmin ? '' : isPPK ? ' AND d.ppk_id = ?' : isKabagTU ? ' AND lr.status = "menunggu_disposisi"' : isPICRuangan ? ' AND EXISTS (SELECT 1 FROM pic_ruangan pr2 WHERE pr2.ruangan_id = lr.ruangan_id AND pr2.user_id = ? AND pr2.status = "aktif")' : ' AND lr.pelapor_id = ?'}
            ${status ? ' AND lr.status = ?' : ''}
            ${prioritas ? ' AND lr.prioritas = ?' : ''}
            ${aset_id ? ' AND lr.aset_id = ?' : ''}
            ${ruangan_id ? ' AND lr.ruangan_id = ?' : ''}
            ${pelapor_id ? ' AND lr.pelapor_id = ?' : ''}
        `;
        
        const countParams = [];
        if (!isAdmin) {
            if (isPPK) countParams.push(userId);
            else if (isPICRuangan) countParams.push(userId);
            else if (!isKabagTU) countParams.push(userId);
        }
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
        
        // Proses data
        const laporanList = rows.map(row => {
            let fotoKerusakan = [];
            try {
                if (row.foto_kerusakan) {
                    if (typeof row.foto_kerusakan === 'string') {
                        try {
                            const parsed = JSON.parse(row.foto_kerusakan);
                            fotoKerusakan = Array.isArray(parsed) ? parsed : [parsed];
                        } catch {
                            fotoKerusakan = [row.foto_kerusakan];
                        }
                    } else if (Array.isArray(row.foto_kerusakan)) {
                        fotoKerusakan = row.foto_kerusakan;
                    }
                }
            } catch (e) {
                fotoKerusakan = [];
            }
            
            return {
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
                pelapor_nama: userMap[row.pelapor_id]?.nama || row.pelapor_id,
                pelapor_email: userMap[row.pelapor_id]?.email || '-',
                
                pic_ruangan_nama: row.pic_user_name || null,
                pic_ruangan_id: row.pic_user_id || null,
                
                // Data disposisi
                disposisi_id: row.disposisi_id,
                kabag_id: row.kabag_id,
                ppk_id: row.ppk_id,
                
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
// backend/routes/laporansRusak.js

// ========== GET LAPORAN BY ID ==========
router.get('/:id', keycloakAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Query dengan JOIN ke pic_ruangan
        const [rows] = await db.query(`
            SELECT 
                lr.*, 
                a.kode_barang as aset_kode, 
                a.nama_barang as aset_nama,
                r.kode_ruangan, 
                r.nama_ruangan,
                -- Ambil data PIC ruangan
                pr.id as pic_ruangan_id,
                pr.user_id as pic_ruangan_user_id,
                pr.user_name as pic_ruangan_nama,
                pr.tgl_penugasan as pic_ruangan_tgl_penugasan,
                pr.status as pic_ruangan_status,
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
            console.warn(`Error parsing foto_kerusakan:`, e.message);
            fotoKerusakan = [];
        }
        
        // Get user details from Keycloak
        let userDetail = null;
        let picRuanganDetail = null;
        try {
            const users = await getPICUsersFromKeycloak();
            userDetail = users.find(u => u.user_id === row.pelapor_id) || null;
            
            // Ambil detail PIC ruangan dari Keycloak
            if (row.pic_ruangan_user_id) {
                picRuanganDetail = users.find(u => u.user_id === row.pic_ruangan_user_id) || null;
            }
        } catch (error) {
            console.error('Error fetching user from Keycloak:', error);
        }
        
        // Format data PIC ruangan
        let picRuanganData = null;
        if (row.pic_ruangan_nama || row.pic_ruangan_user_id) {
            picRuanganData = {
                id: row.pic_ruangan_id,
                user_id: row.pic_ruangan_user_id,
                user_name: row.pic_ruangan_nama,
                nama: picRuanganDetail?.nama || row.pic_ruangan_nama,
                tgl_penugasan: row.pic_ruangan_tgl_penugasan,
                status: row.pic_ruangan_status
            };
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
                pelapor_nama: userDetail?.nama || row.pelapor_id,
                pelapor_email: userDetail?.email || '-',
                
                // ✅ TAMBAHKAN DATA PIC RUANGAN
                pic_ruangan: picRuanganData,
                
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

        // Generate nomor laporan
        const nomor_laporan = await generateNomorLaporan();
        
        // Format tanggal
        const formattedTglLaporan = formatDateForMySQL(tgl_laporan) || 
                                    formatDateForMySQL(new Date());

        const username = getUsernameFromToken(req.user);

        // Handle foto_kerusakan
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
// backend/routes/laporansRusak.js - Endpoint verifikasi

router.post('/:id/verifikasi', keycloakAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { keputusan, catatan, alur, estimasi_biaya } = req.body;

        console.log('📥 Verifikasi request:', { id, keputusan, catatan, alur, estimasi_biaya });

        // Cek apakah laporan ada
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

        // Validasi status
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
                
                // VALIDASI ESTIMASI BIAYA UNTUK ALUR DENGAN ANGGARAN
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
        
        // ============================================
        // UPDATE LAPORAN DENGAN ESTIMASI BIAYA
        // ============================================
        if (estimasi_biaya && keputusan === 'setuju' && alur !== 'langsung') {
            // Update dengan estimasi biaya
            await db.query(
                `UPDATE laporan_rusak 
                 SET status = ?, 
                     estimasi_biaya = ?,
                     deskripsi = CONCAT(deskripsi, '\n\n', ?),
                     updated_at = NOW()
                 WHERE id = ?`,
                [newStatus, parseFloat(estimasi_biaya), catatanLengkap, id]
            );
            
            console.log('💰 Estimasi biaya disimpan:', {
                id,
                estimasi_biaya: parseFloat(estimasi_biaya)
            });
        } else {
            // Update tanpa estimasi biaya
            await db.query(
                `UPDATE laporan_rusak 
                 SET status = ?, 
                     deskripsi = CONCAT(deskripsi, '\n\n', ?),
                     updated_at = NOW()
                 WHERE id = ?`,
                [newStatus, catatanLengkap, id]
            );
        }

        console.log('✅ Verifikasi berhasil:', {
            id,
            oldStatus: currentStatus,
            newStatus,
            alur,
            estimasi_biaya: estimasi_biaya || null,
            catatan: catatanLengkap
        });

        res.json({
            success: true,
            message: `Laporan berhasil diverifikasi`,
            data: { 
                newStatus,
                oldStatus: currentStatus,
                alur,
                estimasi_biaya: estimasi_biaya || null,
                catatan: catatanLengkap
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
// ENDPOINT DISPOSISI OLEH KABAG TU (KE PPK)
// ============================================
// backend/routes/laporansRusak.js - Endpoint disposisi

// backend/routes/laporansRusak.js - Endpoint disposisi

router.post('/:id/disposisi', keycloakAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { tujuan, catatan, estimasi_biaya, ppk_id } = req.body; // Tambahkan ppk_id
        const userId = req.user?.sub || req.user?.id;

        console.log('📥 Disposisi request:', { id, tujuan, catatan, estimasi_biaya, ppk_id });

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

        if (!ppk_id) {
            return res.status(400).json({
                success: false,
                message: 'PPK tujuan harus dipilih'
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

        // Simpan disposisi dengan ppk_id
        await db.query(
            `INSERT INTO disposisi 
             (laporan_id, kabag_id, tgl_disposisi, tujuan, catatan, estimasi_biaya, ppk_id) 
             VALUES (?, ?, NOW(), ?, ?, ?, ?)`,
            [id, userId, tujuan, catatan || '', estimasi_biaya, ppk_id]
        );

        const newStatus = 'menunggu_verifikasi_ppk';
        const statusMessage = `Diteruskan ke PPK untuk verifikasi anggaran`;
        const catatanLengkap = `[Disposisi oleh Kabag TU] ${statusMessage}. Estimasi biaya: Rp ${parseFloat(estimasi_biaya).toLocaleString()}. ${catatan || ''}`.trim();

        await db.query(
            `UPDATE laporan_rusak 
             SET status = ?, 
                 deskripsi = CONCAT(deskripsi, '\n\n', ?),
                 updated_at = NOW()
             WHERE id = ?`,
            [newStatus, catatanLengkap, id]
        );

        console.log('✅ Disposisi berhasil:', {
            id,
            oldStatus: laporan.status,
            newStatus,
            tujuan,
            estimasi_biaya,
            ppk_id
        });

        res.json({
            success: true,
            message: 'Disposisi berhasil dikirim ke PPK',
            data: { 
                newStatus,
                tujuan,
                estimasi_biaya,
                ppk_id
            }
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
        const { hasil_verifikasi, catatan, estimasi_biaya } = req.body;
        const userId = req.user?.sub || req.user?.id;

        console.log('📥 Verifikasi PPK request:', { id, hasil_verifikasi, catatan, estimasi_biaya });

        // Validasi input
        if (!hasil_verifikasi || (hasil_verifikasi !== 'disetujui' && hasil_verifikasi !== 'ditolak')) {
            return res.status(400).json({
                success: false,
                message: 'Hasil verifikasi harus "disetujui" atau "ditolak"'
            });
        }

        // Cek apakah laporan ada
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

        // Validasi status
        if (laporan.status !== 'menunggu_verifikasi_ppk') {
            return res.status(400).json({
                success: false,
                message: `Laporan tidak dalam status menunggu verifikasi PPK. Status saat ini: ${laporan.status}`
            });
        }

        // Simpan verifikasi PPK ke tabel verifikasi_ppk
        await db.query(
            `INSERT INTO verifikasi_ppk 
             (laporan_id, ppk_id, tgl_verifikasi, hasil_verifikasi, estimasi_biaya, catatan) 
             VALUES (?, ?, NOW(), ?, ?, ?)`,
            [id, userId, hasil_verifikasi, estimasi_biaya || null, catatan || '']
        );

        // Tentukan status baru
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

        // Update laporan
        await db.query(
            `UPDATE laporan_rusak 
             SET status = ?, 
                 deskripsi = CONCAT(deskripsi, '\n\n', ?),
                 updated_at = NOW()
             WHERE id = ?`,
            [newStatus, catatanLengkap, id]
        );

        console.log('✅ Verifikasi PPK berhasil:', {
            id,
            oldStatus: laporan.status,
            newStatus,
            hasil: hasil_verifikasi
        });

        res.json({
            success: true,
            message: 'Verifikasi PPK berhasil',
            data: { 
                newStatus,
                estimasi_biaya
            }
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
// ENDPOINT SELESAIKAN PERBAIKAN (PIC RUANGAN)
// ============================================
router.post('/:id/selesaikan-perbaikan', keycloakAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            hasil_perbaikan, 
            catatan, 
            tanggal_selesai,
            rating,
            biaya_aktual,
            dokumentasi,
            rekomendasi,
            nama_vendor,
            no_kontrak
        } = req.body;

        const userId = req.user?.sub || req.user?.id;

        console.log('🔧 SELESAIKAN PERBAIKAN - Request:', { 
            id, 
            hasil_perbaikan, 
            tanggal_selesai,
            rating,
            biaya_aktual,
            nama_vendor
        });

        // Validasi input
        if (!hasil_perbaikan) {
            return res.status(400).json({
                success: false,
                message: 'Hasil perbaikan harus diisi'
            });
        }

        // Validasi hasil_perbaikan
        const validHasil = ['internal', 'eksternal', 'gagal'];
        if (!validHasil.includes(hasil_perbaikan)) {
            return res.status(400).json({
                success: false,
                message: 'Hasil perbaikan tidak valid. Gunakan: internal, eksternal, atau gagal'
            });
        }

        // Validasi nama vendor jika eksternal
        if (hasil_perbaikan === 'eksternal' && !nama_vendor) {
            return res.status(400).json({
                success: false,
                message: 'Nama vendor wajib diisi untuk perbaikan eksternal'
            });
        }

        // Cek apakah laporan ada
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

        // Validasi status
        if (laporan.status !== 'dalam_perbaikan') {
            return res.status(400).json({
                success: false,
                message: `Laporan tidak dalam status dalam_perbaikan. Status saat ini: ${laporan.status}`
            });
        }

        // Cek apakah sudah ada detail perbaikan
        const [existingDetail] = await db.query(
            'SELECT id FROM detail_perbaikan WHERE laporan_id = ?',
            [id]
        );

        // Simpan detail perbaikan
        const tanggalSelesaiFormatted = tanggal_selesai || formatDateForMySQL(new Date());
        const biayaAktualValue = biaya_aktual ? parseFloat(biaya_aktual) : null;

        if (existingDetail.length > 0) {
            // Update detail perbaikan yang sudah ada
            await db.query(
                `UPDATE detail_perbaikan 
                 SET hasil_perbaikan = ?,
                     tanggal_selesai = ?,
                     rating = ?,
                     biaya_aktual = ?,
                     dokumentasi = ?,
                     rekomendasi = ?,
                     nama_vendor = ?,
                     no_kontrak = ?,
                     updated_at = NOW()
                 WHERE laporan_id = ?`,
                [
                    hasil_perbaikan,
                    tanggalSelesaiFormatted,
                    rating || null,
                    biayaAktualValue,
                    dokumentasi || null,
                    rekomendasi || null,
                    nama_vendor || null,
                    no_kontrak || null,
                    id
                ]
            );
        } else {
            // Insert detail perbaikan baru
            await db.query(
                `INSERT INTO detail_perbaikan 
                 (laporan_id, hasil_perbaikan, tanggal_selesai, rating, biaya_aktual, dokumentasi, rekomendasi, nama_vendor, no_kontrak)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id,
                    hasil_perbaikan,
                    tanggalSelesaiFormatted,
                    rating || null,
                    biayaAktualValue,
                    dokumentasi || null,
                    rekomendasi || null,
                    nama_vendor || null,
                    no_kontrak || null
                ]
            );
        }

        // Tentukan status baru
        let newStatus;
        let statusMessage;

        if (hasil_perbaikan === 'internal' || hasil_perbaikan === 'eksternal') {
            newStatus = 'selesai';
            statusMessage = `Perbaikan berhasil dilakukan oleh ${hasil_perbaikan === 'internal' ? 'tim internal' : 'vendor eksternal'}`;
        } else {
            newStatus = 'dalam_perbaikan'; // Tetap dalam_perbaikan jika gagal
            statusMessage = 'Perbaikan gagal, perlu evaluasi lebih lanjut';
        }

        // Buat catatan lengkap
        let catatanLengkap = `[Selesaikan Perbaikan - ${hasil_perbaikan === 'internal' ? 'Tim Internal' : hasil_perbaikan === 'eksternal' ? 'Vendor Eksternal' : 'Gagal'}] ${statusMessage}. `;
        
        if (catatan) {
            catatanLengkap += catatan;
        }

        if (hasil_perbaikan === 'eksternal' && nama_vendor) {
            catatanLengkap += `\nVendor: ${nama_vendor}`;
            if (no_kontrak) {
                catatanLengkap += ` (Kontrak: ${no_kontrak})`;
            }
        }

        if (biayaAktualValue) {
            catatanLengkap += `\nBiaya Aktual: Rp ${biayaAktualValue.toLocaleString()}`;
        }

        if (rating) {
            catatanLengkap += `\nRating: ${rating}/5`;
        }

        // Update status laporan
        await db.query(
            `UPDATE laporan_rusak 
             SET status = ?, 
                 deskripsi = CONCAT(deskripsi, '\n\n', ?),
                 updated_at = NOW()
             WHERE id = ?`,
            [newStatus, catatanLengkap, id]
        );

        console.log('✅ Selesaikan perbaikan berhasil:', {
            id,
            oldStatus: laporan.status,
            newStatus,
            hasil: hasil_perbaikan,
            vendor: nama_vendor || '-'
        });

        res.json({
            success: true,
            message: 'Laporan perbaikan berhasil diselesaikan',
            data: { 
                newStatus,
                hasil_perbaikan,
                detail_perbaikan: {
                    id: existingDetail.length > 0 ? existingDetail[0].id : 'new',
                    hasil_perbaikan,
                    tanggal_selesai: tanggalSelesaiFormatted,
                    rating,
                    biaya_aktual: biayaAktualValue,
                    nama_vendor
                }
            }
        });

    } catch (error) {
        console.error('❌ Error selesaikan perbaikan:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal menyelesaikan perbaikan',
            error: error.message 
        });
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
        res.status(500).json({ 
            success: false, 
            message: 'Gagal mengambil statistik',
            error: error.message 
        });
    }
});

// ========== GET ASET BY RUANGAN ==========
router.get('/aset-berdasarkan-ruangan/:ruanganId', keycloakAuth, async (req, res) => {
    try {
        const { ruanganId } = req.params;
        const ruanganIdInt = parseInt(ruanganId, 10);

        // Query dengan SELECT yang lebih lengkap
        const query = `
            SELECT 
                ma.id,
                ma.kode_barang,
                ma.nama_barang,
                ma.merk,
                ma.tipe,
                ma.kondisi,
                ma.status_bmn,
                ma.tanggal_perolehan,
                ma.is_active as is_active_aset,
                ar.id as aset_ruangan_id,
                ar.ruangan_id,
                ar.tgl_masuk,
                ar.tgl_keluar,
                ar.status as status_ruangan,
                ar.keterangan
            FROM master_aset ma
            INNER JOIN aset_ruangan ar ON ma.id = ar.aset_id
            WHERE ar.ruangan_id = ? 
                AND ar.status = 'aktif'
                AND ma.is_active = 1
            ORDER BY ma.kode_barang ASC
        `;
        
        const [rows] = await db.query(query, [ruanganIdInt]);
        
        console.log(`📊 Data aset untuk ruangan ${ruanganIdInt}: ${rows.length} aset ditemukan`);
        
        res.json({
            success: true,
            data: rows,
            message: `Data aset untuk ruangan ID ${ruanganIdInt} berhasil dimuat`
        });
        
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({
            success: false,
            message: error.message,
            data: []
        });
    }
});

// ========== ENDPOINT RUANGAN ==========
router.get('/ruangan', keycloakAuth, async (req, res) => {
    try {
        const { user_id, has_pic } = req.query;
        
        let query = `
            SELECT 
                r.id,
                r.kode_ruangan,
                r.nama_ruangan,
                r.deskripsi,
                r.lokasi,
                r.is_active,
                pr.user_id as pic_user_id,
                pr.tgl_penugasan,
                pr.tgl_berakhir
            FROM ruangan r
        `;
        
        const params = [];
        
        if (user_id && has_pic === 'true') {
            query += `
                INNER JOIN pic_ruangan pr ON r.id = pr.ruangan_id
                WHERE pr.user_id = ? 
                    AND pr.status = 'aktif'
                    AND r.is_active = 1
            `;
            params.push(user_id);
        } else {
            query += ' WHERE r.is_active = 1';
        }
        
        query += ' ORDER BY r.kode_ruangan ASC';
        
        const [rows] = await db.query(query, params);
        
        console.log(`✅ Mendapatkan ${rows.length} ruangan untuk user ${user_id || 'semua'}`);
        
        res.json({
            success: true,
            data: rows,
            message: 'Data ruangan berhasil dimuat'
        });
    } catch (error) {
        console.error('❌ Error fetching ruangan:', error);
        res.status(500).json({
            success: false,
            message: error.message,
            data: []
        });
    }
});

module.exports = router;