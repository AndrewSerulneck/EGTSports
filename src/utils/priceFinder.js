/**
 * Price Finder Utility for The Odds API
 * Safely traverses bookmakers array to find moneyline (h2h) prices
 * Handles deep nesting, ID vs. Name lookups, and data type conversion
 */

import { getCanonicalName, findTeamByName, findTeamById } from './teamMapper';

/**
 * Fuzzy name matching for team names
 * Handles variations like "Arizona" vs "Arizona Wildcats"
 * @param {string} apiName - Team name from The Odds API
 * @param {string} localName - Team name from local data
 * @returns {boolean} True if names match
 */
function fuzzyMatchTeamName(apiName, localName) {
  if (!apiName || !localName) return false;
  
  const normalize = (str) => str.toLowerCase().trim();
  const apiNorm = normalize(apiName);
  const localNorm = normalize(localName);
  
  // Exact match
  if (apiNorm === localNorm) return true;
  
  // One contains the other
  if (apiNorm.includes(localNorm) || localNorm.includes(apiNorm)) return true;
  
  // Extract mascot/team name (last word) and compare
  const apiWords = apiNorm.split(/\s+/);
  const localWords = localNorm.split(/\s+/);
  const apiMascot = apiWords[apiWords.length - 1];
  const localMascot = localWords[localWords.length - 1];
  
  if (apiMascot === localMascot) return true;
  
  // Compare first words (city names)
  if (apiWords[0] === localWords[0]) return true;
  
  return false;
}

/**
 * Safe number conversion with fallback
 * @param {any} value - Value to convert to number
 * @returns {number|null} Converted number or null
 */
function safeNumberConversion(value) {
  if (value === null || value === undefined) return null;
  
  // Already a valid number
  if (typeof value === 'number') {
    if (isNaN(value)) return null;
    return value;
  }
  
  // Try to convert string to number
  if (typeof value === 'string') {
    // Remove any non-numeric characters except decimal and negative sign
    const cleaned = value.replace(/[^0-9.-]/g, '');
    
    // If nothing left after cleaning, return null
    if (!cleaned || cleaned === '-' || cleaned === '.') {
      return null;
    }
    
    const num = Number(cleaned);
    if (isNaN(num)) {
      return null;
    }
    return num;
  }
  
  return null;
}

/**
 * Validate market structure
 * @param {object} market - Market object from bookmaker
 * @param {string} marketKey - Expected market key (e.g., 'h2h')
 * @returns {boolean} True if market is valid
 */
function isValidMarket(market, marketKey) {
  if (!market) {
    console.log(`    ⚠️ Market is null/undefined`);
    return false;
  }
  
  if (market.key !== marketKey) {
    console.log(`    ⚠️ Market key mismatch: expected "${marketKey}", got "${market.key}"`);
    return false;
  }
  
  if (!market.outcomes || !Array.isArray(market.outcomes) || market.outcomes.length === 0) {
    console.log(`    ⚠️ Market has no outcomes array or it's empty`);
    return false;
  }
  
  return true;
}

/**
 * Find best price across multiple bookmakers for h2h market
 * Priority order: DraftKings, FanDuel, BetMGM, then any other available
 * 
 * @param {Array} bookmakers - Array of bookmaker objects from The Odds API
 * @param {string} homeTeam - Home team name from API
 * @param {string} awayTeam - Away team name from API
 * @param {string} sportKey - Sport key for team mapping (e.g., 'basketball_nba')
 * @param {string} homeTeamId - Optional home team participant ID
 * @param {string} awayTeamId - Optional away team participant ID
 * @returns {object|null} Object with awayPrice, homePrice, drawPrice, bookmakerName, or null
 */
export function findBestMoneylinePrices(bookmakers, homeTeam, awayTeam, sportKey = null, homeTeamId = null, awayTeamId = null) {
  console.log(`\n🔍 Price Finder: Searching for moneyline (h2h) prices`);
  console.log(`   Teams: ${awayTeam} @ ${homeTeam}`);
  console.log(`   Bookmakers available: ${bookmakers?.length || 0}`);
  
  if (!bookmakers || bookmakers.length === 0) {
    console.error(`   ❌ No bookmakers data provided`);
    return null;
  }
  
  // Priority bookmaker order
  const PRIORITY_BOOKMAKERS = ['draftkings', 'fanduel', 'betmgm', 'caesars', 'pointsbet'];
  
  // Sort bookmakers by priority
  const sortedBookmakers = [...bookmakers].sort((a, b) => {
    const aKey = (a.key || '').toLowerCase();
    const bKey = (b.key || '').toLowerCase();
    const aPriority = PRIORITY_BOOKMAKERS.indexOf(aKey);
    const bPriority = PRIORITY_BOOKMAKERS.indexOf(bKey);
    
    // If both are in priority list, sort by priority
    if (aPriority !== -1 && bPriority !== -1) {
      return aPriority - bPriority;
    }
    
    // If only one is in priority list, prioritize it
    if (aPriority !== -1) return -1;
    if (bPriority !== -1) return 1;
    
    // Otherwise keep original order
    return 0;
  });
  
  console.log(`   📋 Bookmaker search order: ${sortedBookmakers.map(b => b.key || b.title).join(', ')}`);
  
  // Search through bookmakers
  for (let i = 0; i < sortedBookmakers.length; i++) {
    const bookmaker = sortedBookmakers[i];
    const bookmakerName = bookmaker.title || bookmaker.key || 'Unknown';
    
    console.log(`\n   📚 Checking bookmaker ${i + 1}/${sortedBookmakers.length}: ${bookmakerName}`);
    
    if (!bookmaker.markets || bookmaker.markets.length === 0) {
      console.log(`    ⚠️ No markets available in this bookmaker`);
      continue;
    }
    
    console.log(`    Markets available: ${bookmaker.markets.map(m => m.key).join(', ')}`);
    
    // Find h2h market
    const h2hMarket = bookmaker.markets.find(m => m.key === 'h2h');
    
    if (!h2hMarket) {
      console.log(`    ❌ No h2h market found in this bookmaker`);
      continue;
    }
    
    // Validate market structure
    if (!isValidMarket(h2hMarket, 'h2h')) {
      continue;
    }
    
    console.log(`    ✅ Found h2h market with ${h2hMarket.outcomes.length} outcomes`);
    console.log(`    Raw outcomes:`, h2hMarket.outcomes.map(o => ({ name: o.name, price: o.price })));
    
    // Initialize result
    let homePrice = null;
    let awayPrice = null;
    let drawPrice = null;
    
    // STEP 1: Try matching by participant ID (most reliable)
    if (homeTeamId || awayTeamId) {
      console.log(`    🆔 Attempting ID-based matching...`);
      
      for (const outcome of h2hMarket.outcomes) {
        // Check if outcome has participant_id or id field
        const outcomeId = outcome.participant_id || outcome.id;
        
        if (outcomeId && homeTeamId && outcomeId === homeTeamId) {
          homePrice = safeNumberConversion(outcome.price);
          console.log(`    ✓ Home team matched by ID (${homeTeamId}): price = ${homePrice}`);
        }
        
        if (outcomeId && awayTeamId && outcomeId === awayTeamId) {
          awayPrice = safeNumberConversion(outcome.price);
          console.log(`    ✓ Away team matched by ID (${awayTeamId}): price = ${awayPrice}`);
        }
        
        // Check for Draw (soccer)
        if (outcome.name === 'Draw') {
          drawPrice = safeNumberConversion(outcome.price);
          console.log(`    ✓ Draw matched: price = ${drawPrice}`);
        }
      }
    }
    
    // STEP 2: Try exact name matching (case-insensitive)
    if (homePrice === null || awayPrice === null) {
      console.log(`    🔤 Attempting exact name matching...`);
      
      for (const outcome of h2hMarket.outcomes) {
        const outcomeName = outcome.name || '';
        
        if (homePrice === null && outcomeName.toLowerCase() === homeTeam.toLowerCase()) {
          homePrice = safeNumberConversion(outcome.price);
          console.log(`    ✓ Home team matched by exact name: ${outcomeName} = ${homePrice}`);
        }
        
        if (awayPrice === null && outcomeName.toLowerCase() === awayTeam.toLowerCase()) {
          awayPrice = safeNumberConversion(outcome.price);
          console.log(`    ✓ Away team matched by exact name: ${outcomeName} = ${awayPrice}`);
        }
        
        if (drawPrice === null && outcomeName === 'Draw') {
          drawPrice = safeNumberConversion(outcome.price);
          console.log(`    ✓ Draw matched: price = ${drawPrice}`);
        }
      }
    }
    
    // STEP 3: Try fuzzy name matching
    if (homePrice === null || awayPrice === null) {
      console.log(`    🔍 Attempting fuzzy name matching...`);
      
      // Track which outcomes we've already matched to prevent duplicates
      const matchedOutcomes = new Set();
      
      for (const outcome of h2hMarket.outcomes) {
        const outcomeName = outcome.name || '';
        
        // Skip if already matched
        if (matchedOutcomes.has(outcome)) continue;
        
        if (homePrice === null && fuzzyMatchTeamName(outcomeName, homeTeam)) {
          homePrice = safeNumberConversion(outcome.price);
          matchedOutcomes.add(outcome);
          console.log(`    ✓ Home team matched by fuzzy matching: "${outcomeName}" ~ "${homeTeam}" = ${homePrice}`);
        }
        
        if (awayPrice === null && fuzzyMatchTeamName(outcomeName, awayTeam)) {
          awayPrice = safeNumberConversion(outcome.price);
          matchedOutcomes.add(outcome);
          console.log(`    ✓ Away team matched by fuzzy matching: "${outcomeName}" ~ "${awayTeam}" = ${awayPrice}`);
        }
      }
    }
    
    // STEP 4: Try team mapping if sport key provided
    if ((homePrice === null || awayPrice === null) && sportKey) {
      console.log(`    🗺️ Attempting team mapper lookup with sport key: ${sportKey}...`);
      
      for (const outcome of h2hMarket.outcomes) {
        const outcomeName = outcome.name || '';
        
        if (homePrice === null) {
          const homeTeamData = findTeamByName(homeTeam, sportKey);
          if (homeTeamData && homeTeamData.aliases) {
            const aliasMatch = homeTeamData.aliases.some(alias => 
              fuzzyMatchTeamName(outcomeName, alias)
            );
            if (aliasMatch) {
              homePrice = safeNumberConversion(outcome.price);
              console.log(`    ✓ Home team matched via team mapper: "${outcomeName}" ~ alias of "${homeTeam}" = ${homePrice}`);
            }
          }
        }
        
        if (awayPrice === null) {
          const awayTeamData = findTeamByName(awayTeam, sportKey);
          if (awayTeamData && awayTeamData.aliases) {
            const aliasMatch = awayTeamData.aliases.some(alias => 
              fuzzyMatchTeamName(outcomeName, alias)
            );
            if (aliasMatch) {
              awayPrice = safeNumberConversion(outcome.price);
              console.log(`    ✓ Away team matched via team mapper: "${outcomeName}" ~ alias of "${awayTeam}" = ${awayPrice}`);
            }
          }
        }
      }
    }
    
    // If we found both prices, return result
    if (homePrice !== null && awayPrice !== null) {
      console.log(`\n   ✅ SUCCESS: Found moneyline prices from ${bookmakerName}`);
      console.log(`      Home: ${homePrice}, Away: ${awayPrice}${drawPrice !== null ? `, Draw: ${drawPrice}` : ''}`);
      
      return {
        awayPrice,
        homePrice,
        drawPrice,
        bookmakerName,
        bookmakerKey: bookmaker.key
      };
    }
    
    // Log partial match failure
    if (homePrice === null && awayPrice === null) {
      console.error(`    ❌ Failed to match either team in ${bookmakerName}`);
      console.error(`       Available outcomes: [${h2hMarket.outcomes.map(o => o.name).join(', ')}]`);
      console.error(`       Looking for: Home="${homeTeam}", Away="${awayTeam}"`);
      if (homeTeamId || awayTeamId) {
        console.error(`       Team IDs: Home="${homeTeamId || 'N/A'}", Away="${awayTeamId || 'N/A'}"`);
      }
    } else if (homePrice === null) {
      console.error(`    ⚠️ Partial match in ${bookmakerName}: Found away (${awayPrice}) but missing home`);
    } else if (awayPrice === null) {
      console.error(`    ⚠️ Partial match in ${bookmakerName}: Found home (${homePrice}) but missing away`);
    }
  }
  
  // No bookmaker had both prices
  console.error(`\n   ❌ FINAL FAILURE: Could not find moneyline prices in any of ${bookmakers.length} bookmakers`);
  console.error(`      Teams: ${awayTeam} @ ${homeTeam}`);
  console.error(`      Sport: ${sportKey || 'unknown'}`);
  if (homeTeamId || awayTeamId) {
    console.error(`      Missing participant_id mapping - Add these to team mapping files:`);
    console.error(`         Home team ID: ${homeTeamId || 'N/A'}`);
    console.error(`         Away team ID: ${awayTeamId || 'N/A'}`);
  }
  
  return null;
}

/**
 * Convert decimal odds to American format with proper typing
 * @param {number} decimalPrice - Decimal odds (e.g., 1.91, 2.50)
 * @returns {string} American odds (e.g., "-110", "+150") or "-"
 */
export function convertToAmericanOdds(decimalPrice) {
  const price = safeNumberConversion(decimalPrice);
  
  if (price === null || price === 1.0) {
    return '-';
  }
  
  try {
    if (price >= 2.0) {
      // Underdog: (decimal - 1) * 100
      const american = Math.round((price - 1) * 100);
      return `+${american}`;
    } else {
      // Favorite: -100 / (decimal - 1)
      const american = Math.round(-100 / (price - 1));
      return american.toString();
    }
  } catch (error) {
    console.error(`    ⚠️ Error converting odds ${decimalPrice}:`, error);
    return '-';
  }
}

/**
 * Format moneyline result for display
 * @param {object|null} priceResult - Result from findBestMoneylinePrices
 * @returns {object} Formatted object with awayMoneyline, homeMoneyline, drawMoneyline
 */
export function formatMoneylineForDisplay(priceResult) {
  if (!priceResult) {
    return {
      awayMoneyline: '-',
      homeMoneyline: '-',
      drawMoneyline: undefined
    };
  }
  
  return {
    awayMoneyline: convertToAmericanOdds(priceResult.awayPrice),
    homeMoneyline: convertToAmericanOdds(priceResult.homePrice),
    drawMoneyline: priceResult.drawPrice !== null ? convertToAmericanOdds(priceResult.drawPrice) : undefined
  };
}
