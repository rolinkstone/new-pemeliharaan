import axios from 'axios';

const BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');
const API_URL = `${BASE}/notifications`;

const getHeaders = (session) => ({
  Authorization: `Bearer ${session?.accessToken}`,
  'Content-Type': 'application/json',
});

const notificationsApi = {
  fetchNotifications: async (session) => {
    const { data } = await axios.get(`${API_URL}`, { headers: getHeaders(session) });
    return data;
  },
  markRead: async (session, id) => {
    const { data } = await axios.put(`${API_URL}/${id}/read`, {}, { headers: getHeaders(session) });
    return data;
  },
  markAllRead: async (session) => {
    const { data } = await axios.put(`${API_URL}/read-all`, {}, { headers: getHeaders(session) });
    return data;
  },
};

export default notificationsApi;
