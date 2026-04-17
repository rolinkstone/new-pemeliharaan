const express = require('express');
const router = express.Router();
const db = require('../db');
const { keycloakAuth, getUsername } = require('../middleware/keycloakAuth');

// ========== HELPER FUNCTIONS ==========
function getUsernameFromToken(user) {
    return user?.preferred_username || user?.username || 'unknown';
}

// ========== DECODE TOKEN FUNCTION ==========
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

// ========== AUTHORIZATION HELPER YANG LEBIH FLEKSIBEL ==========
function hasRole(user, allowedRoles) {
    if (!user) {
        console.log('❌ User is null or undefined');
        return false;
    }
    
    // Kumpulkan semua roles dari berbagai sumber
    const roles = new Set(); // Gunakan Set untuk menghindari duplikasi
    
    // 1. Dari realm_access (Keycloak standard) - SUDAH ADA DI USER OBJECT
    if (user.realm_access && user.realm_access.roles) {
        user.realm_access.roles.forEach(role => roles.add(role));
    }
    
    // 2. Dari resource_access (alternatif Keycloak)
    if (user.resource_access) {
        Object.values(user.resource_access).forEach(resource => {
            if (resource.roles) {
                resource.roles.forEach(role => roles.add(role));
            }
        });
    }
    
    // 3. Dari field role langsung (custom)
    if (user.role) {
        roles.add(user.role);
    }
    
    // 4. Dari user.role (nested)
    if (user.user && user.user.role) {
        roles.add(user.user.role);
    }
    
    // 5. Dari user.roles (array)
    if (user.roles && Array.isArray(user.roles)) {
        user.roles.forEach(role => roles.add(role));
    }
    
    // 6. BACA DARI ACCESS TOKEN (PENTING!)
    if (user.accessToken) {
        const decodedToken = decodeToken(user.accessToken);
        if (decodedToken) {
            // Dari realm_access dalam token
            if (decodedToken.realm_access && decodedToken.realm_access.roles) {
                decodedToken.realm_access.roles.forEach(role => roles.add(role));
            }
            // Dari resource_access dalam token
            if (decodedToken.resource_access) {
                Object.values(decodedToken.resource_access).forEach(resource => {
                    if (resource.roles) {
                        resource.roles.forEach(role => roles.add(role));
                    }
                });
            }
        }
    }
    
    const rolesArray = Array.from(roles);
    console.log('🔍 User roles detected:', rolesArray);
    console.log('👤 User info:', {
        username: user.preferred_username || user.username || user.email || 'unknown',
        hasRealmAccess: !!user.realm_access,
        hasResourceAccess: !!user.resource_access,
        directRole: user.role,
        hasAccessToken: !!user.accessToken,
        rolesCount: rolesArray.length
    });
    
    // Cek apakah user memiliki salah satu role yang diizinkan
    const hasAccess = allowedRoles.some(role => rolesArray.includes(role));
    console.log(`✅ Allowed roles: ${allowedRoles.join(', ')}`);
    console.log(`📋 Has access: ${hasAccess}`);
    
    if (!hasAccess) {
        console.log(`❌ Access denied. User roles: ${rolesArray.join(', ')}`);
    }
    
    return hasAccess;
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
    // Check if user has admin_pemeliharaan or admin role
    if (!hasRole(req.user, ['admin_pemeliharaan', 'admin', 'superadmin'])) {
        return res.status(403).json({ 
            success: false, 
            message: 'Akses ditolak. Hanya admin_pemeliharaan dan admin yang dapat menambah barang.' 
        });
    }

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
    // Check if user has admin_pemeliharaan or admin role
    if (!hasRole(req.user, ['admin_pemeliharaan', 'admin', 'superadmin'])) {
        return res.status(403).json({ 
            success: false, 
            message: 'Akses ditolak. Hanya admin_pemeliharaan dan admin yang dapat mengubah barang.' 
        });
    }

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
    // Check if user has admin_pemeliharaan or admin role
    if (!hasRole(req.user, ['admin_pemeliharaan', 'admin', 'superadmin'])) {
        return res.status(403).json({ 
            success: false, 
            message: 'Akses ditolak. Hanya admin_pemeliharaan dan admin yang dapat menghapus barang.' 
        });
    }

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

// ========== DEBUG ENDPOINT ==========
router.get('/debug/session', keycloakAuth, async (req, res) => {
    try {
        const decodedToken = req.user.accessToken ? decodeToken(req.user.accessToken) : null;
        
        const roles = new Set();
        
        // Dari user object
        if (req.user.realm_access && req.user.realm_access.roles) {
            req.user.realm_access.roles.forEach(role => roles.add(role));
        }
        if (req.user.role) roles.add(req.user.role);
        
        // Dari token
        if (decodedToken) {
            if (decodedToken.realm_access && decodedToken.realm_access.roles) {
                decodedToken.realm_access.roles.forEach(role => roles.add(role));
            }
        }
        
        res.json({
            success: true,
            data: {
                username: req.user.preferred_username || req.user.username,
                roles: Array.from(roles),
                hasAdminRole: roles.has('admin'),
                hasAdminPemeliharaanRole: roles.has('admin_pemeliharaan'),
                canModify: roles.has('admin') || roles.has('admin_pemeliharaan') || roles.has('superadmin'),
                tokenDecoded: decodedToken ? {
                    realm_access: decodedToken.realm_access,
                    preferred_username: decodedToken.preferred_username
                } : null
            }
        });
    } catch (error) {
        console.error('Error in debug endpoint:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;