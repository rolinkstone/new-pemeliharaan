const express = require('express');
const router = express.Router();
const passport = require('passport');
const KEYCLOAK_CONFIG = require('../config/keycloak');

// ========== AUTH ROUTES ==========

// GET - Login endpoint untuk redirect ke Keycloak
router.get('/login', (req, res) => {
    console.log('🔐 Redirecting to Keycloak login...');
    res.redirect('/api/auth/keycloak');
});

// GET - Keycloak authentication
router.get('/keycloak', 
    passport.authenticate('keycloak', { 
        scope: ['openid', 'profile', 'email'] 
    })
);

// GET - Keycloak callback
router.get('/keycloak/callback', 
    passport.authenticate('keycloak', { 
        failureRedirect: '/api/auth/failure',
        failureMessage: true 
    }),
    (req, res) => {
        console.log('✅ Keycloak authentication successful');
        console.log('👤 User authenticated:', req.user ? req.user.username : 'No user');
        
        // Redirect ke frontend dengan token atau session
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3003'}/dashboard`);
    }
);

// GET - Authentication failure
router.get('/failure', (req, res) => {
    console.error('❌ Authentication failed:', req.session.messages);
    res.status(401).json({
        success: false,
        message: 'Authentication failed',
        error: req.session.messages || 'Unknown error'
    });
});

// GET - Logout
router.get('/logout', (req, res) => {
    console.log('👋 Logging out user...');
    
    req.logout((err) => {
        if (err) {
            console.error('❌ Error during logout:', err);
            return res.status(500).json({
                success: false,
                message: 'Logout failed'
            });
        }
        
        // Redirect ke Keycloak logout
        const logoutUrl = `${KEYCLOAK_CONFIG.serverUrl}/realms/${KEYCLOAK_CONFIG.realm}/protocol/openid-connect/logout`;
        console.log('🚪 Redirecting to Keycloak logout');
        res.redirect(logoutUrl);
    });
});

// GET - Current user session
router.get('/me', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({
            success: false,
            message: 'Not authenticated'
        });
    }
    
    // Siapkan user data untuk response
    const userData = {
        id: req.user.id || req.user.sub,
        username: req.user.username || req.user.preferred_username,
        email: req.user.email,
        firstName: req.user.given_name || req.user.firstName,
        lastName: req.user.family_name || req.user.lastName,
        fullName: req.user.name,
        roles: req.user.role || [],
        isAuthenticated: true
    };
    
    res.status(200).json({
        success: true,
        message: 'User authenticated',
        data: userData
    });
});

// POST - Manual login dengan username/password (untuk testing)
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message: 'Username dan password diperlukan'
        });
    }
    
    try {
        // Simulasi login ke Keycloak
        // Di production, gunakan passport.authenticate
        const loginUrl = `${KEYCLOAK_CONFIG.serverUrl}/realms/${KEYCLOAK_CONFIG.realm}/protocol/openid-connect/token`;
        
        const params = new URLSearchParams();
        params.append('grant_type', 'password');
        params.append('client_id', KEYCLOAK_CONFIG.clientId);
        params.append('client_secret', KEYCLOAK_CONFIG.clientSecret);
        params.append('username', username);
        params.append('password', password);
        params.append('scope', 'openid profile email');
        
        const response = await axios.post(loginUrl, params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        
        const tokenData = response.data;
        
        res.status(200).json({
            success: true,
            message: 'Login berhasil',
            data: {
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token,
                expires_in: tokenData.expires_in,
                token_type: tokenData.token_type
            }
        });
        
    } catch (error) {
        console.error('❌ Login error:', error.message);
        
        if (error.response && error.response.status === 401) {
            return res.status(401).json({
                success: false,
                message: 'Username atau password salah'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Login gagal',
            error: error.message
        });
    }
});

// POST - Refresh token
router.post('/refresh', async (req, res) => {
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
        return res.status(400).json({
            success: false,
            message: 'Refresh token diperlukan'
        });
    }
    
    try {
        const refreshUrl = `${KEYCLOAK_CONFIG.serverUrl}/realms/${KEYCLOAK_CONFIG.realm}/protocol/openid-connect/token`;
        
        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append('client_id', KEYCLOAK_CONFIG.clientId);
        params.append('client_secret', KEYCLOAK_CONFIG.clientSecret);
        params.append('refresh_token', refresh_token);
        
        const response = await axios.post(refreshUrl, params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        
        const tokenData = response.data;
        
        res.status(200).json({
            success: true,
            message: 'Token refreshed',
            data: {
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token,
                expires_in: tokenData.expires_in
            }
        });
        
    } catch (error) {
        console.error('❌ Refresh token error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Gagal refresh token',
            error: error.message
        });
    }
});

module.exports = router;