// backend/routes/ruangan.js

const express = require('express');
const router = express.Router();
const db = require('../db');
const { keycloakAuth, getUsername } = require('../middleware/keycloakAuth');
const { getUsernameFromToken, decodeToken, getUserRolesFromRequest, hasRole, canModifyData } = require('../utils/routeHelpers');
const { XLSX, normalizeStr, looksLikeNote, readRowsWithAliases } = require('../utils/xlsxImport');
const { buildXlsxSheet, sendWorkbook, todayFileStamp } = require('../utils/xlsxExport');

// Parsing is_active dari Excel: 1/0, aktif/tidak aktif, true/false, ya/tidak (default 1)
const parseIsActive = (v) => {
  const s = normalizeStr(v).toLowerCase();
  if (['0', 'tidak', 'tidak aktif', 'nonaktif', 'non-aktif', 'false', 'no', 'n'].includes(s)) return 0;
  return 1;
};

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
    const searchTerm = `%${normalizeStr(decodeURIComponent(keyword))}%`;
    
    const [rows] = await db.query(
      `SELECT * FROM ruangan 
       WHERE kode_ruangan LIKE ? 
          OR nama_ruangan LIKE ? 
          OR deskripsi LIKE ?
          OR lokasi LIKE ?
       ORDER BY kode_ruangan ASC`,
      [searchTerm, searchTerm, searchTerm, searchTerm]
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

// GET /api/ruangan/import/template - download template import (publik, tanpa auth)
router.get('/import/template', async (req, res) => {
  try {
    if (!XLSX) return res.status(500).json({ success: false, message: 'xlsx package tidak tersedia' });

    let ruanganRef = [];
    try {
      const [r] = await db.query(
        'SELECT kode_ruangan, nama_ruangan, lokasi, is_active FROM ruangan ORDER BY kode_ruangan ASC'
      );
      ruanganRef = r || [];
    } catch (e) { console.error('Template ruangan ref error:', e.message); }

    const wb = XLSX.utils.book_new();

    // Sheet 1: Template Import (header saja)
    const header = ['kode_ruangan', 'nama_ruangan', 'deskripsi', 'lokasi', 'is_active'];
    const ws = XLSX.utils.aoa_to_sheet([header]);
    ws['!cols'] = [{ wch: 18 }, { wch: 34 }, { wch: 40 }, { wch: 28 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Template Import');

    // Sheet 2: Petunjuk
    const petunjuk = [
      ['PETUNJUK IMPORT DATA RUANGAN'],
      [''],
      ['1. Isi data pada sheet "Template Import" mulai baris ke-2 (jangan ubah baris header).'],
      ['2. Kolom wajib: kode_ruangan dan nama_ruangan.'],
      ['3. Kolom deskripsi dan lokasi opsional.'],
      ['4. Kolom is_active opsional: 1 = aktif, 0 = tidak aktif (default 1).'],
      ['5. Kode ruangan yang sudah ada akan DILEWATI dan dicatat sebagai gagal.'],
      [''],
      ['Contoh pengisian:'],
      ['kode_ruangan', 'nama_ruangan', 'deskripsi', 'lokasi', 'is_active'],
      ['R.001', 'Ruang Laboratorium', 'Ruang uji sampel', 'Gedung A Lantai 1', '1'],
    ];
    const wsPetunjuk = XLSX.utils.aoa_to_sheet(petunjuk);
    wsPetunjuk['!cols'] = [{ wch: 18 }, { wch: 34 }, { wch: 40 }, { wch: 28 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk');

    // Sheet 3: Referensi Ruangan (data yang sudah ada)
    if (ruanganRef.length > 0) {
      const aoa = [['kode_ruangan', 'nama_ruangan', 'lokasi', 'is_active']];
      ruanganRef.forEach(r => aoa.push([
        normalizeStr(r.kode_ruangan), normalizeStr(r.nama_ruangan),
        normalizeStr(r.lokasi), r.is_active,
      ]));
      const wsRef = XLSX.utils.aoa_to_sheet(aoa);
      wsRef['!cols'] = [{ wch: 18 }, { wch: 34 }, { wch: 28 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(wb, wsRef, 'Referensi Ruangan');
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=template_import_ruangan.xlsx');
    res.send(buf);
  } catch (error) {
    console.error('Error generate template import ruangan:', error);
    res.status(500).json({ success: false, message: 'Gagal generate template', error: error.message });
  }
});

// POST /api/ruangan/import - import data ruangan dari file XLSX
router.post('/import', keycloakAuth, async (req, res) => {
  if (!canModifyData(req)) {
    return res.status(403).json({
      success: false,
      message: 'Akses ditolak. Hanya admin_pemeliharaan dan admin yang dapat mengimport data ruangan.'
    });
  }

  try {
    if (!XLSX) return res.status(500).json({ success: false, message: 'xlsx package tidak tersedia' });

    const { fileBase64 } = req.body;
    if (!fileBase64) return res.status(400).json({ success: false, message: 'File tidak ditemukan' });

    const buf = Buffer.from(fileBase64, 'base64');
    const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
    const sheetName = wb.SheetNames.includes('Template Import') ? 'Template Import' : wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];

    // Kolom boleh memakai nama template (snake_case) ATAU label hasil Export
    const ALIAS = {
      kode_ruangan: ['kode_ruangan', 'Kode Ruangan'],
      nama_ruangan: ['nama_ruangan', 'Nama Ruangan'],
      deskripsi: ['deskripsi', 'Deskripsi'],
      lokasi: ['lokasi', 'Lokasi'],
      is_active: ['is_active', 'Status', 'Status Aktif', 'Aktif'],
    };
    const { rows, matched } = readRowsWithAliases(ws, ALIAS);

    if (!matched.includes('kode_ruangan') || !matched.includes('nama_ruangan')) {
      return res.status(400).json({
        success: false,
        message: 'Format header tidak dikenali. Gunakan template import atau file hasil Export dari aplikasi.',
        data: {
          success: 0,
          failed: 0,
          errors: ['Kolom wajib tidak ditemukan: kode_ruangan, nama_ruangan.'],
        },
      });
    }
    if (!rows || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'File kosong atau tidak ada baris data' });
    }

    const [existingRows] = await db.query('SELECT kode_ruangan FROM ruangan');
    const existingKode = new Set(
      (existingRows || []).map(r => normalizeStr(r.kode_ruangan)).filter(Boolean)
    );

    const seenKode = new Set();
    let success = 0;
    let failed = 0;
    const errors = [];
    const username = getUsernameFromToken(req.user);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const kodeRuangan = normalizeStr(row.kode_ruangan);
      const namaRuangan = normalizeStr(row.nama_ruangan);
      const deskripsi = normalizeStr(row.deskripsi);
      const lokasi = normalizeStr(row.lokasi);

      // Lewati baris kosong / baris catatan template
      if (!kodeRuangan && !namaRuangan) continue;
      if (looksLikeNote(kodeRuangan) && !namaRuangan) continue;

      if (!kodeRuangan) { failed++; errors.push(`Baris ${rowNum}: kode_ruangan kosong`); continue; }
      if (!namaRuangan) { failed++; errors.push(`Baris ${rowNum}: nama_ruangan kosong`); continue; }

      if (existingKode.has(kodeRuangan)) {
        failed++;
        errors.push(`Baris ${rowNum}: Kode ruangan "${kodeRuangan}" sudah ada (dilewati)`);
        continue;
      }
      if (seenKode.has(kodeRuangan)) {
        failed++;
        errors.push(`Baris ${rowNum}: Kode ruangan "${kodeRuangan}" duplikat di dalam file (dilewati)`);
        continue;
      }

      const isActive = parseIsActive(row.is_active);

      try {
        await db.query(
          `INSERT INTO ruangan (kode_ruangan, nama_ruangan, deskripsi, lokasi, is_active)
           VALUES (?, ?, ?, ?, ?)`,
          [kodeRuangan, namaRuangan, deskripsi || null, lokasi || null, isActive]
        );
        seenKode.add(kodeRuangan);
        success++;
      } catch (e) {
        failed++;
        errors.push(`Baris ${rowNum}: ${e.message}`);
      }
    }

    console.log(`✅ Import ruangan by ${username}: ${success} berhasil, ${failed} gagal`);
    res.json({
      success: true,
      message: `${success} berhasil, ${failed} gagal`,
      data: { success, failed, errors }
    });
  } catch (error) {
    console.error('Error import ruangan:', error);
    res.status(500).json({ success: false, message: 'Gagal import file', error: error.message });
  }
});

// GET /api/ruangan/export/xlsx - export semua data ruangan
router.get('/export/xlsx', keycloakAuth, async (req, res) => {
  try {
    if (!XLSX) return res.status(500).json({ success: false, message: 'xlsx package tidak tersedia' });

    const [rows] = await db.query(
      'SELECT kode_ruangan, nama_ruangan, deskripsi, lokasi, is_active FROM ruangan ORDER BY kode_ruangan ASC'
    );

    const aoa = [['No', 'Kode Ruangan', 'Nama Ruangan', 'Deskripsi', 'Lokasi', 'Status']];
    (rows || []).forEach((r, i) => {
      aoa.push([
        i + 1,
        normalizeStr(r.kode_ruangan),
        normalizeStr(r.nama_ruangan),
        normalizeStr(r.deskripsi),
        normalizeStr(r.lokasi),
        Number(r.is_active) === 1 ? 'Aktif' : 'Tidak Aktif',
      ]);
    });

    const wb = XLSX.utils.book_new();
    const ws = buildXlsxSheet(aoa, [{ wch: 6 }, { wch: 18 }, { wch: 34 }, { wch: 40 }, { wch: 28 }, { wch: 12 }]);
    XLSX.utils.book_append_sheet(wb, ws, 'Ruangan');

    console.log(`📤 Export ruangan: ${rows.length} baris`);
    sendWorkbook(res, wb, `data-ruangan-${todayFileStamp()}.xlsx`);
  } catch (error) {
    console.error('Error export ruangan:', error);
    res.status(500).json({ success: false, message: 'Gagal export data', error: error.message });
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
      query += ' AND (kode_ruangan LIKE ? OR nama_ruangan LIKE ? OR deskripsi LIKE ? OR lokasi LIKE ?)';
      const searchTerm = `%${normalizeStr(search)}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
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