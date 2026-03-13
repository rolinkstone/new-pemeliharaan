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
        
        if (!apiUrl) {
            console.warn('⚠️ NEXT_PUBLIC_API_URL tidak ditemukan, menggunakan fallback http://localhost:5002/api');
            return 'http://localhost:5002/api';
        }
        return apiUrl.replace(/\/$/, '');
    }
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api';
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
 * - Jika keputusan = 'setuju' dan alur = 'langsung' → status 'selesai'
 * - Jika keputusan = 'setuju' dan alur = 'dengan_anggaran' → status 'menunggu_disposisi'
 * - Jika keputusan = 'tolak' → status 'ditolak'
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
 * POST /api/laporansrusak/:id/selesai (DEPRECATED)
 * Untuk menandai laporan selesai - Gunakan selesaikanPerbaikan
 */
const selesaikanLaporan = async (session, id, data) => {
    console.warn('⚠️ Fungsi selesaikanLaporan sudah deprecated. Gunakan selesaikanPerbaikan');
    
    const token = getToken(session);
    
    if (!token) {
        return { 
            success: false, 
            message: 'Token tidak ditemukan' 
        };
    }
    
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/laporansrusak/${id}/selesai`;
    
    console.log('📤 SELESAI (DEPRECATED) - URL:', url);
    console.log('📤 SELESAI (DEPRECATED) - Payload:', data);
    
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
        console.log('📥 Response selesai (deprecated):', result);
        return result;
    } catch (error) {
        console.error('Error selesaikan laporan:', error);
        return { 
            success: false, 
            message: error.message 
        };
    }
};

/**
 * POST /api/laporansrusak/:id/selesaikan-perbaikan
 * Untuk PIC Ruangan melaporkan hasil perbaikan (internal, eksternal, gagal)
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
    console.log('🔧 SELESAIKAN PERBAIKAN - Payload:', {
        id,
        hasil_perbaikan: data.hasil_perbaikan,
        tanggal_selesai: data.tanggal_selesai,
        rating: data.rating,
        biaya_aktual: data.biaya_aktual,
        nama_vendor: data.nama_vendor,
        next_status: data.next_status
    });
    
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
 * GET /api/ruangan?user_id=xxx&has_pic=true
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
    
    queryParams.append('has_pic', 'true');
    
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
 * GET /api/laporansrusak/options/aset (fallback)
 */
// components/laporanrusak/api/laporanRusakApi.js

/**
 * GET /api/laporansrusak/options/aset (fallback) - PERBAIKI
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
        `${baseUrl}/master-aset`,  // Coba endpoint master-aset
        `${baseUrl}/aset`,          // Coba endpoint aset
        `${baseUrl}/laporansrusak/options/aset`, // Endpoint asli
        `${baseUrl}/master_aset`,   // Dengan underscore
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
                
                // Handle berbagai format response
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
    selesaikanLaporan,
    selesaikanPerbaikan,
    getDetailPerbaikan,
    fetchLaporanStatistics,
    fetchAsetOptions,
    fetchRuanganOptions,
    fetchAsetByRuangan,
    uploadFoto
};

// ========== ALIASES (HANYA UNTUK FUNGSI DENGAN NAMA BERBEDA) ==========
export const getAll = fetchAllLaporanRusak;
export const getById = fetchLaporanRusakById;
export const getUserLaporan = fetchLaporanByUser;
export const create = createLaporanRusak;
export const update = updateLaporanRusak;
export const remove = deleteLaporanRusak;
export const getStats = fetchLaporanStatistics;
export const verifikasi = verifikasiLaporan;
export const disposisi = disposisiLaporan;
export const selesai = selesaikanLaporan; // Deprecated

// HAPUS SEMUA ALIAS YANG REDUNDANT - karena sudah ada di named exports dengan nama yang sama
// export const verifikasiPPK = verifikasiPPK; // <-- HAPUS
// export const selesaikanPerbaikan = selesaikanPerbaikan; // <-- HAPUS
// export const getDetailPerbaikan = getDetailPerbaikan; // <-- HAPUS

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
    selesaikanLaporan,        // Deprecated
    selesaikanPerbaikan,       // Fungsi baru
    getDetailPerbaikan,        // Fungsi baru
    fetchLaporanStatistics,
    
    // Options
    fetchAsetOptions,
    fetchRuanganOptions,
    fetchAsetByRuangan,
    
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
    verifikasiPPK: verifikasiPPK, // Ini property object, bukan variable terpisah, jadi aman
    selesai: selesaikanLaporan, // Deprecated
    selesaikanPerbaikan: selesaikanPerbaikan, // Property object
    getDetailPerbaikan: getDetailPerbaikan, // Property object
    getAsetOptions: fetchAsetOptions,
    getAsetByRuangan: fetchAsetByRuangan,
    getRuanganOptions: fetchRuanganOptions,
    upload: uploadFoto
};

export default laporanApi;