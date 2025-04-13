// src/components/RankBadge.js
import React from 'react';
import '../styles/RankBadge.css';

const RankBadge = ({ tier, rank }) => {
  const getRankImage = () => {
    // Default to Iron if tier is undefined
    const safeTier = tier ? tier.toLowerCase() : 'iron';
    
    return `https://opgg-static.akamaized.net/images/medals/${safeTier}_1.png`;
  };
  
  return (
    <div className="rank-badge">
      <img 
        src={getRankImage()} 
        alt={`${tier} ${rank}`} 
        className="rank-image"
      />
    </div>
  );
};

export default RankBadge;