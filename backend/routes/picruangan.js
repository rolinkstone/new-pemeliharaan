const express = require('express');
const router = express.Router();
const db = require('../db');
const { keycloakAuth } = require('../middleware/keycloakAuth');
const { 
    getPICUsersFromKeycloak, 
    getAllUsersForPIC,
    getPPKUsersFromKeycloak,
    getAllUsersAndFilterPPK 
} = require('../utils/keycloakHelpers');

function getUsernameFromToken(user) {
    return user?.preferred_username || user?.username || 'unknown';
}

// ========== OPTIONS USERS FROM KEYCLOAK ==========
// backend/routes/picRuangan.js

/**
 * GET /api/picruangan/options/users
 * Mendapatkan daftar user dari Keycloak (dengan filter role)
 */
// backend/routes/picRuangan.js

/**
 * GET /api/picruangan/options/users
 * Mendapatkan daftar user dari Keycloak (dengan filter role)
 */
router.get('/options/users', keycloakAuth, async (req, res) => {
    const { role } = req.query;
    const username = getUsernameFromToken(req.user);
    
    console.log('='.repeat(50));
    console.log('🔍 DEBUG: GET /options/users');
    console.log('   - Request oleh:', username);
    console.log('   - Parameter role:', role);
    console.log('='.repeat(50));
    
    try {
        let users;
        
        if (role === 'pic_ruangan') {
            console.log('📋 Mencari user dengan role: pic_ruangan');
            users = await getUsersByRole('pic_ruangan');
            
            console.log(`✅ Ditemukan ${users.length} user dengan role pic_ruangan`);
            
            if (users.length > 0) {
                console.log('📋 Daftar user:');
                users.forEach((user, index) => {
                    console.log(`   ${index + 1}. ID: ${user.user_id}`);
                    console.log(`      Nama: ${user.nama}`);
                    console.log(`      Username: ${user.username}`);
                    console.log(`      NIP: ${user.nip}`);
                    console.log(`      Jabatan: ${user.jabatan}`);
                    console.log('      ---');
                });
            } else {
                console.log('⚠️ Tidak ada user dengan role pic_ruangan');
                console.log('💡 Tips:');
                console.log('   1. Pastikan role "pic_ruangan" sudah dibuat di Keycloak');
                console.log('   2. Pastikan ada user yang diberikan role tersebut');
                console.log('   3. Cek di Keycloak Admin Console:');
                console.log(`      - Realm: ${KEYCLOAK_CONFIG.realm}`);
                console.log('      - Manage > Users > pilih user > Role Mappings');
            }
        } else {
            console.log('📋 Mengambil semua user (tanpa filter role)');
            users = await getPICUsersFromKeycloak();
            console.log(`✅ Ditemukan ${users.length} total user`);
        }
        
        return res.status(200).json({
            success: true,
            message: 'Daftar user berhasil diambil',
            data: users || [],
            count: users?.length || 0
        });
        
    } catch (error) {
        console.error('❌ Error fetching users:', error);
        console.error('❌ Error stack:', error.stack);
        
        return res.status(500).json({
            success: false,
            message: 'Gagal mengambil daftar user',
            error: error.message,
            stack: error.stack
        });
    }
});

// Fungsi untuk mendapatkan user berdasarkan role
async function getUsersByRole(roleName) {
    console.log(`🔍 Memulai getUsersByRole untuk role: ${roleName}`);
    
    try {
        // Dapatkan admin token
        console.log('📤 Mendapatkan admin token...');
        const adminToken = await getAdminCliToken();
        console.log('✅ Admin token berhasil didapatkan');
        
        // 1. Cari role ID untuk role yang dimaksud
        console.log(`🔍 Mencari role ${roleName} di Keycloak...`);
        const rolesUrl = `${KEYCLOAK_CONFIG.serverUrl}/admin/realms/${KEYCLOAK_CONFIG.realm}/roles`;
        console.log('   URL:', rolesUrl);
        
        const rolesResponse = await axios.get(rolesUrl, {
            headers: { 
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`✅ Mendapatkan ${rolesResponse.data.length} roles dari Keycloak`);
        
        // Log semua role yang ditemukan
        console.log('📋 Daftar role di Keycloak:');
        rolesResponse.data.forEach((r, i) => {
            console.log(`   ${i+1}. ${r.name} (${r.id})`);
        });
        
        const targetRole = rolesResponse.data.find(r => r.name === roleName);
        
        if (!targetRole) {
            console.log(`❌ Role ${roleName} TIDAK DITEMUKAN di Keycloak!`);
            console.log('💡 Solusi: Buat role "pic_ruangan" di Keycloak terlebih dahulu');
            return [];
        }
        
        console.log(`✅ Role ditemukan: ${targetRole.name} (ID: ${targetRole.id})`);
        
        // 2. Ambil users dengan role tersebut
        const usersWithRoleUrl = `${KEYCLOAK_CONFIG.serverUrl}/admin/realms/${KEYCLOAK_CONFIG.realm}/roles/${targetRole.id}/users`;
        console.log(`📤 Mengambil users dari: ${usersWithRoleUrl}`);
        
        const usersResponse = await axios.get(usersWithRoleUrl, {
            headers: { 
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            params: {
                max: 1000
            }
        });
        
        console.log(`📥 Response status: ${usersResponse.status}`);
        console.log(`✅ Ditemukan ${usersResponse.data.length} users dengan role ${roleName} (sebelum filter)`);
        
        // 3. Filter hanya user yang enabled
        const enabledUsers = usersResponse.data.filter(user => user.enabled);
        console.log(`✅ Setelah filter enabled: ${enabledUsers.length} users`);
        
        // 4. Format data user
        const formattedUsers = enabledUsers.map(user => {
            // Format nama
            let nama = '';
            if (user.firstName || user.lastName) {
                nama = `${user.firstName || ''} ${user.lastName || ''}`.trim();
            } else if (user.attributes?.nama_lengkap?.[0]) {
                nama = user.attributes.nama_lengkap[0];
            } else {
                nama = user.username || user.email || 'N/A';
            }
            
            return {
                user_id: user.id,
                username: user.username,
                email: user.email,
                nama: nama,
                nip: user.attributes?.nip?.[0] || 
                     user.attributes?.employee_id?.[0] || 
                     user.attributes?.nomor_induk?.[0] || '',
                jabatan: user.attributes?.jabatan?.[0] || '-',
                unit_kerja: user.attributes?.unit_kerja?.[0] || '-',
                enabled: user.enabled
            };
        });
        
        console.log(`✅ Formatting selesai: ${formattedUsers.length} users`);
        
        // 5. Urutkan berdasarkan nama
        const sortedUsers = formattedUsers.sort((a, b) => a.nama.localeCompare(b.nama));
        
        console.log(`✅ FINAL: ${sortedUsers.length} user dengan role ${roleName}`);
        
        return sortedUsers;
        
    } catch (error) {
        console.error(`❌ Error di getUsersByRole:`, error);
        if (error.response) {
            console.error('Response error:', {
                status: error.response.status,
                data: error.response.data
            });
        }
        throw error;
    }
}
// Fungsi untuk mendapatkan user berdasarkan role
async function getUsersByRole(roleName) {
    try {
        // Dapatkan admin token
        const adminToken = await getAdminCliToken();
        
        // 1. Cari role ID untuk role yang dimaksud
        console.log(`🔍 Mencari role ${roleName} di Keycloak...`);
        const rolesUrl = `${KEYCLOAK_CONFIG.serverUrl}/admin/realms/${KEYCLOAK_CONFIG.realm}/roles`;
        
        const rolesResponse = await axios.get(rolesUrl, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        const targetRole = rolesResponse.data.find(r => r.name === roleName);
        if (!targetRole) {
            console.log(`⚠️ Role ${roleName} tidak ditemukan di Keycloak`);
            return [];
        }
        
        console.log(`✅ Role ditemukan: ${targetRole.name} (ID: ${targetRole.id})`);
        
        // 2. Ambil users dengan role tersebut
        const usersWithRoleUrl = `${KEYCLOAK_CONFIG.serverUrl}/admin/realms/${KEYCLOAK_CONFIG.realm}/roles/${targetRole.id}/users`;
        console.log(`📤 Mengambil users dari: ${usersWithRoleUrl}`);
        
        const usersResponse = await axios.get(usersWithRoleUrl, {
            headers: { 'Authorization': `Bearer ${adminToken}` },
            params: {
                max: 1000 // Batasi jumlah user
            }
        });
        
        console.log(`✅ Ditemukan ${usersResponse.data.length} users dengan role ${roleName}`);
        
        // 3. Format data user
        const formattedUsers = usersResponse.data
            .filter(user => user.enabled) // Hanya user aktif
            .map(user => {
                // Format nama dengan berbagai fallback
                let nama = '';
                
                if (user.firstName || user.lastName) {
                    nama = `${user.firstName || ''} ${user.lastName || ''}`.trim();
                } else if (user.attributes?.nama_lengkap?.[0]) {
                    nama = user.attributes.nama_lengkap[0];
                } else if (user.attributes?.displayName?.[0]) {
                    nama = user.attributes.displayName[0];
                } else {
                    nama = user.username || user.email || 'N/A';
                }
                
                return {
                    user_id: user.id,
                    username: user.username,
                    email: user.email,
                    nama: nama,
                    nip: user.attributes?.nip?.[0] || 
                         user.attributes?.employee_id?.[0] || 
                         user.attributes?.nomor_induk?.[0] || '',
                    jabatan: user.attributes?.jabatan?.[0] || 
                            user.attributes?.position?.[0] || 
                            user.attributes?.title?.[0] || '-',
                    unit_kerja: user.attributes?.unit_kerja?.[0] || 
                               user.attributes?.department?.[0] || 
                               user.attributes?.organisasi?.[0] || '',
                    enabled: user.enabled,
                    email_verified: user.emailVerified
                };
            });
        
        // 4. Urutkan berdasarkan nama
        const sortedUsers = formattedUsers.sort((a, b) => a.nama.localeCompare(b.nama));
        
        console.log(`✅ Final: ${sortedUsers.length} user dengan role ${roleName} siap digunakan`);
        
        return sortedUsers;
        
    } catch (error) {
        console.error(`❌ Error getting users with role ${roleName}:`, error.message);
        
        if (error.response) {
            console.error('Keycloak API Error:', {
                status: error.response.status,
                data: error.response.data
            });
        }
        
        throw error;
    }
}

// Fungsi getAdminCliToken yang diperlukan
async function getAdminCliToken() {
    try {
        const tokenUrl = `${KEYCLOAK_CONFIG.serverUrl}/realms/${KEYCLOAK_CONFIG.realm}/protocol/openid-connect/token`;
        
        const params = new URLSearchParams();
        params.append('client_id', KEYCLOAK_CONFIG.adminClientId);
        params.append('client_secret', KEYCLOAK_CONFIG.adminClientSecret);
        params.append('grant_type', 'client_credentials');
        
        const response = await axios.post(tokenUrl, params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        
        return response.data.access_token;
    } catch (error) {
        console.error('❌ Error getting admin token:', error.message);
        throw error;
    }
}

// ========== GET ALL PIC RUANGAN ==========
router.get('/', keycloakAuth, async (req, res) => {
    try {
        const { ruangan_id, status, user_id, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        
        let query = `
            SELECT pr.*, 
                   r.kode_ruangan, r.nama_ruangan, r.lokasi
            FROM pic_ruangan pr
            LEFT JOIN ruangan r ON pr.ruangan_id = r.id
            WHERE 1=1
        `;
        const params = [];
        
        if (ruangan_id) {
            query += ' AND pr.ruangan_id = ?';
            params.push(ruangan_id);
        }
        
        if (status) {
            query += ' AND pr.status = ?';
            params.push(status);
        }
        
        if (user_id) {
            query += ' AND pr.user_id = ?';
            params.push(user_id);
        }
        
        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total
            FROM pic_ruangan pr
            WHERE 1=1
            ${ruangan_id ? ' AND pr.ruangan_id = ?' : ''}
            ${status ? ' AND pr.status = ?' : ''}
            ${user_id ? ' AND pr.user_id = ?' : ''}
        `;
        const countParams = [];
        if (ruangan_id) countParams.push(ruangan_id);
        if (status) countParams.push(status);
        if (user_id) countParams.push(user_id);
        
        const [countResult] = await db.query(countQuery, countParams);
        const total = countResult && countResult[0] ? countResult[0].total : 0;
        
        query += ' ORDER BY pr.tgl_penugasan DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const [rows] = await db.query(query, params);
        
        // OPTIMASI: Hanya ambil user dari Keycloak jika ada data
        if (rows.length === 0) {
            return res.json({
                success: true,
                data: [],
                pagination: {
                    currentPage: parseInt(page),
                    perPage: parseInt(limit),
                    total: 0,
                    totalPages: 0
                }
            });
        }
        
        // OPTIMASI: Ambil hanya user_id yang muncul di data
        const uniqueUserIds = [...new Set(rows.map(row => row.user_id))];
        
        // Ambil user dari Keycloak (bisa di-cache)
        let userMap = {};
        try {
            // Coba ambil dari cache atau database lokal dulu
            // Idealnya, simpan data user di tabel lokal dan sinkronisasi periodik
            const users = await getPICUsersFromKeycloak();
            
            // Buat map untuk quick lookup
            users.forEach(user => {
                userMap[user.user_id] = user;
            });
            
            console.log(`✅ Loaded ${Object.keys(userMap).length} users from Keycloak`);
        } catch (error) {
            console.error('Error fetching users from Keycloak:', error);
            // Fallback: gunakan user_id sebagai nama
            uniqueUserIds.forEach(id => {
                userMap[id] = { nama: id, nip: '-', email: '-', jabatan: '-' };
            });
        }
        
        // Format data untuk dikirim
        const picUsers = rows.map(row => ({
            id: row.id,
            user_id: row.user_id,
            ruangan_id: row.ruangan_id,
            tgl_penugasan: row.tgl_penugasan,
            tgl_berakhir: row.tgl_berakhir,
            status: row.status,
            created_at: row.created_at,
            
            // Data user dari Keycloak (dengan fallback)
            user_nama: userMap[row.user_id]?.nama || row.user_id,
            user_nip: userMap[row.user_id]?.nip || '-',
            user_email: userMap[row.user_id]?.email || '-',
            user_jabatan: userMap[row.user_id]?.jabatan || '-',
            
            // Data ruangan
            ruangan_nama: row.nama_ruangan || `Ruangan ID: ${row.ruangan_id}`,
            ruangan_kode: row.kode_ruangan || '',
            ruangan_lokasi: row.lokasi || ''
        }));
        
        res.json({
            success: true,
            data: picUsers,
            pagination: {
                currentPage: parseInt(page),
                perPage: parseInt(limit),
                total: total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching PIC ruangan:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal mengambil data PIC ruangan',
            error: error.message 
        });
    }
});

// ========== GET SINGLE PIC RUANGAN BY ID ==========
router.get('/:id', keycloakAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        const [rows] = await db.query(`
            SELECT pr.*, 
                   r.kode_ruangan, r.nama_ruangan, r.lokasi
            FROM pic_ruangan pr
            LEFT JOIN ruangan r ON pr.ruangan_id = r.id
            WHERE pr.id = ?
        `, [id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Data PIC ruangan tidak ditemukan' 
            });
        }
        
        // Get user details from Keycloak
        let userDetail = null;
        try {
            const users = await getPPKUsersFromKeycloak();
            userDetail = users.find(u => u.user_id === rows[0].user_id) || null;
        } catch (error) {
            console.error('Error fetching user from Keycloak:', error);
        }
        
        res.json({
            success: true,
            data: {
                ...rows[0],
                user_detail: userDetail,
                user_nama: userDetail?.nama || rows[0].user_id,
                user_nip: userDetail?.nip || '-',
                user_email: userDetail?.email || '-',
                user_jabatan: userDetail?.jabatan || '-'
            }
        });
    } catch (error) {
        console.error('Error fetching PIC ruangan:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// ========== GET PIC BY USER ID ==========
router.get('/user/:userId', keycloakAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        
        const [rows] = await db.query(`
            SELECT pr.*, 
                   r.kode_ruangan, r.nama_ruangan, r.lokasi
            FROM pic_ruangan pr
            LEFT JOIN ruangan r ON pr.ruangan_id = r.id
            WHERE pr.user_id = ? AND pr.status = 'aktif'
            ORDER BY pr.tgl_penugasan DESC
        `, [userId]);
        
        res.json({
            success: true,
            data: rows || []
        });
    } catch (error) {
        console.error('Error fetching PIC by user:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal mengambil data PIC',
            error: error.message 
        });
    }
});

// ========== GET PIC BY RUANGAN ==========
router.get('/ruangan/:ruanganId', keycloakAuth, async (req, res) => {
    try {
        const { ruanganId } = req.params;
        
        const [rows] = await db.query(`
            SELECT pr.*, 
                   r.kode_ruangan, r.nama_ruangan, r.lokasi
            FROM pic_ruangan pr
            LEFT JOIN ruangan r ON pr.ruangan_id = r.id
            WHERE pr.ruangan_id = ? AND pr.status = 'aktif'
            ORDER BY pr.tgl_penugasan DESC
        `, [ruanganId]);
        
        res.json({
            success: true,
            data: rows || []
        });
    } catch (error) {
        console.error('Error fetching PIC by ruangan:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal mengambil data PIC',
            error: error.message 
        });
    }
});

// ========== CREATE PIC RUANGAN ==========
router.post('/', keycloakAuth, async (req, res) => {
    try {
        const { user_id, ruangan_id, tgl_penugasan, tgl_berakhir, status } = req.body;

        if (!user_id || !ruangan_id || !tgl_penugasan) {
            return res.status(400).json({ 
                success: false, 
                message: 'User ID, Ruangan ID, dan Tanggal Penugasan harus diisi' 
            });
        }

        // Check if ruangan exists
        const [ruangan] = await db.query('SELECT id FROM ruangan WHERE id = ?', [ruangan_id]);
        if (ruangan.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Ruangan tidak ditemukan' 
            });
        }

        // Check if user already has active assignment for this room
        const [existing] = await db.query(
            'SELECT id FROM pic_ruangan WHERE user_id = ? AND ruangan_id = ? AND status = "aktif"',
            [user_id, ruangan_id]
        );
        
        if (existing.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'User sudah ditugaskan di ruangan ini' 
            });
        }

        const username = getUsernameFromToken(req.user);

        const [result] = await db.query(
            `INSERT INTO pic_ruangan (user_id, ruangan_id, tgl_penugasan, tgl_berakhir, status) 
             VALUES (?, ?, ?, ?, ?)`,
            [user_id, ruangan_id, tgl_penugasan, tgl_berakhir || null, status || 'aktif']
        );

        res.status(201).json({
            success: true,
            message: 'PIC ruangan berhasil ditambahkan',
            data: {
                id: result.insertId,
                user_id,
                ruangan_id,
                tgl_penugasan,
                tgl_berakhir,
                status: status || 'aktif'
            },
            createdBy: username
        });
    } catch (error) {
        console.error('Error creating PIC ruangan:', error);
        
        // Check for duplicate entry error
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ 
                success: false, 
                message: 'Data PIC ruangan sudah ada' 
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Gagal menambahkan PIC ruangan',
            error: error.message 
        });
    }
});

// ========== UPDATE PIC RUANGAN ==========
router.put('/:id', keycloakAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { ruangan_id, tgl_penugasan, tgl_berakhir, status } = req.body;

        // Check if data exists
        const [existing] = await db.query('SELECT id FROM pic_ruangan WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Data PIC ruangan tidak ditemukan' 
            });
        }

        const username = getUsernameFromToken(req.user);

        await db.query(
            `UPDATE pic_ruangan 
             SET ruangan_id = ?, tgl_penugasan = ?, tgl_berakhir = ?, status = ?
             WHERE id = ?`,
            [ruangan_id, tgl_penugasan, tgl_berakhir, status, id]
        );

        res.json({
            success: true,
            message: 'Data PIC ruangan berhasil diperbarui',
            updatedBy: username
        });
    } catch (error) {
        console.error('Error updating PIC ruangan:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal memperbarui data',
            error: error.message 
        });
    }
});

// ========== DELETE PIC RUANGAN ==========
router.delete('/:id', keycloakAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await db.query('DELETE FROM pic_ruangan WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Data PIC ruangan tidak ditemukan' 
            });
        }

        const username = getUsernameFromToken(req.user);

        res.json({
            success: true,
            message: 'Data PIC ruangan berhasil dihapus',
            deletedBy: username
        });
    } catch (error) {
        console.error('Error deleting PIC ruangan:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal menghapus data',
            error: error.message 
        });
    }
});

// ========== GET AKTIF PIC ==========
router.get('/status/aktif', keycloakAuth, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT pr.*, 
                   r.kode_ruangan, r.nama_ruangan, r.lokasi
            FROM pic_ruangan pr
            LEFT JOIN ruangan r ON pr.ruangan_id = r.id
            WHERE pr.status = 'aktif'
            ORDER BY pr.tgl_penugasan DESC
        `);
        
        res.json({
            success: true,
            data: rows || []
        });
    } catch (error) {
        console.error('Error fetching aktif PIC:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal mengambil data PIC aktif',
            error: error.message 
        });
    }
});

// ========== GET STATISTICS ==========
router.get('/statistics', keycloakAuth, async (req, res) => {
    try {
        const [total] = await db.query('SELECT COUNT(*) as total FROM pic_ruangan');
        const [aktif] = await db.query('SELECT COUNT(*) as total FROM pic_ruangan WHERE status = "aktif"');
        const [nonaktif] = await db.query('SELECT COUNT(*) as total FROM pic_ruangan WHERE status = "nonaktif"');
        const [uniqueUsers] = await db.query('SELECT COUNT(DISTINCT user_id) as total FROM pic_ruangan');
        const [uniqueRooms] = await db.query('SELECT COUNT(DISTINCT ruangan_id) as total FROM pic_ruangan');
        
        res.json({
            success: true,
            data: {
                total: total[0]?.total || 0,
                aktif: aktif[0]?.total || 0,
                nonaktif: nonaktif[0]?.total || 0,
                unique_users: uniqueUsers[0]?.total || 0,
                unique_rooms: uniqueRooms[0]?.total || 0
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

// ========== OPTIONS RUANGAN ==========
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