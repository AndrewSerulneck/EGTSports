/**
 * Odds Extraction Utility for The Odds API
 * Provides robust extraction and formatting functions for betting odds
 * 
 * Key Features:
 * - Correct nested path traversal (bookmakers[i].markets.find(m => m.key === 'h2h').outcomes)
 * - SID-based matching with fallback to name matching
 * - American odds format (no conversion needed when requesting oddsFormat=american)
 * - Comprehensive error handling and logging
 * 
 * TWO-TIER SID MATCHING:
 * - Pro Leagues (NFL, NBA, NHL): SID stored in aliases array
 * - NCAAB: SID stored directly in id field
 */

import { findTeamByName } from './teamMapper';

/**
 * Extract team odds from The Odds API response using SID-based matching
 * Follows the correct nested path: game.bookmakers[i].markets.find(m => m.key === 'h2h').outcomes
 * 
 * CRITICAL: Uses Source ID (sid) matching with local JSON team files
 * The sid from API outcomes (e.g., "par_01hqmkq6fzfvyvrsb30jj85ade") is stored in the aliases array:
 * Example: { "id": "NBA-020", "canonical": "New York Knicks", 
 *            "aliases": [..., "par_01hqmkq6fzfvyvrsb30jj85ade"] }
 * 
 * This provides the MOST RELIABLE team identification without name-based guessing.
 * 
 * @param {Object} game - The game object from The Odds API
 * @param {string} teamId - The SID from our JSON aliases (e.g., "par_01hqmk...")
 * @param {string} teamName - The team name from The Odds API (fallback only)
 * @param {string} sportKey - Sport key for team mapper lookup (optional)
 * @returns {number|string} - The odds value (American format) or status string ('N/A', 'MISSING', 'ERR')
 */
export const getTeamOdds = (game, teamId, teamName, sportKey = null) => {
  try {
    // Validation - check if game has bookmakers
    if (!game.bookmakers || game.bookmakers.length === 0) {
      console.warn(`[oddsExtraction] No bookmakers for game: ${game.id}`);
      return 'N/A';
    }
    
    // Step A: Get first available bookmaker (priority is handled by priceFinder)
    const bookmaker = game.bookmakers[0];
    
    if (!bookmaker.markets || bookmaker.markets.length === 0) {
      console.warn(`[oddsExtraction] No markets in bookmaker for game: ${game.id}`);
      return 'N/A';
    }
    
    // Step B: Find h2h (moneyline) market specifically
    const h2hMarket = bookmaker.markets?.find(m => m.key === 'h2h');
    if (!h2hMarket) {
      console.warn(`[oddsExtraction] No h2h market for game: ${game.id}`);
      return 'N/A';
    }
    
    if (!h2hMarket.outcomes || h2hMarket.outcomes.length === 0) {
      console.warn(`[oddsExtraction] No outcomes in h2h market for game: ${game.id}`);
      return 'N/A';
    }

    // Step C: PRIORITY 1 - Match by SID (Source ID) from API outcomes
    // This is the MOST RELIABLE method as sid matches our JSON id field exactly
    let outcome = null;
    
    if (teamId) {
      // Try exact SID match first
      outcome = h2hMarket.outcomes.find(o => o.sid && o.sid === teamId);
      if (outcome) {
        console.log(`[oddsExtraction] ✓ Matched by SID: ${teamId} = ${outcome.price} (${outcome.name})`);
      }
    }
    
    // Step D: PRIORITY 2 - Fallback to exact name matching (case-insensitive)
    if (!outcome && teamName) {
      outcome = h2hMarket.outcomes.find(o => 
        o.name && o.name.toLowerCase() === teamName.toLowerCase()
      );
      if (outcome) {
        console.log(`[oddsExtraction] ✓ Matched by exact name: "${teamName}" = ${outcome.price}`);
      }
    }
    
    // Step E: PRIORITY 3 - Fallback to fuzzy name matching using teamMapper
    if (!outcome && sportKey && teamName) {
      const teamData = findTeamByName(teamName, sportKey);
      if (teamData) {
        // Try canonical name
        outcome = h2hMarket.outcomes.find(o => 
          o.name && o.name.toLowerCase() === (teamData.canonical || teamData.full_name || '').toLowerCase()
        );
        
        // Try aliases
        if (!outcome && teamData.aliases) {
          for (const alias of teamData.aliases) {
            outcome = h2hMarket.outcomes.find(o => 
              o.name && o.name.toLowerCase() === alias.toLowerCase()
            );
            if (outcome) break;
          }
        }
        
        if (outcome) {
          console.log(`[oddsExtraction] ✓ Matched via teamMapper: "${teamName}" = ${outcome.price}`);
        }
      }
    }

    if (!outcome) {
      console.error(`[oddsExtraction] FAILED PATH: ${teamName} (ID: ${teamId}) not found in h2h market for game ${game.id}`);
      console.error(`[oddsExtraction] Available outcomes:`, h2hMarket.outcomes.map(o => ({
        name: o.name,
        sid: o.sid || 'NO_SID',
        price: o.price
      })));
      return 'MISSING';
    }

    // Force to Number and validate (American odds are integers like -110, +150)
    const price = Number(outcome.price);
    if (isNaN(price)) {
      console.error(`[oddsExtraction] Invalid price format for ${teamName}: ${outcome.price}`);
      return 'ERR';
    }

    return price;
  } catch (err) {
    console.error(`[oddsExtraction] Error extracting odds for ${teamName}:`, err);
    return 'ERR';
  }
};

/**
 * Format American odds with proper +/- prefix
 * When The Odds API returns American format (oddsFormat=american), odds are integers
 * Positive values need + prefix, negative values already have -
 * 
 * @param {number} americanOdds - American odds as integer (e.g., 150, -110)
 * @returns {string} - Formatted American odds (e.g., "+150" or "-110")
 */
export const formatAmericanOdds = (americanOdds) => {
  // Handle non-numeric inputs
  if (typeof americanOdds !== 'number' || isNaN(americanOdds)) {
    return typeof americanOdds === 'string' ? americanOdds : '-';
  }
  
  // Format with +/- prefix
  return americanOdds > 0 ? `+${Math.round(americanOdds)}` : `${Math.round(americanOdds)}`;
};

/**
 * Convert decimal odds to American format (backup function for decimal format APIs)
 * Handles both decimal (1.91) and already-American (±100+) formats
 * 
 * @param {number} decimal - Decimal odds (e.g., 1.91, 2.50) or American odds
 * @returns {string} - American odds (e.g., "-110" or "+150")
 */
export const convertToAmericanOdds = (decimal) => {
  // Handle non-numeric inputs
  if (typeof decimal !== 'number' || isNaN(decimal)) {
    return typeof decimal === 'string' ? decimal : '-';
  }
  
  // If already in American format (magnitude >= 100)
  if (Math.abs(decimal) >= 100) {
    return formatAmericanOdds(decimal);
  }
  
  // Handle edge case: odds of 1.0 (even money in decimal) should not be converted
  if (decimal === 1.0) {
    return '-';
  }
  
  // Convert decimal to American
  try {
    if (decimal >= 2.0) {
      // Underdog: (decimal - 1) * 100
      const american = Math.round((decimal - 1) * 100);
      return `+${american}`;
    } else if (decimal > 1.0) {
      // Favorite: -100 / (decimal - 1)
      const american = Math.round(-100 / (decimal - 1));
      return `${american}`;
    } else {
      // Invalid odds (< 1.0)
      console.warn(`[oddsExtraction] Invalid decimal odds: ${decimal}`);
      return '-';
    }
  } catch (error) {
    console.error(`[oddsExtraction] Error converting odds ${decimal}:`, error);
    return '-';
  }
};

/**
 * Extract and format moneyline odds for both teams
 * Returns American format odds (when using oddsFormat=american from API)
 * 
 * CRITICAL: teamId parameters should be SIDs from API outcomes 
 * (e.g., "par_01hqmkq6fzfvyvrsb30jj85ade") which are stored in the aliases 
 * array of our local JSON files.
 * 
 * @param {Object} game - The game object from The Odds API
 * @param {string} homeTeamId - Home team SID from API/JSON aliases
 * @param {string} homeTeamName - Home team name from API
 * @param {string} awayTeamId - Away team SID from API/JSON aliases
 * @param {string} awayTeamName - Away team name from API
 * @param {string} sportKey - Sport key for enhanced matching
 * @returns {Object} - { homeML: string, awayML: string, drawML: string|undefined }
 */
export const extractMoneylineOdds = (game, homeTeamId, homeTeamName, awayTeamId, awayTeamName, sportKey = null) => {
  const homeOdds = getTeamOdds(game, homeTeamId, homeTeamName, sportKey);
  const awayOdds = getTeamOdds(game, awayTeamId, awayTeamName, sportKey);
  
  // Check for soccer sports that have draw option
  const isSoccer = sportKey && (
    sportKey.includes('soccer') || 
    sportKey.includes('fifa') || 
    sportKey.includes('mls')
  );
  
  let drawML = undefined;
  if (isSoccer) {
    const drawOdds = getTeamOdds(game, null, 'Draw', sportKey);
    drawML = typeof drawOdds === 'number' ? formatAmericanOdds(drawOdds) : drawOdds;
  }
  
  return {
    homeML: typeof homeOdds === 'number' ? formatAmericanOdds(homeOdds) : homeOdds,
    awayML: typeof awayOdds === 'number' ? formatAmericanOdds(awayOdds) : awayOdds,
    drawML
  };
};

/**
 * Validate API response structure
 * Ensures the game object has the expected nested structure
 * 
 * @param {Object} game - The game object to validate
 * @returns {boolean} - True if structure is valid
 */
export const validateGameStructure = (game) => {
  if (!game) {
    console.error('[oddsExtraction] Game object is null or undefined');
    return false;
  }
  
  if (!game.id) {
    console.error('[oddsExtraction] Game missing id field');
    return false;
  }
  
  if (!game.bookmakers || !Array.isArray(game.bookmakers)) {
    console.warn(`[oddsExtraction] Game ${game.id} missing bookmakers array`);
    return false;
  }
  
  if (game.bookmakers.length === 0) {
    console.warn(`[oddsExtraction] Game ${game.id} has empty bookmakers array`);
    return false;
  }
  
  const firstBookmaker = game.bookmakers[0];
  if (!firstBookmaker.markets || !Array.isArray(firstBookmaker.markets)) {
    console.warn(`[oddsExtraction] Game ${game.id} first bookmaker missing markets array`);
    return false;
  }
  
  return true;
};

/**
 * Format odds for display
 * Handles American odds (integers) and converts status strings
 * 
 * @param {string|number} odds - The odds value or status
 * @returns {string} - Formatted odds for display
 */
export const formatOddsForDisplay = (odds) => {
  if (!odds || odds === '' || odds === 'undefined' || odds === 'null') {
    return '-';
  }
  
  // Status strings are passed through (but converted from N/A to dash)
  if (odds === 'N/A' || odds === 'MISSING') {
    return '-';
  }
  
  if (odds === 'ERR') {
    return 'ERR';
  }
  
  if (odds === 'OFF') {
    return 'OFF';
  }
  
  // If it's already a formatted American odds string, return it
  if (typeof odds === 'string' && (odds.startsWith('+') || odds.startsWith('-'))) {
    return odds;
  }
  
  // If it's a number (American odds as integer), format it
  if (typeof odds === 'number') {
    return formatAmericanOdds(odds);
  }
  
  return String(odds);
};

/**
 * Check if API key is properly configured
 * Should be called at app initialization
 * 
 * @returns {boolean} - True if API key is valid
 */
export const validateApiKey = () => {
  const apiKey = process.env.REACT_APP_THE_ODDS_API_KEY;
  
  if (!apiKey || apiKey === 'undefined' || apiKey === '') {
    console.error('CRITICAL: REACT_APP_THE_ODDS_API_KEY is not set in environment variables');
    console.error('Please add REACT_APP_THE_ODDS_API_KEY=your_api_key to your .env file');
    return false;
  }
  
  console.log('✅ The Odds API key is configured');
  return true;
};
