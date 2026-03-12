const express = require('express');
const router = express.Router();
const db = require('../db');
const { keycloakAuth, checkRole } = require('../middleware/keycloakAuth');

function getUsernameFromToken(user) {
    return user?.preferred_username || user?.username || 'unknown';
}

// ========== VERIFIKASI PIC RUANGAN ==========
router.post('/pic/:laporanId', keycloakAuth, checkRole(['PIC_Ruangan']), async (req, res) => {
    try {
        const { laporanId } = req.params;
        const { hasil_verifikasi, catatan } = req.body;

        if (!hasil_verifikasi) {
            return res.status(400).json({ 
                success: false, 
                message: 'Hasil verifikasi is required' 
            });
        }

        const pic_id = req.user.sub;
        const username = getUsernameFromToken(req.user);

        // Cek apakah PIC berhak atas ruangan ini
        const [cek] = await db.query(`
            SELECT lr.* FROM laporan_rusak lr
            JOIN pic_ruangan pr ON lr.ruangan_id = pr.ruangan_id
            WHERE lr.id = ? AND pr.user_id = ? AND pr.status = 'aktif'
        `, [laporanId, pic_id]);

        if (cek.length === 0) {
            return res.status(403).json({ 
                success: false, 
                message: 'Anda bukan PIC ruangan untuk laporan ini' 
            });
        }

        // Insert verifikasi PIC
        await db.query(
            `INSERT INTO verifikasi_pic_ruangan 
             (laporan_id, pic_id, tgl_verifikasi, hasil_verifikasi, catatan) 
             VALUES (?, ?, NOW(), ?, ?)`,
            [laporanId, pic_id, hasil_verifikasi, catatan]
        );

        // Update status laporan
        let newStatus = 'draft';
        if (hasil_verifikasi === 'lengkap') {
            newStatus = 'menunggu_verifikasi_ppk';
        }

        await db.query(
            'UPDATE laporan_rusak SET status = ? WHERE id = ?',
            [newStatus, laporanId]
        );

        res.json({
            success: true,
            message: `Verifikasi PIC berhasil: ${hasil_verifikasi}`,
            data: {
                laporan_id: laporanId,
                hasil: hasil_verifikasi,
                verifiedBy: username
            }
        });
    } catch (error) {
        console.error('Error verifikasi PIC:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== VERIFIKASI PPK ==========
router.post('/ppk/:laporanId', keycloakAuth, checkRole(['PPK']), async (req, res) => {
    try {
        const { laporanId } = req.params;
        const { hasil_verifikasi, estimasi_biaya, catatan } = req.body;

        if (!hasil_verifikasi) {
            return res.status(400).json({ 
                success: false, 
                message: 'Hasil verifikasi is required' 
            });
        }

        const ppk_id = req.user.sub;
        const username = getUsernameFromToken(req.user);

        // Cek apakah laporan sudah diverifikasi PIC
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

        if (laporan[0].status !== 'menunggu_verifikasi_ppk') {
            return res.status(400).json({ 
                success: false, 
                message: 'Laporan tidak dalam status menunggu verifikasi PPK' 
            });
        }

        // Insert verifikasi PPK
        await db.query(
            `INSERT INTO verifikasi_ppk 
             (laporan_id, ppk_id, tgl_verifikasi, hasil_verifikasi, estimasi_biaya, catatan) 
             VALUES (?, ?, NOW(), ?, ?, ?)`,
            [laporanId, ppk_id, hasil_verifikasi, estimasi_biaya || 0, catatan]
        );

        // Update status laporan
        let newStatus = 'draft';
        if (hasil_verifikasi === 'disetujui') {
            newStatus = 'menunggu_disposisi';
        } else if (hasil_verifikasi === 'ditolak') {
            newStatus = 'ditolak';
        }

        await db.query(
            'UPDATE laporan_rusak SET status = ? WHERE id = ?',
            [newStatus, laporanId]
        );

        res.json({
            success: true,
            message: `Verifikasi PPK berhasil: ${hasil_verifikasi}`,
            data: {
                laporan_id: laporanId,
                hasil: hasil_verifikasi,
                estimasi_biaya,
                verifiedBy: username
            }
        });
    } catch (error) {
        console.error('Error verifikasi PPK:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

module.exports = router;