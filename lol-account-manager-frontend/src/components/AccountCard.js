// src/components/AccountCard.js
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import FlairTag from './FlairTag';
import '../styles/AccountCard.css';

const AccountCard = ({ account, onDelete, onToggleFavorite }) => {
  const [copyMessage, setCopyMessage] = useState('');
  
  // Format server name for display
  const formatServer = (server) => {
    const serverMap = {
      'na1': 'NA',
      'euw1': 'EUW',
      'eun1': 'EUNE',
      'kr': 'KR',
      'br1': 'BR',
      'jp1': 'JP',
      'ru': 'RU',
      'oc1': 'OCE',
      'tr1': 'TR',
      'la1': 'LAN',
      'la2': 'LAS'
    };
    
    return serverMap[server] || server.toUpperCase();
  };
  
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
  
  return (
    <div className={`account-card ${account.favorite ? 'favorite' : ''}`}>
      {account.favorite && <div className="favorite-star"><i className="fas fa-star"></i></div>}
      <div className="account-header">
        <h3 className="account-name">{account.summoner_name}</h3>
        <span className="account-server">{formatServer(account.server)}</span>
      </div>
      
      {account.flairs && account.flairs.length > 0 && (
        <div className="account-flairs">
          {account.flairs
            .filter(flair => flair !== null)
            .map((flair, index) => (
              <FlairTag key={index} name={flair} size="small" />
            ))}
        </div>
      )}
      
      <div className="account-login">
        <div className="login-info">
          <div className="login-row">
            <span className="login-label">Login:</span>
            <span className="login-value">{account.login_username}</span>
            <button 
              className="btn-copy" 
              onClick={() => copyToClipboard(account.login_username, 'Username')}
              title="Copy username"
            >
              <i className="fas fa-copy"></i>
            </button>
          </div>
          <div className="login-row">
            <span className="login-label">Password:</span>
            <span className="login-value">••••••••</span>
            <button 
              className="btn-copy" 
              onClick={() => copyToClipboard('', 'Password')}
              title="Copy password"
            >
              <i className="fas fa-copy"></i>
            </button>
          </div>
        </div>
        {copyMessage && <div className="copy-message">{copyMessage}</div>}
      </div>
      
      <div className="account-actions">
        <Link to={`/accounts/${account.id}`} className="btn-view">
          <i className="fas fa-eye"></i> View Details
        </Link>
        <button 
          className="btn-favorite"
          onClick={() => onToggleFavorite(account.id)}
          title={account.favorite ? "Remove from favorites" : "Add to favorites"}
        >
          <i className={`fas ${account.favorite ? 'fa-star' : 'fa-star-o'}`}></i>
        </button>
        <button 
          className="btn-delete"
          onClick={() => onDelete(account.id)}
          title="Delete account"
        >
          <i className="fas fa-trash"></i>
        </button>
      </div>
    </div>
  );
};

export default AccountCard;