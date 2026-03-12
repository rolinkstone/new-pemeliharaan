// components/aset/api/asetApi.js

/**
 * Helper untuk mendapatkan token
 */
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

// UPDATE SEMUA FETCH FUNCTION DENGAN HEADER NO-CACHE
export const fetchAllAset = async (session) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan',
            data: []
        };
    }
    
    const baseUrl = process.env.NEXT_PUBLIC_API_URL;
    const url = `${baseUrl}/aset`;
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
            cache: 'no-store' // Untuk Next.js fetch
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
 * GET /api/aset/:id
 * Mendapatkan data aset berdasarkan ID
 */
export const fetchAsetById = async (session, id) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan'
        };
    }
    
    const baseUrl = process.env.NEXT_PUBLIC_API_URL;
    const url = `${baseUrl}/aset/${id}`;
    
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
 * POST /api/aset
 * Membuat data aset baru
 */
export const createAset = async (session, data) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan'
        };
    }
    
    const baseUrl = process.env.NEXT_PUBLIC_API_URL;
    const url = `${baseUrl}/aset`;
    
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
        
        const result = await handleResponse(response);
        console.log('📥 Response:', result);
        return result;
    } catch (error) {
        console.error('❌ Error:', error);
        return {
            success: false,
            message: error.message
        };
    }
};

/**
 * PUT /api/aset/:id
 * Mengupdate data aset
 */
export const updateAset = async (session, id, data) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan'
        };
    }
    
    const baseUrl = process.env.NEXT_PUBLIC_API_URL;
    const url = `${baseUrl}/aset/${id}`;
    
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
        
        const result = await handleResponse(response);
        console.log('📥 Response:', result);
        return result;
    } catch (error) {
        console.error('❌ Error:', error);
        return {
            success: false,
            message: error.message
        };
    }
};

/**
 * DELETE /api/aset/:id
 * Menghapus data aset
 */
export const deleteAset = async (session, id) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan'
        };
    }
    
    const baseUrl = process.env.NEXT_PUBLIC_API_URL;
    const url = `${baseUrl}/aset/${id}`;
    
    console.log('📤 DELETE to:', url);
    
    try {
        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const result = await handleResponse(response);
        console.log('📥 Response:', result);
        return result;
    } catch (error) {
        console.error('❌ Error:', error);
        return {
            success: false,
            message: error.message
        };
    }
};

// ========== SEARCH & FILTER API ==========

/**
 * GET /api/aset/search/:keyword
 * Mencari aset berdasarkan keyword
 */
export const searchAset = async (session, keyword) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan',
            data: []
        };
    }
    
    const baseUrl = process.env.NEXT_PUBLIC_API_URL;
    const url = `${baseUrl}/aset/search/${encodeURIComponent(keyword)}`;
    
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
 * GET /api/aset/jenis/:jenis
 * Filter aset berdasarkan jenis BMN
 */
export const filterByJenis = async (session, jenis) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan',
            data: []
        };
    }
    
    const baseUrl = process.env.NEXT_PUBLIC_API_URL;
    const url = `${baseUrl}/aset/jenis/${encodeURIComponent(jenis)}`;
    
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
 * GET /api/aset/kondisi/:kondisi
 * Filter aset berdasarkan kondisi
 */
export const filterByKondisi = async (session, kondisi) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan',
            data: []
        };
    }
    
    const baseUrl = process.env.NEXT_PUBLIC_API_URL;
    const url = `${baseUrl}/aset/kondisi/${encodeURIComponent(kondisi)}`;
    
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
 * GET /api/aset/status/:status
 * Filter aset berdasarkan status BMN
 */
export const filterByStatus = async (session, status) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan',
            data: []
        };
    }
    
    const baseUrl = process.env.NEXT_PUBLIC_API_URL;
    const url = `${baseUrl}/aset/status/${encodeURIComponent(status)}`;
    
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

// ========== METADATA API ==========

/**
 * GET /api/aset/metadata/jenis
 * Mendapatkan daftar jenis BMN
 */
export const fetchJenisList = async (session) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan',
            data: []
        };
    }
    
    const baseUrl = process.env.NEXT_PUBLIC_API_URL;
    const url = `${baseUrl}/aset/metadata/jenis`;
    
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
 * GET /api/aset/metadata/kondisi
 * Mendapatkan daftar kondisi aset
 */
export const fetchKondisiList = async (session) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan',
            data: []
        };
    }
    
    const baseUrl = process.env.NEXT_PUBLIC_API_URL;
    const url = `${baseUrl}/aset/metadata/kondisi`;
    
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

// ========== STATISTICS API ==========

/**
 * GET /api/aset/statistics/summary
 * Mendapatkan statistik aset
 */
export const fetchStatistics = async (session) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan',
            data: {
                total_aset: 0,
                per_jenis: [],
                per_kondisi: [],
                per_status: [],
                per_intra_extra: []
            }
        };
    }
    
    const baseUrl = process.env.NEXT_PUBLIC_API_URL;
    const url = `${baseUrl}/aset/statistics/summary`;
    
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
                total_aset: 0,
                per_jenis: [],
                per_kondisi: [],
                per_status: [],
                per_intra_extra: []
            }
        };
    }
};

// ========== PAGINATION API ==========

/**
 * GET /api/aset/page/:page
 * Mendapatkan data aset dengan pagination
 */
export const fetchPaginatedAset = async (session, page = 1, limit = 20) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan',
            data: [],
            pagination: {
                current_page: 1,
                per_page: limit,
                total: 0,
                total_pages: 0
            }
        };
    }
    
    const baseUrl = process.env.NEXT_PUBLIC_API_URL;
    const url = `${baseUrl}/aset/page/${page}?limit=${limit}`;
    
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
            data: [],
            pagination: {
                current_page: 1,
                per_page: limit,
                total: 0,
                total_pages: 0
            }
        };
    }
};

// ========== ALIASES FOR BACKWARD COMPATIBILITY ==========
export const getAll = fetchAllAset;
export const getById = fetchAsetById;
export const create = createAset;
export const update = updateAset;
export const remove = deleteAset;
export const search = searchAset;
export const filterJenis = filterByJenis;
export const filterKondisi = filterByKondisi;
export const filterStatus = filterByStatus;
export const getJenis = fetchJenisList;
export const getKondisi = fetchKondisiList;
export const getStats = fetchStatistics;
export const getPaginated = fetchPaginatedAset;

// ========== DEFAULT EXPORT WITH ALL FUNCTIONS ==========
export default {
    // Original functions
    fetchAllAset,
    fetchAsetById,
    createAset,
    updateAset,
    deleteAset,
    searchAset,
    filterByJenis,
    filterByKondisi,
    filterByStatus,
    fetchJenisList,
    fetchKondisiList,
    fetchStatistics,
    fetchPaginatedAset,
    
    // Aliases
    getAll: fetchAllAset,
    getById: fetchAsetById,
    create: createAset,
    update: updateAset,
    remove: deleteAset,
    search: searchAset,
    filterJenis: filterByJenis,
    filterKondisi: filterByKondisi,
    filterStatus: filterByStatus,
    getJenis: fetchJenisList,
    getKondisi: fetchKondisiList,
    getStats: fetchStatistics,
    getPaginated: fetchPaginatedAset,
};