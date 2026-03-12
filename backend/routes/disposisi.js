const express = require('express');
const router = express.Router();
const db = require('../db');
const { keycloakAuth, checkRole } = require('../middleware/keycloakAuth');

function getUsernameFromToken(user) {
    return user?.preferred_username || user?.username || 'unknown';
}

// ========== CREATE DISPOSISI ==========
router.post('/:laporanId', keycloakAuth, checkRole(['Kabag_TU']), async (req, res) => {
    try {
        const { laporanId } = req.params;
        const { tujuan, catatan } = req.body;

        if (!tujuan) {
            return res.status(400).json({ 
                success: false, 
                message: 'Tujuan disposisi is required (tim_internal/pihak_ketiga/ganti_baru)' 
            });
        }

        const kabag_id = req.user.sub;
        const username = getUsernameFromToken(req.user);

        // Cek laporan
        const [laporan] = await db.query(
            'SELECT status FROM laporan_rusak WHERE id = ?',
            [laporanId]
        );

        if (laporan.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Laporan not found' 
            });
        }

        if (laporan[0].status !== 'menunggu_disposisi') {
            return res.status(400).json({ 
                success: false, 
                message: 'Laporan tidak dalam status menunggu disposisi' 
            });
        }

        // Insert disposisi
        await db.query(
            `INSERT INTO disposisi (laporan_id, kabag_id, tgl_disposisi, tujuan, catatan) 
             VALUES (?, ?, NOW(), ?, ?)`,
            [laporanId, kabag_id, tujuan, catatan]
        );

        // Update status laporan
        await db.query(
            'UPDATE laporan_rusak SET status = "dalam_perbaikan" WHERE id = ?',
            [laporanId]
        );

        res.json({
            success: true,
            message: `Disposisi berhasil: perbaikan oleh ${tujuan}`,
            data: {
                laporan_id: laporanId,
                tujuan,
                catatan,
                disposisi_by: username
            }
        });
    } catch (error) {
        console.error('Error disposisi:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== GET RIWAYAT DISPOSISI ==========
router.get('/laporan/:laporanId', keycloakAuth, async (req, res) => {
    try {
        const { laporanId } = req.params;
        
        const [rows] = await db.query(`
            SELECT d.*
            FROM disposisi d
            WHERE d.laporan_id = ?
            ORDER BY d.tgl_disposisi DESC
        `, [laporanId]);
        
        res.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching disposisi:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

module.exports = router;