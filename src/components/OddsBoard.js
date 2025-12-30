/**
 * OddsBoard Component
 * Displays real-time betting odds from The Odds API
 * Integrates with local team mapping files for canonical names
 */

import React, { useState, useEffect } from 'react';
import { decimalToAmerican, getOddsClass } from '../utils/oddsUtils';
import { getCanonicalName, getTeamLogo, isSlimSchema } from '../utils/teamMapper';

const ODDS_API_KEY = process.env.REACT_APP_THE_ODDS_API_KEY;
const ODDS_API_BASE_URL = 'https://api.the-odds-api.com/v4';
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * OddsBoard Component
 * @param {string} sport - The Odds API sport key (e.g., 'basketball_nba')
 * @param {string} title - Display title for the board (e.g., 'NBA')
 * @param {string} region - Odds region (default: 'us')
 * @param {string} bookmaker - Preferred bookmaker (default: 'draftkings')
 */
function OddsBoard({ 
  sport = 'basketball_nba', 
  title = 'NBA',
  region = 'us',
  bookmaker = 'draftkings'
}) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  /**
   * Fetch odds from The Odds API
   */
  const fetchOdds = async () => {
    // Validate API key
    if (!ODDS_API_KEY || ODDS_API_KEY === 'undefined') {
      setError('API key not configured. Please set REACT_APP_THE_ODDS_API_KEY in .env');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const url = `${ODDS_API_BASE_URL}/sports/${sport}/odds/?apiKey=${ODDS_API_KEY}&regions=${region}&markets=h2h&oddsFormat=american&includeSids=true`;
      
      console.log(`🔄 Fetching odds for ${sport}...`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid API key. Check REACT_APP_THE_ODDS_API_KEY in .env');
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded. Try again later.');
        } else {
          throw new Error(`API error: ${response.status}`);
        }
      }

      const data = await response.json();
      console.log(`✅ Fetched ${data.length} games for ${sport}`);
      
      setGames(data || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('❌ Error fetching odds:', err);
      setError(err.message || 'Failed to fetch odds');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch on mount
  useEffect(() => {
    fetchOdds();
  }, [sport]); // Re-fetch when sport changes

  // Set up auto-refresh interval
  useEffect(() => {
    const interval = setInterval(() => {
      console.log(`🔄 Auto-refreshing odds for ${sport}...`);
      fetchOdds();
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [sport]);

  /**
   * Format game time to local timezone
   */
  const formatGameTime = (commenceTime) => {
    if (!commenceTime) return 'TBD';
    
    try {
      const date = new Date(commenceTime);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return 'TBD';
    }
  };

  /**
   * Get moneyline odds for a team from bookmakers
   */
  const getMoneylineOdds = (game, teamName) => {
    if (!game.bookmakers || game.bookmakers.length === 0) {
      return null;
    }

    // Try to find preferred bookmaker first
    let targetBookmaker = game.bookmakers.find(b => b.key === bookmaker);
    
    // Fallback to first available bookmaker
    if (!targetBookmaker) {
      targetBookmaker = game.bookmakers[0];
    }

    // Find h2h market
    const h2hMarket = targetBookmaker.markets?.find(m => m.key === 'h2h');
    if (!h2hMarket || !h2hMarket.outcomes) {
      return null;
    }

    // Find outcome for this team
    const outcome = h2hMarket.outcomes.find(o => o.name === teamName);
    return outcome?.price || null;
  };

  /**
   * Get bookmaker name for display
   */
  const getBookmakerName = (game) => {
    if (!game.bookmakers || game.bookmakers.length === 0) {
      return 'N/A';
    }

    const targetBookmaker = game.bookmakers.find(b => b.key === bookmaker) || game.bookmakers[0];
    return targetBookmaker.title || targetBookmaker.key || 'Unknown';
  };

  /**
   * Render loading state
   */
  if (loading && games.length === 0) {
    return (
      <div className="odds-board-container" role="status" aria-live="polite">
        <div className="odds-board-header">
          <h2 className="text-2xl font-bold text-gray-800">{title} Live Odds</h2>
        </div>
        <div className="flex justify-center items-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="ml-4 text-gray-600">Loading odds...</span>
        </div>
      </div>
    );
  }

  /**
   * Render error state
   */
  if (error) {
    return (
      <div className="odds-board-container" role="alert">
        <div className="odds-board-header">
          <h2 className="text-2xl font-bold text-gray-800">{title} Live Odds</h2>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 m-4">
          <div className="flex items-center">
            <span className="text-red-600 text-xl mr-3">⚠️</span>
            <div>
              <h3 className="text-red-800 font-semibold">Error Loading Odds</h3>
              <p className="text-red-700 mt-1">{error}</p>
            </div>
          </div>
          <button 
            onClick={fetchOdds}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  /**
   * Render empty state
   */
  if (games.length === 0) {
    return (
      <div className="odds-board-container">
        <div className="odds-board-header">
          <h2 className="text-2xl font-bold text-gray-800">{title} Live Odds</h2>
          {lastUpdated && (
            <p className="text-sm text-gray-500 mt-1">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 m-4 text-center">
          <p className="text-gray-600 text-lg">No games available at this time</p>
          <button 
            onClick={fetchOdds}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  /**
   * Render game card
   */
  const renderGameCard = (game) => {
    const awayTeamCanonical = getCanonicalName(game.away_team, sport);
    const homeTeamCanonical = getCanonicalName(game.home_team, sport);
    
    const awayLogo = getTeamLogo(game.away_team, sport);
    const homeLogo = getTeamLogo(game.home_team, sport);
    
    const awayOdds = getMoneylineOdds(game, game.away_team);
    const homeOdds = getMoneylineOdds(game, game.home_team);
    
    const bookmakerName = getBookmakerName(game);
    const isSlim = isSlimSchema(sport);

    return (
      <div 
        key={game.id} 
        className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden"
      >
        {/* Game Time Header */}
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
          <p className="text-sm text-gray-600 font-medium">
            {formatGameTime(game.commence_time)}
          </p>
        </div>

        {/* Teams and Odds */}
        <div className="p-4">
          {/* Away Team */}
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
            <div className="flex items-center flex-1">
              {awayLogo && !isSlim && (
                <img 
                  src={awayLogo} 
                  alt={`${awayTeamCanonical} logo`}
                  className="w-8 h-8 mr-3 object-contain"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              )}
              <span className="text-gray-800 font-medium">{awayTeamCanonical}</span>
            </div>
            <div className="ml-4">
              {awayOdds ? (
                <span className={`text-lg font-bold ${getOddsClass(awayOdds)}`}>
                  {decimalToAmerican(awayOdds)}
                </span>
              ) : (
                <span className="text-sm text-gray-400 font-medium px-3 py-1 bg-gray-100 rounded">
                  Suspended
                </span>
              )}
            </div>
          </div>

          {/* Home Team */}
          <div className="flex items-center justify-between">
            <div className="flex items-center flex-1">
              {homeLogo && !isSlim && (
                <img 
                  src={homeLogo} 
                  alt={`${homeTeamCanonical} logo`}
                  className="w-8 h-8 mr-3 object-contain"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              )}
              <span className="text-gray-800 font-medium">{homeTeamCanonical}</span>
            </div>
            <div className="ml-4">
              {homeOdds ? (
                <span className={`text-lg font-bold ${getOddsClass(homeOdds)}`}>
                  {decimalToAmerican(homeOdds)}
                </span>
              ) : (
                <span className="text-sm text-gray-400 font-medium px-3 py-1 bg-gray-100 rounded">
                  Suspended
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bookmaker Footer */}
        <div className="bg-gray-50 px-4 py-2 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Source: {bookmakerName}
          </p>
        </div>
      </div>
    );
  };

  /**
   * Main render
   */
  return (
    <div className="odds-board-container w-full max-w-7xl mx-auto p-4" role="region" aria-label={`${title} Odds Board`}>
      {/* Header */}
      <div className="odds-board-header mb-6">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold text-gray-800">{title} Live Odds</h2>
          <button 
            onClick={fetchOdds}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors text-sm font-medium"
            aria-label="Refresh odds"
          >
            {loading ? '🔄 Refreshing...' : '🔄 Refresh'}
          </button>
        </div>
        {lastUpdated && (
          <p className="text-sm text-gray-500 mt-2">
            Last updated: {lastUpdated.toLocaleTimeString()} • Auto-refreshes every 5 minutes
          </p>
        )}
      </div>

      {/* Games Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {games.map(game => renderGameCard(game))}
      </div>

      {/* Loading Overlay (during refresh) */}
      {loading && games.length > 0 && (
        <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
          <span className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Updating...
          </span>
        </div>
      )}
    </div>
  );
}

export default OddsBoard;
