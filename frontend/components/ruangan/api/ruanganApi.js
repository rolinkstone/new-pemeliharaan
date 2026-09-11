// components/ruangan/api/ruanganApi.js

/**
 * Helper untuk mendapatkan token
 */
const getToken = (session) => {
  return session?.accessToken || session?.token || session?.access_token || localStorage.getItem('token');
};

/**
 * Helper untuk handle response dengan error handling lebih baik
 */
const handleResponse = async (response) => {
  // Cek apakah response valid
  if (!response) {
    throw new Error('Tidak ada response dari server');
  }

  // Cek status HTTP
  if (!response.ok) {
    let errorMessage = `HTTP Error ${response.status}`;
    
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
    } catch {
      // Jika response bukan JSON, ambil text
      try {
        const text = await response.text();
        if (text) errorMessage = text;
      } catch {}
    }
    
    throw new Error(errorMessage);
  }

  // Parse response JSON
  try {
    const data = await response.json();
    return data;
  } catch (error) {
    throw new Error('Response bukan format JSON yang valid');
  }
};

/**
 * Helper untuk mendapatkan base URL dengan validasi
 */
const getBaseUrl = () => {
  // Prioritaskan environment variable
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  
 
  
  // Hapus trailing slash jika ada
  return apiUrl.replace(/\/$/, '');
};

/**
 * Helper untuk membuat URL dengan parameter
 */
const buildUrl = (baseUrl, path, params = {}) => {
  const url = new URL(`${baseUrl}${path}`);
  
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
      url.searchParams.append(key, params[key]);
    }
  });
  
  return url.toString();
};

// ========== RUANGAN API ==========

/**
 * GET /api/ruangan
 * Mendapatkan semua data ruangan
 */
export const fetchAllRuangan = async (session, params = {}) => {
  const token = getToken(session);
  
  if (!token) {
    console.error('❌ Token tidak ditemukan');
    return {
      success: false,
      message: 'Token tidak ditemukan. Silakan login ulang.',
      data: []
    };
  }

  const baseUrl = getBaseUrl();
  const url = buildUrl(baseUrl, '/ruangan', {
    search: params.search,
    is_active: params.is_active,
    page: params.page || 1,
    limit: params.limit || 10
  });
  
  console.log('📤 Fetching ruangan from:', url);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // Timeout 10 detik

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
    
    return await handleResponse(response);
  } catch (error) {
    console.error('❌ Error fetching ruangan:', error);
    
    let errorMessage = 'Gagal terhubung ke server';
    
    if (error.name === 'AbortError') {
      errorMessage = 'Request timeout. Server tidak merespons.';
    } else if (error.message.includes('Failed to fetch')) {
      errorMessage = 'Tidak dapat terhubung ke server. Pastikan backend sedang running.';
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
 * GET /api/ruangan/:id
 * Mendapatkan data ruangan berdasarkan ID
 */
export const fetchRuanganById = async (session, id) => {
  const token = getToken(session);
  
  if (!token) {
    return {
      success: false,
      message: 'Token tidak ditemukan'
    };
  }
  
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/ruangan/${id}`;
  
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
    console.error('Error fetching ruangan by id:', error);
    return {
      success: false,
      message: error.message
    };
  }
};

/**
 * POST /api/ruangan
 * Membuat data ruangan baru
 */
export const createRuangan = async (session, data) => {
  const token = getToken(session);
  
  if (!token) {
    return {
      success: false,
      message: 'Token tidak ditemukan'
    };
  }
  
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/ruangan`;
  
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
 * PUT /api/ruangan/:id
 * Mengupdate data ruangan
 */
export const updateRuangan = async (session, id, data) => {
  const token = getToken(session);
  
  if (!token) {
    return {
      success: false,
      message: 'Token tidak ditemukan'
    };
  }
  
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/ruangan/${id}`;
  
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
 * DELETE /api/ruangan/:id
 * Menghapus data ruangan
 */
export const deleteRuangan = async (session, id) => {
  const token = getToken(session);
  
  if (!token) {
    return {
      success: false,
      message: 'Token tidak ditemukan'
    };
  }
  
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/ruangan/${id}`;
  
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

/**
 * GET /api/ruangan/statistics
 * Mendapatkan statistik ruangan
 */
export const fetchRuanganStatistics = async (session) => {
  const token = getToken(session);
  
  if (!token) {
    return {
      success: false,
      message: 'Token tidak ditemukan',
      data: {
        total: 0,
        aktif: 0,
        tidak_aktif: 0
      }
    };
  }
  
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/ruangan/statistics`;
  
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
        tidak_aktif: 0
      }
    };
  }
};

// ========== IMPORT / TEMPLATE (XLSX) ==========

const IMPORT_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api').replace(/\/+$/, '');

/**
 * URL download template import ruangan (endpoint publik, bisa dibuka via browser)
 */
export const downloadImportTemplateUrl = `${IMPORT_BASE_URL}/ruangan/import/template`;

/**
 * POST /api/ruangan/import
 * Import data ruangan dari file XLSX (dikirim sebagai base64)
 */
export const importRuanganXLSX = async (session, file) => {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = async () => {
      try {
        const base64 = reader.result.split(',')[1];
        const response = await fetch(`${IMPORT_BASE_URL}/ruangan/import`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${getToken(session)}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ fileBase64: base64 })
        });
        resolve(await handleResponse(response));
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsDataURL(file);
  });
};

/**
 * GET /api/ruangan/export/xlsx
 * Export semua data ruangan sebagai file XLSX (Blob)
 */
export const exportRuanganXLSX = async (session) => {
  const response = await fetch(`${IMPORT_BASE_URL}/ruangan/export/xlsx`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${getToken(session)}` }
  });
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const err = await response.json();
      message = err.message || message;
    } catch (e) { /* response bukan JSON */ }
    throw new Error(message);
  }
  return await response.blob();
};

// ========== EXPORT ==========
export default {
  fetchAllRuangan,
  fetchRuanganById,
  createRuangan,
  updateRuangan,
  deleteRuangan,
  fetchRuanganStatistics,
  downloadImportTemplateUrl,
  importRuanganXLSX,
  exportRuanganXLSX
};