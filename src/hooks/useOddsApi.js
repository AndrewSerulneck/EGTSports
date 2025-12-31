/**
 * useOddsApi Hook
 * Simplified hook for fetching odds from The Odds API
 * Uses fuzzy matching instead of ID-based matching for reliable team name resolution
 */

import { useState, useCallback } from 'react';
import { findBestMoneylinePrices, formatMoneylineForDisplay, convertToAmericanOdds, fuzzyMatchTeamName } from '../utils/priceFinder';

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

// Sport key mapping for The Odds API
const SPORT_KEYS = {
  'NFL': 'americanfootball_nfl',
  'NBA': 'basketball_nba',
  'College Football': 'americanfootball_ncaaf',
  'College Basketball': 'basketball_ncaab',
  'NHL': 'icehockey_nhl',
  'MLB': 'baseball_mlb',
  'World Cup': 'soccer_fifa_world_cup',
  'MLS': 'soccer_usa_mls',
  'Boxing': 'boxing',
  'UFC': 'mma_mixed_martial_arts'
};

/**
 * Hook for fetching odds data from The Odds API
 * @returns {Object} { fetchOddsForSport, loading, error }
 */
export function useOddsApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  /**
   * Fetch odds for a specific sport using fuzzy matching
   * @param {string} sport - Sport name (e.g., 'NFL', 'NBA')
   * @param {string} apiKey - The Odds API key
   * @returns {Promise<Object>} oddsMap - Object keyed by "awayTeam|homeTeam"
   */
  const fetchOddsForSport = useCallback(async (sport, apiKey) => {
    if (!apiKey || apiKey === 'undefined') {
      throw new Error('API key required');
    }
    
    const sportKey = SPORT_KEYS[sport];
    if (!sportKey) {
      throw new Error(`Sport ${sport} not supported`);
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Determine markets based on sport type
      const isCombat = sport === 'Boxing' || sport === 'UFC';
      
      let markets;
      if (isCombat) {
        markets = 'h2h,h2h_method,h2h_round,h2h_go_distance';
      } else {
        markets = 'h2h,spreads,totals';
      }
      
      // Build URL with time window for next 14 days
      const now = new Date();
      const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      const commenceTimeFrom = now.toISOString().split('.')[0] + 'Z';
      const commenceTimeTo = fourteenDaysFromNow.toISOString().split('.')[0] + 'Z';
      
      const url = `${ODDS_API_BASE}/sports/${sportKey}/odds/?apiKey=${apiKey}&regions=us&markets=${markets}&oddsFormat=american&includeSids=true&commenceTimeFrom=${commenceTimeFrom}&commenceTimeTo=${commenceTimeTo}`;
      
      console.log(`\n🎯 Fetching odds from The Odds API for ${sport}...`);
      console.log(`📋 Markets: ${markets}`);
      console.log(`📅 Time window: ${commenceTimeFrom} to ${commenceTimeTo}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid API key');
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded');
        } else if (response.status === 404) {
          throw new Error(`Sport ${sport} not found in API`);
        }
        throw new Error(`API error: ${response.status}`);
      }
      
      const events = await response.json();
      const oddsMap = {};
      
      console.log(`✅ Received ${events.length} events from The Odds API for ${sport}`);
      
      // Process each event
      for (const event of events) {
        const { home_team, away_team, bookmakers } = event;
        
        if (!bookmakers || bookmakers.length === 0) {
          console.log(`⚠️ No bookmakers for ${away_team} @ ${home_team}`);
          continue;
        }
        
        console.log(`\n📊 Processing: ${away_team} @ ${home_team}`);
        
        // Get moneyline using fuzzy matching from priceFinder
        const mlResult = findBestMoneylinePrices(
          bookmakers,
          home_team,
          away_team,
          sportKey,
          null, // homeTeamId - use fuzzy matching
          null  // awayTeamId - use fuzzy matching
        );
        
        const mlFormatted = formatMoneylineForDisplay(mlResult);
        
        // Find spreads and totals from bookmakers
        let spreadData = { 
          homeSpread: '-', 
          awaySpread: '-', 
          homeSpreadOdds: '-', 
          awaySpreadOdds: '-' 
        };
        let totalData = { 
          total: '-', 
          overOdds: '-', 
          underOdds: '-' 
        };
        
        // Search through bookmakers for spreads and totals
        for (const bookmaker of bookmakers) {
          const spreadsMarket = bookmaker.markets?.find(m => m.key === 'spreads');
          const totalsMarket = bookmaker.markets?.find(m => m.key === 'totals');
          
          // Get spreads if not already found
          if (spreadsMarket?.outcomes && spreadData.homeSpread === '-') {
            // Use fuzzy matching to find correct outcomes
            let homeOutcome = null;
            let awayOutcome = null;
            
            for (const outcome of spreadsMarket.outcomes) {
              if (homeOutcome === null && fuzzyMatchTeamName(outcome.name, home_team)) {
                homeOutcome = outcome;
              }
              if (awayOutcome === null && fuzzyMatchTeamName(outcome.name, away_team)) {
                awayOutcome = outcome;
              }
            }
            
            if (homeOutcome && awayOutcome) {
              spreadData = {
                homeSpread: homeOutcome.point > 0 ? `+${homeOutcome.point}` : `${homeOutcome.point}`,
                awaySpread: awayOutcome.point > 0 ? `+${awayOutcome.point}` : `${awayOutcome.point}`,
                homeSpreadOdds: convertToAmericanOdds(homeOutcome.price),
                awaySpreadOdds: convertToAmericanOdds(awayOutcome.price),
              };
              console.log(`  ✓ Spreads: ${awayOutcome.name} ${spreadData.awaySpread} (${spreadData.awaySpreadOdds}) / ${homeOutcome.name} ${spreadData.homeSpread} (${spreadData.homeSpreadOdds})`);
            }
          }
          
          // Get totals if not already found
          if (totalsMarket?.outcomes && totalData.total === '-') {
            const overOutcome = totalsMarket.outcomes.find(o => o.name === 'Over');
            const underOutcome = totalsMarket.outcomes.find(o => o.name === 'Under');
            
            if (overOutcome && underOutcome) {
              totalData = {
                total: `${overOutcome.point}`,
                overOdds: convertToAmericanOdds(overOutcome.price),
                underOdds: convertToAmericanOdds(underOutcome.price),
              };
              console.log(`  ✓ Total: ${totalData.total} (Over: ${totalData.overOdds}, Under: ${totalData.underOdds})`);
            }
          }
          
          // Break if we found both spreads and totals
          if (spreadData.homeSpread !== '-' && totalData.total !== '-') break;
        }
        
        // Store using team names as key (we'll fuzzy match against ESPN names later)
        const gameKey = `${away_team}|${home_team}`;
        oddsMap[gameKey] = {
          homeMoneyline: mlFormatted.homeMoneyline,
          awayMoneyline: mlFormatted.awayMoneyline,
          drawMoneyline: mlFormatted.drawMoneyline,
          ...spreadData,
          ...totalData,
          bookmaker: mlFormatted.bookmaker || mlResult?.bookmakerName || 'Unknown',
        };
        
        console.log(`  💰 Stored with key: "${gameKey}"`);
        console.log(`      ML: ${mlFormatted.awayMoneyline}/${mlFormatted.homeMoneyline}, Spread: ${spreadData.awaySpread}/${spreadData.homeSpread}, Total: ${totalData.total}`);
      }
      
      console.log(`\n✅ Built oddsMap with ${Object.keys(oddsMap).length} games`);
      
      setLoading(false);
      return oddsMap;
      
    } catch (err) {
      console.error('❌ Error in fetchOddsForSport:', err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, []);
  
  return { fetchOddsForSport, loading, error };
}
