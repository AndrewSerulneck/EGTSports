import React, { useState, useEffect, useCallback, useRef } from 'react';
import './PropBetsView.css';

// Cache configuration
const CACHE_KEY_PREFIX = 'propBets_cache_';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const DEBOUNCE_DELAY = 500; // 500ms debounce

/**
 * PropBetsView Component - Interactive prop bets with category selection
 * Optimized for API rate limiting with caching and debouncing
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
  const debounceTimerRef = useRef(null);
  const lastFetchRef = useRef(null);
  
  const sports = ['NFL', 'NBA', 'College Football', 'College Basketball', 'NHL'];

  // Define available prop categories per sport (LIMITED TO TOP 5)
  const propCategories = {
    'NFL': [
      { key: 'player_pass_yds', label: '🏈 Passing Yards', icon: '📊', popular: true },
      { key: 'player_rush_yds', label: '🏃 Rushing Yards', icon: '⚡', popular: true },
      { key: 'player_rece_yds', label: '🙌 Receiving Yards', icon: '🎯', popular: true },
      { key: 'player_pass_tds', label: '🎯 Passing TDs', icon: '✨', popular: true },
      { key: 'player_anytime_td', label: '🔥 Anytime TD', icon: '💥', popular: true }
    ],
    'College Football': [
      { key: 'player_pass_yds', label: '🏈 Passing Yards', icon: '📊', popular: true },
      { key: 'player_rush_yds', label: '🏃 Rushing Yards', icon: '⚡', popular: true },
      { key: 'player_rece_yds', label: '🙌 Receiving Yards', icon: '🎯', popular: true },
      { key: 'player_pass_tds', label: '🎯 Passing TDs', icon: '✨', popular: true }
    ],
    'NBA': [
      { key: 'player_points', label: '🏀 Points', icon: '⭐', popular: true },
      { key: 'player_assists', label: '🤝 Assists', icon: '🎁', popular: true },
      { key: 'player_rebounds', label: '🔄 Rebounds', icon: '💪', popular: true },
      { key: 'player_threes', label: '🎯 Three-Pointers', icon: '🔥', popular: true }
    ],
    'College Basketball': [
      { key: 'player_points', label: '🏀 Points', icon: '⭐', popular: true },
      { key: 'player_assists', label: '🤝 Assists', icon: '🎁', popular: true },
      { key: 'player_rebounds', label: '🔄 Rebounds', icon: '💪', popular: true }
    ],
    'NHL': [
      { key: 'player_points', label: '🏒 Points', icon: '⭐', popular: true },
      { key: 'player_shots_on_goal', label: '🎯 Shots on Goal', icon: '💥', popular: true }
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
    // Clear any pending debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, [selectedSport]);

  // Cache helper functions (wrapped in useCallback but with empty deps as they're pure utility functions)
  const getCacheKey = useCallback((eventId, category) => {
    return `${CACHE_KEY_PREFIX}${eventId}_${category}`;
  }, []);

  const clearOldCache = useCallback(() => {
    try {
      const keys = Object.keys(localStorage);
      const propBetsKeys = keys.filter(key => key.startsWith(CACHE_KEY_PREFIX));
      
      // Sort by age and remove oldest entries
      const entries = propBetsKeys.map(key => {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          return { key, timestamp: data.timestamp || 0 };
        } catch {
          return { key, timestamp: 0 };
        }
      });
      
      entries.sort((a, b) => a.timestamp - b.timestamp);
      
      // Remove oldest half
      const toRemove = entries.slice(0, Math.ceil(entries.length / 2));
      toRemove.forEach(entry => localStorage.removeItem(entry.key));
      
      console.log(`🧹 Cleared ${toRemove.length} old cache entries`);
    } catch (error) {
      console.error('Error clearing old cache:', error);
    }
  }, []);

  const getCachedData = useCallback((eventId, category) => {
    try {
      const cacheKey = getCacheKey(eventId, category);
      const cached = localStorage.getItem(cacheKey);
      
      if (!cached) return null;
      
      const { data, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;
      
      // Check if cache is still valid (less than 5 minutes old)
      if (age < CACHE_DURATION) {
        console.log(`📦 Using cached prop data (${Math.round(age / 1000)}s old)`);
        return data;
      } else {
        // Cache expired, remove it
        localStorage.removeItem(cacheKey);
        return null;
      }
    } catch (error) {
      console.error('Error reading cache:', error);
      return null;
    }
  }, [getCacheKey]);

  const setCachedData = useCallback((eventId, category, data) => {
    try {
      const cacheKey = getCacheKey(eventId, category);
      const cacheData = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      console.log(`💾 Cached prop data for ${eventId}_${category}`);
    } catch (error) {
      console.error('Error writing to cache:', error);
      // If storage is full, try to clear old entries
      if (error.name === 'QuotaExceededError') {
        clearOldCache();
      }
    }
  }, [getCacheKey, clearOldCache]);

  // Fetch prop bets with caching and debouncing
  const fetchPropBets = useCallback(async (game, category) => {
    if (!game || !category) return;

    const eventId = game.oddsApiEventId || game.espnId;
    
    if (!eventId) {
      setError('No event ID available for this game');
      return;
    }

    // Check cache first
    const cachedData = getCachedData(eventId, category);
    if (cachedData) {
      setPropBets(cachedData);
      setError(null);
      return;
    }

    // Prevent duplicate requests
    const requestKey = `${eventId}_${category}`;
    if (lastFetchRef.current === requestKey) {
      console.log('⏭️ Skipping duplicate request');
      return;
    }

    setLoading(true);
    setError(null);
    lastFetchRef.current = requestKey;

    try {
      console.log(`🔄 Fetching props for event ${eventId}, category: ${category}`);
      
      const response = await fetch(
        `/api/wager-manager?action=getEventPropBets&eventId=${eventId}&sport=${selectedSport}&categories=${category}`,
        {
          headers: authToken ? {
            'Authorization': `Bearer ${authToken}`
          } : {}
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch prop bets');
      }

      const data = await response.json();
      
      if (data.success) {
        const propBetsData = data.propBets || [];
        setPropBets(propBetsData);
        
        // Cache the successful response
        setCachedData(eventId, category, propBetsData);
        
        console.log(`✅ Fetched ${propBetsData.length} props`);
      } else {
        throw new Error(data.error || 'No prop bets available');
      }
    } catch (err) {
      console.error('Error fetching prop bets:', err);
      setError(err.message);
      setPropBets([]);
    } finally {
      setLoading(false);
      lastFetchRef.current = null;
    }
  }, [selectedSport, authToken, getCachedData, setCachedData]);

  // Debounced fetch function
  const debouncedFetchPropBets = useCallback((game, category) => {
    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      fetchPropBets(game, category);
      debounceTimerRef.current = null;
    }, DEBOUNCE_DELAY);
  }, [fetchPropBets]);

  // Handle game selection
  const handleGameSelect = useCallback((game) => {
    setSelectedGame(game);
    setSelectedCategory(null);
    setPropBets([]);
    setError(null);
    
    // Clear any pending fetch
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  // Handle category selection with debouncing
  const handleCategorySelect = useCallback((categoryKey) => {
    setSelectedCategory(categoryKey);
    if (selectedGame) {
      // Use debounced fetch to prevent rapid-fire requests
      debouncedFetchPropBets(selectedGame, categoryKey);
    }
  }, [selectedGame, debouncedFetchPropBets]);

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
        <h2>🎯 Prop Bets</h2>
      </div>

      {/* Sport Tabs */}
      <div className="sport-tabs-section">
        <h3 className="section-title">Step 1: Select a League</h3>
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
      </div>

      {/* Game Selection */}
      {upcomingGames.length > 0 ? (
        <div className="game-selection-section">
          <h3 className="section-title">Step 2: Select a Game</h3>
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
          <h3 className="section-title">Step 3: Select a Prop Category</h3>
          <div className="categories-grid">
            {propCategories[selectedSport]?.map(category => (
              <button
                key={category.key}
                className={`category-card ${selectedCategory === category.key ? 'selected' : ''} ${loading && selectedCategory === category.key ? 'loading' : ''}`}
                onClick={() => handleCategorySelect(category.key)}
                disabled={loading && selectedCategory === category.key}
              >
                <span className="category-icon">{category.icon}</span>
                <span className="category-label">{category.label}</span>
                {selectedCategory === category.key && !loading && <div className="selected-checkmark">✓</div>}
                {loading && selectedCategory === category.key && (
                  <div className="loading-spinner-inline">
                    <div className="spinner-small"></div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Prop Bets Display */}
      {selectedGame && selectedCategory && (
        <div className="props-display-section">
          <h3 className="section-title">Step 4: Select Props to Bet</h3>
          
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
