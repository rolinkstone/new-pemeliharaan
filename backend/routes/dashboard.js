// backend/routes/dashboard.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { keycloakAuth, getUserId, getUsername } = require('../middleware/keycloakAuth');

// ========== HELPER FUNCTIONS ==========

/**
 * Mendapatkan NIP dari token (preferred_username)
 */
function getUserNipFromToken(user) {
    if (!user) return null;
    const nip = user.preferred_username || user.username;
    console.log('🔍 getUserNipFromToken:', { preferred_username: user.preferred_username, username: user.username, nip });
    return nip;
}

/**
 * Cek apakah user adalah admin_tambun_raya
 */
function isAdminTambunRaya(user) {
    if (!user) return false;
    const roles = user.extractedRoles || user.role || [];
    return roles.includes('admin_tambun_raya');
}

/**
 * Cek apakah user adalah katim
 */
function isKatim(user) {
    if (!user) return false;
    const roles = user.extractedRoles || user.role || [];
    return roles.includes('katim');
}

/**
 * GET /api/dashboard/stats
 * Mendapatkan statistik untuk dashboard
 */
router.get('/stats', keycloakAuth, async (req, res) => {
    try {
        const userNip = getUserNipFromToken(req.user);
        console.log('📊 Dashboard stats requested by:', userNip);
        
        // Dapatkan user ID dari database
        let userId = null;
        if (userNip) {
            const [user] = await db.query(
                'SELECT id FROM kepegawaian.user WHERE nip = ?',
                [userNip]
            );
            userId = user.length > 0 ? user[0].id : null;
        }
        
        console.log('👤 User ID:', userId);

        // 1. Statistik Kompetensi
        const [kompetensiStats] = await db.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'Lulus' AND hasil_verif = 'Valid' THEN 1 ELSE 0 END) as lulus,
                SUM(CASE WHEN status = 'Tidak Lulus' OR hasil_verif = 'Tidak Valid' THEN 1 ELSE 0 END) as tidak_lulus,
                SUM(CASE WHEN verified_by IS NULL THEN 1 ELSE 0 END) as dalam_proses,
                SUM(CASE WHEN hasil_verif = 'Perlu Revisi' THEN 1 ELSE 0 END) as perlu_revisi
            FROM kepegawaian.user_kompetensi
        `);

        console.log('📊 Kompetensi stats:', kompetensiStats[0]);

        // 2. Kompetensi per Fungsi
        const [kompetensiPerFungsi] = await db.query(`
            SELECT 
                f.nama_fungsi as name,
                COUNT(uk.id) as value
            FROM kepegawaian.user_kompetensi uk
            JOIN kepegawaian.user u ON uk.id_user = u.id
            JOIN kepegawaian.fungsi f ON u.id_fungsi = f.id
            GROUP BY f.id, f.nama_fungsi
            ORDER BY value DESC
            LIMIT 5
        `);

        // 3. Kompetensi per Status (untuk pie chart)
        const [kompetensiPerStatus] = await db.query(`
            SELECT 
                CASE 
                    WHEN status = 'Lulus' AND hasil_verif = 'Valid' THEN 'Lulus'
                    WHEN status = 'Tidak Lulus' OR hasil_verif = 'Tidak Valid' THEN 'Tidak Lulus'
                    WHEN hasil_verif = 'Perlu Revisi' THEN 'Perlu Revisi'
                    ELSE 'Dalam Proses'
                END as name,
                COUNT(*) as value
            FROM kepegawaian.user_kompetensi
            GROUP BY name
        `);

        // 4. Statistik Pelatihan
        const [pelatihanStats] = await db.query(`
            SELECT 
                COUNT(*) as total_jadwal,
                SUM(CASE WHEN status = 'Draft' THEN 1 ELSE 0 END) as draft,
                SUM(CASE WHEN status = 'Publik' THEN 1 ELSE 0 END) as publik,
                SUM(CASE WHEN status = 'Berlangsung' THEN 1 ELSE 0 END) as berlangsung,
                SUM(CASE WHEN status = 'Selesai' THEN 1 ELSE 0 END) as selesai,
                COALESCE(SUM(jumlah_peserta), 0) as total_peserta,
                COALESCE(SUM(jumlah_hadir), 0) as total_hadir
            FROM (
                SELECT 
                    jp.*,
                    (SELECT COUNT(*) FROM kepegawaian.peserta_pelatihan WHERE id_jadwal = jp.id) as jumlah_peserta,
                    (SELECT COUNT(*) FROM kepegawaian.peserta_pelatihan WHERE id_jadwal = jp.id AND status_kehadiran = 'Hadir') as jumlah_hadir
                FROM kepegawaian.jadwal_pelatihan jp
            ) as subquery
        `);

        // 5. Tren Pelatihan per Bulan (6 bulan terakhir)
        const [pelatihanPerBulan] = await db.query(`
            SELECT 
                DATE_FORMAT(tanggal_mulai, '%b') as name,
                COUNT(*) as jadwal,
                COALESCE(SUM((SELECT COUNT(*) FROM kepegawaian.peserta_pelatihan WHERE id_jadwal = jp.id)), 0) as peserta
            FROM kepegawaian.jadwal_pelatihan jp
            WHERE tanggal_mulai >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
            GROUP BY DATE_FORMAT(tanggal_mulai, '%Y-%m'), DATE_FORMAT(tanggal_mulai, '%b')
            ORDER BY MIN(tanggal_mulai)
        `);

        // 6. Status Pelatihan (untuk radial chart)
        const [pelatihanPerStatus] = await db.query(`
            SELECT 
                status as name,
                COUNT(*) as value
            FROM kepegawaian.jadwal_pelatihan
            GROUP BY status
        `);

        // 7. Master Pelatihan per Jenis
        const [masterPerJenis] = await db.query(`
            SELECT 
                jenis_pelatihan as name,
                COUNT(*) as value
            FROM kepegawaian.master_pelatihan
            WHERE is_active = 1
            GROUP BY jenis_pelatihan
        `);

        // 8. Total Master Pelatihan
        const [masterTotal] = await db.query(`
            SELECT COUNT(*) as total
            FROM kepegawaian.master_pelatihan
            WHERE is_active = 1
        `);

        // 9. Undangan Pending untuk user biasa
        let undanganPending = 0;
        if (!isAdminTambunRaya(req.user) && !isKatim(req.user) && userId) {
            const [pending] = await db.query(`
                SELECT COUNT(*) as total
                FROM kepegawaian.peserta_pelatihan pp
                JOIN kepegawaian.jadwal_pelatihan jp ON pp.id_jadwal = jp.id
                WHERE pp.id_user = ? AND pp.status_undangan = 'Pending'
            `, [userId]);
            undanganPending = pending[0]?.total || 0;
        }

        // Format response
        const response = {
            success: true,
            data: {
                kompetensi: {
                    total: kompetensiStats[0]?.total || 0,
                    lulus: kompetensiStats[0]?.lulus || 0,
                    tidakLulus: kompetensiStats[0]?.tidak_lulus || 0,
                    dalamProses: kompetensiStats[0]?.dalam_proses || 0,
                    perluRevisi: kompetensiStats[0]?.perlu_revisi || 0,
                    persentase: kompetensiStats[0]?.total > 0 
                        ? Math.round((kompetensiStats[0].lulus / kompetensiStats[0].total) * 100) 
                        : 0,
                    byStatus: kompetensiPerStatus.map(item => ({
                        name: item.name,
                        value: item.value,
                        color: item.name === 'Lulus' ? '#10B981' :
                               item.name === 'Tidak Lulus' ? '#EF4444' :
                               item.name === 'Perlu Revisi' ? '#F59E0B' : '#3B82F6'
                    })),
                    byFungsi: kompetensiPerFungsi.map(item => ({
                        name: item.name,
                        value: item.value
                    }))
                },
                pelatihan: {
                    totalJadwal: pelatihanStats[0]?.total_jadwal || 0,
                    draft: pelatihanStats[0]?.draft || 0,
                    publik: pelatihanStats[0]?.publik || 0,
                    berlangsung: pelatihanStats[0]?.berlangsung || 0,
                    selesai: pelatihanStats[0]?.selesai || 0,
                    totalPeserta: parseInt(pelatihanStats[0]?.total_peserta) || 0,
                    totalHadir: parseInt(pelatihanStats[0]?.total_hadir) || 0,
                    undanganPending,
                    byBulan: pelatihanPerBulan.map(item => ({
                        name: item.name,
                        jadwal: parseInt(item.jadwal) || 0,
                        peserta: parseInt(item.peserta) || 0
                    })),
                    byStatusPelatihan: pelatihanPerStatus.map(item => ({
                        name: item.name,
                        value: item.value,
                        color: item.name === 'Draft' ? '#6B7280' :
                               item.name === 'Publik' ? '#3B82F6' :
                               item.name === 'Berlangsung' ? '#10B981' :
                               item.name === 'Selesai' ? '#8B5CF6' : '#F59E0B'
                    }))
                },
                masterPelatihan: {
                    total: masterTotal[0]?.total || 0,
                    byJenis: masterPerJenis.map(item => ({
                        name: item.name,
                        value: item.value,
                        color: item.name === 'Teknis' ? '#3B82F6' :
                               item.name === 'Manajerial' ? '#10B981' :
                               item.name === 'Sertifikasi' ? '#F59E0B' : '#8B5CF6'
                    }))
                }
            }
        };

        console.log('✅ Sending dashboard response with data:', {
            kompetensiTotal: response.data.kompetensi.total,
            pelatihanTotal: response.data.pelatihan.totalJadwal,
            masterTotal: response.data.masterPelatihan.total
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