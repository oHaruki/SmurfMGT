// src/pages/AccountsList.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import AccountCard from '../components/AccountCard';
import Loader from '../components/Loader';
import '../styles/AccountsList.css';

const sortOptions = [
  { value: 'name', label: 'Summoner Name' },
  { value: 'server', label: 'Server' },
  { value: 'rank', label: 'Rank (Highest First)' },
  { value: 'lastModified', label: 'Last Modified' }
];

const AccountsList = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('name');
  const [sortedAccounts, setSortedAccounts] = useState([]);
  
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const data = await api.getAccounts();
        console.log('Fetched accounts:', data);
        
        // Initialize accounts with favorite field if not present
        const accountsWithFavorites = data.map(account => ({
          ...account,
          favorite: account.favorite || false,
          // If we have rank data stored, use it, otherwise set to null
          rank: account.rank || null
        }));
        
        setAccounts(accountsWithFavorites);
      } catch (err) {
        console.error('Error fetching accounts:', err);
        setError(err.message || 'Failed to fetch accounts');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAccounts();
  }, []);
  
  useEffect(() => {
    // Define sortAccounts inside the useEffect to avoid the dependency warning
    const sortAccounts = (criteria) => {
      const sorted = [...accounts];
      
      // Always put favorites at the top
      sorted.sort((a, b) => {
        // First sort by favorite status
        if (a.favorite && !b.favorite) return -1;
        if (!a.favorite && b.favorite) return 1;
        
        // Then sort by the selected criteria
        switch (criteria) {
          case 'name':
            return a.summoner_name.localeCompare(b.summoner_name);
          case 'server':
            return a.server.localeCompare(b.server);
          case 'rank':
            // Placeholder for rank sorting - would need actual rank data
            const rankOrder = { 
              'CHALLENGER': 9, 'GRANDMASTER': 8, 'MASTER': 7, 
              'DIAMOND': 6, 'PLATINUM': 5, 'GOLD': 4, 
              'SILVER': 3, 'BRONZE': 2, 'IRON': 1, null: 0 
            };
            return (rankOrder[b.rank] || 0) - (rankOrder[a.rank] || 0);
          case 'lastModified':
            // If we have lastModified timestamp, use it
            return (b.lastModified || 0) - (a.lastModified || 0);
          default:
            return 0;
        }
      });
      
      setSortedAccounts(sorted);
    };

    // Sort accounts whenever accounts or sortBy changes
    sortAccounts(sortBy);
  }, [accounts, sortBy]);
  
  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this account?')) {
      try {
        await api.deleteAccount(id);
        setAccounts(accounts.filter(account => account.id !== id));
      } catch (err) {
        setError(err.message || 'Failed to delete account');
      }
    }
  };
  
  const handleToggleFavorite = async (id) => {
    try {
      // Find the account
      const accountIndex = accounts.findIndex(account => account.id === id);
      if (accountIndex === -1) return;
      
      // Create a new array with the toggled favorite status
      const newAccounts = [...accounts];
      newAccounts[accountIndex] = {
        ...newAccounts[accountIndex],
        favorite: !newAccounts[accountIndex].favorite
      };
      
      setAccounts(newAccounts);
      
      // Update in the database
      await api.updateAccount(id, { favorite: newAccounts[accountIndex].favorite });
      
    } catch (err) {
      console.error('Error toggling favorite:', err);
      setError(err.message || 'Failed to update favorite status');
    }
  };
  
  const handleSortChange = (e) => {
    setSortBy(e.target.value);
  };
  
  if (loading) return <Loader />;
  
  return (
    <div className="accounts-list">
      <div className="accounts-header">
        <h1>My League Accounts</h1>
        <div className="accounts-actions">
          <div className="sort-container">
            <label htmlFor="sort-by">Sort by:</label>
            <select 
              id="sort-by" 
              value={sortBy} 
              onChange={handleSortChange}
              className="sort-select"
            >
              {sortOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <Link to="/add-account" className="btn-add">
            <i className="fas fa-plus"></i> Add New Account
          </Link>
        </div>
      </div>
      
      {error && <div className="error">{error}</div>}
      
      {accounts.length === 0 ? (
        <div className="no-accounts">
          <p>You don't have any accounts yet. Add your first League of Legends account!</p>
          <Link to="/add-account" className="btn-add-large">
            <i className="fas fa-plus"></i> Add Account
          </Link>
        </div>
      ) : (
        <div className="accounts-grid">
          {sortedAccounts.map(account => (
            <AccountCard 
              key={account.id} 
              account={account} 
              onDelete={handleDelete}
              onToggleFavorite={handleToggleFavorite}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AccountsList;