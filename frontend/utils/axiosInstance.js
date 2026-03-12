// utils/axiosInstance.js
import axios from 'axios';

// Buat axios instance dengan interceptor
const createAxiosInstance = (baseURL = 'http://localhost:5000/api') => {
  const instance = axios.create({
    baseURL,
    timeout: 30000, // 30 detik timeout
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });

  // Request interceptor untuk menambahkan token
  instance.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      console.error('Request interceptor error:', error);
      return Promise.reject(error);
    }
  );

  // Response interceptor untuk handle error
  instance.interceptors.response.use(
    (response) => {
      return response;
    },
    (error) => {
      if (error.response) {
        // Handle error responses
        if (error.response.status === 401) {
          // Token expired atau tidak valid
          console.error('Unauthorized access - token mungkin expired');
          // Bisa dispatch event untuk logout atau refresh token
          window.dispatchEvent(new Event('unauthorized'));
        } else if (error.response.status === 403) {
          console.error('Forbidden access');
        } else if (error.response.status === 404) {
          console.error('Endpoint tidak ditemukan');
        }
      } else if (error.request) {
        // Request dibuat tapi tidak ada response
        console.error('No response received:', error.request);
      } else {
        // Error saat setup request
        console.error('Request setup error:', error.message);
      }
      return Promise.reject(error);
    }
  );

  return instance;
};

// Ekspor instance yang sudah dibuat
export const axiosInstance = createAxiosInstance();

// Ekspor fungsi untuk membuat instance baru jika diperlukan
export default createAxiosInstance;