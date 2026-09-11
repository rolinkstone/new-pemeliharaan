import axios from 'axios';

const BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api').replace(/\/+$/, '');
const API_URL = `${BASE}/pencatatan`;

const getHeaders = (session) => ({
  Authorization: `Bearer ${session?.accessToken || session?.token}`,
  'Content-Type': 'application/json',
});

// ========== LIST ==========
export const fetchPencatatan = async (session, params = {}) => {
  const { data } = await axios.get(`${API_URL}`, { headers: getHeaders(session), params });
  return data;
};

// ========== COUNTER (badge sub-menu) ==========
export const fetchCounter = async (session) => {
  const { data } = await axios.get(`${API_URL}/counter`, { headers: getHeaders(session) });
  return data;
};

// ========== CREATE ==========
export const createPencatatan = async (session, body) => {
  const { data } = await axios.post(`${API_URL}`, body, { headers: getHeaders(session) });
  return data;
};

// ========== UPDATE ==========
export const updatePencatatan = async (session, id, body) => {
  const { data } = await axios.put(`${API_URL}/${id}`, body, { headers: getHeaders(session) });
  return data;
};

// ========== MARK SELESAI ==========
export const selesaiPencatatan = async (session, id, body = {}) => {
  const { data } = await axios.put(`${API_URL}/${id}/selesai`, body, { headers: getHeaders(session) });
  return data;
};

// ========== REOPEN ==========
export const bukaPencatatan = async (session, id) => {
  const { data } = await axios.put(`${API_URL}/${id}/buka`, {}, { headers: getHeaders(session) });
  return data;
};

// ========== DELETE ==========
export const deletePencatatan = async (session, id) => {
  const { data } = await axios.delete(`${API_URL}/${id}`, { headers: getHeaders(session) });
  return data;
};

export default {
  fetchPencatatan,
  fetchCounter,
  createPencatatan,
  updatePencatatan,
  selesaiPencatatan,
  bukaPencatatan,
  deletePencatatan,
};
