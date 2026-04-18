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
    url: process.env.KEYCLOAK_URL || 'https://auth.bbpompky.id',
    realm: process.env.KEYCLOAK_REALM || 'master',
    clientId: process.env.KEYCLOAK_CLIENT_ID || 'nextjs-local',
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || 'WJGi86sOoEcIW1IvD0ET40BgEnDvuSDj'
};

const httpsAgent = new https.Agent({ rejectUnauthorized: true });

// ========== PUBLIC ROUTES ==========
const publicRoutes = ['/api/login', '/api/health', '/uploads'];

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
        const decoded = jwt.decode(token);
        if (!decoded || (decoded.exp && decoded.exp < Date.now() / 1000)) {
            return res.status(401).json({ success: false, message: 'Token invalid or expired' });
        }
        
        req.user = {
            id: decoded.sub,
            username: decoded.preferred_username || decoded.email,
            email: decoded.email,
            name: decoded.name,
            roles: decoded.realm_access?.roles || []
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
        const status = error.response?.status === 401 ? 401 : 500;
        res.status(status).json({
            success: false,
            message: error.response?.status === 401 ? 'Username atau password salah' : 'Login failed'
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
    const filePath = path.join(UPLOADS_DIR, req.params.filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: 'File not found' });
    }
    res.sendFile(filePath);
});

app.get('/api/check-file/:filename', (req, res) => {
    const filePath = path.join(UPLOADS_DIR, req.params.filename);
    res.json({ success: true, exists: fs.existsSync(filePath), filename: req.params.filename });
});

// ========== DATABASE ==========
const db = require('./db');

// ========== ROUTES (SEDERHANA) ==========
const routes = [
    { name: 'laporanRusak', path: '/api/laporansrusak', file: './routes/laporanRusak' },
    { name: 'picRuangan', path: '/api/picruangan', file: './routes/picRuangan' },
    { name: 'ruangan', path: '/api/ruangan', file: './routes/ruangan' },
    { name: 'keycloak', path: '/api/keycloak', file: './routes/keycloak' },
    { name: 'asetRuangan', path: '/api/asetRuangan', file: './routes/asetRuangan' },
    { name: 'aset', path: '/api/aset', file: './routes/aset' }
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
    if (err.message && err.message.includes('hanya file gambar')) {
        return res.status(400).json({ success: false, message: err.message });
    }
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