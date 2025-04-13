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
        let message = error.response?.data?.error || error.message;
        
        // Include details for more informative error messages
        if (error.response?.data?.details) {
          message += ` (${error.response.data.details})`;
        }
        
        // Include solution if available
        if (error.response?.data?.solution) {
          message += `. ${error.response.data.solution}`;
        }
        
        return Promise.reject({ 
          message, 
          status: error.response?.status,
          details: error.response?.data
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
  
  // Auth methods
  async login(email, password) {
    return this.post('/auth/login', { email, password });
  }
  
  async register(username, email, password) {
    return this.post('/auth/register', { username, email, password });
  }
  
  // Account methods
  async getAccounts() {
    return this.get('/accounts');
  }
  
  async getAccount(id) {
    return this.get(`/accounts/${id}`);
  }
  
  async createAccount(accountData) {
    return this.post('/accounts', accountData);
  }
  
  async updateAccount(id, accountData) {
    return this.put(`/accounts/${id}`, accountData);
  }
  
  async deleteAccount(id) {
    return this.delete(`/accounts/${id}`);
  }
  
  // Flair methods
  async getFlairs() {
    return this.get('/flairs');
  }
  
  async addFlair(accountId, flairId) {
    return this.post(`/accounts/${accountId}/flairs`, { flairId });
  }
  
  async removeFlair(accountId, flairId) {
    return this.delete(`/accounts/${accountId}/flairs/${flairId}`);
  }
  
  // Riot API methods
  async getRiotSummoner(server, summonerName) {
    return this.get(`/riot/summoner/${server}/${summonerName}`);
  }
}

export const api = new ApiService();