// src/pages/Home.js
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/Home.css';

const Home = () => {
  const { isAuthenticated } = useAuth();
  
  return (
    <div className="home">
      <div className="hero">
        <div className="hero-content">
          <h1>League of Legends Account Manager</h1>
          <p>
            Store and manage all your League of Legends accounts in one place.
            Track stats, add custom flairs, and never lose your login information again.
          </p>
          
          {isAuthenticated ? (
            <Link to="/accounts" className="btn-hero">
              View My Accounts
            </Link>
          ) : (
            <div className="hero-buttons">
              <Link to="/login" className="btn-hero">
                Log In
              </Link>
              <Link to="/register" className="btn-hero btn-hero-outline">
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
      
      <div className="features">
        <h2>Features</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Track Account Stats</h3>
            <p>
              Connect to Riot API to get real-time statistics for all your accounts.
              Track rank, level, and performance across multiple accounts.
            </p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <h3>Secure Storage</h3>
            <p>
              Safely store your account credentials with encrypted passwords.
              Never worry about forgetting your login information again.
            </p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🏷️</div>
            <h3>Custom Flairs</h3>
            <p>
              Add custom flairs to your accounts like "Main Account", "Smurf", or
              "Handleveled" to keep them organized and easy to identify.
            </p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🌐</div>
            <h3>Multi-Region Support</h3>
            <p>
              Manage accounts across different servers and regions.
              Perfect for players who compete globally.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;