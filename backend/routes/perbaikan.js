const express = require('express');
const router = express.Router();
const db = require('../db');
const { keycloakAuth, checkRole } = require('../middleware/keycloakAuth');

function getUsernameFromToken(user) {
    return user?.preferred_username || user?.username || 'unknown';
}

// ========== PERBAIKAN INTERNAL ==========

// Mulai perbaikan internal
router.post('/internal/mulai/:laporanId', keycloakAuth, checkRole(['Tim_Perbaikan_Internal']), async (req, res) => {
    try {
        const { laporanId } = req.params;
        const { tindakan } = req.body;

        const teknisi_id = req.user.sub;
        const username = getUsernameFromToken(req.user);

        // Cek disposisi
        const [disposisi] = await db.query(`
            SELECT d.* FROM disposisi d
            WHERE d.laporan_id = ? AND d.tujuan = 'tim_internal'
            ORDER BY d.tgl_disposisi DESC LIMIT 1
        `, [laporanId]);

        if (disposisi.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Laporan tidak didisposisikan untuk perbaikan internal' 
            });
        }

        // Insert perbaikan internal
        const [result] = await db.query(
            `INSERT INTO perbaikan_internal (laporan_id, teknisi_id, tgl_mulai, tindakan) 
             VALUES (?, ?, NOW(), ?)`,
            [laporanId, teknisi_id, tindakan || 'Perbaikan dimulai']
        );

        res.json({
            success: true,
            message: 'Perbaikan internal dimulai',
            data: {
                id: result.insertId,
                laporan_id: laporanId,
                teknisi_id,
                tgl_mulai: new Date()
            }
        });
    } catch (error) {
        console.error('Error mulai perbaikan internal:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// Selesai perbaikan internal
router.put('/internal/selesai/:id', keycloakAuth, checkRole(['Tim_Perbaikan_Internal']), async (req, res) => {
    try {
        const { id } = req.params;
        const { hasil, catatan, tindakan } = req.body;

        if (!hasil) {
            return res.status(400).json({ 
                success: false, 
                message: 'Hasil perbaikan is required (berhasil/gagal/sebagian)' 
            });
        }

        // Update perbaikan internal
        await db.query(
            `UPDATE perbaikan_internal 
             SET tgl_selesai = NOW(), hasil = ?, catatan = ?, tindakan = CONCAT(tindakan, '\n', ?)
             WHERE id = ? AND tgl_selesai IS NULL`,
            [hasil, catatan, tindakan || '', id]
        );

        // Panggil stored procedure untuk menyelesaikan perbaikan
        const [perbaikan] = await db.query(
            'SELECT laporan_id FROM perbaikan_internal WHERE id = ?',
            [id]
        );

        if (perbaikan.length > 0) {
            await db.query(
                'CALL sp_perbaikan_internal_selesai(?, ?, ?, ?, ?)',
                [perbaikan[0].laporan_id, req.user.sub, tindakan, hasil, catatan]
            );
        }

        res.json({
            success: true,
            message: `Perbaikan internal selesai dengan hasil: ${hasil}`,
            updatedBy: getUsernameFromToken(req.user)
        });
    } catch (error) {
        console.error('Error selesai perbaikan internal:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== PERBAIKAN EKSTERNAL ==========

// Assign vendor untuk perbaikan eksternal
router.post('/eksternal/:laporanId', keycloakAuth, checkRole(['PPK', 'Kabag_TU']), async (req, res) => {
    try {
        const { laporanId } = req.params;
        const { vendor_id, no_kontrak, tgl_mulai, biaya, no_spk } = req.body;

        if (!vendor_id) {
            return res.status(400).json({ 
                success: false, 
                message: 'Vendor ID is required' 
            });
        }

        // Cek disposisi
        const [disposisi] = await db.query(`
            SELECT d.* FROM disposisi d
            WHERE d.laporan_id = ? AND d.tujuan = 'pihak_ketiga'
            ORDER BY d.tgl_disposisi DESC LIMIT 1
        `, [laporanId]);

        if (disposisi.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Laporan tidak didisposisikan untuk perbaikan eksternal' 
            });
        }

        const [result] = await db.query(
            `INSERT INTO perbaikan_eksternal 
             (laporan_id, pihak_ketiga_id, no_kontrak, tgl_mulai, biaya, no_spk) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [laporanId, vendor_id, no_kontrak, tgl_mulai || new Date(), biaya, no_spk]
        );

        res.status(201).json({
            success: true,
            message: 'Vendor assigned for external repair',
            data: {
                id: result.insertId,
                laporan_id: laporanId,
                vendor_id
            }
        });
    } catch (error) {
        console.error('Error assign vendor:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// Selesai perbaikan eksternal
router.put('/eksternal/selesai/:id', keycloakAuth, checkRole(['PPK', 'Kabag_TU']), async (req, res) => {
    try {
        const { id } = req.params;
        const { hasil, catatan, tgl_selesai, biaya_aktual } = req.body;

        if (!hasil) {
            return res.status(400).json({ 
                success: false, 
                message: 'Hasil perbaikan is required' 
            });
        }

        await db.query(
            `UPDATE perbaikan_eksternal 
             SET tgl_selesai = COALESCE(?, NOW()), 
                 hasil = ?, 
                 catatan = ?,
                 biaya = COALESCE(?, biaya)
             WHERE id = ?`,
            [tgl_selesai, hasil, catatan, biaya_aktual, id]
        );

        // Get laporan_id untuk update histori
        const [perbaikan] = await db.query(
            'SELECT laporan_id FROM perbaikan_eksternal WHERE id = ?',
            [id]
        );

        if (perbaikan.length > 0 && hasil === 'berhasil') {
            // Update status laporan
            await db.query(
                'UPDATE laporan_rusak SET status = "selesai" WHERE id = ?',
                [perbaikan[0].laporan_id]
            );

            // Insert ke histori
            await db.query(`
                INSERT INTO histori_kerusakan 
                (aset_id, laporan_id, tgl_kejadian, deskripsi, tindakan, biaya, 
                 dilaporkan_oleh, vendor_id, lama_perbaikan_hari, status_akhir)
                SELECT lr.aset_id, lr.id, lr.tgl_laporan, lr.deskripsi, pe.catatan,
                       pe.biaya, lr.pelapor_id, pe.pihak_ketiga_id,
                       DATEDIFF(pe.tgl_selesai, pe.tgl_mulai), ?
                FROM perbaikan_eksternal pe
                JOIN laporan_rusak lr ON pe.laporan_id = lr.id
                WHERE pe.id = ?
            `, [hasil, id]);
        }

        res.json({
            success: true,
            message: 'External repair completed'
        });
    } catch (error) {
        console.error('Error complete external repair:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// Update kontrak perbaikan eksternal
router.put('/eksternal/:id/kontrak', keycloakAuth, checkRole(['PPK']), async (req, res) => {
    try {
        const { id } = req.params;
        const { no_kontrak, no_spk, biaya } = req.body;

        await db.query(
            `UPDATE perbaikan_eksternal 
             SET no_kontrak = COALESCE(?, no_kontrak),
                 no_spk = COALESCE(?, no_spk),
                 biaya = COALESCE(?, biaya)
             WHERE id = ?`,
            [no_kontrak, no_spk, biaya, id]
        );

        res.json({
            success: true,
            message: 'Kontrak updated successfully'
        });
    } catch (error) {
        console.error('Error updating kontrak:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

module.exports = router;