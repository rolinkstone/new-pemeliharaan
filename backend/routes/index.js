// backend/routes/index.js
// Auto-generated route index - menghubungkan semua route ke app.js

const express = require('express');
const router = express.Router();

// ========== DAFTAR ROUTE ==========
const routeModules = [
    { name: 'laporanRusak', path: '/laporanrusak', file: './laporanrusak' },
    { name: 'picRuangan', path: '/picruangan', file: './picruangan' },
    { name: 'ruangan', path: '/ruangan', file: './ruangan' },
    { name: 'keycloak', path: '/keycloak', file: './keycloak' },
    { name: 'asetRuangan', path: '/asetRuangan', file: './asetRuangan' },
    { name: 'aset', path: '/aset', file: './aset' },
    { name: 'dashboard', path: '/dashboard', file: './dashboard' },
    { name: 'vendor', path: '/vendor', file: './vendor' },
    { name: 'disposisi', path: '/disposisi', file: './disposisi' },
    { name: 'perbaikan', path: '/perbaikan', file: './perbaikan' },
    { name: 'verifikasi', path: '/verifikasi', file: './verifikasi' },
    { name: 'monitoring', path: '/monitoring', file: './monitoring' },
    { name: 'export', path: '/export', file: './export' },
    { name: 'auth', path: '/auth', file: './auth' },
    { name: 'upload', path: '/upload', file: './upload' },
    { name: 'persediaan', path: '/persediaan', file: './persediaan' },
    { name: 'reagen', path: '/reagen', file: './reagen' },
    { name: 'pencatatan', path: '/pencatatan', file: './pencatatan' },
    { name: 'notifications', path: '/notifications', file: './notifications' }
];

routeModules.forEach(route => {
    try {
        const routeModule = require(route.file);
        router.use(route.path, routeModule);
        console.log(`✅ Route loaded: ${route.path}`);
    } catch (error) {
        console.log(`⚠️ Route skip: ${route.path} (${error.message})`);
    }
});

// ========== HEALTH CHECK ==========
router.get('/health', (req, res) => {
    res.json({ success: true, message: 'Server running', timestamp: new Date().toISOString() });
});

module.exports = router;
