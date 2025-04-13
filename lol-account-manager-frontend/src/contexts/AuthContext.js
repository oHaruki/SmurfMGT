// src/contexts/AuthContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check if user is logged in on page load
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
      setIsAuthenticated(true);
      api.setToken(token);
    }
    
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      setError(null);
      const response = await api.post('/auth/login', { email, password });
      const { token, user } = response;
      
      // Save to local storage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      // Update state
      setUser(user);
      setIsAuthenticated(true);
      api.setToken(token);
      
      return user;
    } catch (err) {
      setError(err.message || 'Failed to login');
      throw err;
    }
  };

  const register = async (username, email, password) => {
    try {
      setError(null);
      const response = await api.post('/auth/register', { 
        username, 
        email, 
        password 
      });
      return response;
    } catch (err) {
      setError(err.message || 'Failed to register');
      throw err;
    }
  };

  const logout = () => {
    // Clear local storage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Update state
    setUser(null);
    setIsAuthenticated(false);
    api.clearToken();
  };

  const value = {
    user,
    isAuthenticated,
    loading,
    error,
    login,
    register,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};