import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/signin';
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  signup: (data) => api.post('/auth/signup', data),
  signin: (data) => api.post('/auth/signin', data),
};

export const auctionAPI = {
  create: (data) => api.post('/auctions', data),
  getMyAuctions: () => api.get('/auctions/my'),
  getAllAuctions: () => api.get('/auctions/all'),
  getDetails: (id) => api.get(`/auctions/${id}`),
};

export const bidAPI = {
  submit: (auction_id, data) => api.post(`/auctions/${auction_id}/bid`, data),
};

export default api;
