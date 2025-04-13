// src/components/FlairTag.js
import React from 'react';
import '../styles/FlairTag.css';

const FlairTag = ({ name, onRemove, size = 'normal' }) => {
  // Generate a consistent color based on the flair name
  const getFlairColor = () => {
    const colors = ['blue', 'purple', 'green', 'orange', 'gray', 'teal', 'pink'];
    
    // Simple hash function to generate consistent color for the same flair name
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  };
  
  return (
    <div className={`flair-tag ${getFlairColor()} ${size === 'small' ? 'small' : ''}`}>
      <span className="flair-name">{name}</span>
      {onRemove && (
        <button 
          className="flair-remove" 
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          ×
        </button>
      )}
    </div>
  );
};

export default FlairTag;