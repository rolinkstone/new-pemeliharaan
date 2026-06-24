// backend/utils/routeHelpers.js
// Shared helper functions untuk semua route files
// Digunakan untuk menghindari duplikasi kode

/**
 * Mendapatkan username dari token user
 * @param {object} user - User object dari request
 * @returns {string} Username atau 'unknown'
 */
function getUsernameFromToken(user) {
    return user?.preferred_username || user?.username || 'unknown';
}

/**
 * Decode JWT token tanpa verifikasi (hanya untuk ekstraksi data)
 * @param {string} token - JWT token
 * @returns {object|null} Decoded payload atau null
 */
function decodeToken(token) {
    try {
        if (!token) return null;
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(Buffer.from(base64, 'base64').toString());
        return payload;
    } catch (error) {
        console.error('Error decoding token:', error.message);
        return null;
    }
}

/**
 * Format tanggal ke format MySQL (YYYY-MM-DD)
 * Versi date-only, tanpa komponen waktu
 * @param {string|Date} dateValue - Nilai tanggal input
 * @returns {string|null} Tanggal format YYYY-MM-DD atau null
 */
function formatDateForMySQL(dateValue) {
    if (!dateValue) return null;
    
    if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        return dateValue;
    }
    
    if (typeof dateValue === 'string' && dateValue.includes('T')) {
        return dateValue.split('T')[0];
    }
    
    try {
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) return null;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch {
        return null;
    }
}

/**
 * Format tanggal ke format MySQL DATETIME (YYYY-MM-DD HH:MM:SS)
 * @param {string|Date} dateValue - Nilai tanggal input
 * @returns {string|null} Datetime format YYYY-MM-DD HH:MM:SS atau null
 */
function formatDateTimeForMySQL(dateValue) {
    if (!dateValue) return null;
    if (typeof dateValue === 'string' && dateValue.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
        return dateValue;
    }
    if (typeof dateValue === 'string' && dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return `${dateValue} 00:00:00`;
    }
    try {
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) return null;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch (error) {
        return null;
    }
}

/**
 * Mendapatkan daftar roles user dari berbagai sumber (req object)
 * @param {object} req - Express request object
 * @returns {string[]} Array of role names
 */
function getUserRolesFromRequest(req) {
    const roles = new Set();
    
    // 1. Dari user object yang sudah diparse oleh keycloakAuth
    if (req.user) {
        if (req.user.realm_access && req.user.realm_access.roles) {
            req.user.realm_access.roles.forEach(role => roles.add(role));
        }
        if (req.user.resource_access) {
            Object.values(req.user.resource_access).forEach(resource => {
                if (resource.roles) {
                    resource.roles.forEach(role => roles.add(role));
                }
            });
        }
        if (req.user.role) {
            if (Array.isArray(req.user.role)) {
                req.user.role.forEach(role => roles.add(role));
            } else {
                roles.add(req.user.role);
            }
        }
        if (req.user.roles && Array.isArray(req.user.roles)) {
            req.user.roles.forEach(role => roles.add(role));
        }
        if (req.user.user && req.user.user.role) {
            roles.add(req.user.user.role);
        }
    }
    
    // 2. Dari header Authorization (token JWT)
    const authHeader = req.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const decodedToken = decodeToken(token);
        if (decodedToken) {
            if (decodedToken.realm_access && decodedToken.realm_access.roles) {
                decodedToken.realm_access.roles.forEach(role => roles.add(role));
            }
            if (decodedToken.resource_access) {
                Object.values(decodedToken.resource_access).forEach(resource => {
                    if (resource.roles) {
                        resource.roles.forEach(role => roles.add(role));
                    }
                });
            }
        }
    }
    
    // 3. Dari body request (jika ada session dengan accessToken)
    if (req.body && req.body.session && req.body.session.accessToken) {
        const decodedToken = decodeToken(req.body.session.accessToken);
        if (decodedToken) {
            if (decodedToken.realm_access && decodedToken.realm_access.roles) {
                decodedToken.realm_access.roles.forEach(role => roles.add(role));
            }
            if (decodedToken.resource_access) {
                Object.values(decodedToken.resource_access).forEach(resource => {
                    if (resource.roles) {
                        resource.roles.forEach(role => roles.add(role));
                    }
                });
            }
        }
    }
    
    return Array.from(roles);
}

/**
 * Cek apakah user memiliki role yang diizinkan (req-based)
 * @param {object} req - Express request object
 * @param {string[]} allowedRoles - Daftar role yang diizinkan
 * @returns {boolean}
 */
function hasRole(req, allowedRoles) {
    const roles = getUserRolesFromRequest(req);
    return allowedRoles.some(role => roles.includes(role));
}

/**
 * Cek apakah user dapat memodifikasi data (admin_pemeliharaan/admin/superadmin)
 * @param {object} req - Express request object
 * @returns {boolean}
 */
function canModifyData(req) {
    return hasRole(req, ['admin_pemeliharaan', 'admin', 'superadmin']);
}

module.exports = {
    getUsernameFromToken,
    decodeToken,
    formatDateForMySQL,
    formatDateTimeForMySQL,
    getUserRolesFromRequest,
    hasRole,
    canModifyData
};
