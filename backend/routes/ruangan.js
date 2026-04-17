// backend/routes/ruangan.js

const express = require('express');
const router = express.Router();
const db = require('../db');
const { keycloakAuth, getUsername } = require('../middleware/keycloakAuth');

// ========== HELPER FUNCTIONS ==========
function getUsernameFromToken(user) {
    return user?.preferred_username || user?.username || 'unknown';
}

// Decode token function
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

// ========== IMPROVED AUTHORIZATION HELPER ==========
function getUserRolesFromRequest(req) {
    const roles = new Set();
    
    // 1. Dari user object yang sudah diparse oleh keycloakAuth
    if (req.user) {
        // Dari realm_access
        if (req.user.realm_access && req.user.realm_access.roles) {
            req.user.realm_access.roles.forEach(role => roles.add(role));
        }
        
        // Dari resource_access
        if (req.user.resource_access) {
            Object.values(req.user.resource_access).forEach(resource => {
                if (resource.roles) {
                    resource.roles.forEach(role => roles.add(role));
                }
            });
        }
        
        // Dari field role langsung
        if (req.user.role) {
            roles.add(req.user.role);
        }
        
        // Dari user.user.role (nested)
        if (req.user.user && req.user.user.role) {
            roles.add(req.user.user.role);
        }
    }
    
    // 2. Dari header Authorization (token JWT)
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
    console.log('🔍 Ruangan - Detected roles:', roles);
    console.log('✅ Ruangan - Allowed roles:', allowedRoles);
    
    const hasAccess = allowedRoles.some(role => roles.includes(role));
    console.log('📋 Ruangan - Has access:', hasAccess);
    
    return hasAccess;
}

function canModifyData(req) {
    return hasRole(req, ['admin_pemeliharaan', 'admin', 'superadmin']);
}

// ========== PENTING: ENDPOINT KHUSUS HARUS DI ATAS ENDPOINT DINAMIS ==========

// GET /api/ruangan/statistics - ENDPOINT KHUSUS (Semua user bisa akses)
router.get('/statistics', keycloakAuth, async (req, res) => {
  console.log('📊 Statistics endpoint accessed');
  try {
    const [total] = await db.query('SELECT COUNT(*) as total FROM ruangan');
    const [aktif] = await db.query('SELECT COUNT(*) as total FROM ruangan WHERE is_active = 1');
    const [tidakAktif] = await db.query('SELECT COUNT(*) as total FROM ruangan WHERE is_active = 0');
    
    res.json({
      success: true,
      data: {
        total: total[0].total,
        aktif: aktif[0].total,
        tidak_aktif: tidakAktif[0].total
      }
    });
  } catch (error) {
    console.error('Error fetching ruangan statistics:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Gagal mengambil statistik ruangan',
      error: error.message 
    });
  }
});

// GET /api/ruangan/status/aktif - ENDPOINT KHUSUS (Semua user bisa akses)
router.get('/status/aktif', keycloakAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM ruangan WHERE is_active = 1 ORDER BY kode_ruangan ASC'
    );
    
    res.json({
      success: true,
      data: rows,
      total: rows.length
    });
  } catch (error) {
    console.error('Error fetching active ruangan:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Gagal mengambil ruangan aktif',
      error: error.message 
    });
  }
});

// GET /api/ruangan/search/:keyword - ENDPOINT KHUSUS (Semua user bisa akses)
router.get('/search/:keyword', keycloakAuth, async (req, res) => {
  try {
    const { keyword } = req.params;
    const searchTerm = `%${keyword}%`;
    
    const [rows] = await db.query(
      `SELECT * FROM ruangan 
       WHERE kode_ruangan LIKE ? 
          OR nama_ruangan LIKE ? 
          OR lokasi LIKE ?
       ORDER BY kode_ruangan ASC`,
      [searchTerm, searchTerm, searchTerm]
    );
    
    res.json({
      success: true,
      data: rows,
      total: rows.length
    });
  } catch (error) {
    console.error('Error searching ruangan:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Gagal mencari ruangan',
      error: error.message 
    });
  }
});

// ========== ENDPOINT DINAMIS (HARUS DI BAWAH) ==========

// GET /api/ruangan - Get all ruangan (Semua user bisa akses)
router.get('/', keycloakAuth, async (req, res) => {
  try {
    const { search, is_active, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM ruangan WHERE 1=1';
    const params = [];
    
    if (search) {
      query += ' AND (kode_ruangan LIKE ? OR nama_ruangan LIKE ? OR lokasi LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (is_active !== undefined && is_active !== 'all' && is_active !== '') {
      query += ' AND is_active = ?';
      params.push(is_active);
    }
    
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    const [countResult] = await db.query(countQuery, params);
    const total = countResult[0].total;
    
    query += ' ORDER BY kode_ruangan ASC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const [rows] = await db.query(query, params);
    
    res.json({
      success: true,
      data: rows,
      pagination: {
        currentPage: parseInt(page),
        perPage: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching ruangan:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Gagal mengambil data ruangan',
      error: error.message 
    });
  }
});

// GET /api/ruangan/:id - Get ruangan by ID (Semua user bisa akses)
router.get('/:id', keycloakAuth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM ruangan WHERE id = ?', [req.params.id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Ruangan tidak ditemukan' 
      });
    }
    
    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('Error fetching ruangan:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Gagal mengambil data ruangan',
      error: error.message 
    });
  }
});

// POST /api/ruangan - Create ruangan (Hanya admin_pemeliharaan dan admin)
router.post('/', keycloakAuth, async (req, res) => {
  // Check access rights
  if (!canModifyData(req)) {
    console.log('❌ Create ruangan: Access denied');
    return res.status(403).json({
      success: false,
      message: 'Akses ditolak. Hanya admin_pemeliharaan dan admin yang dapat menambah ruangan.'
    });
  }

  try {
    const { kode_ruangan, nama_ruangan, deskripsi, lokasi, is_active } = req.body;
    
    if (!kode_ruangan || !nama_ruangan) {
      return res.status(400).json({
        success: false,
        message: 'Kode ruangan dan nama ruangan harus diisi'
      });
    }
    
    const [existing] = await db.query(
      'SELECT id FROM ruangan WHERE kode_ruangan = ?', 
      [kode_ruangan]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Kode ruangan sudah digunakan' 
      });
    }
    
    const username = getUsernameFromToken(req.user);
    
    const [result] = await db.query(
      `INSERT INTO ruangan (kode_ruangan, nama_ruangan, deskripsi, lokasi, is_active) 
       VALUES (?, ?, ?, ?, ?)`,
      [kode_ruangan, nama_ruangan, deskripsi || null, lokasi || null, is_active !== undefined ? is_active : 1]
    );
    
    console.log(`✅ Ruangan created by ${username}: ${kode_ruangan} - ${nama_ruangan}`);
    
    res.status(201).json({
      success: true,
      message: 'Ruangan berhasil ditambahkan',
      data: { 
        id: result.insertId, 
        kode_ruangan, 
        nama_ruangan, 
        deskripsi, 
        lokasi, 
        is_active: is_active !== undefined ? is_active : 1 
      },
      createdBy: username
    });
  } catch (error) {
    console.error('Error creating ruangan:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Gagal menambahkan ruangan',
      error: error.message 
    });
  }
});

// PUT /api/ruangan/:id - Update ruangan (Hanya admin_pemeliharaan dan admin)
router.put('/:id', keycloakAuth, async (req, res) => {
  // Check access rights
  if (!canModifyData(req)) {
    console.log('❌ Update ruangan: Access denied');
    return res.status(403).json({
      success: false,
      message: 'Akses ditolak. Hanya admin_pemeliharaan dan admin yang dapat mengubah ruangan.'
    });
  }

  try {
    const { kode_ruangan, nama_ruangan, deskripsi, lokasi, is_active } = req.body;
    const { id } = req.params;
    
    if (!kode_ruangan || !nama_ruangan) {
      return res.status(400).json({
        success: false,
        message: 'Kode ruangan dan nama ruangan harus diisi'
      });
    }
    
    const [existing] = await db.query('SELECT id FROM ruangan WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Ruangan tidak ditemukan' 
      });
    }
    
    const [duplicate] = await db.query(
      'SELECT id FROM ruangan WHERE kode_ruangan = ? AND id != ?', 
      [kode_ruangan, id]
    );
    
    if (duplicate.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Kode ruangan sudah digunakan' 
      });
    }
    
    const username = getUsernameFromToken(req.user);
    
    await db.query(
      `UPDATE ruangan 
       SET kode_ruangan = ?, nama_ruangan = ?, deskripsi = ?, lokasi = ?, is_active = ?
       WHERE id = ?`,
      [kode_ruangan, nama_ruangan, deskripsi || null, lokasi || null, is_active, id]
    );
    
    console.log(`✅ Ruangan updated by ${username}: ${kode_ruangan} - ${nama_ruangan}`);
    
    res.json({
      success: true,
      message: 'Ruangan berhasil diperbarui',
      data: { id, kode_ruangan, nama_ruangan, deskripsi, lokasi, is_active },
      updatedBy: username
    });
  } catch (error) {
    console.error('Error updating ruangan:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Gagal memperbarui ruangan',
      error: error.message 
    });
  }
});

// DELETE /api/ruangan/:id - Delete ruangan (Hanya admin_pemeliharaan dan admin)
router.delete('/:id', keycloakAuth, async (req, res) => {
  // Check access rights
  if (!canModifyData(req)) {
    console.log('❌ Delete ruangan: Access denied');
    return res.status(403).json({
      success: false,
      message: 'Akses ditolak. Hanya admin_pemeliharaan dan admin yang dapat menghapus ruangan.'
    });
  }

  try {
    const { id } = req.params;
    
    const [existing] = await db.query('SELECT id FROM ruangan WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Ruangan tidak ditemukan' 
      });
    }
    
    const username = getUsernameFromToken(req.user);
    
    await db.query('DELETE FROM ruangan WHERE id = ?', [id]);
    
    console.log(`✅ Ruangan deleted by ${username}: ID ${id}`);
    
    res.json({
      success: true,
      message: 'Ruangan berhasil dihapus',
      deletedBy: username
    });
  } catch (error) {
    console.error('Error deleting ruangan:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Gagal menghapus ruangan',
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