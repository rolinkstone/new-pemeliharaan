const express = require('express');
const router = express.Router();
const db = require('../db');
const { keycloakAuth, checkRole } = require('../middleware/keycloakAuth');

function getUsernameFromToken(user) {
    return user?.preferred_username || user?.username || 'unknown';
}

// ========== GET ALL VENDOR ==========
router.get('/', keycloakAuth, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT p.*, 
                   COUNT(pe.id) as total_perbaikan,
                   SUM(CASE WHEN pe.hasil = 'berhasil' THEN 1 ELSE 0 END) as perbaikan_berhasil
            FROM pihak_ketiga p
            LEFT JOIN perbaikan_eksternal pe ON p.id = pe.pihak_ketiga_id
            WHERE p.is_active = 1
            GROUP BY p.id
            ORDER BY p.nama_perusahaan ASC
        `);
        
        res.json({
            success: true,
            data: rows,
            total: rows.length
        });
    } catch (error) {
        console.error('Error fetching vendors:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== GET VENDOR BY ID ==========
router.get('/:id', keycloakAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        const [rows] = await db.query(
            'SELECT * FROM pihak_ketiga WHERE id = ? AND is_active = 1',
            [id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Vendor not found' 
            });
        }
        
        // Get riwayat perbaikan vendor
        const [perbaikan] = await db.query(`
            SELECT pe.*, lr.nomor_laporan, ma.nama_barang
            FROM perbaikan_eksternal pe
            JOIN laporan_rusak lr ON pe.laporan_id = lr.id
            JOIN master_aset ma ON lr.aset_id = ma.id
            WHERE pe.pihak_ketiga_id = ?
            ORDER BY pe.tgl_mulai DESC
            LIMIT 20
        `, [id]);
        
        res.json({
            success: true,
            data: {
                ...rows[0],
                riwayat_perbaikan: perbaikan
            }
        });
    } catch (error) {
        console.error('Error fetching vendor:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== CREATE VENDOR ==========
router.post('/', keycloakAuth, checkRole(['Admin', 'PPK']), async (req, res) => {
    try {
        const {
            nama_perusahaan,
            npwp,
            alamat,
            no_telp,
            email,
            kontak_person,
            no_hp_kontak
        } = req.body;

        if (!nama_perusahaan) {
            return res.status(400).json({ 
                success: false, 
                message: 'Nama perusahaan is required' 
            });
        }

        const username = getUsernameFromToken(req.user);
        
        const [result] = await db.query(
            `INSERT INTO pihak_ketiga 
            (nama_perusahaan, npwp, alamat, no_telp, email, kontak_person, no_hp_kontak) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [nama_perusahaan, npwp, alamat, no_telp, email, kontak_person, no_hp_kontak]
        );

        res.status(201).json({
            success: true,
            message: 'Vendor created successfully',
            data: { id: result.insertId, ...req.body },
            createdBy: username
        });
    } catch (error) {
        console.error('Error creating vendor:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== UPDATE VENDOR ==========
router.put('/:id', keycloakAuth, checkRole(['Admin', 'PPK']), async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const [existing] = await db.query('SELECT id FROM pihak_ketiga WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Vendor not found' 
            });
        }

        const username = getUsernameFromToken(req.user);

        const setClause = Object.keys(updates)
            .map(key => `${key} = ?`)
            .join(', ');
        const values = [...Object.values(updates), id];

        await db.query(
            `UPDATE pihak_ketiga SET ${setClause} WHERE id = ?`,
            values
        );

        res.json({
            success: true,
            message: 'Vendor updated successfully',
            updatedBy: username
        });
    } catch (error) {
        console.error('Error updating vendor:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== DELETE VENDOR ==========
router.delete('/:id', keycloakAuth, checkRole(['Admin']), async (req, res) => {
    try {
        const { id } = req.params;

        // Cek apakah vendor pernah digunakan
        const [used] = await db.query(
            'SELECT id FROM perbaikan_eksternal WHERE pihak_ketiga_id = ?',
            [id]
        );
        
        if (used.length > 0) {
            // Soft delete jika sudah pernah digunakan
            await db.query('UPDATE pihak_ketiga SET is_active = 0 WHERE id = ?', [id]);
            res.json({
                success: true,
                message: 'Vendor deactivated successfully (has history)'
            });
        } else {
            // Hard delete jika belum pernah digunakan
            await db.query('DELETE FROM pihak_ketiga WHERE id = ?', [id]);
            res.json({
                success: true,
                message: 'Vendor deleted successfully'
            });
        }
    } catch (error) {
        console.error('Error deleting vendor:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

module.exports = router;