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
    
    // Ambil nomor urut terakhir untuk bulan ini
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
// backend/routes/laporansRusak.js

// ========== GET ALL LAPORAN RUSAK ==========
router.get('/', keycloakAuth, async (req, res) => {
    try {
        const { 
            status, prioritas, aset_id, ruangan_id, pelapor_id, 
            search, page = 1, limit = 10 
        } = req.query;
        const offset = (page - 1) * limit;
        
        // Query dengan JOIN ke tabel pic_ruangan
        let query = `
            SELECT 
                lr.*, 
                a.kode_barang as aset_kode, 
                a.nama_barang as aset_nama, 
                a.merk as aset_merk,
                r.kode_ruangan, 
                r.nama_ruangan, 
                r.lokasi,
                -- Data PIC dari tabel pic_ruangan
                pr.id as pic_id,
                pr.user_id as pic_user_id,
                pr.tgl_penugasan as pic_tgl_penugasan,
                pr.status as pic_status
            FROM laporan_rusak lr
            LEFT JOIN master_aset a ON lr.aset_id = a.id
            LEFT JOIN ruangan r ON lr.ruangan_id = r.id
            LEFT JOIN pic_ruangan pr ON lr.ruangan_id = pr.ruangan_id AND pr.status = 'aktif'
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
        
        // Group by laporan untuk mengumpulkan multiple PIC
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
                    
                    aset_nama: row.aset_nama || `Aset ID: ${row.aset_id}`,
                    aset_kode: row.aset_kode || '',
                    aset_merk: row.aset_merk || '',
                    ruangan_nama: row.nama_ruangan || `Ruangan ID: ${row.ruangan_id}`,
                    ruangan_kode: row.kode_ruangan || '',
                    ruangan_lokasi: row.lokasi || '',
                    
                    // Data PIC akan dikumpulkan
                    pic_ruangan: []
                });
            }
            
            // Tambahkan PIC jika ada
            if (row.pic_user_id) {
                const laporan = laporanMap.get(row.id);
                laporan.pic_ruangan.push({
                    id: row.pic_id,
                    user_id: row.pic_user_id,
                    nama: userMap[row.pic_user_id]?.nama || row.pic_user_id,
                    email: userMap[row.pic_user_id]?.email || '-',
                    tgl_penugasan: row.pic_tgl_penugasan,
                    status: row.pic_status
                });
            }
        });
        
        // Konversi Map ke array dan parse foto_kerusakan
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
        
        const [rows] = await db.query(`
            SELECT lr.*, 
                   a.kode_barang as aset_kode, a.nama_barang as aset_nama,
                   r.kode_ruangan, r.nama_ruangan
            FROM laporan_rusak lr
            LEFT JOIN master_aset a ON lr.aset_id = a.id
            LEFT JOIN ruangan r ON lr.ruangan_id = r.id
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
        
        // Get user details from Keycloak
        let userDetail = null;
        try {
            const users = await getPICUsersFromKeycloak();
            userDetail = users.find(u => u.user_id === row.pelapor_id) || null;
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
                
                aset_nama: row.aset_nama,
                aset_kode: row.aset_kode,
                ruangan_nama: row.nama_ruangan,
                ruangan_kode: row.kode_ruangan,
                pelapor_nama: userDetail?.nama || row.pelapor_id,
                pelapor_email: userDetail?.email || '-'
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

// ========== GET LAPORAN BY USER ==========
router.get('/user/:userId', keycloakAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        
        const [rows] = await db.query(`
            SELECT lr.*, 
                   a.kode_barang as aset_kode, a.nama_barang as aset_nama,
                   r.kode_ruangan, r.nama_ruangan
            FROM laporan_rusak lr
            LEFT JOIN master_aset a ON lr.aset_id = a.id
            LEFT JOIN ruangan r ON lr.ruangan_id = r.id
            WHERE lr.pelapor_id = ?
            ORDER BY lr.tgl_laporan DESC
        `, [userId]);
        
        const laporanList = rows.map(row => {
            let fotoKerusakan = [];
            try {
                if (row.foto_kerusakan) {
                    fotoKerusakan = JSON.parse(row.foto_kerusakan);
                }
            } catch (e) {
                console.warn(`Error parsing foto_kerusakan for laporan ${row.id}:`, e.message);
                fotoKerusakan = [];
            }
            
            return {
                ...row,
                foto_kerusakan: fotoKerusakan,
                aset_nama: row.aset_nama || `Aset ID: ${row.aset_id}`,
                ruangan_nama: row.nama_ruangan || `Ruangan ID: ${row.ruangan_id}`
            };
        });
        
        res.json({
            success: true,
            data: laporanList
        });
    } catch (error) {
        console.error('Error fetching user laporan:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal mengambil data laporan user',
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
                prioritas || 'sedang', status || 'draft'
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
// ENDPOINT VERIFIKASI AWAL (PIC/PPK)
// ============================================
// ============================================
// ENDPOINT VERIFIKASI AWAL (PIC/PPK)
// ============================================
// ============================================
// ENDPOINT VERIFIKASI LAPORAN (MULTI FUNGSI)
// ============================================


// ============================================
// ENDPOINT SELESAI (PERBAIKAN INTERNAL)
// ============================================
router.post('/:id/selesai', keycloakAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { catatan } = req.body;

        console.log('📥 Selesaikan laporan - Request:', { id, catatan });

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

        // Update status menjadi selesai
        const catatanLengkap = `[Selesai] ${catatan || 'Laporan selesai diperbaiki oleh tim internal'}`.trim();
        
        await db.query(
            `UPDATE laporan_rusak 
             SET status = 'selesai', 
                 deskripsi = CONCAT(deskripsi, '\n\n', ?),
                 updated_at = NOW()
             WHERE id = ?`,
            [catatanLengkap, id]
        );

        console.log('✅ Selesaikan laporan berhasil:', { id, newStatus: 'selesai' });

        res.json({
            success: true,
            message: 'Laporan berhasil diselesaikan',
            data: { newStatus: 'selesai' }
        });

    } catch (error) {
        console.error('❌ Error menyelesaikan laporan:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal menyelesaikan laporan',
            error: error.message 
        });
    }
});

// Di file router laporan rusak (misalnya laporanRusakRouter.js)
// routes/laporansRusak.js

// ============================================
// ENDPOINT VERIFIKASI LAPORAN (MULTI FUNGSI)
// ============================================
router.post('/:id/verifikasi', keycloakAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { keputusan, catatan, tipe } = req.body;

        console.log('📥 Verifikasi request:', { id, keputusan, catatan, tipe });

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
        let newStatus;
        let statusMessage = '';
        let catatanLengkap = '';

        // ============================================
        // TIPE 1: VERIFIKASI AWAL (SETUJU/TOLAK)
        // ============================================
        if (tipe === 'verifikasi_awal') {
            if (!keputusan || (keputusan !== 'setuju' && keputusan !== 'tolak')) {
                return res.status(400).json({
                    success: false,
                    message: 'Keputusan tidak valid. Gunakan "setuju" atau "tolak" untuk verifikasi awal'
                });
            }

            statusMessage = keputusan === 'setuju' ? 'Disetujui' : 'Ditolak';

            if (currentStatus === 'menunggu_verifikasi_pic') {
                newStatus = keputusan === 'setuju' ? 'diverifikasi_pic' : 'ditolak';
            } 
            else if (currentStatus === 'menunggu_verifikasi_ppk') {
                newStatus = keputusan === 'setuju' ? 'diverifikasi_ppk' : 'ditolak';
            } 
            else {
                return res.status(400).json({
                    success: false,
                    message: 'Laporan tidak dalam status yang dapat diverifikasi'
                });
            }

            catatanLengkap = `[Verifikasi ${statusMessage}] ${catatan || ''}`.trim();
            
            // Update status laporan
            await db.query(
                `UPDATE laporan_rusak 
                 SET status = ?, 
                     deskripsi = CONCAT(deskripsi, '\n\n', ?),
                     updated_at = NOW()
                 WHERE id = ?`,
                [newStatus, catatanLengkap, id]
            );
        }
        
        // ============================================
        // TIPE 2: SELESAI (PERBAIKAN INTERNAL)
        // ============================================
        else if (tipe === 'selesai') {
            newStatus = 'selesai';
            statusMessage = 'Selesai';
            catatanLengkap = `[Selesai] ${catatan || 'Laporan selesai diperbaiki oleh tim internal'}`.trim();
            
            await db.query(
                `UPDATE laporan_rusak 
                 SET status = ?, 
                     deskripsi = CONCAT(deskripsi, '\n\n', ?),
                     updated_at = NOW()
                 WHERE id = ?`,
                [newStatus, catatanLengkap, id]
            );
            
            console.log('✅ Memproses penyelesaian laporan');
        }
        
        // ============================================
        // TIPE 3: DISPOSISI (DITERUSKAN KE KABAG TU)
        // ============================================
        else if (tipe === 'disposisi') {
            newStatus = 'diteruskan';
            statusMessage = 'Diteruskan';
            
            catatanLengkap = `[Disposisi] ${catatan || 'Diteruskan ke Kabag TU untuk disposisi'}`.trim();
            
            // Update status laporan menjadi 'diteruskan'
            await db.query(
                `UPDATE laporan_rusak 
                 SET status = ?, 
                     deskripsi = CONCAT(deskripsi, '\n\n', ?),
                     updated_at = NOW()
                 WHERE id = ?`,
                [newStatus, catatanLengkap, id]
            );
            
            console.log('✅ Memproses disposisi laporan ke Kabag TU');
        }
        
        // ============================================
        // TIPE TIDAK DIKENAL
        // ============================================
        else {
            return res.status(400).json({
                success: false,
                message: 'Tipe verifikasi tidak valid. Gunakan "verifikasi_awal", "selesai", atau "disposisi"'
            });
        }

        console.log('✅ Verifikasi berhasil:', {
            id,
            oldStatus: currentStatus,
            newStatus,
            tipe,
            catatan: catatanLengkap
        });

        res.json({
            success: true,
            message: `Laporan berhasil diproses (${tipe})`,
            data: { 
                newStatus,
                oldStatus: currentStatus,
                tipe,
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
// ENDPOINT DISPOSISI OLEH KABAG TU
// ============================================
// routes/laporansRusak.js

// ============================================
// ENDPOINT DISPOSISI OLEH KABAG TU (HANYA KE PPK)
// ============================================
router.post('/:id/disposisi', keycloakAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { tujuan, catatan, estimasi_biaya } = req.body;
        const userId = req.user?.sub || req.user?.id;

        console.log('📥 Disposisi request:', { id, tujuan, catatan, estimasi_biaya });

        // Validasi tujuan - harus 'ppk'
        if (tujuan !== 'ppk') {
            return res.status(400).json({
                success: false,
                message: 'Tujuan disposisi harus ppk'
            });
        }

        // Validasi estimasi biaya
        if (!estimasi_biaya || estimasi_biaya <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Estimasi biaya harus diisi dengan nilai yang valid'
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

        // Simpan disposisi ke tabel disposisi
        await db.query(
            `INSERT INTO disposisi 
             (laporan_id, kabag_id, tgl_disposisi, tujuan, catatan) 
             VALUES (?, ?, NOW(), ?, ?)`,
            [id, userId, tujuan, catatan || '']
        );

        // Update status laporan - HANYA update status, TIDAK update estimasi_biaya
        const newStatus = 'menunggu_verifikasi_ppk';
        const statusMessage = 'Diteruskan ke PPK untuk verifikasi anggaran';
        const catatanLengkap = `[Disposisi oleh Kabag TU] ${statusMessage}. ${catatan || ''}`.trim();

        await db.query(
            `UPDATE laporan_rusak 
             SET status = ?, 
                 deskripsi = CONCAT(deskripsi, '\n\n', ?),
                 updated_at = NOW()
             WHERE id = ?`,
            [newStatus, catatanLengkap, id]
        );

        // Estimasi biaya akan disimpan saat PPK melakukan verifikasi
        // Tidak perlu disimpan di sini karena akan disimpan di tabel verifikasi_ppk

        console.log('✅ Disposisi berhasil:', {
            id,
            oldStatus: laporan.status,
            newStatus,
            tujuan
        });

        res.json({
            success: true,
            message: 'Disposisi berhasil dikirim ke PPK',
            data: { 
                newStatus,
                tujuan,
                estimasi_biaya // Kembalikan estimasi biaya ke frontend
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
// routes/laporansRusak.js

// ============================================
// ENDPOINT VERIFIKASI PPK
// ============================================
router.post('/:id/verifikasi-ppk', keycloakAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { hasil_verifikasi, catatan, estimasi_biaya } = req.body;
        const userId = req.user?.sub || req.user?.id;

        console.log('📥 Verifikasi PPK request:', { id, hasil_verifikasi, catatan, estimasi_biaya });

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

        // Simpan verifikasi PPK ke tabel verifikasi_ppk (dengan estimasi_biaya)
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
        } else if (hasil_verifikasi === 'ditolak') {
            newStatus = 'ditolak';
            statusMessage = 'Anggaran ditolak';
        } else {
            newStatus = 'menunggu_revisi';
            statusMessage = 'Perlu revisi anggaran';
        }

        const catatanLengkap = `[Verifikasi PPK] ${statusMessage}. ${catatan || ''}`.trim();

        // Update laporan - HANYA update status, TIDAK update estimasi_biaya
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
                estimasi_biaya // Kembalikan estimasi biaya
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



// ========== GET STATISTICS ==========
router.get('/statistics', keycloakAuth, async (req, res) => {
    try {
        const [total] = await db.query('SELECT COUNT(*) as total FROM laporan_rusak');
        const [draft] = await db.query('SELECT COUNT(*) as total FROM laporan_rusak WHERE status = "draft"');
        const [menungguVerifikasi] = await db.query(
            'SELECT COUNT(*) as total FROM laporan_rusak WHERE status LIKE "menunggu_verifikasi%"'
        );
        const [dalamPerbaikan] = await db.query(
            'SELECT COUNT(*) as total FROM laporan_rusak WHERE status IN ("dalam_perbaikan", "didisposisi")'
        );
        const [selesai] = await db.query('SELECT COUNT(*) as total FROM laporan_rusak WHERE status = "selesai"');
        const [ditolak] = await db.query('SELECT COUNT(*) as total FROM laporan_rusak WHERE status = "ditolak"');
        
        res.json({
            success: true,
            data: {
                total: total[0]?.total || 0,
                draft: draft[0]?.total || 0,
                menunggu_verifikasi: menungguVerifikasi[0]?.total || 0,
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

// ========== ENDPOINT BARU: GET ASET BY RUANGAN ==========
/**
 * GET /api/aset-berdasarkan-ruangan/:ruanganId
 * Mendapatkan aset berdasarkan ruangan dari tabel aset_ruangan
 */
// backend/routes/laporansRusak.js

// ========== GET ASET BY RUANGAN (PERBAIKI) ==========
// backend/routes/laporansRusak.js

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
        
        // Log detail untuk debugging
        console.log(`📊 Data aset untuk ruangan ${ruanganIdInt}:`);
        rows.forEach(row => {
            console.log(`   - ID: ${row.id}, ${row.kode_barang} - ${row.nama_barang}`);
        });
        
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
/**
 * GET /api/ruangan?user_id=xxx&has_pic=true
 * Mendapatkan ruangan berdasarkan PIC user
 */
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

// ========== ENDPOINT OPTIONS (untuk kompatibilitas) ==========
router.get('/options/aset', keycloakAuth, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT id, kode_barang, nama_barang, merk 
            FROM master_aset 
            WHERE is_active = 1
            ORDER BY kode_barang
        `);
        res.json({ success: true, data: rows || [] });
    } catch (error) {
        console.error('Error fetching aset options:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal mengambil data aset',
            error: error.message 
        });
    }
});

router.get('/options/ruangan', keycloakAuth, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT id, kode_ruangan, nama_ruangan, lokasi 
            FROM ruangan 
            WHERE is_active = 1 
            ORDER BY kode_ruangan
        `);
        res.json({ success: true, data: rows || [] });
    } catch (error) {
        console.error('Error fetching ruangan options:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal mengambil data ruangan',
            error: error.message 
        });
    }
});

module.exports = router;