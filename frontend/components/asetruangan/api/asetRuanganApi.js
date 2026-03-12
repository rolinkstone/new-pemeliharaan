/**
 * Helper untuk mendapatkan token
 */
const getToken = (session) => {
    return session?.accessToken || session?.token || session?.access_token || localStorage.getItem('token');
};

/**
 * Helper untuk handle response
 */
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

// ========== MASTER ASET RUANGAN API ==========

/**
 * GET /api/asetRuangan
 * Mendapatkan semua data posisi aset di ruangan
 */
export const fetchAllAsetRuangan = async (session, params = {}) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan',
            data: []
        };
    }
    
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api';
    
    // Build query params
    const queryParams = new URLSearchParams();
    if (params.status && params.status !== 'all') queryParams.append('status', params.status);
    if (params.aset_id) queryParams.append('aset_id', params.aset_id);
    if (params.ruangan_id) queryParams.append('ruangan_id', params.ruangan_id);
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    
    const url = `${baseUrl}/asetRuangan${queryParams.toString() ? `?${queryParams}` : ''}`;
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            cache: 'no-store'
        });
        
        return await handleResponse(response);
    } catch (error) {
        console.error('Error fetching aset ruangan:', error);
        return {
            success: false,
            message: error.message,
            data: []
        };
    }
};

/**
 * GET /api/asetRuangan/:id
 * Mendapatkan data posisi aset berdasarkan ID
 */
export const fetchAsetRuanganById = async (session, id) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan'
        };
    }
    
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api';
    const url = `${baseUrl}/asetRuangan/${id}`;
    
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
 * GET /api/asetRuangan/aset/:asetId
 * Mendapatkan riwayat posisi aset berdasarkan aset_id
 */
export const fetchRiwayatAset = async (session, asetId) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan',
            data: []
        };
    }
    
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api';
    const url = `${baseUrl}/asetRuangan/aset/${asetId}`;
    
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
 * GET /api/asetRuangan/ruangan/:ruanganId
 * Mendapatkan daftar aset di ruangan tertentu
 */
export const fetchAsetByRuangan = async (session, ruanganId) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan',
            data: []
        };
    }
    
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api';
    const url = `${baseUrl}/asetRuangan/ruangan/${ruanganId}`;
    
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
 * GET /api/asetRuangan/status/aktif
 * Mendapatkan semua posisi aset yang aktif
 */
export const fetchAsetRuanganAktif = async (session) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan',
            data: []
        };
    }
    
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api';
    const url = `${baseUrl}/asetRuangan/status/aktif`;
    
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
 * POST /api/asetRuangan
 * Membuat data posisi aset baru (initial placement)
 */
export const createAsetRuangan = async (session, data) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan'
        };
    }
    
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api';
    const url = `${baseUrl}/asetRuangan`;
    
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
        console.error('Error creating aset ruangan:', error);
        return {
            success: false,
            message: error.message
        };
    }
};

/**
 * POST /api/asetRuangan/pindah
 * Memindahkan aset ke ruangan lain
 */
export const pindahAset = async (session, data) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan'
        };
    }
    
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api';
    const url = `${baseUrl}/asetRuangan/pindah`;
    
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
        console.error('Error moving aset:', error);
        return {
            success: false,
            message: error.message
        };
    }
};

/**
 * POST /api/asetRuangan/:id/keluar
 * Mencatat aset keluar dari ruangan (dihapuskan)
 */
export const catatKeluarAset = async (session, id, data) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan'
        };
    }
    
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api';
    const url = `${baseUrl}/asetRuangan/${id}/keluar`;
    
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
        console.error('Error catat keluar:', error);
        return {
            success: false,
            message: error.message
        };
    }
};

/**
 * PUT /api/asetRuangan/:id
 * Mengupdate data posisi aset
 */
export const updateAsetRuangan = async (session, id, data) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan'
        };
    }
    
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api';
    const url = `${baseUrl}/asetRuangan/${id}`;
    
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
        console.error('Error updating aset ruangan:', error);
        return {
            success: false,
            message: error.message
        };
    }
};

/**
 * DELETE /api/asetRuangan/:id
 * Menghapus data posisi aset
 */
export const deleteAsetRuangan = async (session, id) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan'
        };
    }
    
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api';
    const url = `${baseUrl}/asetRuangan/${id}`;
    
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
        console.error('Error deleting aset ruangan:', error);
        return {
            success: false,
            message: error.message
        };
    }
};

// ========== STATISTICS API ==========

/**
 * GET /api/asetRuangan/statistics
 * Mendapatkan statistik posisi aset
 */
export const fetchAsetRuanganStatistics = async (session) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan',
            data: {
                total: 0,
                aktif: 0,
                dipindah: 0,
                dihapuskan: 0,
                unique_aset: 0
            }
        };
    }
    
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api';
    const url = `${baseUrl}/asetruangan/statistics`;
    
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
            data: {
                total: 0,
                aktif: 0,
                dipindah: 0,
                dihapuskan: 0,
                unique_aset: 0
            }
        };
    }
};

// ========== OPTIONS API ==========

/**
 * GET /api/asetRuangan/options/aset
 * Mendapatkan daftar aset untuk dropdown
 */
export const fetchAsetOptions = async (session) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan',
            data: []
        };
    }
    
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api';
    const url = `${baseUrl}/asetRuangan/options/aset`;
    
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
 * GET /api/asetRuangan/options/ruangan
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
    
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api';
    const url = `${baseUrl}/asetRuangan/options/ruangan`;
    
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

// ========== ALIASES FOR BACKWARD COMPATIBILITY ==========
export const getAll = fetchAllAsetRuangan;
export const getById = fetchAsetRuanganById;
export const create = createAsetRuangan;
export const update = updateAsetRuangan;
export const remove = deleteAsetRuangan;
export const getRiwayat = fetchRiwayatAset;
export const getByRuangan = fetchAsetByRuangan;
export const getAktif = fetchAsetRuanganAktif;
export const pindah = pindahAset;
export const keluar = catatKeluarAset;
export const getStats = fetchAsetRuanganStatistics;
export const getAsetOptions = fetchAsetOptions;
export const getRuanganOptions = fetchRuanganOptions;

// ========== DEFAULT EXPORT WITH ALL FUNCTIONS ==========
export default {
    fetchAllAsetRuangan,
    fetchAsetRuanganById,
    fetchRiwayatAset,
    fetchAsetByRuangan,
    fetchAsetRuanganAktif,
    createAsetRuangan,
    pindahAset,
    catatKeluarAset,
    updateAsetRuangan,
    deleteAsetRuangan,
    fetchAsetRuanganStatistics,
    fetchAsetOptions,
    fetchRuanganOptions,
    
    getAll: fetchAllAsetRuangan,
    getById: fetchAsetRuanganById,
    create: createAsetRuangan,
    update: updateAsetRuangan,
    remove: deleteAsetRuangan,
    getRiwayat: fetchRiwayatAset,
    getByRuangan: fetchAsetByRuangan,
    getAktif: fetchAsetRuanganAktif,
    pindah: pindahAset,
    keluar: catatKeluarAset,
    getStats: fetchAsetRuanganStatistics,
    getAsetOptions: fetchAsetOptions,
    getRuanganOptions: fetchRuanganOptions,
};