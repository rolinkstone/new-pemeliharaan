// backend/routes/dashboard.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { keycloakAuth, getUserId, getUsername } = require('../middleware/keycloakAuth');

/**
 * GET /api/dashboard/stats
 * Mendapatkan statistik untuk dashboard pemeliharaan aset
 */
router.get('/stats', keycloakAuth, async (req, res) => {
    try {
        const username = getUsername(req.user);
        console.log('📊 Dashboard stats requested by:', username);

        // 1. Statistik Laporan Rusak per Status
        const [laporanStats] = await db.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
                SUM(CASE WHEN status = 'menunggu_verifikasi_pic' THEN 1 ELSE 0 END) as menunggu_verifikasi_pic,
                SUM(CASE WHEN status = 'menunggu_disposisi' THEN 1 ELSE 0 END) as menunggu_disposisi,
                SUM(CASE WHEN status = 'menunggu_verifikasi_ppk' THEN 1 ELSE 0 END) as menunggu_verifikasi_ppk,
                SUM(CASE WHEN status = 'dalam_perbaikan' THEN 1 ELSE 0 END) as dalam_perbaikan,
                SUM(CASE WHEN status = 'selesai' THEN 1 ELSE 0 END) as selesai,
                SUM(CASE WHEN status = 'ditolak' THEN 1 ELSE 0 END) as ditolak
            FROM laporan_rusak
        `);

        // 2. Laporan per Prioritas
        const [laporanPerPrioritas] = await db.query(`
            SELECT 
                prioritas as name,
                COUNT(*) as value
            FROM laporan_rusak
            GROUP BY prioritas
            ORDER BY FIELD(prioritas, 'kritis', 'tinggi', 'sedang', 'rendah')
        `);

        // 3. Laporan per Bulan (6 bulan terakhir)
        const [laporanPerBulan] = await db.query(`
            SELECT 
                DATE_FORMAT(tgl_laporan, '%b') as name,
                COUNT(*) as value
            FROM laporan_rusak
            WHERE tgl_laporan >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
            GROUP BY DATE_FORMAT(tgl_laporan, '%Y-%m'), DATE_FORMAT(tgl_laporan, '%b')
            ORDER BY MIN(tgl_laporan)
        `);

        // 4. Total Aset
        const [asetTotal] = await db.query(`
            SELECT COUNT(*) as total FROM master_aset WHERE is_active = 1
        `);

        // 5. Total Ruangan
        const [ruanganTotal] = await db.query(`
            SELECT COUNT(*) as total FROM ruangan WHERE is_active = 1
        `);

        // 6. PIC Ruangan aktif
        const [picAktif] = await db.query(`
            SELECT COUNT(*) as total FROM pic_ruangan WHERE status = 'aktif'
        `);

        // 7. Detail Perbaikan
        const [perbaikanStats] = await db.query(`
            SELECT 
                COUNT(*) as total_perbaikan,
                COALESCE(AVG(biaya_aktual), 0) as rata_rata_biaya,
                COALESCE(SUM(biaya_aktual), 0) as total_biaya,
                COALESCE(AVG(rating), 0) as rata_rata_rating
            FROM detail_perbaikan
        `);

        // 8. Aset dengan kerusakan terbanyak
        const [asetRawan] = await db.query(`
            SELECT 
                a.nama_barang as name,
                a.kode_barang as kode,
                COUNT(lr.id) as value
            FROM laporan_rusak lr
            JOIN master_aset a ON lr.aset_id = a.id
            GROUP BY lr.aset_id
            ORDER BY value DESC
            LIMIT 5
        `);

        // Format response
        const response = {
            success: true,
            data: {
                laporan: {
                    total: laporanStats[0]?.total || 0,
                    draft: laporanStats[0]?.draft || 0,
                    menunggu_verifikasi_pic: laporanStats[0]?.menunggu_verifikasi_pic || 0,
                    menunggu_disposisi: laporanStats[0]?.menunggu_disposisi || 0,
                    menunggu_verifikasi_ppk: laporanStats[0]?.menunggu_verifikasi_ppk || 0,
                    dalam_perbaikan: laporanStats[0]?.dalam_perbaikan || 0,
                    selesai: laporanStats[0]?.selesai || 0,
                    ditolak: laporanStats[0]?.ditolak || 0,
                    persentase_selesai: laporanStats[0]?.total > 0 
                        ? Math.round((laporanStats[0].selesai / laporanStats[0].total) * 100) 
                        : 0,
                    byPrioritas: laporanPerPrioritas.map(item => ({
                        name: item.name,
                        value: item.value,
                        color: item.name === 'kritis' ? '#EF4444' :
                               item.name === 'tinggi' ? '#F59E0B' :
                               item.name === 'sedang' ? '#3B82F6' : '#10B981'
                    })),
                    byBulan: laporanPerBulan.map(item => ({
                        name: item.name,
                        value: item.value
                    }))
                },
                aset: {
                    total: asetTotal[0]?.total || 0,
                    ruangan: ruanganTotal[0]?.total || 0,
                    pic_aktif: picAktif[0]?.total || 0,
                    asetRawan: asetRawan.map(item => ({
                        name: item.name,
                        kode: item.kode,
                        value: item.value
                    }))
                },
                perbaikan: {
                    total: perbaikanStats[0]?.total_perbaikan || 0,
                    rata_rata_biaya: parseFloat(perbaikanStats[0]?.rata_rata_biaya || 0),
                    total_biaya: parseFloat(perbaikanStats[0]?.total_biaya || 0),
                    rata_rata_rating: parseFloat(perbaikanStats[0]?.rata_rata_rating || 0)
                }
            }
        };

        console.log('✅ Dashboard stats response:', {
            totalLaporan: response.data.laporan.total,
            totalAset: response.data.aset.total,
            totalPerbaikan: response.data.perbaikan.total
        });

        res.json(response);

    } catch (error) {
        console.error('❌ Error fetching dashboard stats:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil data dashboard',
            error: error.message
        });
    }
});

module.exports = router;