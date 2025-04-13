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
  const [copyMessage, setCopyMessage] = useState('');
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("Fetching account with ID:", id);
        
        // Fetch account details
        const accountData = await api.getAccount(id);
        console.log("Account data:", accountData);
        setAccount(accountData);
        
        // Fetch available flairs
        const flairsData = await api.getFlairs();
        console.log("Flairs data:", flairsData);
        setAvailableFlairs(flairsData || []);
        
        // If account has flairs, set them
        if (accountData.flairs && accountData.flairs.length > 0) {
          setFlairs(accountData.flairs.filter(flair => flair !== null));
        }
        
        // If a default flair exists, set it as selected
        if (flairsData && flairsData.length > 0) {
          setSelectedFlair(flairsData[0].id);
        }
      } catch (err) {
        console.error("Error fetching account:", err);
        setError(err.message || 'Failed to fetch account details');
      } finally {
        setLoading(false);
      }
    };
    
    if (id) {
      fetchData();
    } else {
      setError('No account ID provided');
      setLoading(false);
    }
  }, [id]);
  
  // Copy text to clipboard
  const copyToClipboard = (text, field) => {
    // Check if we have a decrypted password available from the API
    if (field === 'Password' && account.decrypted_password) {
      navigator.clipboard.writeText(account.decrypted_password)
        .then(() => {
          setCopyMessage(`${field} copied!`);
          setTimeout(() => setCopyMessage(''), 2000);
        })
        .catch(err => {
          console.error('Could not copy text: ', err);
        });
    } else {
      // For non-password fields or when no decrypted password is available
      navigator.clipboard.writeText(text)
        .then(() => {
          setCopyMessage(`${field} copied!`);
          setTimeout(() => setCopyMessage(''), 2000);
        })
        .catch(err => {
          console.error('Could not copy text: ', err);
        });
    }
  };
  
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
      
      // Update account with rank info if available
      if (data.ranked && data.ranked.length > 0) {
        // Find the highest rank (first prioritize solo/duo queue)
        const soloQueue = data.ranked.find(q => q.queueType === 'RANKED_SOLO_5x5');
        const highestRank = soloQueue || data.ranked[0];
        
        // Update account with rank info
        try {
          await api.updateAccount(id, { 
            rank: highestRank.tier,
            rankDivision: highestRank.rank,
            lastModified: Date.now()
          });
          
          // Update local account state
          setAccount({
            ...account,
            rank: highestRank.tier,
            rankDivision: highestRank.rank,
            lastModified: Date.now()
          });
        } catch (error) {
          console.error("Failed to update account with rank info:", error);
        }
      }
    } catch (err) {
      console.error("Riot API error:", err);
      setError(err.message || 'Failed to fetch Riot API data');
    } finally {
      setFetchingRiot(false);
    }
  };
  
  const handleAddFlair = async () => {
    if (!selectedFlair) return;
    
    try {
      setError(null);
      await api.addFlair(id, selectedFlair);
      
      // Get the flair name from available flairs
      const flair = availableFlairs.find(f => f.id === parseInt(selectedFlair));
      
      // Add flair to the list if it's not already there
      if (flair && !flairs.includes(flair.flair_name)) {
        setFlairs([...flairs, flair.flair_name]);
      }
    } catch (err) {
      console.error("Error adding flair:", err);
      setError(err.message || 'Failed to add flair');
    }
  };
  
  const handleRemoveFlair = async (flairName) => {
    try {
      setError(null);
      // Find flair ID from name
      const flair = availableFlairs.find(f => f.flair_name === flairName);
      
      if (flair) {
        await api.removeFlair(id, flair.id);
        setFlairs(flairs.filter(f => f !== flairName));
      }
    } catch (err) {
      console.error("Error removing flair:", err);
      setError(err.message || 'Failed to remove flair');
    }
  };
  
  const handleDeleteAccount = async () => {
    if (window.confirm('Are you sure you want to delete this account?')) {
      try {
        setError(null);
        await api.deleteAccount(id);
        navigate('/accounts');
      } catch (err) {
        console.error("Error deleting account:", err);
        setError(err.message || 'Failed to delete account');
      }
    }
  };
  
  const handleToggleFavorite = async () => {
    if (!account) return;
    
    try {
      setError(null);
      const updatedAccount = { ...account, favorite: !account.favorite };
      await api.updateAccount(id, { favorite: updatedAccount.favorite });
      setAccount(updatedAccount);
    } catch (err) {
      console.error("Error toggling favorite:", err);
      setError(err.message || 'Failed to update favorite status');
    }
  };
  
  if (loading) return <Loader />;
  
  if (!account) return (
    <div className="account-not-found">
      <h2>Account Not Found</h2>
      <p>The account you're looking for doesn't exist or you don't have permission to view it.</p>
      <button onClick={() => navigate('/accounts')} className="btn-back">
        <i className="fas fa-arrow-left"></i> Back to Accounts
      </button>
    </div>
  );
  
  return (
    <div className="account-details">
      <div className="details-header">
        <div>
          <h1>{account.summoner_name}</h1>
          <div className="account-server">{account.server.toUpperCase()}</div>
        </div>
        <button 
          className={`btn-favorite ${account.favorite ? 'active' : ''}`}
          onClick={handleToggleFavorite}
        >
          <i className={`fas ${account.favorite ? 'fa-star' : 'fa-star-o'}`}></i>
          {account.favorite ? 'Favorited' : 'Add to Favorites'}
        </button>
      </div>
      
      {error && <div className="error">{error}</div>}
      {copyMessage && <div className="copy-message">{copyMessage}</div>}
      
      <div className="account-sections">
        <div className="account-section">
          <h2>Account Information</h2>
          <div className="account-info">
            <div className="info-row">
              <span className="info-label">Login Username:</span>
              <span className="info-value">{account.login_username}</span>
              <button 
                className="btn-copy" 
                onClick={() => copyToClipboard(account.login_username, 'Username')}
                title="Copy username"
              >
                <i className="fas fa-copy"></i>
              </button>
            </div>
            <div className="info-row">
              <span className="info-label">Password:</span>
              <span className="info-value">••••••••</span>
              <button 
                className="btn-copy" 
                onClick={() => copyToClipboard('', 'Password')}
                title="Copy password"
              >
                <i className="fas fa-copy"></i>
              </button>
            </div>
            <div className="info-row">
              <span className="info-label">Summoner Name:</span>
              <span className="info-value">{account.summoner_name}</span>
              <button 
                className="btn-copy" 
                onClick={() => copyToClipboard(account.summoner_name, 'Summoner Name')}
                title="Copy summoner name"
              >
                <i className="fas fa-copy"></i>
              </button>
            </div>
            <div className="info-row">
              <span className="info-label">Server:</span>
              <span className="info-value">{account.server.toUpperCase()}</span>
            </div>
            {account.rank && (
              <div className="info-row">
                <span className="info-label">Rank:</span>
                <span className="info-value">
                  {account.rank} {account.rankDivision || ''}
                </span>
              </div>
            )}
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
              <p className="no-flairs">No flairs added yet</p>
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
              <button onClick={handleAddFlair}>
                <i className="fas fa-plus"></i> Add Flair
              </button>
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
                {fetchingRiot ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i> Fetching...
                  </>
                ) : (
                  <>
                    <i className="fas fa-sync-alt"></i> Fetch Account Data
                  </>
                )}
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
                {riotData.ranked && riotData.ranked.length > 0 ? (
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
                <i className="fas fa-sync-alt"></i> Refresh Data
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
          <i className="fas fa-trash"></i> Delete Account
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