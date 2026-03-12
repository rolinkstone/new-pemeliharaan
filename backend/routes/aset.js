const express = require('express');
const router = express.Router();
const db = require('../db');
const { keycloakAuth, getUsername } = require('../middleware/keycloakAuth');

// ========== HELPER FUNCTIONS ==========
function getUsernameFromToken(user) {
    return user?.preferred_username || user?.username || 'unknown';
}

// ========== GET ALL ASET ==========
router.get('/', keycloakAuth, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM master_aset ORDER BY id DESC');
        
        res.json({
            success: true,
            data: rows,
            total: rows.length
        });
    } catch (error) {
        console.error('Error fetching aset:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== GET ASET BY ID ==========
router.get('/:id', keycloakAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        const [rows] = await db.query('SELECT * FROM master_aset WHERE id = ?', [id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Aset not found' 
            });
        }
        
        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching aset by id:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== CREATE NEW ASET ==========
router.post('/', keycloakAuth, async (req, res) => {
    try {
        const {
            jenis_bmn,
            nama_satker,
            kode_barang,
            nup,
            nama_barang,
            status_bmn,
            merk,
            tipe,
            kondisi,
            intra_extra,
            tanggal_perolehan
        } = req.body;

        // Validasi required fields
        if (!jenis_bmn || !nama_barang) {
            return res.status(400).json({ 
                success: false, 
                message: 'Jenis BMN and Nama Barang are required' 
            });
        }

        const username = getUsernameFromToken(req.user);
        
        const [result] = await db.query(
            `INSERT INTO master_aset 
            (jenis_bmn, nama_satker, kode_barang, nup, nama_barang, status_bmn, 
             merk, tipe, kondisi, intra_extra, tanggal_perolehan) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                jenis_bmn,
                nama_satker || 'BALAI BESAR PENGAWAS OBAT DAN MAKANAN DI PALANGKA RAYA',
                kode_barang,
                nup,
                nama_barang,
                status_bmn || 'Aktif',
                merk,
                tipe,
                kondisi || 'Baik',
                intra_extra || 'Intra',
                tanggal_perolehan || null
            ]
        );

        res.status(201).json({
            success: true,
            message: 'Aset created successfully',
            data: {
                id: result.insertId,
                ...req.body
            },
            createdBy: username
        });
    } catch (error) {
        console.error('Error creating aset:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== UPDATE ASET ==========
router.put('/:id', keycloakAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            jenis_bmn,
            nama_satker,
            kode_barang,
            nup,
            nama_barang,
            status_bmn,
            merk,
            tipe,
            kondisi,
            intra_extra,
            tanggal_perolehan
        } = req.body;

        // Cek apakah aset exist
        const [existing] = await db.query('SELECT id FROM master_aset WHERE id = ?', [id]);
        
        if (existing.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Aset not found' 
            });
        }

        const username = getUsernameFromToken(req.user);

        await db.query(
            `UPDATE master_aset 
            SET jenis_bmn = ?, nama_satker = ?, kode_barang = ?, nup = ?, 
                nama_barang = ?, status_bmn = ?, merk = ?, tipe = ?, 
                kondisi = ?, intra_extra = ?, tanggal_perolehan = ?
            WHERE id = ?`,
            [
                jenis_bmn,
                nama_satker,
                kode_barang,
                nup,
                nama_barang,
                status_bmn,
                merk,
                tipe,
                kondisi,
                intra_extra,
                tanggal_perolehan,
                id
            ]
        );

        res.json({
            success: true,
            message: 'Aset updated successfully',
            data: { id, ...req.body },
            updatedBy: username
        });
    } catch (error) {
        console.error('Error updating aset:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== DELETE ASET ==========
router.delete('/:id', keycloakAuth, async (req, res) => {
    try {
        const { id } = req.params;

        // Cek apakah aset exist
        const [existing] = await db.query('SELECT id FROM master_aset WHERE id = ?', [id]);
        
        if (existing.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Aset not found' 
            });
        }

        const username = getUsernameFromToken(req.user);

        await db.query('DELETE FROM master_aset WHERE id = ?', [id]);

        res.json({
            success: true,
            message: 'Aset deleted successfully',
            deletedId: id,
            deletedBy: username
        });
    } catch (error) {
        console.error('Error deleting aset:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== SEARCH ASET ==========
router.get('/search/:keyword', keycloakAuth, async (req, res) => {
    try {
        const { keyword } = req.params;
        const searchTerm = `%${keyword}%`;

        const [rows] = await db.query(
            `SELECT * FROM master_aset 
            WHERE jenis_bmn LIKE ? 
            OR nama_barang LIKE ? 
            OR kode_barang LIKE ?
            OR merk LIKE ?
            OR tipe LIKE ?
            ORDER BY id DESC`,
            [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm]
        );

        res.json({
            success: true,
            data: rows,
            total: rows.length,
            keyword: keyword
        });
    } catch (error) {
        console.error('Error searching aset:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== FILTER BY JENIS BMN ==========
router.get('/jenis/:jenis', keycloakAuth, async (req, res) => {
    try {
        const { jenis } = req.params;

        const [rows] = await db.query(
            'SELECT * FROM master_aset WHERE jenis_bmn = ? ORDER BY id DESC',
            [jenis]
        );

        res.json({
            success: true,
            data: rows,
            total: rows.length,
            jenis_bmn: jenis
        });
    } catch (error) {
        console.error('Error filtering by jenis:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== FILTER BY KONDISI ==========
router.get('/kondisi/:kondisi', keycloakAuth, async (req, res) => {
    try {
        const { kondisi } = req.params;

        const [rows] = await db.query(
            'SELECT * FROM master_aset WHERE kondisi = ? ORDER BY id DESC',
            [kondisi]
        );

        res.json({
            success: true,
            data: rows,
            total: rows.length,
            kondisi: kondisi
        });
    } catch (error) {
        console.error('Error filtering by kondisi:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== FILTER BY STATUS ==========
router.get('/status/:status', keycloakAuth, async (req, res) => {
    try {
        const { status } = req.params;

        const [rows] = await db.query(
            'SELECT * FROM master_aset WHERE status_bmn = ? ORDER BY id DESC',
            [status]
        );

        res.json({
            success: true,
            data: rows,
            total: rows.length,
            status_bmn: status
        });
    } catch (error) {
        console.error('Error filtering by status:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== GET DISTINCT JENIS BMN ==========
router.get('/metadata/jenis', keycloakAuth, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT DISTINCT jenis_bmn FROM master_aset WHERE jenis_bmn IS NOT NULL AND jenis_bmn != "" ORDER BY jenis_bmn');
        
        res.json({
            success: true,
            data: rows.map(row => row.jenis_bmn)
        });
    } catch (error) {
        console.error('Error fetching jenis bmn:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== GET DISTINCT KONDISI ==========
router.get('/metadata/kondisi', keycloakAuth, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT DISTINCT kondisi FROM master_aset WHERE kondisi IS NOT NULL AND kondisi != "" ORDER BY kondisi');
        
        res.json({
            success: true,
            data: rows.map(row => row.kondisi)
        });
    } catch (error) {
        console.error('Error fetching kondisi:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== GET STATISTICS ==========
router.get('/statistics/summary', keycloakAuth, async (req, res) => {
    try {
        // Total aset
        const [total] = await db.query('SELECT COUNT(*) as total FROM master_aset');
        
        // Total per jenis
        const [perJenis] = await db.query('SELECT jenis_bmn, COUNT(*) as total FROM master_aset GROUP BY jenis_bmn ORDER BY total DESC');
        
        // Total per kondisi
        const [perKondisi] = await db.query('SELECT kondisi, COUNT(*) as total FROM master_aset WHERE kondisi IS NOT NULL GROUP BY kondisi');
        
        // Total per status
        const [perStatus] = await db.query('SELECT status_bmn, COUNT(*) as total FROM master_aset WHERE status_bmn IS NOT NULL GROUP BY status_bmn');
        
        // Total per intra_extra
        const [perIntraExtra] = await db.query('SELECT intra_extra, COUNT(*) as total FROM master_aset WHERE intra_extra IS NOT NULL GROUP BY intra_extra');

        res.json({
            success: true,
            data: {
                total_aset: total[0].total,
                per_jenis: perJenis,
                per_kondisi: perKondisi,
                per_status: perStatus,
                per_intra_extra: perIntraExtra
            }
        });
    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== PAGINATION ==========
router.get('/page/:page', keycloakAuth, async (req, res) => {
    try {
        const page = parseInt(req.params.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        // Get total count
        const [countResult] = await db.query('SELECT COUNT(*) as total FROM master_aset');
        const total = countResult[0].total;

        // Get paginated data
        const [rows] = await db.query(
            'SELECT * FROM master_aset ORDER BY id DESC LIMIT ? OFFSET ?',
            [limit, offset]
        );

        res.json({
            success: true,
            data: rows,
            pagination: {
                current_page: page,
                per_page: limit,
                total: total,
                total_pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching paginated aset:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

module.exports = router;