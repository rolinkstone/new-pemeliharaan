const express = require('express');
const router = express.Router();
const db = require('../db');
const { keycloakAuth } = require('../middleware/keycloakAuth');

// ========== DASHBOARD STATISTICS ==========
router.get('/dashboard', keycloakAuth, async (req, res) => {
    try {
        // Total laporan per status
        const [statusLaporan] = await db.query(`
            SELECT 
                SUM(CASE WHEN status = 'menunggu_verifikasi_pic' THEN 1 ELSE 0 END) as menunggu_pic,
                SUM(CASE WHEN status = 'menunggu_verifikasi_ppk' THEN 1 ELSE 0 END) as menunggu_ppk,
                SUM(CASE WHEN status = 'menunggu_disposisi' THEN 1 ELSE 0 END) as menunggu_disposisi,
                SUM(CASE WHEN status = 'dalam_perbaikan' THEN 1 ELSE 0 END) as dalam_perbaikan,
                SUM(CASE WHEN status = 'selesai' THEN 1 ELSE 0 END) as selesai,
                COUNT(*) as total
            FROM laporan_rusak
            WHERE is_active = 1
        `);

        // Total aset per kondisi
        const [kondisiAset] = await db.query(`
            SELECT kondisi, COUNT(*) as total
            FROM master_aset
            WHERE is_active = 1
            GROUP BY kondisi
        `);

        // Laporan prioritas tinggi
        const [prioritasTinggi] = await db.query(`
            SELECT COUNT(*) as total
            FROM laporan_rusak
            WHERE prioritas IN ('tinggi', 'darurat') 
              AND status NOT IN ('selesai', 'ditolak')
        `);

        // Rata-rata waktu penyelesaian (hari)
        const [rataWaktu] = await db.query(`
            SELECT AVG(DATEDIFF(tgl_selesai, tgl_laporan)) as rata_hari
            FROM laporan_rusak
            WHERE status = 'selesai' AND tgl_selesai IS NOT NULL
        `);

        // Laporan per bulan (6 bulan terakhir)
        const [laporanBulanan] = await db.query(`
            SELECT 
                DATE_FORMAT(tgl_laporan, '%Y-%m') as bulan,
                COUNT(*) as total,
                SUM(CASE WHEN status = 'selesai' THEN 1 ELSE 0 END) as selesai
            FROM laporan_rusak
            WHERE tgl_laporan >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
            GROUP BY DATE_FORMAT(tgl_laporan, '%Y-%m')
            ORDER BY bulan DESC
        `);

        res.json({
            success: true,
            data: {
                ringkasan: statusLaporan[0],
                kondisi_aset: kondisiAset,
                prioritas_tinggi: prioritasTinggi[0].total,
                rata_waktu_penyelesaian: Math.round(rataWaktu[0]?.rata_hari || 0),
                tren_bulanan: laporanBulanan
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== HISTORI KERUSAKAN ASET ==========
router.get('/histori/aset/:asetId', keycloakAuth, async (req, res) => {
    try {
        const { asetId } = req.params;
        
        const [rows] = await db.query(`
            SELECT h.*, 
                   u_preferred?.preferred_username as pelapor_nama,
                   u_teknisi?.preferred_username as teknisi_nama,
                   p.nama_perusahaan as vendor_nama
            FROM histori_kerusakan h
            LEFT JOIN pihak_ketiga p ON h.vendor_id = p.id
            WHERE h.aset_id = ?
            ORDER BY h.tgl_kejadian DESC
        `, [asetId]);
        
        // Hitung total biaya dan frekuensi
        const totalBiaya = rows.reduce((sum, item) => sum + (parseFloat(item.biaya) || 0), 0);
        
        res.json({
            success: true,
            data: {
                riwayat: rows,
                total_kejadian: rows.length,
                total_biaya: totalBiaya,
                rata_biaya: rows.length > 0 ? totalBiaya / rows.length : 0
            }
        });
    } catch (error) {
        console.error('Error fetching histori:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== ASET DENGAN KERUSAKAN TERBANYAK ==========
router.get('/analisis/aset-rawan', keycloakAuth, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                ma.id,
                ma.nama_barang,
                ma.kode_barang,
                ma.jenis_bmn,
                COUNT(h.id) as jumlah_kerusakan,
                SUM(h.biaya) as total_biaya_perbaikan,
                AVG(h.lama_perbaikan_hari) as rata_lama_perbaikan,
                MAX(h.tgl_kejadian) as terakhir_rusak
            FROM master_aset ma
            LEFT JOIN histori_kerusakan h ON ma.id = h.aset_id
            WHERE ma.is_active = 1
            GROUP BY ma.id
            HAVING jumlah_kerusakan > 0
            ORDER BY jumlah_kerusakan DESC
            LIMIT 20
        `);
        
        res.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching aset rawan:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== KINERJA TIM PERBAIKAN ==========
router.get('/analisis/kinerja-teknisi', keycloakAuth, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                pi.teknisi_id,
                COUNT(*) as total_perbaikan,
                SUM(CASE WHEN pi.hasil = 'berhasil' THEN 1 ELSE 0 END) as berhasil,
                SUM(CASE WHEN pi.hasil = 'gagal' THEN 1 ELSE 0 END) as gagal,
                AVG(TIMESTAMPDIFF(HOUR, pi.tgl_mulai, pi.tgl_selesai)) as rata_jam
            FROM perbaikan_internal pi
            WHERE pi.tgl_selesai IS NOT NULL
            GROUP BY pi.teknisi_id
            ORDER BY berhasil DESC
        `);
        
        res.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching kinerja teknisi:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== PERFORMANCE VENDOR ==========
router.get('/analisis/kinerja-vendor', keycloakAuth, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                p.id,
                p.nama_perusahaan,
                COUNT(pe.id) as total_perbaikan,
                SUM(CASE WHEN pe.hasil = 'berhasil' THEN 1 ELSE 0 END) as berhasil,
                SUM(pe.biaya) as total_biaya,
                AVG(DATEDIFF(pe.tgl_selesai, pe.tgl_mulai)) as rata_hari
            FROM pihak_ketiga p
            LEFT JOIN perbaikan_eksternal pe ON p.id = pe.pihak_ketiga_id
            WHERE p.is_active = 1
            GROUP BY p.id
            ORDER BY berhasil DESC
        `);
        
        res.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching kinerja vendor:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== SLA MONITORING ==========
router.get('/sla', keycloakAuth, async (req, res) => {
    try {
        // Laporan yang melebihi SLA (misal > 3 hari belum diverifikasi PIC)
        const [slaPIC] = await db.query(`
            SELECT lr.*, ma.nama_barang, r.nama_ruangan,
                   DATEDIFF(NOW(), lr.tgl_laporan) as hari_menunggu
            FROM laporan_rusak lr
            JOIN master_aset ma ON lr.aset_id = ma.id
            JOIN ruangan r ON lr.ruangan_id = r.id
            WHERE lr.status = 'menunggu_verifikasi_pic'
              AND DATEDIFF(NOW(), lr.tgl_laporan) > 3
            ORDER BY hari_menunggu DESC
        `);

        // Laporan yang melebihi SLA PPK
        const [slaPPK] = await db.query(`
            SELECT lr.*, ma.nama_barang,
                   DATEDIFF(NOW(), lr.tgl_laporan) as hari_menunggu
            FROM laporan_rusak lr
            JOIN master_aset ma ON lr.aset_id = ma.id
            WHERE lr.status = 'menunggu_verifikasi_ppk'
              AND DATEDIFF(NOW(), lr.tgl_laporan) > 5
            ORDER BY hari_menunggu DESC
        `);

        res.json({
            success: true,
            data: {
                sla_pic_terlambat: slaPIC,
                sla_ppk_terlambat: slaPPK,
                total_terlambat: slaPIC.length + slaPPK.length
            }
        });
    } catch (error) {
        console.error('Error fetching SLA:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

module.exports = router;