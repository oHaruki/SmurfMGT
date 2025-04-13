// src/services/api.js
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

class ApiService {
  constructor() {
    this.api = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Add a request interceptor to include the token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
    
    // Add a response interceptor to handle errors
    this.api.interceptors.response.use(
      (response) => response.data,
      (error) => {
        const message = error.response?.data?.error || error.message;
        return Promise.reject({ 
          message, 
          status: error.response?.status 
        });
      }
    );
  }
  
  setToken(token) {
    this.token = token;
  }
  
  clearToken() {
    this.token = null;
  }
  
  // Generic methods
  async get(endpoint) {
    return this.api.get(endpoint);
  }
  
  async post(endpoint, data) {
    return this.api.post(endpoint, data);
  }
  
  async put(endpoint, data) {
    return this.api.put(endpoint, data);
  }
  
  async delete(endpoint) {
    return this.api.delete(endpoint);
  }
}

export const api = new ApiService();