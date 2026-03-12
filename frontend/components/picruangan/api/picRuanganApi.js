// components/picruangan/api/picRuanganApi.js

const getToken = (session) => {
    return session?.accessToken || session?.token || session?.access_token || localStorage.getItem('token');
};

const handleResponse = async (response) => {
    const clonedResponse = response.clone();
    
    try {
        const text = await clonedResponse.text();
        
        let result;
        try {
            result = JSON.parse(text);
        } catch (e) {
            throw new Error('Response bukan format JSON yang valid');
        }
        
        return result;
    } catch (error) {
        throw error;
    }
};

const getBaseUrl = () => {
    // Cek apakah di browser
    if (typeof window !== 'undefined') {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        console.log('🔍 NEXT_PUBLIC_API_URL:', apiUrl);
        
        if (!apiUrl) {
            console.warn('⚠️ NEXT_PUBLIC_API_URL tidak ditemukan, menggunakan fallback http://localhost:5002/api');
            return 'http://localhost:5002/api';
        }
        return apiUrl.replace(/\/$/, '');
    }
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api';
};

// ========== PIC RUANGAN API ==========

/**
 * GET /api/picruangan
 * Mendapatkan semua data PIC ruangan
 */
export const fetchAllPicRuangan = async (session, params = {}) => {
    console.log('🔍 fetchAllPicRuangan dipanggil dengan params:', params);
    
    const token = getToken(session);
    
    if (!token) {
        console.error('❌ Token tidak ditemukan');
        return {
            success: false,
            message: 'Token tidak ditemukan',
            data: []
        };
    }
    
    const baseUrl = getBaseUrl();
    console.log('🔍 Base URL:', baseUrl);
    
    // Build query params
    const queryParams = new URLSearchParams();
    if (params.ruangan_id) queryParams.append('ruangan_id', params.ruangan_id);
    if (params.status && params.status !== 'all') queryParams.append('status', params.status);
    if (params.user_id) queryParams.append('user_id', params.user_id);
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    
    const url = `${baseUrl}/picruangan${queryParams.toString() ? `?${queryParams}` : ''}`;
    
    console.log('📤 Final URL:', url);
    console.log('📤 Method: GET');
    console.log('📤 Headers:', {
        'Authorization': `Bearer ${token.substring(0, 20)}...`,
        'Content-Type': 'application/json'
    });
    
    // Gunakan AbortController untuk timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        console.error('❌ Request timeout after 10 seconds');
        controller.abort();
    }, 10000);
    
    try {
        console.log('📤 Sending request...');
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            signal: controller.signal,
            cache: 'no-store'
        });
        
        clearTimeout(timeoutId);
        
        console.log('📥 Response status:', response.status);
        console.log('📥 Response status text:', response.statusText);
        
        if (!response.ok) {
            let errorMessage = `HTTP Error ${response.status}`;
            try {
                const errorText = await response.text();
                console.error('❌ Error response:', errorText);
                errorMessage = `${errorMessage}: ${errorText}`;
            } catch {
                errorMessage = `${errorMessage}: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }
        
        const data = await handleResponse(response);
        console.log('📥 Response data:', data);
        return data;
    } catch (error) {
        clearTimeout(timeoutId);
        console.error('❌ Fetch error:', error);
        console.error('❌ Error name:', error.name);
        console.error('❌ Error message:', error.message);
        
        let errorMessage = 'Gagal terhubung ke server';
        
        if (error.name === 'AbortError') {
            errorMessage = 'Request timeout. Server tidak merespons setelah 10 detik.';
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            errorMessage = `Tidak dapat terhubung ke server. Pastikan backend running di ${baseUrl}`;
            console.error('💡 Tips:');
            console.error('   1. Pastikan backend sudah dijalankan (cd backend && npm run dev)');
            console.error('   2. Pastikan backend berjalan di port 5002');
            console.error('   3. Cek apakah endpoint /api/picruangan sudah ada di backend');
            console.error('   4. Coba akses langsung: curl ' + url);
        } else {
            errorMessage = error.message;
        }
        
        return {
            success: false,
            message: errorMessage,
            data: []
        };
    }
};

// ... (fungsi lainnya tetap sama, dengan perubahan URL yang sama)

/**
 * GET /api/picruangan/:id
 * Mendapatkan data PIC ruangan berdasarkan ID
 */
export const fetchPicRuanganById = async (session, id) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan'
        };
    }
    
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/picruangan/${id}`;
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        return await handleResponse(response);
    } catch (error) {
        return {
            success: false,
            message: error.message
        };
    }
};

/**
 * GET /api/picruangan/user/:userId
 * Mendapatkan PIC by user ID
 */
export const fetchPicByUser = async (session, userId) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan',
            data: []
        };
    }
    
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/picruangan/user/${userId}`;
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        return await handleResponse(response);
    } catch (error) {
        return {
            success: false,
            message: error.message,
            data: []
        };
    }
};

/**
 * GET /api/picruangan/ruangan/:ruanganId
 * Mendapatkan PIC by ruangan ID
 */
export const fetchPicByRuangan = async (session, ruanganId) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan',
            data: []
        };
    }
    
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/picruangan/ruangan/${ruanganId}`;
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        return await handleResponse(response);
    } catch (error) {
        return {
            success: false,
            message: error.message,
            data: []
        };
    }
};

/**
 * GET /api/picruangan/status/aktif
 * Mendapatkan semua PIC aktif
 */
export const fetchPicAktif = async (session) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan',
            data: []
        };
    }
    
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/picruangan/status/aktif`;
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        return await handleResponse(response);
    } catch (error) {
        return {
            success: false,
            message: error.message,
            data: []
        };
    }
};

/**
 * POST /api/picruangan
 * Membuat data PIC ruangan baru
 */
export const createPicRuangan = async (session, data) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan'
        };
    }
    
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/picruangan`;
    
    console.log('📤 POST to:', url);
    console.log('📤 Data:', data);
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        return await handleResponse(response);
    } catch (error) {
        console.error('Error creating PIC ruangan:', error);
        return {
            success: false,
            message: error.message
        };
    }
};

/**
 * PUT /api/picruangan/:id
 * Mengupdate data PIC ruangan
 */
export const updatePicRuangan = async (session, id, data) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan'
        };
    }
    
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/picruangan/${id}`;
    
    console.log('📤 PUT to:', url);
    console.log('📤 Data:', data);
    
    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        return await handleResponse(response);
    } catch (error) {
        console.error('Error updating PIC ruangan:', error);
        return {
            success: false,
            message: error.message
        };
    }
};

/**
 * DELETE /api/picruangan/:id
 * Menghapus data PIC ruangan
 */
export const deletePicRuangan = async (session, id) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan'
        };
    }
    
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/picruangan/${id}`;
    
    console.log('📤 DELETE to:', url);
    
    try {
        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        return await handleResponse(response);
    } catch (error) {
        console.error('Error deleting PIC ruangan:', error);
        return {
            success: false,
            message: error.message
        };
    }
};

/**
 * GET /api/picruangan/statistics
 * Mendapatkan statistik PIC ruangan
 */
export const fetchPicStatistics = async (session) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan',
            data: {
                total: 0,
                aktif: 0,
                nonaktif: 0,
                unique_users: 0,
                unique_rooms: 0
            }
        };
    }
    
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/picruangan/statistics`;
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        return await handleResponse(response);
    } catch (error) {
        console.error('Error fetching statistics:', error);
        return {
            success: false,
            message: error.message,
            data: {
                total: 0,
                aktif: 0,
                nonaktif: 0,
                unique_users: 0,
                unique_rooms: 0
            }
        };
    }
};

// ========== OPTIONS API - DIPERBAIKI UNTUK FILTER ROLE ==========

/**
 * GET /api/picruangan/options/users?role=pic_ruangan
 * Mendapatkan daftar user dengan role PIC Ruangan dari Keycloak untuk dropdown
 */
// components/picruangan/api/picRuanganApi.js

/**
 * GET /api/picruangan/options/users?role=pic_ruangan
 * Mendapatkan daftar user dengan role PIC Ruangan dari Keycloak untuk dropdown
 */
export const fetchUserOptions = async (session) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan',
            data: []
        };
    }
    
    const baseUrl = getBaseUrl();
    // PASTIKAN parameter role=pic_ruangan dikirim
    const url = `${baseUrl}/picruangan/options/users?role=pic_ruangan`;
    
    console.log('📤 Fetching PIC user options from:', url);
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const result = await handleResponse(response);
        console.log('📥 User options response:', result);
        
        return {
            success: true,
            data: result.data || [],
            message: result.message || 'Data user berhasil dimuat'
        };
    } catch (error) {
        console.error('Error fetching user options:', error);
        return {
            success: false,
            message: error.message,
            data: []
        };
    }
};

/**
 * GET /api/picruangan/options/ruangan
 * Mendapatkan daftar ruangan untuk dropdown
 */
export const fetchRuanganOptions = async (session) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan',
            data: []
        };
    }
    
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/picruangan/options/ruangan`;
    
    console.log('📤 Fetching ruangan options from:', url);
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const result = await handleResponse(response);
        console.log('📥 Ruangan options response:', result);
        
        return {
            success: true,
            data: result.data || [],
            message: result.message || 'Data ruangan berhasil dimuat'
        };
    } catch (error) {
        console.error('Error fetching ruangan options:', error);
        return {
            success: false,
            message: error.message,
            data: []
        };
    }
};

// ========== ALIASES ==========
export const getAll = fetchAllPicRuangan;
export const getById = fetchPicRuanganById;
export const create = createPicRuangan;
export const update = updatePicRuangan;
export const remove = deletePicRuangan;
export const getStats = fetchPicStatistics;
export const getUserOptions = fetchUserOptions;
export const getRuanganOptions = fetchRuanganOptions;

// ========== DEFAULT EXPORT ==========
export default {
    fetchAllPicRuangan,
    fetchPicRuanganById,
    fetchPicByUser,
    fetchPicByRuangan,
    fetchPicAktif,
    createPicRuangan,
    updatePicRuangan,
    deletePicRuangan,
    fetchPicStatistics,
    fetchUserOptions,
    fetchRuanganOptions,
    
    getAll: fetchAllPicRuangan,
    getById: fetchPicRuanganById,
    create: createPicRuangan,
    update: updatePicRuangan,
    remove: deletePicRuangan,
    getStats: fetchPicStatistics,
    getUserOptions: fetchUserOptions,
    getRuanganOptions: fetchRuanganOptions
};