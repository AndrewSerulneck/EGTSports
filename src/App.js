import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css';

// ==============================
// Configuration and Constants
// ==============================

const SPORTS_TO_LOAD = [
  'NFL',
  'NBA',
  'College Football',
  'College Basketball',
  'Major League Baseball',
  'NHL',
  'World Cup',
  'MLS',
  'Boxing',
  'UFC'
];

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const USE_ODDS_API_FALLBACK = true; // Toggle to enable/disable The Odds API fallback

// The Odds API Configuration
const ODDS_API_KEY = process.env.REACT_APP_ODDS_API_KEY;

// Debug: Log API key status
console.log('🔑 Odds API Key Status:', ODDS_API_KEY ? '✅ LOADED' : '❌ MISSING');
if (!ODDS_API_KEY) {
  console.error('❌ CRITICAL: REACT_APP_ODDS_API_KEY is not defined in .env file');
  console.error('Please add: REACT_APP_ODDS_API_KEY=your_api_key_here');
}

// The Odds API sport keys mapping
const ODDS_API_SPORT_KEYS = {
  'NFL': 'americanfootball_nfl',
  'NBA': 'basketball_nba',
  'College Football': 'americanfootball_ncaaf',
  'College Basketball': 'basketball_ncaab',
  'Major League Baseball': 'baseball_mlb',
  'NHL': 'icehockey_nhl',
  'World Cup': 'soccer_fifa_world_cup',
  'MLS': 'soccer_usa_mls',
  'Boxing': 'boxing_boxing',
  'UFC': 'mma_mixed_martial_arts'
};

// Odds API cache
const oddsApiCache = {};
const ODDS_API_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// JsonOdds API Configuration for Moneyline Odds
const JSON_ODDS_API_KEY = process.env.REACT_APP_JSON_ODDS_API_KEY;

// Debug: Log JsonOdds API key status
console.log('🔑 JsonOdds API Key Status:', JSON_ODDS_API_KEY ? '✅ LOADED' : '❌ MISSING');
if (!JSON_ODDS_API_KEY) {
  console.error('❌ CRITICAL: REACT_APP_JSON_ODDS_API_KEY is not defined in .env file');
  console.error('Please add: REACT_APP_JSON_ODDS_API_KEY=your_api_key_here');
}

// JsonOdds sport keys mapping (from documentation)
const JSON_ODDS_SPORT_KEYS = {
  'NFL': 'NFL',
  'NBA': 'NBA',
  'College Football': 'NCAAF',
  'College Basketball': 'NCAAB',
  'Major League Baseball': 'MLB',
  'NHL': 'NHL',
  'World Cup': 'Soccer', // Generic soccer, may need refinement
  'MLS': 'MLS',
  'Boxing': 'Boxing',
  'UFC': 'MMA'
};

// JsonOdds cache with same structure as Odds API cache
const jsonOddsCache = {};
const JSON_ODDS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// ==============================
// Team Name Normalization
// ==============================

const TEAM_NAME_MAPPINGS = {
  // NFL
  'LA Rams': ['Los Angeles Rams', 'LAR', 'Rams'],
  'LA Chargers': ['Los Angeles Chargers', 'LAC', 'Chargers'],
  'New England': ['New England Patriots', 'Patriots', 'NE'],
  'Tampa Bay': ['Tampa Bay Buccaneers', 'Buccaneers', 'TB'],
  'Green Bay': ['Green Bay Packers', 'Packers', 'GB'],
  'Kansas City': ['Kansas City Chiefs', 'Chiefs', 'KC'],
  'San Francisco': ['San Francisco 49ers', '49ers', 'SF'],
  'New Orleans': ['New Orleans Saints', 'Saints', 'NO'],
  'Las Vegas': ['Las Vegas Raiders', 'Raiders', 'LV'],
  
  // NBA
  'LA Lakers': ['Los Angeles Lakers', 'Lakers', 'LAL'],
  'LA Clippers': ['Los Angeles Clippers', 'Clippers', 'LAC'],
  'Golden State': ['Golden State Warriors', 'Warriors', 'GS', 'GSW'],
  'New York': ['New York Knicks', 'Knicks', 'NY', 'NYK'],
  'Brooklyn': ['Brooklyn Nets', 'Nets', 'BKN'],
  
  // NHL
  'NY Rangers': ['New York Rangers', 'Rangers', 'NYR'],
  'NY Islanders': ['New York Islanders', 'Islanders', 'NYI'],
  'Tampa Bay': ['Tampa Bay Lightning', 'Lightning', 'TB', 'TBL'],
  
  // MLB
  'NY Yankees': ['New York Yankees', 'Yankees', 'NYY'],
  'NY Mets': ['New York Mets', 'Mets', 'NYM'],
  'LA Dodgers': ['Los Angeles Dodgers', 'Dodgers', 'LAD'],
  'LA Angels': ['Los Angeles Angels', 'Angels', 'LAA'],
  'White Sox': ['Chicago White Sox', 'CWS'],
  'Red Sox': ['Boston Red Sox', 'BOS'],
  
  // College Football
  'Miami': ['Miami Hurricanes', 'Miami (FL)', 'Miami FL'],
  'USC': ['USC Trojans', 'Southern California'],
  'UCF': ['UCF Knights', 'Central Florida'],
  'BYU': ['BYU Cougars', 'Brigham Young'],
  'SMU': ['SMU Mustangs', 'Southern Methodist'],
  
  // College Basketball
  'UConn': ['Connecticut Huskies', 'Connecticut'],
  'UCLA': ['UCLA Bruins'],
  'Kansas': ['Kansas Jayhawks'],
  'Duke': ['Duke Blue Devils'],
  'UNC': ['North Carolina Tar Heels', 'North Carolina']
};

/**
 * Normalize team name for matching
 * Removes common suffixes and converts to lowercase
 */
const normalizeTeamName = (teamName) => {
  if (!teamName) return '';
  
  let normalized = teamName.toLowerCase().trim();
  
  // Remove common suffixes
  const suffixes = [
    'fc', 'united', 'city', 'town', 'athletic', 'athletics',
    'national', 'international', 'club', 'team'
  ];
  
  suffixes.forEach(suffix => {
    const regex = new RegExp(`\\s+${suffix}$`, 'i');
    normalized = normalized.replace(regex, '');
  });
  
  return normalized;
};

/**
 * Check if two team names match using multiple strategies
 * Returns { match: boolean, confidence: number }
 */
const teamsMatchHelper = (name1, name2) => {
  if (!name1 || !name2) return { match: false, confidence: 0 };
  
  // Exact match
  if (name1.toLowerCase() === name2.toLowerCase()) {
    return { match: true, confidence: 1.0 };
  }
  
  // Check mappings
  for (const [canonical, variants] of Object.entries(TEAM_NAME_MAPPINGS)) {
    const allNames = [canonical, ...variants].map(n => n.toLowerCase());
    const name1Lower = name1.toLowerCase();
    const name2Lower = name2.toLowerCase();
    
    if (allNames.includes(name1Lower) && allNames.includes(name2Lower)) {
      return { match: true, confidence: 0.95 };
    }
  }
  
  // Normalized match
  const norm1 = normalizeTeamName(name1);
  const norm2 = normalizeTeamName(name2);
  
  if (norm1 === norm2) {
    return { match: true, confidence: 0.9 };
  }
  
  // Contains match (one name contains the other)
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    return { match: true, confidence: 0.8 };
  }
  
  // Word overlap match
  const words1 = norm1.split(/\s+/);
  const words2 = norm2.split(/\s+/);
  const commonWords = words1.filter(w => words2.includes(w) && w.length > 2);
  
  if (commonWords.length > 0) {
    const confidence = commonWords.length / Math.max(words1.length, words2.length);
    if (confidence > 0.5) {
      return { match: true, confidence: confidence * 0.7 };
    }
  }
  
  return { match: false, confidence: 0 };
};

// ==============================
// Data Fetching Functions
// ==============================

/**
 * Fetch ESPN scoreboard data for a given sport
 */
const fetchESPNData = async (sport) => {
  const sportUrls = {
    'NFL': 'http://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
    'NBA': 'http://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
    'College Football': 'http://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
    'College Basketball': 'http://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard',
    'Major League Baseball': 'http://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
    'NHL': 'http://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
    'World Cup': 'http://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard',
    'MLS': 'http://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard',
    'Boxing': 'http://site.api.espn.com/apis/site/v2/sports/boxing/boxing/scoreboard',
    'UFC': 'http://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard'
  };

  const url = sportUrls[sport];
  if (!url) {
    console.error(`Unknown sport: ${sport}`);
    return null;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching ESPN data for ${sport}:`, error);
    return null;
  }
};

/**
 * Parse ESPN data into a standardized game format
 */
const parseESPNData = (data, sport) => {
  if (!data || !data.events) {
    return [];
  }

  return data.events.map(event => {
    const competition = event.competitions?.[0];
    if (!competition) return null;

    const competitors = competition.competitors || [];
    const homeTeam = competitors.find(c => c.homeAway === 'home');
    const awayTeam = competitors.find(c => c.homeAway === 'away');

    if (!homeTeam || !awayTeam) return null;

    // Extract odds data from competition.odds
    const odds = competition.odds?.[0];
    const details = odds?.details;
    const overUnder = odds?.overUnder;

    // Parse moneyline from details string (e.g., "LAL -200")
    let awayMoneyline = '-';
    let homeMoneyline = '-';
    
    if (details) {
      const parts = details.split(' ');
      if (parts.length >= 2) {
        const team = parts[0];
        const line = parts[1];
        
        // Determine which team has the line
        const awayAbbrev = awayTeam.team?.abbreviation || '';
        const homeAbbrev = homeTeam.team?.abbreviation || '';
        
        if (team === awayAbbrev) {
          awayMoneyline = line;
        } else if (team === homeAbbrev) {
          homeMoneyline = line;
        }
      }
    }

    // Extract spread data
    let awaySpread = '-';
    let homeSpread = '-';
    
    if (odds?.spread) {
      const spread = parseFloat(odds.spread);
      if (!isNaN(spread)) {
        // ESPN typically shows spread from perspective of one team
        awaySpread = spread > 0 ? `+${spread}` : `${spread}`;
        homeSpread = spread > 0 ? `-${spread}` : `+${Math.abs(spread)}`;
      }
    }

    // Format total
    let total = '-';
    if (overUnder) {
      total = `${overUnder}`;
    }

    // Extract scores
    const awayScore = awayTeam.score || '0';
    const homeScore = homeTeam.score || '0';

    // Determine game status
    const status = competition.status?.type?.state || 'pre';
    const statusDetail = competition.status?.type?.detail || '';

    return {
      id: event.id,
      sport: sport,
      awayTeam: awayTeam.team?.displayName || awayTeam.team?.name || 'Unknown',
      homeTeam: homeTeam.team?.displayName || homeTeam.team?.name || 'Unknown',
      awayScore: awayScore,
      homeScore: homeScore,
      awayMoneyline: awayMoneyline,
      homeMoneyline: homeMoneyline,
      awaySpread: awaySpread,
      homeSpread: homeSpread,
      total: total,
      status: status,
      statusDetail: statusDetail,
      date: event.date,
      venue: competition.venue?.fullName || 'TBD',
      broadcast: competition.broadcasts?.[0]?.names?.join(', ') || 'N/A'
    };
  }).filter(game => game !== null);
};

/**
 * Fetch moneyline odds from JsonOdds API
 * According to JsonOdds documentation:
 * - Endpoint: https://jsonodds.com/api/odds/{sport}
 * - Authentication: x-api-key header
 * - Data structure: matches array, each with Odds array
 * - Moneyline fields: MoneyLineHome, MoneyLineAway (directly on odds object)
 * 
 * @param {string} sport - Sport name (e.g., 'NFL', 'NBA')
 * @param {boolean} forceRefresh - Skip cache if true
 * @returns {object} - Map of game keys to moneyline data { awayMoneyline, homeMoneyline }
 */
const fetchMoneylineFromJsonOdds = async (sport, forceRefresh = false) => {
  try {
    const sportKey = JSON_ODDS_SPORT_KEYS[sport];
    if (!sportKey) {
      console.warn(`⚠️ No JsonOdds sport key for: ${sport}`);
      return null;
    }
    
    // Validate API key
    if (!JSON_ODDS_API_KEY || JSON_ODDS_API_KEY === 'undefined') {
      console.error('❌ Error: REACT_APP_JSON_ODDS_API_KEY is not defined in .env');
      return null;
    }
    
    // Check cache first
    if (!forceRefresh && jsonOddsCache[sport]) {
      const cached = jsonOddsCache[sport];
      if (Date.now() - cached.timestamp < JSON_ODDS_CACHE_DURATION) {
        console.log(`✅ Using cached JsonOdds data for ${sport}`);
        return cached.data;
      }
    }
    
    // Build JsonOdds API URL
    const url = `https://jsonodds.com/api/odds/${sportKey}`;
    
    console.log(`🎰 Fetching moneylines from JsonOdds for ${sport}...`);
    console.log(`📡 URL: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'x-api-key': JSON_ODDS_API_KEY
      }
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        console.error(`❌ 401 UNAUTHORIZED: Invalid JsonOdds API key`);
      } else if (response.status === 429) {
        console.error(`❌ 429 RATE LIMIT: Too many requests to JsonOdds`);
      } else {
        console.error(`❌ JsonOdds returned ${response.status}: ${response.statusText}`);
      }
      return null;
    }
    
    const data = await response.json();
    console.log(`✅ JsonOdds response received for ${sport}`);
    
    // Validate response structure
    if (!data || typeof data !== 'object') {
      console.error('❌ JsonOdds returned invalid data structure');
      return null;
    }
    
    // Extract matches array - handle both direct array and wrapped object
    let matches = [];
    if (Array.isArray(data)) {
      matches = data;
    } else if (data.matches && Array.isArray(data.matches)) {
      matches = data.matches;
    } else {
      console.error('❌ JsonOdds response missing matches array');
      console.log('Response structure:', Object.keys(data));
      return null;
    }
    
    console.log(`📊 JsonOdds returned ${matches.length} matches for ${sport}`);
    
    // Build moneyline map using same key format as Odds API
    const moneylineMap = {};
    
    matches.forEach((match, idx) => {
      const homeTeam = match.HomeTeam;
      const awayTeam = match.AwayTeam;
      
      if (!homeTeam || !awayTeam) {
        console.warn(`  ⚠️ Match ${idx + 1} missing team names`);
        return;
      }
      
      console.log(`\n🎮 Match ${idx + 1}: ${awayTeam} @ ${homeTeam}`);
      
      // Check if Odds array exists
      if (!match.Odds || !Array.isArray(match.Odds) || match.Odds.length === 0) {
        console.warn(`  ⚠️ No odds data available`);
        return;
      }
      
      console.log(`  📊 Found ${match.Odds.length} odds provider(s)`);
      
      // Extract moneyline from first available odds provider
      // Loop through all providers to find valid moneyline data
      let homeMoneyline = null;
      let awayMoneyline = null;
      
      for (let i = 0; i < match.Odds.length; i++) {
        const odd = match.Odds[i];
        
        // CRITICAL: Convert to string as per your instruction
        // JsonOdds returns numeric values, we need strings for consistency
        if (odd.MoneyLineHome !== undefined && odd.MoneyLineHome !== null) {
          const mlHome = parseInt(odd.MoneyLineHome);
          if (!isNaN(mlHome) && mlHome >= -10000 && mlHome <= 10000) {
            homeMoneyline = String(odd.MoneyLineHome);
            if (mlHome > 0 && !homeMoneyline.startsWith('+')) {
              homeMoneyline = '+' + homeMoneyline;
            }
          }
        }
        
        if (odd.MoneyLineAway !== undefined && odd.MoneyLineAway !== null) {
          const mlAway = parseInt(odd.MoneyLineAway);
          if (!isNaN(mlAway) && mlAway >= -10000 && mlAway <= 10000) {
            awayMoneyline = String(odd.MoneyLineAway);
            if (mlAway > 0 && !awayMoneyline.startsWith('+')) {
              awayMoneyline = '+' + awayMoneyline;
            }
          }
        }
        
        // If we found both moneylines, stop searching
        if (homeMoneyline && awayMoneyline) {
          console.log(`  ✅ Moneylines from provider ${i + 1}: Away ${awayMoneyline}, Home ${homeMoneyline}`);
          break;
        }
      }
      
      // Store moneyline data using same key format as Odds API for matching
      const gameKey = `${awayTeam}|${homeTeam}`;
      moneylineMap[gameKey] = {
        awayMoneyline: awayMoneyline || '-',
        homeMoneyline: homeMoneyline || '-'
      };
      
      console.log(`  📋 Stored with key: "${gameKey}"`);
      console.log(`     Away ML: ${moneylineMap[gameKey].awayMoneyline}`);
      console.log(`     Home ML: ${moneylineMap[gameKey].homeMoneyline}`);
    });
    
    console.log(`\n🎉 JsonOdds parsing complete: ${Object.keys(moneylineMap).length} games with moneyline data`);
    
    // Cache the results
    jsonOddsCache[sport] = {
      data: moneylineMap,
      timestamp: Date.now()
    };
    
    return moneylineMap;
    
  } catch (error) {
    console.error(`\n❌ EXCEPTION in fetchMoneylineFromJsonOdds for ${sport}:`);
    console.error(`Error type: ${error.name}`);
    console.error(`Error message: ${error.message}`);
    console.error('Stack trace:', error.stack);
    return null;
  }
};

/**
 * Fetch odds data from The Odds API
 * This is used as a fallback when ESPN data is incomplete
 * 
 * @param {string} sport - Sport name (e.g., 'NFL', 'NBA')
 * @param {boolean} forceRefresh - Skip cache if true
 * @returns {object} - Map of game keys to odds data
 */
const fetchOddsFromTheOddsAPI = async (sport, forceRefresh = false) => {
  try {
    const sportKey = ODDS_API_SPORT_KEYS[sport];
    if (!sportKey) {
      console.warn(`⚠️ No Odds API sport key for: ${sport}`);
      return null;
    }
    
    // Validate API key
    if (!ODDS_API_KEY || ODDS_API_KEY === 'undefined') {
      console.error('❌ Error: REACT_APP_ODDS_API_KEY is not defined in .env');
      return null;
    }
    
    // Check cache first
    if (!forceRefresh && oddsApiCache[sport]) {
      const cached = oddsApiCache[sport];
      if (Date.now() - cached.timestamp < ODDS_API_CACHE_DURATION) {
        console.log(`✅ Using cached Odds API data for ${sport}`);
        return cached.data;
      }
    }
    
    // Build The Odds API URL
    const markets = 'h2h,spreads,totals';
    const regions = 'us';
    const oddsFormat = 'american';
    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${ODDS_API_KEY}&regions=${regions}&markets=${markets}&oddsFormat=${oddsFormat}`;
    
    console.log(`🎲 Fetching odds from The Odds API for ${sport}...`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 401) {
        console.error(`❌ 401 UNAUTHORIZED: Invalid Odds API key`);
      } else if (response.status === 422) {
        console.error(`❌ 422 UNPROCESSABLE: Sport key '${sportKey}' may not be valid or active`);
      } else if (response.status === 429) {
        console.error(`❌ 429 RATE LIMIT: Odds API request limit reached`);
      } else {
        console.error(`❌ The Odds API returned ${response.status}: ${response.statusText}`);
      }
      return null;
    }
    
    const remainingRequests = response.headers.get('x-requests-remaining');
    const usedRequests = response.headers.get('x-requests-used');
    console.log(`📊 Odds API Usage: ${usedRequests} used, ${remainingRequests} remaining`);
    
    const data = await response.json();
    console.log(`✅ Odds API response received for ${sport}: ${data.length} events`);
    
    // Build a map of odds keyed by team matchup
    const oddsMap = {};
    
    data.forEach((event, idx) => {
      const homeTeam = event.home_team;
      const awayTeam = event.away_team;
      
      console.log(`\n🎮 Event ${idx + 1}: ${awayTeam} @ ${homeTeam}`);
      
      // Extract bookmaker data (use first available bookmaker)
      const bookmaker = event.bookmakers?.[0];
      if (!bookmaker) {
        console.warn(`  ⚠️ No bookmaker data available`);
        return;
      }
      
      console.log(`  📚 Using bookmaker: ${bookmaker.title}`);
      
      const oddsData = {
        oddsApiEventId: event.id
      };
      
      // Extract h2h (moneyline)
      const h2hMarket = bookmaker.markets?.find(m => m.key === 'h2h');
      if (h2hMarket) {
        const homeOutcome = h2hMarket.outcomes?.find(o => o.name === homeTeam);
        const awayOutcome = h2hMarket.outcomes?.find(o => o.name === awayTeam);
        const drawOutcome = h2hMarket.outcomes?.find(o => o.name === 'Draw');
        
        if (homeOutcome && awayOutcome) {
          oddsData.homeMoneyline = homeOutcome.price > 0 ? `+${homeOutcome.price}` : `${homeOutcome.price}`;
          oddsData.awayMoneyline = awayOutcome.price > 0 ? `+${awayOutcome.price}` : `${awayOutcome.price}`;
          console.log(`  💰 Moneylines: Away ${oddsData.awayMoneyline}, Home ${oddsData.homeMoneyline}`);
        }
        
        if (drawOutcome) {
          oddsData.drawMoneyline = drawOutcome.price > 0 ? `+${drawOutcome.price}` : `${drawOutcome.price}`;
          console.log(`  🤝 Draw: ${oddsData.drawMoneyline}`);
        }
      }
      
      // Extract spreads
      const spreadsMarket = bookmaker.markets?.find(m => m.key === 'spreads');
      if (spreadsMarket) {
        const homeOutcome = spreadsMarket.outcomes?.find(o => o.name === homeTeam);
        const awayOutcome = spreadsMarket.outcomes?.find(o => o.name === awayTeam);
        
        if (homeOutcome && awayOutcome) {
          const homePoint = homeOutcome.point;
          const awayPoint = awayOutcome.point;
          
          oddsData.homeSpread = homePoint > 0 ? `+${homePoint}` : `${homePoint}`;
          oddsData.awaySpread = awayPoint > 0 ? `+${awayPoint}` : `${awayPoint}`;
          console.log(`  📈 Spreads: Away ${oddsData.awaySpread}, Home ${oddsData.homeSpread}`);
        }
      }
      
      // Extract totals
      const totalsMarket = bookmaker.markets?.find(m => m.key === 'totals');
      if (totalsMarket) {
        const overOutcome = totalsMarket.outcomes?.find(o => o.name === 'Over');
        const underOutcome = totalsMarket.outcomes?.find(o => o.name === 'Under');
        
        if (overOutcome && underOutcome && overOutcome.point === underOutcome.point) {
          oddsData.total = `${overOutcome.point}`;
          console.log(`  🎯 Total: ${oddsData.total}`);
        }
      }
      
      // Store using same key format as ESPN data for easy matching
      const gameKey = `${awayTeam}|${homeTeam}`;
      oddsMap[gameKey] = oddsData;
      console.log(`  📋 Stored with key: "${gameKey}"`);
    });
    
    console.log(`\n🎉 Odds API parsing complete: ${Object.keys(oddsMap).length} games with odds data`);
    
    // Cache the results
    oddsApiCache[sport] = {
      data: oddsMap,
      timestamp: Date.now()
    };
    
    return oddsMap;
    
  } catch (error) {
    console.error(`\n❌ EXCEPTION in fetchOddsFromTheOddsAPI for ${sport}:`);
    console.error(`Error type: ${error.name}`);
    console.error(`Error message: ${error.message}`);
    console.error('Stack trace:', error.stack);
    return null;
  }
};

/**
 * Match odds data to a game using team name matching
 */
const matchOddsToGame = (game, oddsMap) => {
  // Try exact match first
  const exactKey = `${game.awayTeam}|${game.homeTeam}`;
  if (oddsMap[exactKey]) {
    console.log(`  ✅ Exact match found for ${game.awayTeam} @ ${game.homeTeam}`);
    return oddsMap[exactKey];
  }
  
  // Try fuzzy matching
  for (const [key, odds] of Object.entries(oddsMap)) {
    const [oddsAway, oddsHome] = key.split('|');
    
    const awayMatch = teamsMatchHelper(game.awayTeam, oddsAway);
    const homeMatch = teamsMatchHelper(game.homeTeam, oddsHome);
    
    if (awayMatch.match && homeMatch.match) {
      console.log(`  🎯 Fuzzy match found: "${game.awayTeam} @ ${game.homeTeam}" -> "${key}"`);
      console.log(`     Confidence: Away ${awayMatch.confidence.toFixed(2)}, Home ${homeMatch.confidence.toFixed(2)}`);
      return odds;
    }
  }
  
  console.log(`  ❌ No odds match found for ${game.awayTeam} @ ${game.homeTeam}`);
  return {};
};

/**
 * Check if a game has complete odds data
 */
const hasCompleteOddsData = (game) => {
  return game.awayMoneyline !== '-' &&
         game.homeMoneyline !== '-' &&
         game.awaySpread !== '-' &&
         game.homeSpread !== '-' &&
         game.total !== '-';
};

/**
 * Count games missing odds data
 */
const countMissingOdds = (games) => {
  return games.filter(game => !hasCompleteOddsData(game)).length;
};

// ==============================
// Main App Component
// ==============================

function App() {
  const [sportsData, setSportsData] = useState({});
  const [selectedSport, setSelectedSport] = useState('NFL');
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'live', 'upcoming', 'final'

  /**
   * Load data for all sports
   */
  const loadAllSports = useCallback(async () => {
    console.log('\n🚀 Starting to load all sports data...');
    setLoading(true);
    
    const newSportsData = {};
    
    for (const sport of SPORTS_TO_LOAD) {
      console.log(`\n📡 Fetching ${sport}...`);
      
      try {
        const espnData = await fetchESPNData(sport);
        
        if (!espnData) {
          console.error(`❌ Failed to fetch ESPN data for ${sport}`);
          newSportsData[sport] = [];
          continue;
        }
        
        const formattedGames = parseESPNData(espnData, sport);
        console.log(`✅ ESPN returned ${formattedGames.length} games for ${sport}`);
        
        // Check if we need to fetch fallback odds
        if (USE_ODDS_API_FALLBACK) {
          const missingCount = countMissingOdds(formattedGames);
          
          if (missingCount > 0) {
            // STEP 1: Fetch spreads and totals from The Odds API
            const oddsMap = await fetchOddsFromTheOddsAPI(sport);
            
            // STEP 2: Fetch moneylines from JsonOdds (PRIMARY SOURCE)
            const jsonOddsMoneylines = await fetchMoneylineFromJsonOdds(sport);
            
            if (oddsMap || jsonOddsMoneylines) {
              const finalFormattedGames = formattedGames.map(game => {
                if (hasCompleteOddsData(game)) return game;
                
                // Log when ESPN is missing data
                if (!game.awayMoneyline || !game.homeMoneyline) {
                  console.log(`📞 ESPN missing moneyline for ${game.awayTeam} @ ${game.homeTeam}`);
                }
                
                // First, get spreads and totals from The Odds API
                const odds = oddsMap ? matchOddsToGame(game, oddsMap) : {};
                
                // Then, overlay JsonOdds moneylines (PRIORITY OVERRIDE)
                let jsonOddsML = null;
                if (jsonOddsMoneylines) {
                  // Try exact match first
                  const gameKey = `${game.awayTeam}|${game.homeTeam}`;
                  jsonOddsML = jsonOddsMoneylines[gameKey];
                  
                  // If no exact match, try fuzzy matching
                  if (!jsonOddsML) {
                    for (const [key, value] of Object.entries(jsonOddsMoneylines)) {
                      const [oddsAway, oddsHome] = key.split('|');
                      const awayMatch = teamsMatchHelper(game.awayTeam, oddsAway);
                      const homeMatch = teamsMatchHelper(game.homeTeam, oddsHome);
                      
                      if (awayMatch.match && homeMatch.match) {
                        jsonOddsML = value;
                        console.log(`  🎯 JsonOdds fuzzy match: "${gameKey}" -> "${key}"`);
                        break;
                      }
                    }
                  }
                }
                
                // Build updated game object with layered data:
                // 1. Base game data (ESPN)
                // 2. The Odds API (spreads, totals, fallback moneyline)
                // 3. JsonOdds (moneyline OVERRIDE)
                const updatedGame = {
                  ...game,
                  // Spreads and totals from The Odds API
                  awaySpread: odds.awaySpread || game.awaySpread,
                  homeSpread: odds.homeSpread || game.homeSpread,
                  total: odds.total || game.total,
                  // Moneyline PRIORITY: JsonOdds > The Odds API > ESPN
                  awayMoneyline: (jsonOddsML && jsonOddsML.awayMoneyline !== '-') ? jsonOddsML.awayMoneyline : (odds.awayMoneyline || game.awayMoneyline),
                  homeMoneyline: (jsonOddsML && jsonOddsML.homeMoneyline !== '-') ? jsonOddsML.homeMoneyline : (odds.homeMoneyline || game.homeMoneyline),
                  oddsApiEventId: odds.oddsApiEventId
                };
                
                // Log source of moneyline data
                if (jsonOddsML && jsonOddsML.awayMoneyline !== '-') {
                  console.log(`✅ Applied JsonOdds moneyline: ${game.awayTeam} ${updatedGame.awayMoneyline}, ${game.homeTeam} ${updatedGame.homeMoneyline}`);
                } else if (odds.awayMoneyline && !game.awayMoneyline) {
                  console.log(`✅ Applied Odds API moneyline: ${game.awayTeam} ${odds.awayMoneyline}`);
                }
                
                // Add draw moneyline for soccer sports
                if (odds.drawMoneyline !== undefined) {
                  updatedGame.drawMoneyline = odds.drawMoneyline;
                }
                
                // Add quarter/halftime markets if available
                const quarterHalfKeys = [
                  'Q1_homeMoneyline', 'Q1_awayMoneyline', 'Q1_homeSpread', 'Q1_awaySpread', 'Q1_total',
                  'Q2_homeMoneyline', 'Q2_awayMoneyline', 'Q2_homeSpread', 'Q2_awaySpread', 'Q2_total',
                  'Q3_homeMoneyline', 'Q3_awayMoneyline', 'Q3_homeSpread', 'Q3_awaySpread', 'Q3_total',
                  'Q4_homeMoneyline', 'Q4_awayMoneyline', 'Q4_homeSpread', 'Q4_awaySpread', 'Q4_total',
                  'H1_homeMoneyline', 'H1_awayMoneyline', 'H1_homeSpread', 'H1_awaySpread', 'H1_total',
                  'H2_homeMoneyline', 'H2_awayMoneyline', 'H2_homeSpread', 'H2_awaySpread', 'H2_total'
                ];
                
                quarterHalfKeys.forEach(key => {
                  if (odds[key] !== undefined) {
                    updatedGame[key] = odds[key];
                  }
                });

                
                return updatedGame;
              });
              
              sportsData[sport] = finalFormattedGames;
            } else {
              sportsData[sport] = formattedGames;
            }
          } else {
            sportsData[sport] = formattedGames;
          }
        } else {
          sportsData[sport] = formattedGames;
        }
        
        newSportsData[sport] = sportsData[sport] || formattedGames;
        
      } catch (error) {
        console.error(`❌ Error processing ${sport}:`, error);
        newSportsData[sport] = [];
      }
    }
    
    setSportsData(newSportsData);
    setLastUpdate(new Date());
    setLoading(false);
    
    console.log('\n✅ All sports data loaded successfully!');
  }, []);

  /**
   * Initial load on mount
   */
  useEffect(() => {
    loadAllSports();
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(() => {
      console.log('\n🔄 Auto-refreshing data...');
      loadAllSports();
    }, CACHE_DURATION);
    
    return () => clearInterval(interval);
  }, [loadAllSports]);

  /**
   * Get current games for selected sport
   */
  const currentGames = useMemo(() => {
    return sportsData[selectedSport] || [];
  }, [sportsData, selectedSport]);

  /**
   * Filter games by status
   */
  const filteredGames = useMemo(() => {
    if (filterStatus === 'all') return currentGames;
    
    return currentGames.filter(game => {
      if (filterStatus === 'live') {
        return game.status === 'in';
      } else if (filterStatus === 'upcoming') {
        return game.status === 'pre';
      } else if (filterStatus === 'final') {
        return game.status === 'post';
      }
      return true;
    });
  }, [currentGames, filterStatus]);

  /**
   * Sort games
   */
  const sortedGames = useMemo(() => {
    if (!sortConfig.key) return filteredGames;
    
    const sorted = [...filteredGames].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
    
    return sorted;
  }, [filteredGames, sortConfig]);

  /**
   * Handle sort
   */
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  /**
   * Format status badge
   */
  const getStatusBadge = (status, statusDetail) => {
    const statusMap = {
      'pre': { label: 'Upcoming', className: 'status-upcoming' },
      'in': { label: 'LIVE', className: 'status-live' },
      'post': { label: 'Final', className: 'status-final' }
    };
    
    const statusInfo = statusMap[status] || { label: statusDetail, className: 'status-default' };
    
    return (
      <span className={`status-badge ${statusInfo.className}`}>
        {statusInfo.label}
      </span>
    );
  };

  /**
   * Render loading state
   */
  if (loading && Object.keys(sportsData).length === 0) {
    return (
      <div className="App">
        <header className="App-header">
          <h1>🏆 EGT Sports Betting Dashboard</h1>
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading sports data...</p>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>🏆 EGT Sports Betting Dashboard</h1>
        <div className="header-info">
          {lastUpdate && (
            <p className="last-update">
              Last Updated: {lastUpdate.toLocaleTimeString()}
            </p>
          )}
          <button className="refresh-btn" onClick={loadAllSports} disabled={loading}>
            {loading ? '⏳ Refreshing...' : '🔄 Refresh'}
          </button>
        </div>
      </header>

      <div className="controls">
        <div className="sport-selector">
          <label htmlFor="sport-select">Select Sport:</label>
          <select
            id="sport-select"
            value={selectedSport}
            onChange={(e) => setSelectedSport(e.target.value)}
          >
            {SPORTS_TO_LOAD.map(sport => (
              <option key={sport} value={sport}>
                {sport} ({(sportsData[sport] || []).length})
              </option>
            ))}
          </select>
        </div>

        <div className="filter-buttons">
          <button
            className={filterStatus === 'all' ? 'active' : ''}
            onClick={() => setFilterStatus('all')}
          >
            All ({currentGames.length})
          </button>
          <button
            className={filterStatus === 'live' ? 'active' : ''}
            onClick={() => setFilterStatus('live')}
          >
            Live ({currentGames.filter(g => g.status === 'in').length})
          </button>
          <button
            className={filterStatus === 'upcoming' ? 'active' : ''}
            onClick={() => setFilterStatus('upcoming')}
          >
            Upcoming ({currentGames.filter(g => g.status === 'pre').length})
          </button>
          <button
            className={filterStatus === 'final' ? 'active' : ''}
            onClick={() => setFilterStatus('final')}
          >
            Final ({currentGames.filter(g => g.status === 'post').length})
          </button>
        </div>
      </div>

      <main className="games-container">
        {sortedGames.length === 0 ? (
          <div className="no-games">
            <p>No games available for {selectedSport}</p>
          </div>
        ) : (
          <div className="games-grid">
            {sortedGames.map(game => (
              <div key={game.id} className={`game-card ${game.status}`}>
                <div className="game-header">
                  <div className="game-status">
                    {getStatusBadge(game.status, game.statusDetail)}
                  </div>
                  <div className="game-time">
                    {new Date(game.date).toLocaleString()}
                  </div>
                </div>

                <div className="game-matchup">
                  <div className="team away-team">
                    <span className="team-name">{game.awayTeam}</span>
                    <span className="team-score">{game.awayScore}</span>
                  </div>
                  <div className="vs">@</div>
                  <div className="team home-team">
                    <span className="team-name">{game.homeTeam}</span>
                    <span className="team-score">{game.homeScore}</span>
                  </div>
                </div>

                <div className="game-odds">
                  <div className="odds-section">
                    <h4>Moneyline</h4>
                    <div className="odds-row">
                      <span className="odds-label">Away:</span>
                      <span className="odds-value">{game.awayMoneyline}</span>
                    </div>
                    <div className="odds-row">
                      <span className="odds-label">Home:</span>
                      <span className="odds-value">{game.homeMoneyline}</span>
                    </div>
                    {game.drawMoneyline && (
                      <div className="odds-row">
                        <span className="odds-label">Draw:</span>
                        <span className="odds-value">{game.drawMoneyline}</span>
                      </div>
                    )}
                  </div>

                  <div className="odds-section">
                    <h4>Spread</h4>
                    <div className="odds-row">
                      <span className="odds-label">Away:</span>
                      <span className="odds-value">{game.awaySpread}</span>
                    </div>
                    <div className="odds-row">
                      <span className="odds-label">Home:</span>
                      <span className="odds-value">{game.homeSpread}</span>
                    </div>
                  </div>

                  <div className="odds-section">
                    <h4>Total</h4>
                    <div className="odds-row">
                      <span className="odds-value">{game.total}</span>
                    </div>
                  </div>
                </div>

                <div className="game-footer">
                  <div className="venue">📍 {game.venue}</div>
                  <div className="broadcast">📺 {game.broadcast}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;