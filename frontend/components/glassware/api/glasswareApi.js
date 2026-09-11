import axios from 'axios';

const BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');
const API_URL = `${BASE}/glassware`;

const getHeaders = (session) => ({
  Authorization: `Bearer ${session?.accessToken}`,
  'Content-Type': 'application/json',
});

// ========== LABORATORIUM & JENIS ==========
export const fetchLaboratorium = async (session) => {
  const { data } = await axios.get(`${API_URL}/laboratorium`, { headers: getHeaders(session) });
  return data;
};

export const fetchJenis = async (session) => {
  const { data } = await axios.get(`${API_URL}/jenis`, { headers: getHeaders(session) });
  return data;
};

export const fetchMaster = async (session, params = {}) => {
  const { data } = await axios.get(`${API_URL}/master`, { headers: getHeaders(session), params });
  return data;
};

export const addMaster = async (session, body) => {
  const { data } = await axios.post(`${API_URL}/master`, body, { headers: getHeaders(session) });
  return data;
};

// ========== PERIODE ==========
export const fetchPeriode = async (session) => {
  const { data } = await axios.get(`${API_URL}/periode`, { headers: getHeaders(session) });
  return data;
};

export const createPeriode = async (session, body) => {
  const { data } = await axios.post(`${API_URL}/periode`, body, { headers: getHeaders(session) });
  return data;
};

export const deletePeriode = async (session, id) => {
  const { data } = await axios.delete(`${API_URL}/periode/${id}`, { headers: getHeaders(session) });
  return data;
};

// ========== REKAP STOK ==========
export const fetchStok = async (session, params = {}) => {
  const { data } = await axios.get(`${API_URL}/stok`, { headers: getHeaders(session), params });
  return data;
};

// ========== BARANG MASUK ==========
export const fetchMasuk = async (session, params = {}) => {
  const { data } = await axios.get(`${API_URL}/masuk`, { headers: getHeaders(session), params });
  return data;
};

export const addMasuk = async (session, body) => {
  const { data } = await axios.post(`${API_URL}/masuk`, body, { headers: getHeaders(session) });
  return data;
};

export const deleteMasuk = async (session, id) => {
  const { data } = await axios.delete(`${API_URL}/masuk/${id}`, { headers: getHeaders(session) });
  return data;
};

// ========== GLASSWARE PECAH ==========
export const fetchPecah = async (session, params = {}) => {
  const { data } = await axios.get(`${API_URL}/pecah`, { headers: getHeaders(session), params });
  return data;
};

export const addPecah = async (session, body) => {
  const { data } = await axios.post(`${API_URL}/pecah`, body, { headers: getHeaders(session) });
  return data;
};

export const deletePecah = async (session, id) => {
  const { data } = await axios.delete(`${API_URL}/pecah/${id}`, { headers: getHeaders(session) });
  return data;
};

// ========== PEMANTAUAN TIDAK BERGERAK ==========
export const fetchMovement = async (session, params = {}) => {
  const { data } = await axios.get(`${API_URL}/movement`, { headers: getHeaders(session), params });
  return data;
};

// ========== DAFTAR USER ROLE MT (Keycloak) ==========
export const fetchMtList = async (session) => {
  const { data } = await axios.get(`${BASE}/keycloak/mt/list`, { headers: getHeaders(session) });
  return data;
};

// ========== PENGAJUAN SEMESTER KE MT ==========
// Status satu (periode, lab): data pengajuan atau null (belum diajukan)
export const fetchPengajuan = async (session, params = {}) => {
  const { data } = await axios.get(`${API_URL}/pengajuan`, { headers: getHeaders(session), params });
  return data;
};

// Ringkasan transaksi periode+lab (semua jenis) utk kartu pengajuan
export const fetchPengajuanSummary = async (session, params = {}) => {
  const { data } = await axios.get(`${API_URL}/pengajuan/summary`, { headers: getHeaders(session), params });
  return data;
};

// Daftar pengajuan (di-scope per role: admin semua, mt miliknya, pic_lab kirimannya)
export const fetchPengajuanList = async (session, params = {}) => {
  const { data } = await axios.get(`${API_URL}/pengajuan/list`, { headers: getHeaders(session), params });
  return data;
};

// Kirim / kirim ulang pengajuan ke MT: { periode_id, laboratorium_id, mt_id, mt_nama, catatan }
export const kirimPengajuan = async (session, body) => {
  const { data } = await axios.post(`${API_URL}/pengajuan/kirim`, body, { headers: getHeaders(session) });
  return data;
};

export const setujuiPengajuan = async (session, id) => {
  const { data } = await axios.put(`${API_URL}/pengajuan/${id}/setujui`, {}, { headers: getHeaders(session) });
  return data;
};

export const tolakPengajuan = async (session, id, catatan_tolak) => {
  const { data } = await axios.put(`${API_URL}/pengajuan/${id}/tolak`, { catatan_tolak }, { headers: getHeaders(session) });
  return data;
};

// Hapus pengajuan dari riwayat — khusus role admin
export const deletePengajuan = async (session, id) => {
  const { data } = await axios.delete(`${API_URL}/pengajuan/${id}`, { headers: getHeaders(session) });
  return data;
};
