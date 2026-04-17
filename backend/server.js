// backend/server.js

const express = require('express');
const path = require('path');
const cors = require('cors');
const db = require('./db');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const https = require('https');
const fs = require('fs');
const qs = require('qs');

const app = express();

// ========== CONFIGURATION ==========
const PORT = process.env.PORT || 5002;

// ========== KONFIGURASI UPLOAD FOLDER ==========
const UPLOADS_DIR = path.join(__dirname, 'uploads');
console.log('📁 Uploads directory:', UPLOADS_DIR);

// Buat folder uploads jika belum ada
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    console.log('✅ Folder uploads berhasil dibuat');
}

// 🚨 PERBAIKAN 1: Set JSON PARSER SEBELUM APAPUN dengan limit besar
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Logging untuk memastikan limit terpasang
console.log('📦 JSON Parser configured with limit: 100mb');

// CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// ========== KEYCLOAK CONFIG ==========
const KEYCLOAK_CONFIG = {
    url: 'https://auth.bbpompky.id',
    realm: 'master',
    clientId: 'nextjs-local',
    clientSecret: 'WJGi86sOoEcIW1IvD0ET40BgEnDvuSDj'
};

// ========== CUSTOM HTTPS AGENT ==========
const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 50,
    rejectUnauthorized: true
});

// ========== PUBLIC ROUTES - TANPA AUTH ==========

/**
 * POST /api/login - Public login endpoint
 */
app.post('/api/login', async (req, res) => {
    console.log('='.repeat(50));
    console.log('📂 PUBLIC LOGIN ENDPOINT');
    console.log('Time:', new Date().toISOString());
    console.log('Body:', req.body);
    console.log('='.repeat(50));
    
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message: 'Username dan password harus diisi'
        });
    }
    
    try {
        const tokenUrl = `${KEYCLOAK_CONFIG.url}/realms/${KEYCLOAK_CONFIG.realm}/protocol/openid-connect/token`;
        
        console.log('🔐 Requesting token from Keycloak...');
        
        const response = await axios.post(
            tokenUrl,
            qs.stringify({
                grant_type: 'password',
                client_id: KEYCLOAK_CONFIG.clientId,
                client_secret: KEYCLOAK_CONFIG.clientSecret,
                username: username,
                password: password,
                scope: 'openid profile email'
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                httpsAgent
            }
        );
        
        console.log('✅ Login successful');
        
        // Decode token untuk mendapatkan user info
        const decoded = jwt.decode(response.data.access_token);
        
        res.json({
            success: true,
            message: 'Login berhasil',
            data: {
                access_token: response.data.access_token,
                refresh_token: response.data.refresh_token,
                expires_in: response.data.expires_in,
                token_type: response.data.token_type,
                user: {
                    id: decoded?.sub,
                    username: decoded?.preferred_username || username,
                    email: decoded?.email,
                    name: decoded?.name || decoded?.preferred_username,
                    roles: decoded?.realm_access?.roles || []
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Login error:', error.response?.data || error.message);
        
        if (error.response?.status === 401) {
            return res.status(401).json({
                success: false,
                message: 'Username atau password salah'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Gagal login',
            error: error.response?.data || error.message
        });
    }
});

/**
 * GET /api/health - Public health check
 */
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

/**
 * GET /uploads-list - Public list uploads (untuk testing)
 */
app.get('/uploads-list', (req, res) => {
    try {
        const files = fs.readdirSync(UPLOADS_DIR);
        res.json({
            success: true,
            uploads_dir: UPLOADS_DIR,
            files: files,
            urls: files.map(f => `http://localhost:${PORT}/uploads/${f}`)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Gagal membaca folder uploads',
            error: error.message
        });
    }
});

// 🚨 TAMBAHKAN: Public endpoint untuk mengakses file upload (TANPA AUTH)
/**
 * GET /uploads/:filename - Public file access (tanpa auth)
 */
app.get('/uploads/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(UPLOADS_DIR, filename);
        
        console.log(`📁 Public access file: ${filename}`);
        
        // Cek apakah file ada
        if (!fs.existsSync(filePath)) {
            console.log(`❌ File tidak ditemukan: ${filename}`);
            return res.status(404).json({
                success: false,
                error: 'Not Found',
                message: 'File tidak ditemukan'
            });
        }
        
        // Dapatkan ekstensi file
        const ext = path.extname(filename).toLowerCase();
        
        // Set content type berdasarkan ekstensi
        const contentTypes = {
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif'
        };
        
        if (contentTypes[ext]) {
            res.contentType(contentTypes[ext]);
        }
        
        // Set header untuk preview
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        
        // Kirim file
        res.sendFile(filePath);
        console.log(`✅ File berhasil dikirim: ${filename}`);
        
    } catch (error) {
        console.error('❌ Error accessing file:', error);
        res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: 'Gagal mengakses file: ' + error.message
        });
    }
});

// ========== AUTH MIDDLEWARE ==========
const enhancedAuth = async (req, res, next) => {
    try {
        // Daftar route yang TIDAK memerlukan autentikasi
        const publicRoutes = [
            '/api/login',
            '/api/health',
            '/api/validate',
            '/api/refresh',
            '/api/debug',
            '/api/kegiatan/test/public',
            '/uploads-list',
            '/uploads' // TAMBAHKAN: route uploads publik
        ];

        // Cek apakah request ke public route
        const isPublicRoute = publicRoutes.some(route => req.path.startsWith(route));

        if (isPublicRoute) {
            console.log(`📂 Public route accessed: ${req.path}`);
            return next();
        }

        // Untuk route yang memerlukan autentikasi
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: 'No authorization header'
            });
        }

        let token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

        if (!token || token.trim() === '') {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: 'Empty token'
            });
        }

        const decoded = jwt.decode(token);

        if (!decoded) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: 'Invalid token format'
            });
        }

        const currentTime = Math.floor(Date.now() / 1000);
        if (decoded.exp && decoded.exp < currentTime) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: 'Token expired'
            });
        }

        req.user = {
            id: decoded.sub,
            username: decoded.preferred_username || decoded.email || 'unknown',
            email: decoded.email || '',
            name: decoded.name || decoded.preferred_username || 'User',
            roles: decoded.realm_access?.roles || []
        };

        console.log(`✅ User authenticated: ${req.user.username}`);
        next();

    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: 'Authentication failed'
        });
    }
};

// Terapkan middleware AUTH ke semua route setelah ini
app.use(enhancedAuth);

// ========== PROTECTED ROUTES ==========

/**
 * GET /api/uploads/:filename - Protected file access (MASIH ADA UNTUK KOMPATIBILITAS)
 */
app.get('/api/uploads/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(UPLOADS_DIR, filename);
        
        console.log(`📁 User ${req.user?.username} mengakses file via API: ${filename}`);
        
        // Cek apakah file ada
        if (!fs.existsSync(filePath)) {
            console.log(`❌ File tidak ditemukan: ${filename}`);
            return res.status(404).json({
                success: false,
                error: 'Not Found',
                message: 'File tidak ditemukan'
            });
        }
        
        // Dapatkan ekstensi file
        const ext = path.extname(filename).toLowerCase();
        
        // Set content type berdasarkan ekstensi
        const contentTypes = {
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif'
        };
        
        if (contentTypes[ext]) {
            res.contentType(contentTypes[ext]);
        }
        
        // Set header untuk download
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        
        // Kirim file
        res.sendFile(filePath);
        console.log(`✅ File berhasil dikirim ke ${req.user?.username}: ${filename}`);
        
    } catch (error) {
        console.error('❌ Error accessing file:', error);
        res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: 'Gagal mengakses file: ' + error.message
        });
    }
});

// ========== IMPORT ROUTES ==========
const keycloakRoutes = require('./routes/keycloak');
const dashboardRoutes = require('./routes/dashboard');
const asetRoutes = require('./routes/aset');
const ruanganRoutes = require('./routes/ruangan');
const asetRuanganRoutes = require('./routes/asetRuangan');
const picRuanganRoutes = require('./routes/picRuangan');
const laporansRusakRoutes = require('./routes/laporanRusak');

// 🚨 TAMBAHKAN: Import route upload
const uploadRoutes = require('./routes/upload');

// ========== MOUNT PROTECTED ROUTES ==========
app.use('/api/keycloak', keycloakRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/aset', asetRoutes);
app.use('/api/ruangan', ruanganRoutes);
app.use('/api/asetRuangan', asetRuanganRoutes);
app.use('/api/picRuangan', picRuanganRoutes);
app.use('/api/laporansrusak', laporansRusakRoutes);

// 🚨 TAMBAHKAN: Mount route upload
app.use('/api/upload', uploadRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  
  if (err.type === 'entity.too.large' || err.message.includes('too large')) {
    return res.status(413).json({
      success: false,
      message: `Data terlalu besar. Maksimal 100MB, data Anda ${(err.length / 1024).toFixed(2)}KB`,
      error: err.message
    });
  }
  
  // Handle multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: 'Ukuran file terlalu besar. Maksimal 10MB per file.',
      error: err.message
    });
  }
  
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({
      success: false,
      message: 'Terlalu banyak file. Maksimal 10 file.',
      error: err.message
    });
  }
  
  if (err.message === 'Hanya file gambar yang diperbolehkan') {
    return res.status(400).json({
      success: false,
      message: err.message,
      error: err.message
    });
  }
  
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: err.message
  });
});

// ========== START SERVER ==========
app.listen(PORT, () => {
    console.log(`
    ============================================
    🚀 SERVER READY: http://localhost:${PORT}
    📦 JSON Limit: 100MB (active)
    📁 Uploads Directory: ${UPLOADS_DIR}
    ============================================
    `);
    
    console.log('📋 Available Routes:');
    console.log('   PUBLIC:');
    console.log(`   ✅ POST http://localhost:${PORT}/api/login`);
    console.log(`   ✅ GET  http://localhost:${PORT}/api/health`);
    console.log(`   ✅ GET  http://localhost:${PORT}/uploads-list`);
    console.log(`   ✅ GET  http://localhost:${PORT}/uploads/:filename (public file access)`);
    console.log('   PROTECTED:');
    console.log(`   🔒 GET  http://localhost:${PORT}/api/uploads/:filename (legacy)`);
    console.log(`   🔒 POST http://localhost:${PORT}/api/upload/foto (upload multiple files)`);
    console.log(`   🔒 POST http://localhost:${PORT}/api/upload/foto/single (upload single file)`);
    console.log(`   🔒 DELETE http://localhost:${PORT}/api/upload/foto/:filename (delete file)`);
    console.log(`   🔒 GET  http://localhost:${PORT}/api/keycloak/*`);
    console.log(`   🔒 GET  http://localhost:${PORT}/api/dashboard/*`);
    console.log(`   🔒 POST http://localhost:${PORT}/api/laporansrusak (max 100MB)`);
});