import axios from "axios";
import useAuthStore from "../store/authStore.js";

const api = axios.create({ baseURL: "/api", timeout: 30_000 });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r.data,
  (err) => {
    if (err.response?.status === 401) useAuthStore.getState().logout();
    return Promise.reject(err.response?.data?.error || err.message || "Server error");
  }
);

export default api;
