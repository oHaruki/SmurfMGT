// src/pages/AccountsList.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import AccountCard from '../components/AccountCard';
import Loader from '../components/Loader';
import '../styles/AccountsList.css';

const AccountsList = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const data = await api.getAccounts();
        setAccounts(data);
      } catch (err) {
        setError(err.message || 'Failed to fetch accounts');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAccounts();
  }, []);
  
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
  
  if (loading) return <Loader />;
  
  return (
    <div className="accounts-list">
      <div className="accounts-header">
        <h1>My League Accounts</h1>
        <Link to="/add-account" className="btn-add">
          Add New Account
        </Link>
      </div>
      
      {error && <div className="error">{error}</div>}
      
      {accounts.length === 0 ? (
        <div className="no-accounts">
          <p>You don't have any accounts yet. Add your first League of Legends account!</p>
          <Link to="/add-account" className="btn-add-large">
            Add Account
          </Link>
        </div>
      ) : (
        <div className="accounts-grid">
          {accounts.map(account => (
            <AccountCard 
              key={account.id} 
              account={account} 
              onDelete={() => handleDelete(account.id)} 
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AccountsList;