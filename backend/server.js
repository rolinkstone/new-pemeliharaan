// backend/server.js
const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const https = require('https');
const qs = require('qs');

const app = express();
const PORT = process.env.PORT || 5002;
const UPLOADS_DIR = path.join(__dirname, 'uploads');

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

// Akses file upload (public)
app.get('/uploads/:filename', (req, res) => {
    const filePath = path.join(UPLOADS_DIR, req.params.filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: 'File not found' });
    }
    res.sendFile(filePath);
});

// ========== IMPORT ROUTES ==========
// Hanya import route yang filenya benar-benar ada
const routes = {
    keycloak: './routes/keycloak',
    dashboard: './routes/dashboard',
    aset: './routes/aset',
    ruangan: './routes/ruangan',
    picRuangan: './routes/picRuangan',
    upload: './routes/upload'
};

// Mount routes yang tersedia
Object.entries(routes).forEach(([name, routePath]) => {
    try {
        const route = require(routePath);
        app.use(`/api/${name}`, route);
        console.log(`✅ Loaded route: /api/${name}`);
    } catch (error) {
        console.warn(`⚠️ Route /api/${name} not found (${routePath})`);
    }
});

// Coba load route laporanRusak (nama filenya laporanRusak, bukan laporansRusak)
try {
    const laporanRoutes = require('./routes/laporanRusak');
    app.use('/api/laporansrusak', laporanRoutes);
    console.log('✅ Loaded route: /api/laporansrusak');
} catch (error) {
    console.warn('⚠️ Route /api/laporansrusak not found');
}

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    const status = err.type === 'entity.too.large' || err.code === 'LIMIT_FILE_SIZE' ? 413 : 500;
    res.status(status).json({
        success: false,
        message: status === 413 ? 'File too large (max 100MB)' : 'Internal server error'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
    ════════════════════════════════════════
    🚀 Server running on port ${PORT}
    📁 Uploads: ${UPLOADS_DIR}
    ════════════════════════════════════════
    `);
});