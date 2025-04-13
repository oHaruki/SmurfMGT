// src/pages/AddAccount.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import '../styles/AddAccount.css';

// Server options
const servers = [
  { value: 'na1', label: 'North America (NA)' },
  { value: 'euw1', label: 'Europe West (EUW)' },
  { value: 'eun1', label: 'Europe Nordic & East (EUNE)' },
  { value: 'kr', label: 'Korea (KR)' },
  { value: 'br1', label: 'Brazil (BR)' },
  { value: 'jp1', label: 'Japan (JP)' },
  { value: 'ru', label: 'Russia (RU)' },
  { value: 'oc1', label: 'Oceania (OCE)' },
  { value: 'tr1', label: 'Turkey (TR)' },
  { value: 'la1', label: 'Latin America North (LAN)' },
  { value: 'la2', label: 'Latin America South (LAS)' }
];

const AddAccount = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    summoner_name: '',
    server: 'na1'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  
  const navigate = useNavigate();
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    
    // Clear verification result when summoner name or server changes
    if (name === 'summoner_name' || name === 'server') {
      setVerificationResult(null);
    }
  };
  
  const verifySummoner = async () => {
    const { summoner_name, server } = formData;
    
    if (!summoner_name || !server) {
      return setError('Summoner name and server are required for verification');
    }
    
    try {
      setVerifying(true);
      setError('');
      
      const data = await api.getRiotSummoner(server, summoner_name);
      
      setVerificationResult({
        status: 'success',
        message: 'Summoner found!',
        data
      });
    } catch (err) {
      setVerificationResult({
        status: 'error',
        message: err.message || 'Failed to verify summoner'
      });
    } finally {
      setVerifying(false);
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const { username, password, summoner_name, server } = formData;
    
    if (!username || !password || !summoner_name || !server) {
      return setError('All fields are required');
    }
    
    try {
      setLoading(true);
      setError('');
      
      await api.createAccount(formData);
      navigate('/accounts');
    } catch (err) {
      setError(err.message || 'Failed to add account');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="add-account">
      <h1>Add League of Legends Account</h1>
      {error && <div className="error">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="form-section">
          <h2>Login Information</h2>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="username">Login Username</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>
          </div>
        </div>
        
        <div className="form-section">
          <h2>In-Game Information</h2>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="summoner_name">Summoner Name</label>
              <input
                type="text"
                id="summoner_name"
                name="summoner_name"
                value={formData.summoner_name}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="server">Server</label>
              <select
                id="server"
                name="server"
                value={formData.server}
                onChange={handleChange}
                required
              >
                {servers.map((server) => (
                  <option key={server.value} value={server.value}>
                    {server.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="verification-section">
            <button
              type="button"
              className="btn-verify"
              onClick={verifySummoner}
              disabled={verifying}
            >
              {verifying ? 'Verifying...' : 'Verify Summoner Name'}
            </button>
            
            {verificationResult && (
              <div className={`verification-result ${verificationResult.status}`}>
                <p>{verificationResult.message}</p>
                {verificationResult.data && (
                  <div className="summoner-preview">
                    <div className="summoner-icon">
                      <img 
                        src={`https://ddragon.leagueoflegends.com/cdn/11.14.1/img/profileicon/${verificationResult.data.summoner.profileIconId}.png`} 
                        alt="Summoner Icon" 
                      />
                    </div>
                    <div className="summoner-info">
                      <p className="summoner-name">{verificationResult.data.summoner.name}</p>
                      <p className="summoner-level">Level: {verificationResult.data.summoner.summonerLevel}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="form-actions">
          <button 
            type="button" 
            className="btn-cancel"
            onClick={() => navigate('/accounts')}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="btn-save"
            disabled={loading}
          >
            {loading ? 'Adding...' : 'Add Account'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddAccount;