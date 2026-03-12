// backend/routes/ruangan.js

const express = require('express');
const router = express.Router();
const db = require('../db');
const { keycloakAuth } = require('../middleware/keycloakAuth');

// ========== PENTING: ENDPOINT KHUSUS HARUS DI ATAS ENDPOINT DINAMIS ==========

// GET /api/ruangan/statistics - ENDPOINT KHUSUS (HARUS DI ATAS)
router.get('/statistics', keycloakAuth, async (req, res) => {
  console.log('📊 Statistics endpoint accessed');
  try {
    // Get total count
    const [total] = await db.query('SELECT COUNT(*) as total FROM ruangan');
    
    // Get active count
    const [aktif] = await db.query('SELECT COUNT(*) as total FROM ruangan WHERE is_active = 1');
    
    // Get inactive count
    const [tidakAktif] = await db.query('SELECT COUNT(*) as total FROM ruangan WHERE is_active = 0');
    
    console.log('📊 Statistics result:', {
      total: total[0].total,
      aktif: aktif[0].total,
      tidak_aktif: tidakAktif[0].total
    });
    
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

// GET /api/ruangan/status/aktif - ENDPOINT KHUSUS
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

// GET /api/ruangan/search/:keyword - ENDPOINT KHUSUS
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

// GET /api/ruangan - Get all ruangan
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
    
    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    const [countResult] = await db.query(countQuery, params);
    const total = countResult[0].total;
    
    // Add pagination and order
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

// GET /api/ruangan/:id - Get ruangan by ID (HARUS PALING BAWAH)
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

// POST /api/ruangan - Create ruangan
router.post('/', keycloakAuth, async (req, res) => {
  // ... (kode create)
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
    
    const [result] = await db.query(
      `INSERT INTO ruangan (kode_ruangan, nama_ruangan, deskripsi, lokasi, is_active) 
       VALUES (?, ?, ?, ?, ?)`,
      [kode_ruangan, nama_ruangan, deskripsi || null, lokasi || null, is_active !== undefined ? is_active : 1]
    );
    
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
      }
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

// PUT /api/ruangan/:id - Update ruangan
router.put('/:id', keycloakAuth, async (req, res) => {
  // ... (kode update)
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
    
    await db.query(
      `UPDATE ruangan 
       SET kode_ruangan = ?, nama_ruangan = ?, deskripsi = ?, lokasi = ?, is_active = ?
       WHERE id = ?`,
      [kode_ruangan, nama_ruangan, deskripsi || null, lokasi || null, is_active, id]
    );
    
    res.json({
      success: true,
      message: 'Ruangan berhasil diperbarui',
      data: { id, kode_ruangan, nama_ruangan, deskripsi, lokasi, is_active }
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

// DELETE /api/ruangan/:id - Delete ruangan
router.delete('/:id', keycloakAuth, async (req, res) => {
  // ... (kode delete)
  try {
    const { id } = req.params;
    
    const [existing] = await db.query('SELECT id FROM ruangan WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Ruangan tidak ditemukan' 
      });
    }
    
    await db.query('DELETE FROM ruangan WHERE id = ?', [id]);
    
    res.json({
      success: true,
      message: 'Ruangan berhasil dihapus'
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

module.exports = router;