// backend/routes/ttd.js
// =====================================================================
// Data TTD penandatangan (diambil dari aplikasi Talawang - READ ONLY)
// Mount: /api/ttd
// =====================================================================

const express = require('express');
const router = express.Router();
const { keycloakAuth } = require('../middleware/keycloakAuth');
const { cariTtd, infoTalawang } = require('../utils/talawangTtd');

// =====================================================================
// POST /api/ttd/penandatangan
// Body: { keys: ["<uuid|nip|username|nama>", ...] }
// -> { success, data: [{ kunci, ketemu, nama, jabatan, nip, ttd_url }] }
// =====================================================================
router.post('/penandatangan', keycloakAuth, async (req, res) => {
  try {
    const keys = Array.isArray(req.body?.keys)
      ? req.body.keys
      : typeof req.body?.keys === 'string'
        ? req.body.keys.split(',')
        : [];

    if (keys.length === 0) {
      return res.json({ success: true, data: [], message: 'Tidak ada kunci yang dikirim' });
    }

    const hasil = await cariTtd(keys);
    res.json({
      success: true,
      data: hasil,
      message: `Ditemukan ${hasil.filter((h) => h.ketemu).length} TTD dari ${hasil.length} kunci`,
    });
  } catch (error) {
    console.error('❌ Error ambil TTD penandatangan:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data TTD penandatangan',
      error: error.message,
      data: [],
    });
  }
});

// =====================================================================
// GET /api/ttd/info -> konfigurasi integrasi (tanpa kredensial)
// =====================================================================
router.get('/info', keycloakAuth, (req, res) => {
  res.json({ success: true, data: infoTalawang() });
});

module.exports = router;
