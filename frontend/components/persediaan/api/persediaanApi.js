import axios from 'axios';

const BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');
const API_URL = `${BASE}/persediaan`;
export const BACKEND_HOST = BASE.replace('/api', '');

const getHeaders = (session) => ({
  Authorization: `Bearer ${session?.accessToken}`,
  'Content-Type': 'application/json',
});

// ========== BARANG PERSEDIAAN ==========
export const fetchBarang = async (session, params = {}) => {
  const { data } = await axios.get(`${API_URL}/barang`, {
    headers: getHeaders(session),
    params,
  });
  return data;
};
export const exportMutasi = async (session) => {
  const { data } = await axios.get(`${API_URL}/opname/export-mutasi`, {
    headers: { Authorization: `Bearer ${session?.accessToken}` },
    responseType: 'blob',
  });
  return data;
};
export const createBarang = async (session, body) => {
  const { data } = await axios.post(`${API_URL}/barang`, body, { headers: getHeaders(session) });
  return data;
};

export const updateBarang = async (session, id, body) => {
  const { data } = await axios.put(`${API_URL}/barang/${id}`, body, { headers: getHeaders(session) });
  return data;
};

export const deleteBarang = async (session, id) => {
  const { data } = await axios.delete(`${API_URL}/barang/${id}`, { headers: getHeaders(session) });
  return data;
};

// ========== BARANG MASUK ==========
export const fetchBarangMasuk = async (session, params = {}) => {
  const { data } = await axios.get(`${API_URL}/barang-masuk`, { headers: getHeaders(session), params });
  return data;
};

export const createBarangMasuk = async (session, body) => {
  const { data } = await axios.post(`${API_URL}/barang-masuk`, body, { headers: getHeaders(session) });
  return data;
};

export const approveBarangMasuk = async (session, id) => {
  const { data } = await axios.put(`${API_URL}/barang-masuk/${id}/approve`, {}, { headers: getHeaders(session) });
  return data;
};

// ========== BARANG MASUK BATCH ==========
export const createBarangMasukBatch = async (session, body) => {
  const { data } = await axios.post(`${API_URL}/barang-masuk/batch`, body, { headers: getHeaders(session) });
  return data;
};

export const approveBarangMasukBatch = async (session, kuitansi_url) => {
  const { data } = await axios.put(`${API_URL}/barang-masuk/approve-batch`, { kuitansi_url }, { headers: getHeaders(session) });
  return data;
};

// ========== FILE UPLOAD ==========
const UPLOAD_URL = `${API_URL.replace('/persediaan', '')}/upload/foto`;
export const uploadFile = async (session, file) => {
  const formData = new FormData();
  formData.append('foto_kerusakan', file);
  const { data } = await axios.post(UPLOAD_URL, formData, {
    headers: { Authorization: `Bearer ${session?.accessToken}`, 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const tolakBarangMasuk = async (session, id, alasan) => {
  const { data } = await axios.put(`${API_URL}/barang-masuk/${id}/tolak`, { alasan }, { headers: getHeaders(session) });
  return data;
};

// ========== PERMINTAAN BARANG ==========
export const fetchPermintaan = async (session) => {
  const { data } = await axios.get(`${API_URL}/permintaan`, { headers: getHeaders(session) });
  return data;
};

export const createPermintaan = async (session, body) => {
  const { data } = await axios.post(`${API_URL}/permintaan`, body, { headers: getHeaders(session) });
  return data;
};

export const approvePermintaanKatim = async (session, id) => {
  const { data } = await axios.put(`${API_URL}/permintaan/${id}/approve-katim`, {}, { headers: getHeaders(session) });
  return data;
};

export const approvePermintaanKabag = async (session, id) => {
  const { data } = await axios.put(`${API_URL}/permintaan/${id}/approve-kabag`, {}, { headers: getHeaders(session) });
  return data;
};

export const serahkanPermintaan = async (session, id) => {
  const { data } = await axios.put(`${API_URL}/permintaan/${id}/serahkan`, {}, { headers: getHeaders(session) });
  return data;
};

export const tolakPermintaan = async (session, id, alasan) => {
  const { data } = await axios.put(`${API_URL}/permintaan/${id}/tolak`, { alasan }, { headers: getHeaders(session) });
  return data;
};

export const deletePermintaan = async (session, id) => {
  const { data } = await axios.delete(`${API_URL}/permintaan/${id}`, { headers: getHeaders(session) });
  return data;
};

export const prosesItemsPermintaan = async (session, groupId, items) => {
  const { data } = await axios.post(`${API_URL}/permintaan/${groupId}/proses-items`, { items }, { headers: getHeaders(session) });
  return data;
};

// ========== STOK OPNAME ==========
export const fetchOpname = async (session, params = {}) => {
  const { data } = await axios.get(`${API_URL}/opname`, { headers: getHeaders(session), params });
  return data;
};

export const fetchMutasiStok = async (session, params = {}) => {
  const { data } = await axios.get(`${API_URL}/opname/mutasi`, { headers: getHeaders(session), params });
  return data;
};

export const createOpname = async (session, body) => {
  const { data } = await axios.post(`${API_URL}/opname`, body, { headers: getHeaders(session) });
  return data;
};

export const fetchMutasiDetail = async (session, barang_id, params = {}) => {
  const { data } = await axios.get(`${API_URL}/opname/mutasi/${barang_id}/detail`, { headers: getHeaders(session), params });
  return data;
};

// ========== FILTER OPTIONS ==========
export const fetchFilterOptions = async (session) => {
  const { data } = await axios.get(`${API_URL}/barang/filter-options`, { headers: getHeaders(session) });
  return data;
};

// ========== IMPORT / TEMPLATE ==========
export const downloadTemplateUrl = `${API_URL}/barang/template-xlsx`;

export const importXLSX = async (session, file) => {
  // Read file as base64
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = async () => {
      try {
        const base64 = reader.result.split(',')[1];
        const res = await axios.post(`${API_URL}/barang/import-xlsx`, { fileBase64: base64 }, {
          headers: { Authorization: `Bearer ${session?.accessToken}`, 'Content-Type': 'application/json' },
        });
        resolve(res.data);
      } catch (e) { reject(e); }
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsDataURL(file);
  });
};
