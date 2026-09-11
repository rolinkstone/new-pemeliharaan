import axios from 'axios';

const BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');
const API_URL = `${BASE}/reagen`;
export const BACKEND_HOST = BASE.replace('/api', '');

const getHeaders = (session) => ({
  Authorization: `Bearer ${session?.accessToken}`,
  'Content-Type': 'application/json',
});

// ========== MASTER REAGEN ==========
export const fetchReagen = async (session, params = {}) => {
  const { data } = await axios.get(`${API_URL}/reagen`, { headers: getHeaders(session), params });
  return data;
};

export const fetchAllReagen = async (session) => {
  const { data } = await axios.get(`${API_URL}/reagen/all`, { headers: getHeaders(session) });
  return data;
};

export const fetchFilterOptions = async (session) => {
  const { data } = await axios.get(`${API_URL}/reagen/filter-options`, { headers: getHeaders(session) });
  return data;
};

export const createReagen = async (session, body) => {
  const { data } = await axios.post(`${API_URL}/reagen`, body, { headers: getHeaders(session) });
  return data;
};

export const updateReagen = async (session, id, body) => {
  const { data } = await axios.put(`${API_URL}/reagen/${id}`, body, { headers: getHeaders(session) });
  return data;
};

export const deleteReagen = async (session, id) => {
  const { data } = await axios.delete(`${API_URL}/reagen/${id}`, { headers: getHeaders(session) });
  return data;
};

// ========== STOK GUDANG (per batch / expiry) ==========
export const fetchStokGudang = async (session, params = {}) => {
  const { data } = await axios.get(`${API_URL}/reagen/stok`, { headers: getHeaders(session), params });
  return data;
};

// ========== IMPORT STOK GUDANG (XLSX) ==========
export const downloadStokTemplateUrl = `${API_URL}/reagen/import-stok/template`;

export const importStokXLSX = async (session, file) => {
  // Baca file sebagai base64
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = async () => {
      try {
        const base64 = reader.result.split(',')[1];
        const res = await axios.post(`${API_URL}/reagen/import-stok`, { fileBase64: base64 }, {
          headers: { Authorization: `Bearer ${session?.accessToken}`, 'Content-Type': 'application/json' },
        });
        resolve(res.data);
      } catch (e) { reject(e); }
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsDataURL(file);
  });
};

// ========== BARANG MASUK GUDANG ==========
export const fetchMasuk = async (session) => {
  const { data } = await axios.get(`${API_URL}/reagen/masuk`, { headers: getHeaders(session) });
  return data;
};

export const createMasuk = async (session, body) => {
  const { data } = await axios.post(`${API_URL}/reagen/masuk`, body, { headers: getHeaders(session) });
  return data;
};

export const deleteMasuk = async (session, id) => {
  const { data } = await axios.delete(`${API_URL}/reagen/masuk/${id}`, { headers: getHeaders(session) });
  return data;
};

// ========== PENGELUARAN GUDANG KE LAB ==========
export const fetchPengeluaran = async (session) => {
  const { data } = await axios.get(`${API_URL}/reagen/pengeluaran`, { headers: getHeaders(session) });
  return data;
};

export const createPengeluaran = async (session, body) => {
  const { data } = await axios.post(`${API_URL}/reagen/pengeluaran`, body, { headers: getHeaders(session) });
  return data;
};

export const kirimKeKatim = async (session, groupId, body) => {
  const { data } = await axios.put(`${API_URL}/reagen/pengeluaran/${groupId}/kirim-ke-katim`, body, { headers: getHeaders(session) });
  return data;
};

export const approveKatim = async (session, groupId) => {
  const { data } = await axios.put(`${API_URL}/reagen/pengeluaran/${groupId}/approve-katim`, {}, { headers: getHeaders(session) });
  return data;
};

export const approveKabag = async (session, groupId) => {
  const { data } = await axios.put(`${API_URL}/reagen/pengeluaran/${groupId}/approve-kabag`, {}, { headers: getHeaders(session) });
  return data;
};

export const serahkanPengeluaran = async (session, groupId) => {
  const { data } = await axios.put(`${API_URL}/reagen/pengeluaran/${groupId}/serahkan`, {}, { headers: getHeaders(session) });
  return data;
};

export const tolakPengeluaran = async (session, groupId, alasan) => {
  const { data } = await axios.put(`${API_URL}/reagen/pengeluaran/${groupId}/tolak`, { alasan }, { headers: getHeaders(session) });
  return data;
};

export const deletePengeluaran = async (session, groupId) => {
  const { data } = await axios.delete(`${API_URL}/reagen/pengeluaran/${groupId}`, { headers: getHeaders(session) });
  return data;
};

// ========== PERSEDIAAN LAB (per gram / mL) ==========
export const fetchLabStok = async (session, params = {}) => {
  const { data } = await axios.get(`${API_URL}/reagen/lab-stok`, { headers: getHeaders(session), params });
  return data;
};

export const createPemakaianLab = async (session, body) => {
  const { data } = await axios.post(`${API_URL}/reagen/lab-pemakaian`, body, { headers: getHeaders(session) });
  return data;
};

export const fetchPemakaianLab = async (session, params = {}) => {
  const { data } = await axios.get(`${API_URL}/reagen/lab-pemakaian`, { headers: getHeaders(session), params });
  return data;
};

// ========== STOK OPNAME (GUDANG / BOTOL) ==========
export const fetchOpname = async (session, params = {}) => {
  const { data } = await axios.get(`${API_URL}/reagen/opname`, { headers: getHeaders(session), params });
  return data;
};

export const fetchMutasiStok = async (session, params = {}) => {
  const { data } = await axios.get(`${API_URL}/reagen/opname/mutasi`, { headers: getHeaders(session), params });
  return data;
};

export const fetchMovement = async (session) => {
  const { data } = await axios.get(`${API_URL}/reagen/movement`, { headers: getHeaders(session) });
  return data;
};

export const createOpname = async (session, body) => {
  const { data } = await axios.post(`${API_URL}/reagen/opname`, body, { headers: getHeaders(session) });
  return data;
};

export const fetchMutasiDetail = async (session, reagen_id, params = {}) => {
  const { data } = await axios.get(`${API_URL}/reagen/opname/mutasi/${reagen_id}/detail`, { headers: getHeaders(session), params });
  return data;
};

// ========== FILE UPLOAD (kuitansi) ==========
const UPLOAD_URL = `${BASE}/upload/foto`;
export const uploadFile = async (session, file) => {
  const formData = new FormData();
  formData.append('foto_kerusakan', file);
  const { data } = await axios.post(UPLOAD_URL, formData, {
    headers: { Authorization: `Bearer ${session?.accessToken}`, 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

// ========== MERGE LAMPIRAN MASUK REAGEN (nota + foto -> 1 PDF) ==========
export const downloadMasukMerge = async (session, params = {}) => {
  const { data } = await axios.get(`${API_URL}/reagen/masuk/merge`, {
    headers: { Authorization: `Bearer ${session?.accessToken}` },
    params,
    responseType: 'blob',
  });
  return data;
};
