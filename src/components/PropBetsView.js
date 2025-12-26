import React, { useState, useEffect, useCallback } from 'react';
import './PropBetsView.css';

/**
 * PropBetsView Component - Interactive prop bets with category selection
 * Uses /events/{eventId}/odds endpoint for on-demand prop fetching
 */
function PropBetsView({ 
  allSportsGames,  // Access to game data with espnId
  onSelectPropBet, 
  selectedPicks,
  betType,
  authToken  // For API authentication
}) {
  const [selectedSport, setSelectedSport] = useState('NFL');
  const [selectedGame, setSelectedGame] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [propBets, setPropBets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const sports = ['NFL', 'NBA', 'College Football', 'College Basketball', 'NHL'];

  // Define available prop categories per sport
  const propCategories = {
    'NFL': [
      { key: 'player_pass_yds', label: '🏈 Passing Yards', icon: '📊' },
      { key: 'player_rush_yds', label: '🏃 Rushing Yards', icon: '⚡' },
      { key: 'player_rece_yds', label: '🙌 Receiving Yards', icon: '🎯' },
      { key: 'player_pass_tds', label: '🎯 Passing TDs', icon: '✨' },
      { key: 'player_anytime_td', label: '🔥 Anytime TD', icon: '💥' }
    ],
    'College Football': [
      { key: 'player_pass_yds', label: '🏈 Passing Yards', icon: '📊' },
      { key: 'player_rush_yds', label: '🏃 Rushing Yards', icon: '⚡' },
      { key: 'player_rece_yds', label: '🙌 Receiving Yards', icon: '🎯' },
      { key: 'player_pass_tds', label: '🎯 Passing TDs', icon: '✨' }
    ],
    'NBA': [
      { key: 'player_points', label: '🏀 Points', icon: '⭐' },
      { key: 'player_assists', label: '🤝 Assists', icon: '🎁' },
      { key: 'player_rebounds', label: '🔄 Rebounds', icon: '💪' },
      { key: 'player_threes', label: '🎯 Three-Pointers', icon: '🔥' }
    ],
    'College Basketball': [
      { key: 'player_points', label: '🏀 Points', icon: '⭐' },
      { key: 'player_assists', label: '🤝 Assists', icon: '🎁' },
      { key: 'player_rebounds', label: '🔄 Rebounds', icon: '💪' }
    ],
    'NHL': [
      { key: 'player_points', label: '🏒 Points', icon: '⭐' },
      { key: 'player_shots_on_goal', label: '🎯 Shots on Goal', icon: '💥' }
    ]
  };

  // Get games for current sport
  const currentGames = allSportsGames[selectedSport] || [];
  
  // Filter to only show upcoming games (not final)
  const upcomingGames = currentGames.filter(game => game.status !== 'post');

  // Reset game and category when sport changes
  useEffect(() => {
    setSelectedGame(null);
    setSelectedCategory(null);
    setPropBets([]);
    setError(null);
  }, [selectedSport]);

  // Fetch prop bets for selected game and category
  const fetchPropBets = useCallback(async (game, category) => {
    if (!game || !category) return;

    setLoading(true);
    setError(null);

    try {
      // Use ESPN ID as eventId (may need mapping in some cases)
      const eventId = game.espnId;
      
      const response = await fetch(
        `/api/wager-manager?action=getEventPropBets&eventId=${eventId}&sport=${selectedSport}&categories=${category}`,
        {
          headers: authToken ? {
            'Authorization': `Bearer ${authToken}`
          } : {}
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch prop bets');
      }

      const data = await response.json();
      
      if (data.success) {
        setPropBets(data.propBets || []);
      } else {
        throw new Error(data.error || 'No prop bets available');
      }
    } catch (err) {
      console.error('Error fetching prop bets:', err);
      setError(err.message);
      setPropBets([]);
    } finally {
      setLoading(false);
    }
  }, [selectedSport, authToken]);

  // Handle game selection
  const handleGameSelect = useCallback((game) => {
    setSelectedGame(game);
    setSelectedCategory(null);
    setPropBets([]);
    setError(null);
  }, []);

  // Handle category selection
  const handleCategorySelect = useCallback((categoryKey) => {
    setSelectedCategory(categoryKey);
    if (selectedGame) {
      fetchPropBets(selectedGame, categoryKey);
    }
  }, [selectedGame, fetchPropBets]);

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

  return (
    <div className="prop-bets-view">
      <div className="prop-bets-header">
        <h2>🎯 Player Prop Bets</h2>
        <p className="prop-bets-subtitle">
          Select a game, then choose a prop category to view available bets
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
              {(allSportsGames[sport] || []).filter(g => g.status !== 'post').length}
            </span>
          </button>
        ))}
      </div>

      {/* Game Selection */}
      {upcomingGames.length > 0 ? (
        <div className="game-selection-section">
          <h3 className="section-title">1️⃣ Select a Game</h3>
          <div className="games-grid">
            {upcomingGames.map(game => (
              <button
                key={game.id}
                className={`game-card ${selectedGame?.id === game.id ? 'selected' : ''}`}
                onClick={() => handleGameSelect(game)}
              >
                <div className="game-teams">
                  <div className="team">{game.awayTeam}</div>
                  <div className="vs">@</div>
                  <div className="team">{game.homeTeam}</div>
                </div>
                <div className="game-time">
                  {game.date} • {game.time}
                </div>
                {selectedGame?.id === game.id && <div className="selected-checkmark">✓</div>}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="no-games-message">
          <p>No upcoming games available for {selectedSport} at the moment.</p>
          <p className="no-games-subtitle">Check back when games are scheduled!</p>
        </div>
      )}

      {/* Category Selection */}
      {selectedGame && (
        <div className="category-selection-section">
          <h3 className="section-title">2️⃣ Choose Prop Category</h3>
          <div className="categories-grid">
            {propCategories[selectedSport]?.map(category => (
              <button
                key={category.key}
                className={`category-card ${selectedCategory === category.key ? 'selected' : ''}`}
                onClick={() => handleCategorySelect(category.key)}
              >
                <span className="category-icon">{category.icon}</span>
                <span className="category-label">{category.label}</span>
                {selectedCategory === category.key && <div className="selected-checkmark">✓</div>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Prop Bets Display */}
      {selectedGame && selectedCategory && (
        <div className="props-display-section">
          <h3 className="section-title">3️⃣ Select Props to Bet</h3>
          
          {loading && (
            <div className="loading-spinner">
              <div className="spinner"></div>
              <p>Loading props...</p>
            </div>
          )}

          {error && (
            <div className="error-message">
              <p>⚠️ {error}</p>
              <p style={{marginTop: '12px', fontSize: '14px', color: '#666'}}>
                This game may not have prop bets available yet.
              </p>
            </div>
          )}

          {!loading && !error && propBets.length === 0 && (
            <div className="no-props-message">
              <p>No prop bets available for this category.</p>
            </div>
          )}

          {!loading && !error && propBets.length > 0 && (
            <div className="props-grid">
              {propBets.map(prop => {
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
          )}
        </div>
      )}
    </div>
  );
}

export default PropBetsView;
