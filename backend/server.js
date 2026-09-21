// backend/server.js
const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const https = require('https');
const qs = require('qs');
const multer = require('multer');

// ========== ENV ==========
// WAJIB dimuat di sini: tanpa ini KEYCLOAK_CLIENT_SECRET = undefined dan
// Keycloak membalas 401 unauthorized_client (terlihat seperti "password salah").
// Path ABSOLUT supaya tetap benar walau cwd bukan folder backend.
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5002;
const UPLOADS_DIR = process.env.UPLOADS_PATH || path.join(__dirname, 'uploads');

// ========== KONFIGURASI UPLOAD (TIDAK DIUBAH) ==========
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(UPLOADS_DIR)) {
            fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        }
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `foto-${uniqueSuffix}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
        cb(null, true);
    } else {
        cb(new Error('Hanya file gambar yang diperbolehkan (jpeg, jpg, png, gif, webp)'));
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: fileFilter
});

// ========== MIDDLEWARE DASAR ==========
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(cors());

// ========== KEYCLOAK CONFIG ==========
const KEYCLOAK_CONFIG = {
    // .env memakai nama KEYCLOAK_SERVER_URL; KEYCLOAK_URL dipertahankan sebagai alias
    url: process.env.KEYCLOAK_URL || process.env.KEYCLOAK_SERVER_URL || 'https://auth.bbpompky.id',
    realm: process.env.KEYCLOAK_REALM || 'master',
    clientId: process.env.KEYCLOAK_CLIENT_ID || 'nextjs-local',
    // WAJIB diisi lewat environment variable (.env.local) - jangan hardcode di source
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET
};

if (!KEYCLOAK_CONFIG.clientSecret) {
    console.error('⚠️  KEYCLOAK_CLIENT_SECRET tidak terbaca - endpoint /api/login akan gagal (unauthorized_client).');
}

// ========== VERIFIKASI TANDA TANGAN TOKEN (JWKS Keycloak) ==========
// Sebelumnya token hanya di-`jwt.decode` TANPA verifikasi tanda tangan, sehingga
// token buatan sendiri (ditandatangani dengan secret apa pun) bisa lolos.
// Verifikasi otomatis AKTIF di produksi; di dev bisa dipaksa:
//   JWT_VERIFY_TOKENS=true   -> wajib tanda tangan valid
//   JWT_VERIFY_TOKENS=false  -> hanya decode (khusus pengujian lokal)
const { createPublicKey } = require('crypto');

const VERIFY_TOKENS = process.env.JWT_VERIFY_TOKENS !== undefined
    ? String(process.env.JWT_VERIFY_TOKENS).toLowerCase() === 'true'
    : process.env.NODE_ENV === 'production';

const KEYCLOAK_ISSUER = process.env.KEYCLOAK_ISSUER || `${KEYCLOAK_CONFIG.url}/realms/${KEYCLOAK_CONFIG.realm}`;
const JWKS_URI = `${KEYCLOAK_ISSUER}/protocol/openid-connect/certs`;
const JWKS_TTL = 10 * 60 * 1000;

let jwksCache = { keys: [], fetchedAt: 0 };

async function fetchJwks(force = false) {
    const masihSegar = jwksCache.keys.length > 0 && (Date.now() - jwksCache.fetchedAt) < JWKS_TTL;
    if (!force && masihSegar) return jwksCache.keys;

    const response = await fetch(JWKS_URI);
    if (!response.ok) throw new Error(`Gagal mengambil JWKS (HTTP ${response.status})`);

    const body = await response.json();
    jwksCache = { keys: body.keys || [], fetchedAt: Date.now() };
    return jwksCache.keys;
}

function publicKeyFromJwks(keys, kid) {
    // Hanya pakai key untuk tanda tangan (use=sig) - JWKS Keycloak juga memuat
    // key enkripsi (alg=RSA-OAEP) yang tidak dipakai untuk verifikasi.
    const signingKeys = keys.filter((k) => !k.use || k.use === 'sig');
    const jwk = signingKeys.find((k) => k.kid === kid) || (signingKeys.length === 1 ? signingKeys[0] : null);
    if (!jwk) return null;
    return createPublicKey({ key: jwk, format: 'jwk' });
}

async function verifyKeycloakToken(token) {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || !decoded.header) throw new Error('Token tidak dapat dibaca');

    const kid = decoded.header.kid;
    let key = publicKeyFromJwks(await fetchJwks(), kid);
    if (!key) {
        // Keycloak bisa merotasi key -> paksa ambil ulang JWKS sekali.
        key = publicKeyFromJwks(await fetchJwks(true), kid);
    }
    if (!key) throw new Error(`Public key untuk kid "${kid}" tidak ditemukan di JWKS`);

    return jwt.verify(token, key, { algorithms: ['RS256'], issuer: KEYCLOAK_ISSUER });
}

if (VERIFY_TOKENS) {
    console.log(`🔐 Verifikasi tanda tangan JWT: AKTIF (${JWKS_URI})`);
} else {
    console.warn('⚠️  Verifikasi tanda tangan JWT: NONAKTIF (mode dev). Set NODE_ENV=production atau JWT_VERIFY_TOKENS=true saat produksi.');
}

const httpsAgent = new https.Agent({ rejectUnauthorized: true });

// ========== PUBLIC ROUTES ==========
const publicRoutes = ['/api/login', '/api/health', '/uploads', '/api/persediaan/barang/template-xlsx', '/api/reagen/reagen/import-stok/template', '/api/asetRuangan/import/template', '/api/ruangan/import/template', '/api/aset/import/template'];

// ========== AUTH MIDDLEWARE ==========
const authMiddleware = async (req, res, next) => {
    if (publicRoutes.some(route => req.path.startsWith(route))) {
        return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const token = authHeader.slice(7);
    try {
        // Verifikasi tanda tangan (produksi) atau sekadar decode (dev).
        const decoded = VERIFY_TOKENS ? await verifyKeycloakToken(token) : jwt.decode(token);
        if (!decoded || (decoded.exp && decoded.exp < Date.now() / 1000)) {
            return res.status(401).json({ success: false, message: 'Token invalid or expired' });
        }
        
        // Gabungkan realm roles + client roles (resource_access).
        // Role seperti admin_pemeliharaan bisa dibuat sebagai realm role ATAU client role,
        // jadi keduanya harus diperhitungkan.
        const realmRoles = decoded.realm_access?.roles || [];
        const clientRoles = Object.values(decoded.resource_access || {})
            .flatMap((resource) => resource?.roles || []);
        const roles = [...new Set([...realmRoles, ...clientRoles])];

        req.user = {
            id: decoded.sub,
            username: decoded.preferred_username || decoded.email,
            email: decoded.email,
            name: decoded.name,
            roles,
            // Simpan klaim asli + token agar helper (hasRole / extractUserRoles) lengkap
            realm_access: decoded.realm_access,
            resource_access: decoded.resource_access,
            accessToken: token
        };
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

app.use(authMiddleware);

// ========== ENDPOINTS DASAR ==========
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'Server running', timestamp: new Date().toISOString() });
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username dan password required' });
    }

    try {
        const response = await axios.post(
            `${KEYCLOAK_CONFIG.url}/realms/${KEYCLOAK_CONFIG.realm}/protocol/openid-connect/token`,
            qs.stringify({
                grant_type: 'password',
                client_id: KEYCLOAK_CONFIG.clientId,
                client_secret: KEYCLOAK_CONFIG.clientSecret,
                username,
                password,
                scope: 'openid profile email'
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, httpsAgent }
        );

        const decoded = jwt.decode(response.data.access_token);
        res.json({
            success: true,
            data: {
                access_token: response.data.access_token,
                refresh_token: response.data.refresh_token,
                user: {
                    id: decoded?.sub,
                    username: decoded?.preferred_username || username,
                    email: decoded?.email,
                    name: decoded?.name,
                    roles: decoded?.realm_access?.roles || []
                }
            }
        });
    } catch (error) {
        const kcError = error.response?.data?.error;
        console.error(`❌ Login gagal: HTTP ${error.response?.status ?? '-'} ${kcError || error.message}`);

        // invalid_client/unauthorized_client = konfigurasi (client id/secret), BUKAN salah password.
        // Jangan tampilkan sebagai "Username atau password salah" supaya tidak menyesatkan.
        if (kcError === 'invalid_client' || kcError === 'unauthorized_client') {
            return res.status(500).json({
                success: false,
                message: 'Konfigurasi Keycloak tidak valid (client id/secret) - cek backend/.env.local',
                error: kcError
            });
        }

        res.status(kcError === 'invalid_grant' ? 401 : 500).json({
            success: false,
            message: kcError === 'invalid_grant' ? 'Username atau password salah' : 'Login failed',
            error: kcError || error.message
        });
    }
});

// ========== UPLOAD ENDPOINTS ==========
app.post('/api/upload/foto', upload.array('foto_kerusakan', 10), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: 'Tidak ada file yang diupload' });
        }
        
        const uploadedFiles = req.files.map(file => ({
            filename: file.filename,
            originalName: file.originalname,
            url: `/uploads/${file.filename}`,
            size: file.size,
            mimetype: file.mimetype
        }));
        
        res.json({ success: true, message: 'Foto berhasil diupload', data: uploadedFiles });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/uploads/:filename', (req, res) => {
    // Pengaman path traversal: hanya nama file polos yang diterima.
    const namaFile = String(req.params.filename || '');
    if (!namaFile || namaFile !== path.basename(namaFile) || namaFile.includes('..')) {
        return res.status(400).json({ success: false, message: 'Nama file tidak valid' });
    }

    const filePath = path.join(UPLOADS_DIR, namaFile);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: 'File not found' });
    }

    // File upload = konten tak terpercaya. nosniff + CSP ketat mencegah file yang
    // disamarkan (HTML/SVG berisi skrip) dieksekusi sebagai dokumen di origin API
    // -> mitigasi stored XSS. Gambar tetap tampil normal lewat <img>.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.sendFile(filePath);
});

app.get('/api/check-file/:filename', (req, res) => {
    const filePath = path.join(UPLOADS_DIR, req.params.filename);
    res.json({ success: true, exists: fs.existsSync(filePath), filename: req.params.filename });
});

// ========== DATABASE ==========
const db = require('./db');

// ========== ROUTES ==========
const routes = [
    { name: 'laporanRusak', path: '/api/laporanrusak', file: './routes/laporanRusak' },
    { name: 'picRuangan', path: '/api/picruangan', file: './routes/picruangan' },
    { name: 'ruangan', path: '/api/ruangan', file: './routes/ruangan' },
    { name: 'keycloak', path: '/api/keycloak', file: './routes/keycloak' },
    { name: 'asetRuangan', path: '/api/asetRuangan', file: './routes/asetRuangan' },
    { name: 'aset', path: '/api/aset', file: './routes/aset' },
    { name: 'dashboard', path: '/api/dashboard', file: './routes/dashboard' },
    { name: 'vendor', path: '/api/vendor', file: './routes/vendor' },
    { name: 'disposisi', path: '/api/disposisi', file: './routes/disposisi' },
    { name: 'perbaikan', path: '/api/perbaikan', file: './routes/perbaikan' },
    { name: 'verifikasi', path: '/api/verifikasi', file: './routes/verifikasi' },
    { name: 'monitoring', path: '/api/monitoring', file: './routes/monitoring' },
    { name: 'export', path: '/api/export', file: './routes/export' },
    { name: 'upload', path: '/api/upload', file: './routes/upload' },
    { name: 'persediaan', path: '/api/persediaan', file: './routes/persediaan' },
    { name: 'reagen', path: '/api/reagen', file: './routes/reagen' },
    { name: 'pencatatan', path: '/api/pencatatan', file: './routes/pencatatan' },
    { name: 'glassware', path: '/api/glassware', file: './routes/glassware' },
    { name: 'ttd', path: '/api/ttd', file: './routes/ttd' },
    { name: 'notifications', path: '/api/notifications', file: './routes/notifications' }
];

routes.forEach(route => {
    try {
        const routeModule = require(route.file);
        app.use(route.path, routeModule);
        console.log(`✅ Loaded: ${route.path}`);
    } catch (error) {
        console.log(`⚠️ Skip: ${route.path} (${error.message})`);
    }
});

// ========== DEBUG ==========
app.get('/api/debug/routes', (req, res) => {
    const routesList = [];
    app._router.stack.forEach(m => {
        if (m.route) routesList.push({ path: m.route.path, methods: Object.keys(m.route.methods) });
        else if (m.name === 'router' && m.handle.stack) {
            m.handle.stack.forEach(h => {
                if (h.route) routesList.push({ path: h.route.path, methods: Object.keys(h.route.methods) });
            });
        }
    });
    res.json({ success: true, routes: routesList });
});

// ========== ERROR HANDLER ==========
app.use((err, req, res, next) => {
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ success: false, message: 'Ukuran file terlalu besar. Maksimal 10MB.' });
    }
    // Pesan penolakan fileFilter bisa berawalan huruf besar ("Hanya file gambar..."),
    // jadi pencocokan WAJIB case-insensitive agar pengguna menerima 400 + alasannya,
    // bukan 500 "Internal server error".
    if (err.message && /hanya file gambar/i.test(err.message)) {
        return res.status(400).json({ success: false, message: err.message });
    }
    console.error('❌ Unhandled error:', err.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route ${req.path} tidak ditemukan` });
});

// ========== START SERVER ==========
app.listen(PORT, () => {
    console.log(`
    ════════════════════════════════════════
    🚀 Server running on port ${PORT}
    📁 Uploads: ${UPLOADS_DIR}
    
    📋 Available Routes:
    - POST   /api/login
    - POST   /api/upload/foto
    - GET    /api/asetRuangan
    - GET    /api/asetRuangan/options/aset
    - GET    /api/asetRuangan/options/ruangan
    - GET    /api/aset
    - GET    /api/debug/routes
    ════════════════════════════════════════
    `);
});

module.exports = app;