const express = require('express');
const router = express.Router();
const db = require('../db');
const { keycloakAuth } = require('../middleware/keycloakAuth');

function getUsernameFromToken(user) {
    return user?.preferred_username || user?.username || 'unknown';
}

/**
 * Helper function to format date for MySQL
 * Converts any date format to MySQL datetime (YYYY-MM-DD HH:MM:SS)
 */
const formatDateForMySQL = (dateValue) => {
    if (!dateValue) return null;
    
    // If already in MySQL format, return as is
    if (typeof dateValue === 'string' && dateValue.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
        return dateValue;
    }
    
    try {
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) {
            console.error('Invalid date:', dateValue);
            return null;
        }
        
        // Format: YYYY-MM-DD HH:MM:SS
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch (error) {
        console.error('Error formatting date:', error);
        return null;
    }
};

// ========== GET STATISTICS ==========
router.get('/statistics', keycloakAuth, async (req, res) => {
    try {
        console.log('📊 Statistics endpoint accessed');
        
        // Hitung total semua record
        const [total] = await db.query('SELECT COUNT(*) as total FROM aset_ruangan');
        
        // Hitung berdasarkan status
        const [aktif] = await db.query('SELECT COUNT(*) as total FROM aset_ruangan WHERE status = "aktif"');
        const [dipindah] = await db.query('SELECT COUNT(*) as total FROM aset_ruangan WHERE status = "dipindah"');
        const [dihapuskan] = await db.query('SELECT COUNT(*) as total FROM aset_ruangan WHERE status = "dihapuskan"');
        
        // Hitung unique aset
        const [uniqueAset] = await db.query('SELECT COUNT(DISTINCT aset_id) as total FROM aset_ruangan');
        
        const statistics = {
            total: total[0]?.total || 0,
            aktif: aktif[0]?.total || 0,
            dipindah: dipindah[0]?.total || 0,
            dihapuskan: dihapuskan[0]?.total || 0,
            unique_aset: uniqueAset[0]?.total || 0
        };
        
        console.log('📊 Statistics from DB:', statistics);
        
        res.json({
            success: true,
            data: statistics
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

// ========== GET ALL ASET RUANGAN (DENGAN FILTER) ==========
router.get('/', keycloakAuth, async (req, res) => {
    try {
        const { status, aset_id, ruangan_id, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        
        let query = `
            SELECT ar.*, 
                   ma.nama_barang, ma.kode_barang, ma.jenis_bmn, ma.merk, ma.nup,
                   r.nama_ruangan, r.kode_ruangan, r.lokasi
            FROM aset_ruangan ar
            LEFT JOIN master_aset ma ON ar.aset_id = ma.id
            LEFT JOIN ruangan r ON ar.ruangan_id = r.id
            WHERE 1=1
        `;
        const params = [];
        
        if (status && status !== 'all') {
            query += ' AND ar.status = ?';
            params.push(status);
        }
        
        if (aset_id) {
            query += ' AND ar.aset_id = ?';
            params.push(aset_id);
        }
        
        if (ruangan_id) {
            query += ' AND ar.ruangan_id = ?';
            params.push(ruangan_id);
        }
        
        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total
            FROM aset_ruangan ar
            WHERE 1=1
            ${status && status !== 'all' ? ' AND ar.status = ?' : ''}
            ${aset_id ? ' AND ar.aset_id = ?' : ''}
            ${ruangan_id ? ' AND ar.ruangan_id = ?' : ''}
        `;
        const countParams = [];
        if (status && status !== 'all') countParams.push(status);
        if (aset_id) countParams.push(aset_id);
        if (ruangan_id) countParams.push(ruangan_id);
        
        const [countResult] = await db.query(countQuery, countParams);
        const total = countResult && countResult[0] ? countResult[0].total : 0;
        
        // Add pagination to main query
        query += ' ORDER BY ar.tgl_masuk DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const [rows] = await db.query(query, params);
        
        res.json({
            success: true,
            data: rows || [],
            pagination: {
                currentPage: parseInt(page),
                perPage: parseInt(limit),
                total: total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching aset ruangan:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal mengambil data posisi aset',
            error: error.message 
        });
    }
});

// ========== GET SINGLE ASET RUANGAN BY ID ==========
router.get('/:id', keycloakAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        const [rows] = await db.query(`
            SELECT ar.*, 
                   ma.nama_barang, ma.kode_barang, ma.jenis_bmn, ma.merk, ma.nup,
                   r.nama_ruangan, r.kode_ruangan, r.lokasi
            FROM aset_ruangan ar
            LEFT JOIN master_aset ma ON ar.aset_id = ma.id
            LEFT JOIN ruangan r ON ar.ruangan_id = r.id
            WHERE ar.id = ?
        `, [id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Data tidak ditemukan' 
            });
        }
        
        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching aset ruangan:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== GET RIWAYAT LOKASI ASET ==========
router.get('/aset/:asetId', keycloakAuth, async (req, res) => {
    try {
        const { asetId } = req.params;
        
        const [rows] = await db.query(`
            SELECT ar.*, 
                   r.nama_ruangan, r.kode_ruangan, r.lokasi
            FROM aset_ruangan ar
            LEFT JOIN ruangan r ON ar.ruangan_id = r.id
            WHERE ar.aset_id = ?
            ORDER BY ar.tgl_masuk DESC
        `, [asetId]);
        
        // Get aset info
        const [asetInfo] = await db.query(
            'SELECT id, kode_barang, nama_barang, jenis_bmn FROM master_aset WHERE id = ?',
            [asetId]
        );
        
        res.json({
            success: true,
            data: rows || [],
            aset: asetInfo[0] || null
        });
    } catch (error) {
        console.error('Error fetching riwayat aset:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal mengambil riwayat aset',
            error: error.message 
        });
    }
});

// ========== GET ASET BY RUANGAN (AKTIF) ==========
router.get('/ruangan/:ruanganId', keycloakAuth, async (req, res) => {
    try {
        const { ruanganId } = req.params;
        
        const [rows] = await db.query(`
            SELECT ar.*, 
                   ma.nama_barang, ma.kode_barang, ma.jenis_bmn, ma.merk, ma.nup
            FROM aset_ruangan ar
            LEFT JOIN master_aset ma ON ar.aset_id = ma.id
            WHERE ar.ruangan_id = ? AND ar.status = 'aktif'
            ORDER BY ar.tgl_masuk DESC
        `, [ruanganId]);
        
        // Get ruangan info
        const [ruanganInfo] = await db.query(
            'SELECT id, kode_ruangan, nama_ruangan, lokasi FROM ruangan WHERE id = ?',
            [ruanganId]
        );
        
        res.json({
            success: true,
            data: rows || [],
            ruangan: ruanganInfo[0] || null
        });
    } catch (error) {
        console.error('Error fetching aset by ruangan:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal mengambil aset di ruangan',
            error: error.message 
        });
    }
});

// ========== GET AKTIF (SEMUA ASET AKTIF) ==========
router.get('/status/aktif', keycloakAuth, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT ar.*, 
                   ma.nama_barang, ma.kode_barang, ma.jenis_bmn, ma.merk, ma.nup,
                   r.nama_ruangan, r.kode_ruangan, r.lokasi
            FROM aset_ruangan ar
            LEFT JOIN master_aset ma ON ar.aset_id = ma.id
            LEFT JOIN ruangan r ON ar.ruangan_id = r.id
            WHERE ar.status = 'aktif'
            ORDER BY ar.tgl_masuk DESC
        `);
        
        res.json({
            success: true,
            data: rows || [],
            total: rows.length
        });
    } catch (error) {
        console.error('Error fetching aktif aset:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal mengambil aset aktif',
            error: error.message 
        });
    }
});

// ========== CREATE NEW PLACEMENT (INITIAL) ==========
router.post('/', keycloakAuth, async (req, res) => {
    try {
        let { aset_id, ruangan_id, tgl_masuk, tgl_keluar, keterangan } = req.body;

        if (!aset_id || !ruangan_id) {
            return res.status(400).json({ 
                success: false, 
                message: 'Aset ID dan Ruangan ID harus diisi' 
            });
        }

        // Cek apakah aset sudah pernah ditempatkan dan masih aktif
        const [existing] = await db.query(
            'SELECT id FROM aset_ruangan WHERE aset_id = ? AND status = "aktif"',
            [aset_id]
        );
        
        if (existing.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Aset sudah aktif di ruangan lain. Gunakan fitur pindah lokasi.' 
            });
        }

        const username = getUsernameFromToken(req.user);
        
        // Format tanggal untuk MySQL
        const formattedTglMasuk = formatDateForMySQL(tgl_masuk) || formatDateForMySQL(new Date());
        const formattedTglKeluar = formatDateForMySQL(tgl_keluar);

        console.log('Create - Original tgl_masuk:', tgl_masuk);
        console.log('Create - Formatted tgl_masuk:', formattedTglMasuk);

        const [result] = await db.query(
            `INSERT INTO aset_ruangan (aset_id, ruangan_id, tgl_masuk, tgl_keluar, status, keterangan) 
             VALUES (?, ?, ?, ?, 'aktif', ?)`,
            [aset_id, ruangan_id, formattedTglMasuk, formattedTglKeluar, keterangan]
        );

        res.status(201).json({
            success: true,
            message: 'Aset berhasil ditempatkan',
            data: {
                id: result.insertId,
                aset_id,
                ruangan_id,
                tgl_masuk: formattedTglMasuk
            },
            createdBy: username
        });
    } catch (error) {
        console.error('Error placing aset:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal menempatkan aset',
            error: error.message 
        });
    }
});

// ========== PINDAH LOKASI ASET ==========
router.post('/pindah', keycloakAuth, async (req, res) => {
    try {
        let { aset_id, ruangan_baru_id, tgl_pindah, keterangan } = req.body;

        if (!aset_id || !ruangan_baru_id) {
            return res.status(400).json({ 
                success: false, 
                message: 'Aset ID dan Ruangan Baru ID harus diisi' 
            });
        }

        const username = getUsernameFromToken(req.user);
        
        // Format tanggal untuk MySQL
        const formattedTglPindah = formatDateForMySQL(tgl_pindah) || formatDateForMySQL(new Date());

        console.log('Pindah - Original tgl_pindah:', tgl_pindah);
        console.log('Pindah - Formatted tgl_pindah:', formattedTglPindah);

        // Mulai transaction
        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Cek lokasi aktif saat ini
            const [lokasiAktif] = await connection.query(
                'SELECT * FROM aset_ruangan WHERE aset_id = ? AND status = "aktif"',
                [aset_id]
            );

            if (lokasiAktif.length === 0) {
                await connection.rollback();
                return res.status(400).json({ 
                    success: false, 
                    message: 'Tidak ada lokasi aktif untuk aset ini. Gunakan fitur tempatkan aset.' 
                });
            }

            // Update lokasi lama menjadi dipindah
            await connection.query(
                `UPDATE aset_ruangan 
                 SET status = 'dipindah', tgl_keluar = ?, keterangan = CONCAT(IFNULL(keterangan, ''), '\n', ?)
                 WHERE id = ?`,
                [formattedTglPindah, `Dipindah ke ruangan ID: ${ruangan_baru_id} - ${keterangan || ''}`, lokasiAktif[0].id]
            );

            // Insert lokasi baru
            const [result] = await connection.query(
                `INSERT INTO aset_ruangan (aset_id, ruangan_id, tgl_masuk, status, keterangan) 
                 VALUES (?, ?, ?, 'aktif', ?)`,
                [aset_id, ruangan_baru_id, formattedTglPindah, keterangan]
            );

            await connection.commit();

            res.json({
                success: true,
                message: 'Aset berhasil dipindahkan',
                data: {
                    id: result.insertId,
                    aset_id,
                    ruangan_baru_id,
                    tgl_pindah: formattedTglPindah,
                    from_ruangan: lokasiAktif[0].ruangan_id
                },
                updatedBy: username
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error moving aset:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal memindahkan aset',
            error: error.message 
        });
    }
});

// ========== CATAT KELUAR ASET (DIHAPUSKAN) ==========
// ========== CATAT KELUAR ASET ==========
router.post('/:id/keluar', keycloakAuth, async (req, res) => {
    try {
        const { id } = req.params;
        let { tgl_keluar, status, keterangan } = req.body; // ← Tambahkan status

        if (!tgl_keluar) {
            return res.status(400).json({ 
                success: false, 
                message: 'Tanggal keluar harus diisi' 
            });
        }

        // Format tanggal untuk MySQL
        const formattedTglKeluar = formatDateForMySQL(tgl_keluar);
        
        console.log('Keluar - Data:', { id, tgl_keluar, status, keterangan });

        // Cek apakah data exist dan masih aktif
        const [existing] = await db.query(
            'SELECT * FROM aset_ruangan WHERE id = ? AND status = "aktif"',
            [id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Data tidak ditemukan atau sudah tidak aktif' 
            });
        }

        const username = getUsernameFromToken(req.user);

        // Gunakan status dari request, default ke 'dipindah' jika tidak ada
        const newStatus = status || 'dipindah';
        
        await db.query(
            `UPDATE aset_ruangan 
             SET status = ?, tgl_keluar = ?, keterangan = CONCAT(IFNULL(keterangan, ''), '\n', ?)
             WHERE id = ?`,
            [newStatus, formattedTglKeluar, keterangan || `Aset ${newStatus}`, id]
        );

        res.json({
            success: true,
            message: `Aset berhasil dicatat ${newStatus === 'dipindah' ? 'dipindah' : 'keluar (dihapuskan)'}`,
            updatedBy: username
        });
    } catch (error) {
        console.error('Error catat keluar:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal mencatat keluar',
            error: error.message 
        });
    }
});

// ========== UPDATE DATA ASET RUANGAN ==========
router.put('/:id', keycloakAuth, async (req, res) => {
    try {
        const { id } = req.params;
        let { ruangan_id, tgl_masuk, tgl_keluar, status, keterangan } = req.body;

        // Cek apakah data exist
        const [existing] = await db.query('SELECT id FROM aset_ruangan WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Data tidak ditemukan' 
            });
        }

        // Format tanggal untuk MySQL
        const formattedTglMasuk = formatDateForMySQL(tgl_masuk);
        const formattedTglKeluar = formatDateForMySQL(tgl_keluar);

        console.log('Update - Original tgl_masuk:', tgl_masuk);
        console.log('Update - Formatted tgl_masuk:', formattedTglMasuk);
        console.log('Update - Original tgl_keluar:', tgl_keluar);
        console.log('Update - Formatted tgl_keluar:', formattedTglKeluar);

        const username = getUsernameFromToken(req.user);

        await db.query(
            `UPDATE aset_ruangan 
             SET ruangan_id = ?, tgl_masuk = ?, tgl_keluar = ?, status = ?, keterangan = ?
             WHERE id = ?`,
            [ruangan_id, formattedTglMasuk, formattedTglKeluar, status, keterangan, id]
        );

        res.json({
            success: true,
            message: 'Data berhasil diperbarui',
            updatedBy: username
        });
    } catch (error) {
        console.error('Error updating aset ruangan:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal memperbarui data',
            error: error.message 
        });
    }
});

// ========== DELETE ASET RUANGAN ==========
router.delete('/:id', keycloakAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await db.query('DELETE FROM aset_ruangan WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Data tidak ditemukan' 
            });
        }

        const username = getUsernameFromToken(req.user);

        res.json({
            success: true,
            message: 'Data berhasil dihapus',
            deletedBy: username
        });
    } catch (error) {
        console.error('Error deleting aset ruangan:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal menghapus data',
            error: error.message 
        });
    }
});

// ========== GET STATISTICS ==========
// backend/routes/asetRuangan.js



// ========== OPTIONS FOR DROPDOWNS ==========
router.get('/options/aset', keycloakAuth, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT id, kode_barang, nama_barang, merk, nup, jenis_bmn 
            FROM master_aset 
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

// ========== OPTIONS FOR DROPDOWNS ==========
router.get('/options/ruangan', keycloakAuth, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT id, kode_ruangan, nama_ruangan, lokasi, is_active 
            FROM ruangan 
            WHERE is_active = 1 
            ORDER BY kode_ruangan
        `);
        console.log('📋 Ruangan options (aktif):', rows.length);
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