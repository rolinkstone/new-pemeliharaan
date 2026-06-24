// components/laporanrusak/api/laporanRusakApi.js

const getToken = (session) => {
    return session?.accessToken || session?.token || session?.access_token || localStorage.getItem('token');
};

const handleResponse = async (response) => {
    // Cek content-type terlebih dahulu
    const contentType = response.headers.get('content-type');
    
    if (!contentType || !contentType.includes('application/json')) {
        // Jika bukan JSON, baca sebagai text
        const text = await response.text();
        console.error('Response bukan JSON:', text.substring(0, 200));
        
        // Cek apakah itu HTML error
        if (text.includes('<!DOCTYPE html>')) {
            throw new Error(`Server mengembalikan HTML error (status ${response.status}). Kemungkinan endpoint salah.`);
        }
        
        throw new Error(`Response bukan format JSON: ${text.substring(0, 100)}`);
    }
    
    try {
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error parsing JSON:', error);
        throw new Error('Gagal memproses response dari server');
    }
};

const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        console.log('🔍 NEXT_PUBLIC_API_URL:', apiUrl);
        
        
    }
    return process.env.NEXT_PUBLIC_API_URL ;
};

// ============================================
// KONSTANTA STATUS - SESUAI DENGAN DATABASE ANDA
// ============================================
const STATUS = {
    DRAFT: 'draft',
    MENUNGGU_VERIFIKASI_PIC: 'menunggu_verifikasi_pic',
    MENUNGGU_DISPOSISI: 'menunggu_disposisi',
    MENUNGGU_VERIFIKASI_PPK: 'menunggu_verifikasi_ppk',
    DIVERIFIKASI_PPK: 'diverifikasi_ppk',
    DALAM_PERBAIKAN: 'dalam_perbaikan',
    SELESAI: 'selesai',
    DITOLAK: 'ditolak'
};

// ============================================
// FUNGSI VALIDASI STATUS
// ============================================
const validateStatus = (status) => {
    if (!status) {
        console.warn('⚠️ Status tidak ada, menggunakan default: menunggu_verifikasi_pic');
        return STATUS.MENUNGGU_VERIFIKASI_PIC;
    }
    
    const validStatuses = Object.values(STATUS);
    if (validStatuses.includes(status)) {
        return status;
    }
    
    console.warn(`⚠️ Status tidak valid: ${status}, menggunakan default: menunggu_verifikasi_pic`);
    return STATUS.MENUNGGU_VERIFIKASI_PIC;
};

// ========== LAPORAN RUSAK API ==========

/**
 * GET /api/laporansrusak
 * Mendapatkan semua data laporan rusak
 */
const fetchAllLaporanRusak = async (session, params = {}) => {
    console.log('🔍 fetchAllLaporanRusak dipanggil dengan params:', params);
    
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
    if (params.pelapor_id) queryParams.append('pelapor_id', params.pelapor_id);
    if (params.prioritas && params.prioritas !== 'all') queryParams.append('prioritas', params.prioritas);
    if (params.aset_id) queryParams.append('aset_id', params.aset_id);
    if (params.search) queryParams.append('search', params.search);
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    
    const url = `${baseUrl}/laporansrusak${queryParams.toString() ? `?${queryParams}` : ''}`;
    
    console.log('📤 Final URL:', url);
    
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
        console.log('📥 Content-Type:', response.headers.get('content-type'));
        
        if (!response.ok) {
            let errorMessage = `HTTP Error ${response.status}`;
            try {
                const errorText = await response.text();
                console.error('❌ Error response:', errorText.substring(0, 500));
                
                if (response.status === 404) {
                    if (errorText.includes('Cannot GET')) {
                        errorMessage = `Endpoint tidak ditemukan: ${url}. Pastikan backend sudah memiliki route /api/laporansrusak`;
                    } else {
                        errorMessage = `Data tidak ditemukan (404)`;
                    }
                } else if (response.status === 401) {
                    errorMessage = 'Unauthorized: Token tidak valid atau expired';
                } else if (response.status === 403) {
                    errorMessage = 'Forbidden: Anda tidak memiliki akses';
                } else if (response.status === 500) {
                    errorMessage = 'Internal Server Error: Terjadi kesalahan di server';
                } else {
                    errorMessage = `${errorMessage}: ${errorText.substring(0, 100)}`;
                }
            } catch {
                errorMessage = `${errorMessage}: ${response.statusText}`;
            }
            
            return {
                success: false,
                message: errorMessage,
                data: []
            };
        }
        
        const data = await handleResponse(response);
        console.log('📥 Response data:', data);
        return data;
    } catch (error) {
        clearTimeout(timeoutId);
        console.error('❌ Fetch error:', error);
        
        let errorMessage = 'Gagal terhubung ke server';
        
        if (error.name === 'AbortError') {
            errorMessage = 'Request timeout. Server tidak merespons setelah 10 detik.';
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            errorMessage = `Tidak dapat terhubung ke server. Pastikan backend running di ${baseUrl}`;
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

/**
 * GET /api/laporansrusak/:id
 */
const fetchLaporanRusakById = async (session, id) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan'
        };
    }
    
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/laporansrusak/${id}`;
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            let errorMessage = `HTTP Error ${response.status}`;
            try {
                const errorText = await response.text();
                errorMessage = `${errorMessage}: ${errorText.substring(0, 100)}`;
            } catch {
                errorMessage = `${errorMessage}: ${response.statusText}`;
            }
            
            return {
                success: false,
                message: errorMessage
            };
        }
        
        const result = await handleResponse(response);
        
        if (result.success && result.data) {
            result.data.status = validateStatus(result.data.status);
        }
        
        return result;
    } catch (error) {
        console.error('Error fetching laporan by id:', error);
        return {
            success: false,
            message: error.message
        };
    }
};

/**
 * GET /api/laporansrusak/user/:userId
 */
const fetchLaporanByUser = async (session, userId) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan',
            data: []
        };
    }
    
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/laporansrusak/user/${userId}`;
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            let errorMessage = `HTTP Error ${response.status}`;
            try {
                const errorText = await response.text();
                errorMessage = `${errorMessage}: ${errorText.substring(0, 100)}`;
            } catch {
                errorMessage = `${errorMessage}: ${response.statusText}`;
            }
            
            return {
                success: false,
                message: errorMessage,
                data: []
            };
        }
        
        const result = await handleResponse(response);
        
        if (result.success && Array.isArray(result.data)) {
            result.data = result.data.map(item => ({
                ...item,
                status: validateStatus(item.status)
            }));
        }
        
        return result;
    } catch (error) {
        console.error('Error fetching laporan by user:', error);
        return {
            success: false,
            message: error.message,
            data: []
        };
    }
};

/**
 * POST /api/laporansrusak
 */
const createLaporanRusak = async (session, data) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan'
        };
    }
    
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/laporansrusak`;
    
    const tgl_laporan = data.tgl_laporan instanceof Date 
        ? data.tgl_laporan.toISOString().split('T')[0]
        : data.tgl_laporan || new Date().toISOString().split('T')[0];
    
    const validStatus = validateStatus(data.status || STATUS.MENUNGGU_VERIFIKASI_PIC);
    
    const payload = {
        aset_id: data.aset_id,
        ruangan_id: data.ruangan_id,
        pelapor_id: data.pelapor_id || session?.user?.id || session?.user?.sub,
        tgl_laporan: tgl_laporan,
        deskripsi: data.deskripsi,
        foto_kerusakan: data.foto_kerusakan || [],
        prioritas: data.prioritas || 'sedang',
        status: validStatus
    };
    
    console.log('📤 Creating laporan with payload:', payload);
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            let errorMessage = `HTTP Error ${response.status}`;
            try {
                const errorText = await response.text();
                errorMessage = `${errorMessage}: ${errorText.substring(0, 100)}`;
            } catch {
                errorMessage = `${errorMessage}: ${response.statusText}`;
            }
            
            return {
                success: false,
                message: errorMessage
            };
        }
        
        const result = await handleResponse(response);
        
        if (result.success && result.data) {
            result.data.status = validateStatus(result.data.status);
        }
        
        return result;
    } catch (error) {
        console.error('Error creating laporan rusak:', error);
        return {
            success: false,
            message: error.message
        };
    }
};

/**
 * PUT /api/laporansrusak/:id
 */
const updateLaporanRusak = async (session, id, data) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan'
        };
    }
    
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/laporansrusak/${id}`;
    
    const validStatus = validateStatus(data.status);
    console.log('📝 Update - Status original:', data.status, 'Status valid:', validStatus);
    
    const payload = {
        aset_id: data.aset_id,
        ruangan_id: data.ruangan_id,
        deskripsi: data.deskripsi,
        foto_kerusakan: data.foto_kerusakan || [],
        prioritas: data.prioritas,
        status: validStatus
    };
    
    console.log('📤 Updating laporan with payload:', payload);
    
    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            let errorMessage = `HTTP Error ${response.status}`;
            try {
                const errorText = await response.text();
                errorMessage = `${errorMessage}: ${errorText.substring(0, 100)}`;
            } catch {
                errorMessage = `${errorMessage}: ${response.statusText}`;
            }
            
            return {
                success: false,
                message: errorMessage
            };
        }
        
        const result = await handleResponse(response);
        
        if (result.success && result.data) {
            result.data.status = validateStatus(result.data.status);
        }
        
        return result;
    } catch (error) {
        console.error('Error updating laporan rusak:', error);
        return {
            success: false,
            message: error.message
        };
    }
};

/**
 * DELETE /api/laporansrusak/:id
 */
const deleteLaporanRusak = async (session, id) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan'
        };
    }
    
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/laporansrusak/${id}`;
    
    try {
        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            let errorMessage = `HTTP Error ${response.status}`;
            try {
                const errorText = await response.text();
                errorMessage = `${errorMessage}: ${errorText.substring(0, 100)}`;
            } catch {
                errorMessage = `${errorMessage}: ${response.statusText}`;
            }
            
            return {
                success: false,
                message: errorMessage
            };
        }
        
        return await handleResponse(response);
    } catch (error) {
        console.error('Error deleting laporan rusak:', error);
        return {
            success: false,
            message: error.message
        };
    }
};

/**
 * POST /api/laporansrusak/:id/verifikasi
 * Untuk verifikasi laporan oleh PIC
 */
const verifikasiLaporan = async (session, id, data) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan'
        };
    }
    
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/laporansrusak/${id}/verifikasi`;
    
    console.log('📤 VERIFIKASI - URL:', url);
    console.log('📤 VERIFIKASI - Payload:', data);
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            return {
                success: false,
                message: `HTTP Error ${response.status}: ${errorText}`
            };
        }
        
        const result = await handleResponse(response);
        console.log('📥 Response verifikasi:', result);
        return result;
    } catch (error) {
        console.error('Error verifikasi laporan:', error);
        return {
            success: false,
            message: error.message
        };
    }
};

/**
 * POST /api/laporansrusak/:id/disposisi
 * Untuk disposisi oleh Kabag TU ke PPK
 */
const disposisiLaporan = async (session, id, data) => {
    const token = getToken(session);
    
    if (!token) {
        return { 
            success: false, 
            message: 'Token tidak ditemukan' 
        };
    }
    
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/laporansrusak/${id}/disposisi`;
    
    console.log('📤 DISPOSISI - URL:', url);
    console.log('📤 DISPOSISI - Payload:', data);
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            return {
                success: false,
                message: `HTTP Error ${response.status}: ${errorText}`
            };
        }
        
        const result = await handleResponse(response);
        console.log('📥 Response disposisi:', result);
        return result;
    } catch (error) {
        console.error('Error disposisi laporan:', error);
        return { 
            success: false, 
            message: error.message 
        };
    }
};

/**
 * POST /api/laporansrusak/:id/verifikasi-ppk
 * Untuk verifikasi oleh PPK
 */
const verifikasiPPK = async (session, id, data) => {
    const token = getToken(session);
    
    if (!token) {
        return { 
            success: false, 
            message: 'Token tidak ditemukan' 
        };
    }
    
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/laporansrusak/${id}/verifikasi-ppk`;
    
    console.log('📤 VERIFIKASI PPK - URL:', url);
    console.log('📤 VERIFIKASI PPK - Payload:', data);
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            return {
                success: false,
                message: `HTTP Error ${response.status}: ${errorText}`
            };
        }
        
        const result = await handleResponse(response);
        console.log('📥 Response verifikasi PPK:', result);
        return result;
    } catch (error) {
        console.error('Error verifikasi PPK:', error);
        return { 
            success: false, 
            message: error.message 
        };
    }
};

/**
 * POST /api/laporansrusak/:id/selesaikan-perbaikan
 * Untuk PIC Ruangan melaporkan hasil perbaikan
 */
const selesaikanPerbaikan = async (session, id, data) => {
    const token = getToken(session);
    
    if (!token) {
        return { 
            success: false, 
            message: 'Token tidak ditemukan' 
        };
    }
    
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/laporansrusak/${id}/selesaikan-perbaikan`;
    
    console.log('🔧 SELESAIKAN PERBAIKAN - URL:', url);
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            return {
                success: false,
                message: `HTTP Error ${response.status}: ${errorText}`
            };
        }
        
        const result = await handleResponse(response);
        console.log('📥 Response selesaikan perbaikan:', result);
        return result;
    } catch (error) {
        console.error('❌ Error selesaikan perbaikan:', error);
        return { 
            success: false, 
            message: error.message 
        };
    }
};

/**
 * GET /api/laporansrusak/:id/detail-perbaikan
 * Untuk mendapatkan detail perbaikan yang sudah dilakukan
 */
const getDetailPerbaikan = async (session, id) => {
    const token = getToken(session);
    
    if (!token) {
        return { 
            success: false, 
            message: 'Token tidak ditemukan' 
        };
    }
    
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/laporansrusak/${id}/detail-perbaikan`;
    
    console.log('🔍 GET DETAIL PERBAIKAN - URL:', url);
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            return {
                success: false,
                message: `HTTP Error ${response.status}: ${errorText}`
            };
        }
        
        const result = await handleResponse(response);
        console.log('📥 Response detail perbaikan:', result);
        return result;
    } catch (error) {
        console.error('Error get detail perbaikan:', error);
        return { 
            success: false, 
            message: error.message 
        };
    }
};

/**
 * GET /api/laporansrusak/statistics
 */
const fetchLaporanStatistics = async (session) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan',
            data: {
                total: 0,
                draft: 0,
                menunggu_verifikasi_pic: 0,
                menunggu_disposisi: 0,
                menunggu_verifikasi_ppk: 0,
                diverifikasi_ppk: 0,
                dalam_perbaikan: 0,
                selesai: 0,
                ditolak: 0
            }
        };
    }
    
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/laporansrusak/statistics`;
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            let errorMessage = `HTTP Error ${response.status}`;
            try {
                const errorText = await response.text();
                errorMessage = `${errorMessage}: ${errorText.substring(0, 100)}`;
            } catch {
                errorMessage = `${errorMessage}: ${response.statusText}`;
            }
            
            return {
                success: false,
                message: errorMessage,
                data: {
                    total: 0,
                    draft: 0,
                    menunggu_verifikasi_pic: 0,
                    menunggu_disposisi: 0,
                    menunggu_verifikasi_ppk: 0,
                    diverifikasi_ppk: 0,
                    dalam_perbaikan: 0,
                    selesai: 0,
                    ditolak: 0
                }
            };
        }
        
        return await handleResponse(response);
    } catch (error) {
        console.error('Error fetching statistics:', error);
        return {
            success: false,
            message: error.message,
            data: {
                total: 0,
                draft: 0,
                menunggu_verifikasi_pic: 0,
                menunggu_disposisi: 0,
                menunggu_verifikasi_ppk: 0,
                diverifikasi_ppk: 0,
                dalam_perbaikan: 0,
                selesai: 0,
                ditolak: 0
            }
        };
    }
};

// ========== OPTIONS API ==========

/**
 * GET /api/ruangan
 */
const fetchRuanganOptions = async (session, params = {}) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan',
            data: []
        };
    }
    
    const baseUrl = getBaseUrl();
    
    const queryParams = new URLSearchParams();
    let url = `${baseUrl}/ruangan`;
    
    if (params.user_id) {
        queryParams.append('user_id', params.user_id);
        console.log('📤 Mengirim user_id:', params.user_id);
    }
    
    if (queryParams.toString()) {
        url = `${url}?${queryParams.toString()}`;
    }
    
    console.log('📤 Fetching ruangan options from:', url);
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            let errorMessage = `HTTP Error ${response.status}`;
            try {
                const errorText = await response.text();
                errorMessage = `${errorMessage}: ${errorText.substring(0, 100)}`;
            } catch {
                errorMessage = `${errorMessage}: ${response.statusText}`;
            }
            
            return {
                success: false,
                message: errorMessage,
                data: []
            };
        }
        
        const result = await handleResponse(response);
        
        let ruanganData = [];
        if (result.data && Array.isArray(result.data)) {
            ruanganData = result.data;
        } else if (Array.isArray(result)) {
            ruanganData = result;
        }
        
        return {
            success: true,
            data: ruanganData,
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

/**
 * GET /api/laporansrusak/aset-berdasarkan-ruangan/:ruanganId
 */
const fetchAsetByRuangan = async (session, ruanganId) => {
    const token = getToken(session);
    
    if (!token) {
        console.error('❌ Token tidak ditemukan untuk fetchAsetByRuangan');
        return {
            success: false,
            message: 'Token tidak ditemukan',
            data: []
        };
    }
    
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/laporansrusak/aset-berdasarkan-ruangan/${ruanganId}`;
    
    console.log('📤 Fetching aset by ruangan from:', url);
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        console.log('📥 Response status:', response.status);
        
        if (!response.ok) {
            let errorMessage = `HTTP Error ${response.status}`;
            try {
                const errorText = await response.text();
                errorMessage = `${errorMessage}: ${errorText.substring(0, 100)}`;
            } catch {
                errorMessage = `${errorMessage}: ${response.statusText}`;
            }
            
            return {
                success: false,
                message: errorMessage,
                data: []
            };
        }
        
        const result = await response.json();
        console.log('📥 Response data:', result);
        
        let asetData = [];
        if (result.data && Array.isArray(result.data)) {
            asetData = result.data;
        } else if (Array.isArray(result)) {
            asetData = result;
        }
        
        return {
            success: true,
            data: asetData,
            message: result.message || 'Data aset berhasil dimuat'
        };
    } catch (error) {
        console.error('Error fetching aset by ruangan:', error);
        return {
            success: false,
            message: error.message,
            data: []
        };
    }
};

/**
 * GET /api/pic-ruangan/ruangan/:ruanganId
 * Mendapatkan PIC (Person In Charge) berdasarkan ID ruangan
 */
// components/laporanrusak/api/laporanRusakApi.js

/**
 * GET /api/picruangan
 * Mendapatkan semua data PIC, lalu filter berdasarkan ruangan_id
 */
const fetchPicByRuangan = async (session, ruanganId) => {
    const token = getToken(session);
    
    console.log('🔍 fetchPicByRuangan dipanggil dengan ruanganId:', ruanganId);
    console.log('🔍 Token tersedia:', !!token);
    
    if (!token) {
        console.error('❌ Token tidak ditemukan untuk fetchPicByRuangan');
        return {
            success: false,
            message: 'Token tidak ditemukan',
            data: null
        };
    }
    
    if (!ruanganId) {
        console.error('❌ ruanganId tidak ditemukan');
        return {
            success: false,
            message: 'Ruangan ID diperlukan',
            data: null
        };
    }
    
    const baseUrl = getBaseUrl();
    
    // Gunakan endpoint yang benar: /api/picruangan
    const url = `${baseUrl}/picruangan`;
    
    console.log('📤 Fetching semua PIC dari:', url);
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        console.log('📥 Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Error response:', errorText);
            return {
                success: false,
                message: `HTTP Error ${response.status}: ${errorText.substring(0, 100)}`,
                data: null
            };
        }
        
        const result = await response.json();
        console.log('📥 Response data dari /api/picruangan:', JSON.stringify(result, null, 2));
        
        // Handle berbagai format response
        let allPics = [];
        
        if (result.data && Array.isArray(result.data)) {
            allPics = result.data;
        } else if (Array.isArray(result)) {
            allPics = result;
        } else if (result.success && result.data && Array.isArray(result.data)) {
            allPics = result.data;
        } else if (result.picruangan && Array.isArray(result.picruangan)) {
            allPics = result.picruangan;
        } else if (result.rows && Array.isArray(result.rows)) {
            allPics = result.rows;
        } else if (result.pic_ruangan && Array.isArray(result.pic_ruangan)) {
            allPics = result.pic_ruangan;
        }
        
        console.log('📋 Semua data PIC:', allPics);
        
        if (allPics.length === 0) {
            console.log('⚠️ Tidak ada data PIC di database');
            return {
                success: true,
                data: null,
                message: 'Belum ada PIC yang ditugaskan'
            };
        }
        
        // Cari PIC berdasarkan ruangan_id (konversi ke number/string sesuai kebutuhan)
        const picData = allPics.find(pic => {
            const picRuanganId = pic.ruangan_id || pic.ruanganId || pic.ruangan;
            return picRuanganId == ruanganId; // Gunakan == untuk compare number vs string
        });
        
        if (picData) {
            console.log('✅ PIC ditemukan untuk ruangan', ruanganId, ':', picData);
            
            // Format data PIC untuk konsistensi
            const formattedPic = {
                id: picData.id,
                user_id: picData.user_id || picData.userId,
                user_name: picData.user_name || picData.userName || picData.nama || picData.user,
                ruangan_id: picData.ruangan_id || picData.ruanganId || picData.ruangan,
                tgl_penugasan: picData.tgl_penugasan || picData.tanggal_penugasan || picData.tanggal,
                status: picData.status,
                nama: picData.user_name || picData.userName || picData.nama || picData.user
            };
            
            return {
                success: true,
                data: formattedPic,
                message: 'Data PIC berhasil dimuat'
            };
        } else {
            console.log(`ℹ️ Tidak ada PIC untuk ruangan ID: ${ruanganId}`);
            console.log('📋 Daftar ruangan yang memiliki PIC:', allPics.map(p => ({
                id: p.ruangan_id || p.ruanganId || p.ruangan,
                nama: p.user_name || p.userName || p.nama
            })));
            
            return {
                success: true,
                data: null,
                message: `Tidak ada PIC untuk ruangan ini`
            };
        }
    } catch (error) {
        console.error('❌ Error fetching PIC:', error);
        return {
            success: false,
            message: error.message,
            data: null
        };
    }
};

/**
 * GET /api/laporansrusak/options/aset (fallback)
 */
const fetchAsetOptions = async (session, params = {}) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan',
            data: []
        };
    }
    
    const baseUrl = getBaseUrl();
    
    // Coba beberapa alternatif endpoint
    const endpoints = [
        `${baseUrl}/master-aset`,
        `${baseUrl}/aset`,
        `${baseUrl}/laporansrusak/options/aset`,
        `${baseUrl}/master_aset`,
    ];
    
    let lastError = null;
    
    for (const url of endpoints) {
        try {
            console.log('📤 Mencoba fetch aset dari:', url);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                
                let asetData = [];
                if (result.data && Array.isArray(result.data)) {
                    asetData = result.data;
                } else if (Array.isArray(result)) {
                    asetData = result;
                } else if (result.success && result.data) {
                    asetData = result.data;
                }
                
                return {
                    success: true,
                    data: asetData,
                    message: 'Data aset berhasil dimuat'
                };
            }
        } catch (error) {
            lastError = error.message;
            console.log(`❌ Gagal dengan endpoint ${url}:`, error.message);
        }
    }
    
    // Jika semua endpoint gagal, kembalikan data kosong
    console.warn('⚠️ Semua endpoint aset gagal, menggunakan data kosong');
    return {
        success: true,
        data: [],
        message: 'Menggunakan data kosong (endpoint tidak tersedia)'
    };
};

// ========== UPLOAD API ==========

/**
 * POST /api/upload/foto
 */
const uploadFoto = async (session, files) => {
    const token = getToken(session);
    
    if (!token) {
        return {
            success: false,
            message: 'Token tidak ditemukan',
            data: []
        };
    }
    
    const baseUrl = getBaseUrl();
    const formData = new FormData();
    
    const fileArray = Array.isArray(files) ? files : [files];
    
    fileArray.forEach(file => {
        formData.append('foto_kerusakan', file);
    });
    
    try {
        const response = await fetch(`${baseUrl}/upload/foto`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`HTTP Error ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.data) {
            result.data = result.data.map(item => ({
                ...item,
                url: item.url.replace('/api/uploads/', '/uploads/')
            }));
        }
        
        return result;
    } catch (error) {
        console.error('Error uploading photos:', error);
        return {
            success: false,
            message: error.message,
            data: []
        };
    }
};

// ========== NAMED EXPORTS ==========
export {
    fetchAllLaporanRusak,
    fetchLaporanRusakById,
    fetchLaporanByUser,
    createLaporanRusak,
    updateLaporanRusak,
    deleteLaporanRusak,
    verifikasiLaporan,
    disposisiLaporan,
    verifikasiPPK,
    selesaikanPerbaikan,
    getDetailPerbaikan,
    fetchLaporanStatistics,
    fetchAsetOptions,
    fetchRuanganOptions,
    fetchAsetByRuangan,
    fetchPicByRuangan,
    uploadFoto
};

// ========== ALIASES ==========
export const getAll = fetchAllLaporanRusak;
export const getById = fetchLaporanRusakById;
export const getUserLaporan = fetchLaporanByUser;
export const create = createLaporanRusak;
export const update = updateLaporanRusak;
export const remove = deleteLaporanRusak;
export const getStats = fetchLaporanStatistics;
export const verifikasi = verifikasiLaporan;
export const disposisi = disposisiLaporan;
export const selesaiPerbaikan = selesaikanPerbaikan;
export const getPicByRuangan = fetchPicByRuangan;
export const getAsetOptions = fetchAsetOptions;
export const getAsetByRuangan = fetchAsetByRuangan;
export const getRuanganOptions = fetchRuanganOptions;
export const upload = uploadFoto;

// ========== DEFAULT EXPORT ==========
const laporanApi = {
    // Laporan Rusak
    fetchAllLaporanRusak,
    fetchLaporanRusakById,
    fetchLaporanByUser,
    createLaporanRusak,
    updateLaporanRusak,
    deleteLaporanRusak,
    verifikasiLaporan,
    disposisiLaporan,
    verifikasiPPK,
    selesaikanPerbaikan,
    getDetailPerbaikan,
    fetchLaporanStatistics,
    
    // Options
    fetchAsetOptions,
    fetchRuanganOptions,
    fetchAsetByRuangan,
    fetchPicByRuangan,
    
    // Upload
    uploadFoto,
    
    // Aliases
    getAll: fetchAllLaporanRusak,
    getById: fetchLaporanRusakById,
    getUserLaporan: fetchLaporanByUser,
    create: createLaporanRusak,
    update: updateLaporanRusak,
    remove: deleteLaporanRusak,
    getStats: fetchLaporanStatistics,
    verifikasi: verifikasiLaporan,
    disposisi: disposisiLaporan,
    verifikasiPPK: verifikasiPPK,
    selesaiPerbaikan: selesaikanPerbaikan,
    getPicByRuangan: fetchPicByRuangan,
    getAsetOptions: fetchAsetOptions,
    getAsetByRuangan: fetchAsetByRuangan,
    getRuanganOptions: fetchRuanganOptions,
    upload: uploadFoto
};

export default laporanApi;