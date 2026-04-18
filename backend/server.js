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

// ========== KONFIGURASI MULTER UNTUK UPLOAD ==========
// Konfigurasi storage untuk multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Pastikan folder uploads ada
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

// Filter file type
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
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: fileFilter
});

// ========== KONFIGURASI DASAR ==========
// Buat folder uploads
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Middleware dasar
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(cors());

// Keycloak config
const KEYCLOAK_CONFIG = {
    url: process.env.KEYCLOAK_URL || 'https://auth.bbpompky.id',
    realm: process.env.KEYCLOAK_REALM || 'master',
    clientId: process.env.KEYCLOAK_CLIENT_ID || 'nextjs-local',
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || 'WJGi86sOoEcIW1IvD0ET40BgEnDvuSDj'
};

const httpsAgent = new https.Agent({ rejectUnauthorized: true });

// ========== PUBLIC ROUTES (TANPA AUTH) ==========
const publicRoutes = ['/api/login', '/api/health', '/uploads'];

// Middleware auth sederhana
const authMiddleware = async (req, res, next) => {
    // Skip untuk public routes
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

// ========== ENDPOINTS ==========

// Health check
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'Server running', timestamp: new Date().toISOString() });
});

// Login endpoint
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

// ========== ENDPOINT UPLOAD FOTO ==========
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
        
        console.log(`✅ Uploaded ${uploadedFiles.length} file(s)`);
        
        res.json({
            success: true,
            message: 'Foto berhasil diupload',
            data: uploadedFiles
        });
    } catch (error) {
        console.error('Error uploading foto:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Akses file upload (public)
app.get('/uploads/:filename', (req, res) => {
    const filePath = path.join(UPLOADS_DIR, req.params.filename);
    
    // Log untuk debugging
    console.log(`📁 Request file: ${req.params.filename}`);
    console.log(`📁 File path: ${filePath}`);
    console.log(`📁 File exists: ${fs.existsSync(filePath)}`);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: 'File not found' });
    }
    res.sendFile(filePath);
});

// ========== ENDPOINT CHECK FILE ==========
app.get('/api/check-file/:filename', (req, res) => {
    const filePath = path.join(UPLOADS_DIR, req.params.filename);
    const exists = fs.existsSync(filePath);
    
    res.json({
        success: true,
        exists: exists,
        path: filePath,
        filename: req.params.filename
    });
});

// ========== IMPORT ROUTES ==========
// Route laporanRusak
try {
    const laporanRoutes = require('./routes/laporanRusak');
    app.use('/api/laporansrusak', laporanRoutes);
    console.log('✅ Loaded route: /api/laporansrusak');
} catch (error) {
    console.warn('⚠️ Route /api/laporansrusak not found:', error.message);
}

// Route picruangan
try {
    const picRuanganRoutes = require('./routes/picRuangan');
    app.use('/api/picruangan', picRuanganRoutes);
    console.log('✅ Loaded route: /api/picruangan');
} catch (error) {
    console.warn('⚠️ Route /api/picruangan not found:', error.message);
}

// Route ruangan
try {
    const ruanganRoutes = require('./routes/ruangan');
    app.use('/api/ruangan', ruanganRoutes);
    console.log('✅ Loaded route: /api/ruangan');
} catch (error) {
    console.warn('⚠️ Route /api/ruangan not found:', error.message);
}

// Route keycloak
try {
    const keycloakRoutes = require('./routes/keycloak');
    app.use('/api/keycloak', keycloakRoutes);
    console.log('✅ Loaded route: /api/keycloak');
} catch (error) {
    console.warn('⚠️ Route /api/keycloak not found:', error.message);
}

// ========== ERROR HANDLER ==========
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ 
            success: false, 
            message: 'Ukuran file terlalu besar. Maksimal 10MB.' 
        });
    }
    
    if (err.message && err.message.includes('hanya file gambar')) {
        return res.status(400).json({ 
            success: false, 
            message: err.message 
        });
    }
    
    const status = err.type === 'entity.too.large' ? 413 : 500;
    res.status(status).json({
        success: false,
        message: status === 413 ? 'File too large' : 'Internal server error'
    });
});

// ========== START SERVER ==========
app.listen(PORT, () => {
    console.log(`
    ════════════════════════════════════════
    🚀 Server running on port ${PORT}
    📁 Uploads directory: ${UPLOADS_DIR}
    📁 Uploads exists: ${fs.existsSync(UPLOADS_DIR)}
    ════════════════════════════════════════
    `);
});