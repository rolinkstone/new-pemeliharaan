// backend/routes/picRuangan.js

const express = require('express');
const router = express.Router();
const db = require('../db');
const { keycloakAuth, getUsername } = require('../middleware/keycloakAuth');
const axios = require('axios');

// ========== KEYCLOAK CONFIGURATION FROM ENV ==========
const KEYCLOAK_CONFIG = {
    serverUrl: process.env.KEYCLOAK_SERVER_URL,
    realm: process.env.KEYCLOAK_REALM,
    adminUsername: process.env.KEYCLOAK_ADMIN_USERNAME,
    adminPassword: process.env.KEYCLOAK_ADMIN_PASSWORD,
    adminClientId: process.env.KEYCLOAK_ADMIN_CLIENT_ID || 'admin-cli',
};

// ========== HELPER FUNCTIONS ==========
function getUsernameFromToken(user) {
    return user?.preferred_username || user?.username || 'unknown';
}

function decodeToken(token) {
    try {
        if (!token) return null;
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(Buffer.from(base64, 'base64').toString());
        return payload;
    } catch (error) {
        console.error('Error decoding token:', error.message);
        return null;
    }
}

// ========== DATE FORMATTING HELPER ==========
function formatDateForMySQL(dateValue) {
    if (!dateValue) return null;
    if (typeof dateValue === 'string' && dateValue.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
        return dateValue;
    }
    if (typeof dateValue === 'string' && dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return `${dateValue} 00:00:00`;
    }
    try {
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) return null;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch (error) {
        return null;
    }
}

// ========== IMPROVED AUTHORIZATION HELPER ==========
function getUserRolesFromRequest(req) {
    const roles = new Set();
    
    if (req.user) {
        if (req.user.realm_access && req.user.realm_access.roles) {
            req.user.realm_access.roles.forEach(role => roles.add(role));
        }
        if (req.user.resource_access) {
            Object.values(req.user.resource_access).forEach(resource => {
                if (resource.roles) {
                    resource.roles.forEach(role => roles.add(role));
                }
            });
        }
        if (req.user.role) {
            roles.add(req.user.role);
        }
        if (req.user.user && req.user.user.role) {
            roles.add(req.user.user.role);
        }
    }
    
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const decodedToken = decodeToken(token);
        if (decodedToken) {
            if (decodedToken.realm_access && decodedToken.realm_access.roles) {
                decodedToken.realm_access.roles.forEach(role => roles.add(role));
            }
            if (decodedToken.resource_access) {
                Object.values(decodedToken.resource_access).forEach(resource => {
                    if (resource.roles) {
                        resource.roles.forEach(role => roles.add(role));
                    }
                });
            }
        }
    }
    
    return Array.from(roles);
}

function hasRole(req, allowedRoles) {
    const roles = getUserRolesFromRequest(req);
    const hasAccess = allowedRoles.some(role => roles.includes(role));
    return hasAccess;
}

function canModifyData(req) {
    return hasRole(req, ['admin_pemeliharaan', 'admin', 'superadmin']);
}

// ========== GET ADMIN TOKEN ==========
async function getAdminToken() {
    if (!KEYCLOAK_CONFIG.serverUrl || !KEYCLOAK_CONFIG.realm || !KEYCLOAK_CONFIG.adminUsername || !KEYCLOAK_CONFIG.adminPassword) {
        return null;
    }
    try {
        const tokenUrl = `${KEYCLOAK_CONFIG.serverUrl}/realms/${KEYCLOAK_CONFIG.realm}/protocol/openid-connect/token`;
        const params = new URLSearchParams();
        params.append('client_id', KEYCLOAK_CONFIG.adminClientId);
        params.append('grant_type', 'password');
        params.append('username', KEYCLOAK_CONFIG.adminUsername);
        params.append('password', KEYCLOAK_CONFIG.adminPassword);
        const response = await axios.post(tokenUrl, params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 10000
        });
        return response.data.access_token;
    } catch (error) {
        console.error('❌ Error getting admin token:', error.message);
        return null;
    }
}

// ========== CACHE FOR USER OPTIONS ==========
let cachedUsers = null;
let cacheTimestamp = null;
const CACHE_TTL = 10 * 60 * 1000; // 10 menit

// ========== GET USERS BY ROLE WITH CACHE ==========
async function getUsersByRole(roleName, forceRefresh = false) {
    if (!forceRefresh && cachedUsers && cacheTimestamp && (Date.now() - cacheTimestamp) < CACHE_TTL) {
        console.log('📦 Using cached users');
        return cachedUsers;
    }
    
    try {
        const adminToken = await getAdminToken();
        if (!adminToken) return [];
        
        const usersUrl = `${KEYCLOAK_CONFIG.serverUrl}/admin/realms/${KEYCLOAK_CONFIG.realm}/users`;
        const usersResponse = await axios.get(usersUrl, {
            headers: { 'Authorization': `Bearer ${adminToken}` },
            params: { max: 100 },
            timeout: 15000
        });
        
        const usersWithRole = [];
        
        const userPromises = usersResponse.data
            .filter(user => user.enabled)
            .map(async (user) => {
                try {
                    const userRolesUrl = `${KEYCLOAK_CONFIG.serverUrl}/admin/realms/${KEYCLOAK_CONFIG.realm}/users/${user.id}/role-mappings/realm`;
                    const rolesResponse = await axios.get(userRolesUrl, {
                        headers: { 'Authorization': `Bearer ${adminToken}` },
                        timeout: 5000
                    });
                    const userRoles = rolesResponse.data.map(r => r.name);
                    
                    if (userRoles.includes(roleName)) {
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
                            nip: user.attributes?.nip?.[0] || '',
                            jabatan: user.attributes?.jabatan?.[0] || '-',
                            unit_kerja: user.attributes?.unit_kerja?.[0] || '-',
                        };
                    }
                } catch (err) {
                    console.error(`Error getting roles for user ${user.username}:`, err.message);
                }
                return null;
            });
        
        const results = await Promise.all(userPromises);
        results.forEach(result => {
            if (result) usersWithRole.push(result);
        });
        
        const sortedUsers = usersWithRole.sort((a, b) => a.nama.localeCompare(b.nama));
        
        cachedUsers = sortedUsers;
        cacheTimestamp = Date.now();
        
        return sortedUsers;
    } catch (error) {
        console.error(`❌ Error:`, error.message);
        return cachedUsers || [];
    }
}

// ========== OPTIONS USERS (Semua user bisa akses) ==========
router.get('/options/users', keycloakAuth, async (req, res) => {
    const { role } = req.query;
    
    try {
        let users = [];
        
        if (role === 'pic_ruangan') {
            users = await getUsersByRole('pic_ruangan');
            
            if (users.length === 0 && req.user) {
                let nama = req.user.name || req.user.preferred_username || req.user.username || 'User';
                users = [{
                    user_id: req.user.id || req.user.sub,
                    username: req.user.username || req.user.preferred_username,
                    email: req.user.email,
                    nama: nama,
                    nip: req.user.attributes?.nip || req.user.nip || '',
                    jabatan: req.user.attributes?.jabatan || req.user.jabatan || '-',
                    unit_kerja: req.user.attributes?.unit_kerja || req.user.unit_kerja || '-',
                }];
            }
        }
        
        return res.status(200).json({
            success: true,
            message: 'Daftar user berhasil diambil',
            data: users || [],
            count: users?.length || 0
        });
    } catch (error) {
        console.error('❌ Error fetching users:', error);
        return res.status(500).json({
            success: false,
            message: 'Gagal mengambil daftar user',
            error: error.message,
            data: []
        });
    }
});

// ========== OPTIONS RUANGAN (Semua user bisa akses) ==========
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

// ========== GET STATISTICS (Semua user bisa akses) ==========
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

// ========== GET ALL PIC RUANGAN (Semua user bisa akses) ==========
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
        if (status && status !== 'all') {
            query += ' AND pr.status = ?';
            params.push(status);
        }
        if (user_id) {
            query += ' AND pr.user_id = ?';
            params.push(user_id);
        }
        
        const countQuery = query.replace('SELECT pr.*, r.kode_ruangan, r.nama_ruangan, r.lokasi', 'SELECT COUNT(*) as total');
        const [countResult] = await db.query(countQuery, params);
        const total = countResult[0]?.total || 0;
        
        query += ' ORDER BY pr.tgl_penugasan DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const [rows] = await db.query(query, params);
        
        // Format response dengan user_name dari database
        const formattedRows = rows.map(row => ({
            id: row.id,
            user_id: row.user_id,
            user_name: row.user_name || `User ID: ${row.user_id}`,
            ruangan_id: row.ruangan_id,
            tgl_penugasan: row.tgl_penugasan,
            tgl_berakhir: row.tgl_berakhir,
            status: row.status,
            created_at: row.created_at,
            ruangan_nama: row.nama_ruangan || `Ruangan ID: ${row.ruangan_id}`,
            ruangan_kode: row.kode_ruangan || '',
            ruangan_lokasi: row.lokasi || ''
        }));
        
        res.json({
            success: true,
            data: formattedRows,
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

// ========== GET SINGLE PIC RUANGAN BY ID (Semua user bisa akses) ==========
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
        
        res.json({
            success: true,
            data: {
                ...rows[0],
                user_name: rows[0].user_name || `User ID: ${rows[0].user_id}`
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

// ========== GET PIC BY USER ID (Semua user bisa akses) ==========
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

// ========== GET PIC BY RUANGAN (Semua user bisa akses) ==========
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

// ========== GET AKTIF PIC (Semua user bisa akses) ==========
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

// ========== CREATE PIC RUANGAN (Hanya admin_pemeliharaan dan admin) ==========
router.post('/', keycloakAuth, async (req, res) => {
    if (!canModifyData(req)) {
        console.log('❌ Create PIC ruangan: Access denied');
        return res.status(403).json({
            success: false,
            message: 'Akses ditolak. Hanya admin_pemeliharaan dan admin yang dapat menambah PIC ruangan.'
        });
    }

    try {
        let { user_id, user_name, ruangan_id, tgl_penugasan, tgl_berakhir, status } = req.body;

        console.log('📝 CREATE Request - Body:', { user_id, user_name, ruangan_id, tgl_penugasan, tgl_berakhir, status });

        // Validasi required fields
        if (!user_id) {
            return res.status(400).json({ 
                success: false, 
                message: 'User ID harus diisi' 
            });
        }
        if (!user_name) {
            return res.status(400).json({ 
                success: false, 
                message: 'Nama PIC harus diisi' 
            });
        }
        if (!ruangan_id) {
            return res.status(400).json({ 
                success: false, 
                message: 'Ruangan ID harus diisi' 
            });
        }
        if (!tgl_penugasan) {
            return res.status(400).json({ 
                success: false, 
                message: 'Tanggal penugasan harus diisi' 
            });
        }

        const formattedTglPenugasan = formatDateForMySQL(tgl_penugasan);
        const formattedTglBerakhir = formatDateForMySQL(tgl_berakhir);

        const [ruangan] = await db.query('SELECT id FROM ruangan WHERE id = ?', [ruangan_id]);
        if (ruangan.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Ruangan tidak ditemukan' 
            });
        }

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

        // Insert dengan menyertakan user_name
        const [result] = await db.query(
            `INSERT INTO pic_ruangan (user_id, user_name, ruangan_id, tgl_penugasan, tgl_berakhir, status) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [user_id, user_name, ruangan_id, formattedTglPenugasan, formattedTglBerakhir, status || 'aktif']
        );

        console.log(`✅ PIC ruangan created by ${username}: ${user_name} (${user_id}) -> Ruangan ${ruangan_id}`);

        res.status(201).json({
            success: true,
            message: 'PIC ruangan berhasil ditambahkan',
            data: {
                id: result.insertId,
                user_id,
                user_name,
                ruangan_id,
                tgl_penugasan: formattedTglPenugasan,
                tgl_berakhir: formattedTglBerakhir,
                status: status || 'aktif'
            },
            createdBy: username
        });
    } catch (error) {
        console.error('Error creating PIC ruangan:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal menambahkan PIC ruangan',
            error: error.message 
        });
    }
});

// ========== UPDATE PIC RUANGAN (Hanya admin_pemeliharaan dan admin) ==========
router.put('/:id', keycloakAuth, async (req, res) => {
    if (!canModifyData(req)) {
        console.log('❌ Update PIC ruangan: Access denied');
        return res.status(403).json({
            success: false,
            message: 'Akses ditolak. Hanya admin_pemeliharaan dan admin yang dapat mengubah PIC ruangan.'
        });
    }

    try {
        const { id } = req.params;
        let { user_id, user_name, ruangan_id, tgl_penugasan, tgl_berakhir, status } = req.body;

        console.log('📝 UPDATE Request - ID:', id);
        console.log('📝 UPDATE Request - Body:', { user_id, user_name, ruangan_id, tgl_penugasan, tgl_berakhir, status });

        // Validasi required fields
        if (!user_id) {
            return res.status(400).json({ success: false, message: 'User ID harus diisi' });
        }
        if (!user_name) {
            return res.status(400).json({ success: false, message: 'Nama PIC harus diisi' });
        }
        if (!ruangan_id) {
            return res.status(400).json({ success: false, message: 'Ruangan ID harus diisi' });
        }
        if (!tgl_penugasan) {
            return res.status(400).json({ success: false, message: 'Tanggal penugasan harus diisi' });
        }

        const [existing] = await db.query('SELECT * FROM pic_ruangan WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Data PIC ruangan tidak ditemukan' 
            });
        }

        const formattedTglPenugasan = formatDateForMySQL(tgl_penugasan);
        const formattedTglBerakhir = formatDateForMySQL(tgl_berakhir);

        const username = getUsernameFromToken(req.user);

        await db.query(
            `UPDATE pic_ruangan 
             SET user_id = ?, user_name = ?, ruangan_id = ?, tgl_penugasan = ?, tgl_berakhir = ?, status = ?
             WHERE id = ?`,
            [user_id, user_name, ruangan_id, formattedTglPenugasan, formattedTglBerakhir, status || 'aktif', id]
        );

        console.log(`✅ PIC ruangan updated by ${username}: ID ${id}`);

        res.json({
            success: true,
            message: 'Data PIC ruangan berhasil diperbarui',
            updatedBy: username
        });
    } catch (error) {
        console.error('❌ Error updating PIC ruangan:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal memperbarui data: ' + error.message,
            error: error.message 
        });
    }
});

// ========== DELETE PIC RUANGAN (Hanya admin_pemeliharaan dan admin) ==========
router.delete('/:id', keycloakAuth, async (req, res) => {
    if (!canModifyData(req)) {
        console.log('❌ Delete PIC ruangan: Access denied');
        return res.status(403).json({
            success: false,
            message: 'Akses ditolak. Hanya admin_pemeliharaan dan admin yang dapat menghapus PIC ruangan.'
        });
    }

    try {
        const { id } = req.params;
        
        const [existing] = await db.query('SELECT id FROM pic_ruangan WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Data PIC ruangan tidak ditemukan' 
            });
        }

        const [result] = await db.query('DELETE FROM pic_ruangan WHERE id = ?', [id]);
        
        const username = getUsernameFromToken(req.user);
        
        console.log(`✅ PIC ruangan deleted by ${username}: ID ${id}`);

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

// ========== DEBUG ENDPOINT ==========
router.get('/debug/session', keycloakAuth, async (req, res) => {
    try {
        const roles = getUserRolesFromRequest(req);
        res.json({
            success: true,
            data: {
                username: req.user?.preferred_username || req.user?.username || 'unknown',
                roles: roles,
                hasAdminRole: roles.includes('admin'),
                hasAdminPemeliharaanRole: roles.includes('admin_pemeliharaan'),
                canModify: roles.includes('admin') || roles.includes('admin_pemeliharaan') || roles.includes('superadmin')
            }
        });
    } catch (error) {
        console.error('Error in debug endpoint:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;