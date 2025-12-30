/**
 * Price Finder Utility for The Odds API
 * Safely traverses bookmakers array to find moneyline (h2h) prices
 * Handles deep nesting, ID vs. Name lookups, and data type conversion
 */

import { findTeamByName } from './teamMapper';

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
  
  // Compare first words (city/school names)
  if (apiWords[0] === localWords[0] && apiWords[0].length > 2) return true;
  
  // For College Basketball: Match if API name starts with any word in local name
  // e.g., "Arizona" matches "Arizona Wildcats"
  for (const word of localWords) {
    if (word.length > 3 && apiNorm.startsWith(word)) return true;
    if (word.length > 3 && localNorm.startsWith(apiWords[0])) return true;
  }
  
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
 * CRITICAL: Now supports SID (Source ID) based matching with local JSON files
 * When includeSids=true is used in API requests, outcomes will have sid field
 * 
 * TWO-TIER SID MATCHING:
 * - Pro Leagues (NFL, NBA, NHL): The sid (e.g., "par_01hqmkq6fzfvyvrsb30jj85ade") 
 *   is stored in the aliases array of src/data/*.json files
 *   Example: { "id": "NBA-020", "canonical": "New York Knicks", 
 *              "aliases": ["NYK", ..., "par_01hqmk..."] }
 * 
 * - NCAAB: The sid is stored directly in the id field
 *   Example: { "id": "par_01hqmk...", "full_name": "Duke Blue Devils" }
 * 
 * This provides the MOST RELIABLE team identification.
 * 
 * @param {Array} bookmakers - Array of bookmaker objects from The Odds API
 * @param {string} homeTeam - Home team name from API
 * @param {string} awayTeam - Away team name from API
 * @param {string} sportKey - Sport key for team mapping (e.g., 'basketball_nba')
 * @param {string} homeTeamId - Home team SID from API outcomes (e.g., "par_01hqmk...")
 * @param {string} awayTeamId - Away team SID from API outcomes (e.g., "par_01hqmk...")
 * @returns {object|null} Object with awayPrice, homePrice, drawPrice, bookmakerName, or null
 */
export function findBestMoneylinePrices(bookmakers, homeTeam, awayTeam, sportKey = null, homeTeamId = null, awayTeamId = null) {
  console.log(`\n🔍 Price Finder: Searching for moneyline (h2h) prices`);
  console.log(`   Teams: ${awayTeam} @ ${homeTeam}`);
  console.log(`   Team IDs: Away=${awayTeamId || 'N/A'}, Home=${homeTeamId || 'N/A'}`);
  console.log(`   Sport Key: ${sportKey || 'unknown'}`);
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
    console.log(`    Raw outcomes:`, h2hMarket.outcomes.map(o => ({ 
      name: o.name, 
      price: o.price,
      sid: o.sid || 'NO_SID'
    })));
    
    // Initialize result
    let homePrice = null;
    let awayPrice = null;
    let drawPrice = null;
    
    // STEP 0: PRIORITY METHOD - Try SID (Source ID) matching first
    // This is the MOST RELIABLE method when includeSids=true is used in API request
    // The sid from API outcomes matches the id field in our local JSON files
    if (homeTeamId || awayTeamId) {
      console.log(`    🆔 Attempting SID matching (most reliable)...`);
      
      for (const outcome of h2hMarket.outcomes) {
        if (!outcome.sid) continue; // Skip outcomes without SID
        
        if (homePrice === null && homeTeamId && outcome.sid === homeTeamId) {
          homePrice = safeNumberConversion(outcome.price);
          console.log(`    ✓✓✓ Home team matched by SID: ${homeTeamId} = ${homePrice} (${outcome.name})`);
        }
        
        if (awayPrice === null && awayTeamId && outcome.sid === awayTeamId) {
          awayPrice = safeNumberConversion(outcome.price);
          console.log(`    ✓✓✓ Away team matched by SID: ${awayTeamId} = ${awayPrice} (${outcome.name})`);
        }
      }
      
      // Check for Draw in soccer (no SID for draw, use name)
      if (drawPrice === null) {
        const drawOutcome = h2hMarket.outcomes.find(o => o.name === 'Draw');
        if (drawOutcome) {
          drawPrice = safeNumberConversion(drawOutcome.price);
          console.log(`    ✓ Draw matched by name: price = ${drawPrice}`);
        }
      }
    }
    
    // STEP 1: Fallback - Try exact name matching (case-insensitive)
    if (homePrice === null || awayPrice === null) {
      console.log(`    🔤 Attempting exact name matching...`);
      for (const outcome of h2hMarket.outcomes) {
        const outcomeName = outcome.name || '';
        
        if (homePrice === null && outcomeName.toLowerCase() === homeTeam.toLowerCase()) {
          homePrice = safeNumberConversion(outcome.price);
          console.log(`    ✓ Home team matched by exact name: "${outcomeName}" = ${homePrice}`);
        }
        
        if (awayPrice === null && outcomeName.toLowerCase() === awayTeam.toLowerCase()) {
          awayPrice = safeNumberConversion(outcome.price);
          console.log(`    ✓ Away team matched by exact name: "${outcomeName}" = ${awayPrice}`);
        }
        
        if (drawPrice === null && outcomeName === 'Draw') {
          drawPrice = safeNumberConversion(outcome.price);
          console.log(`    ✓ Draw matched: price = ${drawPrice}`);
        }
      }
    }
    
    // STEP 2: Try fuzzy name matching
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
    
    // STEP 3: Try team mapper lookup if sport key provided
    if ((homePrice === null || awayPrice === null) && sportKey) {
      console.log(`    🗺️ Attempting team mapper lookup with sport key: ${sportKey}...`);
      
      for (const outcome of h2hMarket.outcomes) {
        const outcomeName = outcome.name || '';
        
        if (homePrice === null) {
          const homeTeamData = findTeamByName(homeTeam, sportKey);
          if (homeTeamData) {
            // Try matching with canonical name
            if (fuzzyMatchTeamName(outcomeName, homeTeamData.canonical || homeTeamData.full_name)) {
              homePrice = safeNumberConversion(outcome.price);
              console.log(`    ✓ Home team matched via canonical: "${outcomeName}" ~ "${homeTeamData.canonical || homeTeamData.full_name}" = ${homePrice}`);
            }
            // Try matching with aliases
            else if (homeTeamData.aliases) {
              const aliasMatch = homeTeamData.aliases.find(alias => 
                fuzzyMatchTeamName(outcomeName, alias)
              );
              if (aliasMatch) {
                homePrice = safeNumberConversion(outcome.price);
                console.log(`    ✓ Home team matched via alias: "${outcomeName}" ~ "${aliasMatch}" = ${homePrice}`);
              }
            }
          }
          
          // Also try matching the API outcome name to our local data
          if (homePrice === null) {
            const outcomeTeamData = findTeamByName(outcomeName, sportKey);
            if (outcomeTeamData && fuzzyMatchTeamName(homeTeam, outcomeTeamData.canonical || outcomeTeamData.full_name)) {
              homePrice = safeNumberConversion(outcome.price);
              console.log(`    ✓ Home team matched via reverse lookup: "${outcomeName}" matches canonical "${outcomeTeamData.canonical || outcomeTeamData.full_name}" = ${homePrice}`);
            }
          }
        }
        
        if (awayPrice === null) {
          const awayTeamData = findTeamByName(awayTeam, sportKey);
          if (awayTeamData) {
            // Try matching with canonical name
            if (fuzzyMatchTeamName(outcomeName, awayTeamData.canonical || awayTeamData.full_name)) {
              awayPrice = safeNumberConversion(outcome.price);
              console.log(`    ✓ Away team matched via canonical: "${outcomeName}" ~ "${awayTeamData.canonical || awayTeamData.full_name}" = ${awayPrice}`);
            }
            // Try matching with aliases
            else if (awayTeamData.aliases) {
              const aliasMatch = awayTeamData.aliases.find(alias => 
                fuzzyMatchTeamName(outcomeName, alias)
              );
              if (aliasMatch) {
                awayPrice = safeNumberConversion(outcome.price);
                console.log(`    ✓ Away team matched via alias: "${outcomeName}" ~ "${aliasMatch}" = ${awayPrice}`);
              }
            }
          }
          
          // Also try matching the API outcome name to our local data
          if (awayPrice === null) {
            const outcomeTeamData = findTeamByName(outcomeName, sportKey);
            if (outcomeTeamData && fuzzyMatchTeamName(awayTeam, outcomeTeamData.canonical || outcomeTeamData.full_name)) {
              awayPrice = safeNumberConversion(outcome.price);
              console.log(`    ✓ Away team matched via reverse lookup: "${outcomeName}" matches canonical "${outcomeTeamData.canonical || outcomeTeamData.full_name}" = ${awayPrice}`);
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
  console.error(`      Suggestion: Check that team names in The Odds API match names in src/data/ JSON files`);
  
  return null;
}

/**
 * Format odds for display - handles both American (integers) and decimal formats
 * When API returns American odds (as integers), just format with +/- prefix
 * When API returns decimal odds, convert to American format
 * @param {number} price - Odds value from API (American as integer or decimal)
 * @returns {string} American odds (e.g., "-110", "+150") or "-"
 */
export function convertToAmericanOdds(price) {
  const numPrice = safeNumberConversion(price);
  
  if (numPrice === null) {
    return '-';
  }
  
  try {
    // If the price is already in American format (magnitude >= 100 or <= -100)
    // The Odds API returns American odds as integers like 150 or -110
    if (Math.abs(numPrice) >= 100) {
      // Positive odds need + prefix, negative already have -
      return numPrice > 0 ? `+${Math.round(numPrice)}` : `${Math.round(numPrice)}`;
    }
    
    // Handle decimal format (1.x to 99.x range) - convert to American
    if (numPrice === 1.0) {
      return '-';
    }
    
    if (numPrice >= 2.0) {
      // Underdog: (decimal - 1) * 100
      const american = Math.round((numPrice - 1) * 100);
      return `+${american}`;
    } else if (numPrice > 1.0) {
      // Favorite: -100 / (decimal - 1)
      const american = Math.round(-100 / (numPrice - 1));
      return american.toString();
    }
    
    return '-';
  } catch (error) {
    console.error(`    ⚠️ Error formatting odds ${price}:`, error);
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
