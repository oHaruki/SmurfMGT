// src/pages/AccountDetails.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import Loader from '../components/Loader';
import RankBadge from '../components/RankBadge';
import FlairTag from '../components/FlairTag';
import '../styles/AccountDetails.css';

const AccountDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [account, setAccount] = useState(null);
  const [riotData, setRiotData] = useState(null);
  const [flairs, setFlairs] = useState([]);
  const [availableFlairs, setAvailableFlairs] = useState([]);
  const [selectedFlair, setSelectedFlair] = useState('');
  const [loading, setLoading] = useState(true);
  const [fetchingRiot, setFetchingRiot] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch account details
        const accountData = await api.getAccount(id);
        setAccount(accountData);
        
        // Fetch available flairs
        const flairsData = await api.getFlairs();
        setAvailableFlairs(flairsData);
        
        // If account has flairs, set them
        if (accountData.flairs && accountData.flairs.length > 0) {
          setFlairs(accountData.flairs.filter(flair => flair !== null));
        }
        
        // If a default flair exists, set it as selected
        if (flairsData.length > 0) {
          setSelectedFlair(flairsData[0].id);
        }
      } catch (err) {
        setError(err.message || 'Failed to fetch account details');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id]);
  
  const fetchRiotData = async () => {
    if (!account) return;
    
    try {
      setFetchingRiot(true);
      setError(null);
      
      const data = await api.getRiotSummoner(
        account.server,
        account.summoner_name
      );
      
      setRiotData(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch Riot API data');
    } finally {
      setFetchingRiot(false);
    }
  };
  
  const handleAddFlair = async () => {
    if (!selectedFlair) return;
    
    try {
      await api.addFlair(id, selectedFlair);
      
      // Get the flair name from available flairs
      const flair = availableFlairs.find(f => f.id === parseInt(selectedFlair));
      
      // Add flair to the list if it's not already there
      if (flair && !flairs.includes(flair.flair_name)) {
        setFlairs([...flairs, flair.flair_name]);
      }
    } catch (err) {
      setError(err.message || 'Failed to add flair');
    }
  };
  
  const handleRemoveFlair = async (flairName) => {
    try {
      // Find flair ID from name
      const flair = availableFlairs.find(f => f.flair_name === flairName);
      
      if (flair) {
        await api.removeFlair(id, flair.id);
        setFlairs(flairs.filter(f => f !== flairName));
      }
    } catch (err) {
      setError(err.message || 'Failed to remove flair');
    }
  };
  
  const handleDeleteAccount = async () => {
    if (window.confirm('Are you sure you want to delete this account?')) {
      try {
        await api.deleteAccount(id);
        navigate('/accounts');
      } catch (err) {
        setError(err.message || 'Failed to delete account');
      }
    }
  };
  
  if (loading) return <Loader />;
  if (!account) return <div className="error">Account not found</div>;
  
  return (
    <div className="account-details">
      <h1>{account.summoner_name}</h1>
      <div className="account-server">{account.server.toUpperCase()}</div>
      
      {error && <div className="error">{error}</div>}
      
      <div className="account-sections">
        <div className="account-section">
          <h2>Account Information</h2>
          <div className="account-info">
            <div className="info-row">
              <span className="info-label">Login Username:</span>
              <span className="info-value">{account.login_username}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Password:</span>
              <span className="info-value">••••••••</span>
            </div>
            <div className="info-row">
              <span className="info-label">Summoner Name:</span>
              <span className="info-value">{account.summoner_name}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Server:</span>
              <span className="info-value">{account.server.toUpperCase()}</span>
            </div>
          </div>
        </div>
        
        <div className="account-section">
          <h2>Account Flairs</h2>
          <div className="flairs-container">
            {flairs.length > 0 ? (
              <div className="flairs-list">
                {flairs.map((flair, index) => (
                  <FlairTag 
                    key={index} 
                    name={flair} 
                    onRemove={() => handleRemoveFlair(flair)} 
                  />
                ))}
              </div>
            ) : (
              <p>No flairs added yet</p>
            )}
            
            <div className="add-flair">
              <select 
                value={selectedFlair} 
                onChange={(e) => setSelectedFlair(e.target.value)}
              >
                {availableFlairs.map(flair => (
                  <option key={flair.id} value={flair.id}>
                    {flair.flair_name}
                  </option>
                ))}
              </select>
              <button onClick={handleAddFlair}>Add Flair</button>
            </div>
          </div>
        </div>
        
        <div className="account-section">
          <h2>Riot API Data</h2>
          {!riotData ? (
            <div className="riot-data-fetch">
              <button 
                onClick={fetchRiotData} 
                disabled={fetchingRiot}
                className="btn-fetch-riot"
              >
                {fetchingRiot ? 'Fetching...' : 'Fetch Account Data'}
              </button>
            </div>
          ) : (
            <div className="riot-data">
              <div className="summoner-info">
                <div className="summoner-icon">
                  <img 
                    src={`https://ddragon.leagueoflegends.com/cdn/11.14.1/img/profileicon/${riotData.summoner.profileIconId}.png`} 
                    alt="Summoner Icon" 
                  />
                </div>
                <div className="summoner-details">
                  <h3>{riotData.summoner.name}</h3>
                  <p>Level: {riotData.summoner.summonerLevel}</p>
                </div>
              </div>
              
              <div className="ranked-info">
                <h3>Ranked Information</h3>
                {riotData.ranked.length > 0 ? (
                  riotData.ranked.map((queue, index) => (
                    <div key={index} className="queue-info">
                      <h4>{formatQueueType(queue.queueType)}</h4>
                      <div className="rank-display">
                        <RankBadge tier={queue.tier} rank={queue.rank} />
                        <div className="rank-details">
                          <p>
                            {queue.tier} {queue.rank} - {queue.leaguePoints} LP
                          </p>
                          <p>
                            Wins: {queue.wins} | Losses: {queue.losses} | 
                            Win Rate: {Math.round((queue.wins / (queue.wins + queue.losses)) * 100)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p>No ranked data available for this summoner</p>
                )}
              </div>
              
              <button className="btn-refresh" onClick={fetchRiotData}>
                Refresh Data
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className="account-actions">
        <button 
          className="btn-delete" 
          onClick={handleDeleteAccount}
        >
          Delete Account
        </button>
      </div>
    </div>
  );
};

// Helper function to format queue types
const formatQueueType = (queueType) => {
  switch (queueType) {
    case 'RANKED_SOLO_5x5':
      return 'Ranked Solo/Duo';
    case 'RANKED_FLEX_SR':
      return 'Ranked Flex';
    case 'RANKED_TFT':
      return 'Teamfight Tactics';
    default:
      return queueType.replace('_', ' ');
  }
};

export default AccountDetails;