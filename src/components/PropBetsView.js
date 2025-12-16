import React, { useState } from 'react';
import './PropBetsView.css';

/**
 * PropBetsView Component - Display prop bets organized by sport
 */
function PropBetsView({ 
  propBets, 
  loading,
  error, 
  onSelectPropBet, 
  selectedPicks,
  betType 
}) {
  const [selectedSport, setSelectedSport] = useState('NFL');
  
  const sports = ['NFL', 'NBA', 'College Football', 'College Basketball', 'NHL'];

  // Check if a prop bet is selected
  const isPropBetSelected = (propId) => {
    return selectedPicks.some(pick => pick.id === propId);
  };

  // Format odds for display
  const formatOdds = (odds) => {
    if (!odds) return '';
    return odds > 0 ? `+${odds}` : odds;
  };

  // Format line for display
  const formatLine = (line) => {
    if (!line) return '';
    return line > 0 ? `O ${line}` : `U ${Math.abs(line)}`;
  };

  if (loading) {
    return (
      <div className="prop-bets-view">
        <div className="prop-bets-header">
          <h2>🎯 Player Prop Bets</h2>
          <p className="prop-bets-subtitle">Loading prop bets...</p>
        </div>
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="prop-bets-view">
        <div className="prop-bets-header">
          <h2>🎯 Player Prop Bets</h2>
        </div>
        <div className="error-message">
          <p>⚠️ {error}</p>
          <p style={{marginTop: '12px', fontSize: '14px', color: '#666'}}>
            Prop bets will return once our API quota resets. Check back soon!
          </p>
        </div>
      </div>
    );
  }

  // Safely access prop bets, defaulting to empty array
  const currentProps = (propBets && propBets[selectedSport]) || [];

  return (
    <div className="prop-bets-view">
      <div className="prop-bets-header">
        <h2>🎯 Player Prop Bets</h2>
        <p className="prop-bets-subtitle">
          Select individual player props or combine them in a parlay
        </p>
      </div>

      {/* Sport Tabs */}
      <div className="prop-sports-tabs">
        {sports.map(sport => (
          <button
            key={sport}
            className={`prop-sport-tab ${selectedSport === sport ? 'active' : ''}`}
            onClick={() => setSelectedSport(sport)}
          >
            {sport}
            <span className="prop-count">
              {propBets[sport]?.length || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Prop Bets List */}
      <div className="prop-bets-list">
        {currentProps.length === 0 ? (
          <div className="no-props-message">
            <p>No prop bets available for {selectedSport} at the moment.</p>
            <p className="no-props-subtitle">Check back soon for updated props!</p>
          </div>
        ) : (
          <>
            {/* Group by game */}
            {Object.entries(
              currentProps.reduce((acc, prop) => {
                if (!acc[prop.gameTitle]) acc[prop.gameTitle] = [];
                acc[prop.gameTitle].push(prop);
                return acc;
              }, {})
            ).map(([gameTitle, props]) => (
              <div key={gameTitle} className="game-props-section">
                <div className="game-props-header">
                  <h3>{gameTitle}</h3>
                  <span className="game-time">
                    {new Date(props[0].commence_time).toLocaleDateString()} {new Date(props[0].commence_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="props-grid">
                  {props.map(prop => {
                    const isSelected = isPropBetSelected(prop.id);
                    
                    return (
                      <button
                        key={prop.id}
                        className={`prop-bet-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => onSelectPropBet(prop)}
                      >
                        <div className="prop-player-name">{prop.playerName}</div>
                        <div className="prop-market">{prop.marketDisplay}</div>
                        {prop.line && (
                          <div className="prop-line">{formatLine(prop.line)}</div>
                        )}
                        <div className="prop-odds">{formatOdds(prop.odds)}</div>
                        {isSelected && <div className="selected-checkmark">✓</div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export default PropBetsView;
