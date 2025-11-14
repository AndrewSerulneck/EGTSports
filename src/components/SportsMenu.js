import React, { useState } from 'react';
import './SportsMenu.css';

/**
 * SportsMenu Component - Left sidebar for sport selection
 * Inspired by bet777.be design
 */
function SportsMenu({ 
  currentSport, 
  onSelectSport, 
  allSportsGames,
  betType 
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const sports = [
    { name: 'NFL', icon: '🏈', available: true },
    { name: 'NBA', icon: '🏀', available: true },
    { name: 'College Football', icon: '🏟️', available: true },
    { name: 'College Basketball', icon: '🎓', available: true },
    { name: 'Major League Baseball', icon: '⚾', available: true },
    { name: 'NHL', icon: '🏒', available: true }
  ];

  // Get game count for each sport
  const getGameCount = (sportName) => {
    if (!allSportsGames || !allSportsGames[sportName]) return 0;
    return allSportsGames[sportName].length;
  };

  return (
    <div className={`sports-menu ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="sports-menu-header">
        <button 
          className="menu-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
          title={isExpanded ? 'Collapse menu' : 'Expand menu'}
        >
          {isExpanded ? '◀' : '▶'}
        </button>
        {isExpanded && <h2 className="menu-title">Sports</h2>}
      </div>

      <div className="sports-menu-content">
        {sports.map((sport) => {
          const gameCount = getGameCount(sport.name);
          const isActive = currentSport === sport.name;

          return (
            <button
              key={sport.name}
              className={`sport-item ${isActive ? 'active' : ''} ${!sport.available ? 'disabled' : ''}`}
              onClick={() => sport.available && onSelectSport(sport.name)}
              disabled={!sport.available}
              title={sport.name}
            >
              <span className="sport-icon">{sport.icon}</span>
              {isExpanded && (
                <>
                  <span className="sport-name">{sport.name}</span>
                  <span className="sport-count">{gameCount}</span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {isExpanded && betType === 'parlay' && (
        <div className="menu-footer">
          <div className="parlay-info">
            <span className="parlay-icon">🎲</span>
            <span className="parlay-text">Cross-Sport Parlays Active</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default SportsMenu;
