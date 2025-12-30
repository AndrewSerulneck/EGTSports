/**
 * Team Name Normalization Utility
 * 
 * Provides universal team identification across all sports and odds providers.
 * Uses the consolidated master-teams.json mapping file to convert various team name
 * formats (abbreviations, full names, mascots, ESPN IDs, The Odds API SIDs) to
 * standardized team objects.
 * 
 * This solves the naming mismatch problem where:
 * - ESPN uses canonical names (e.g., "Los Angeles Rams")
 * - JsonOdds uses full names (e.g., "Los Angeles Rams")
 * - The Odds API uses various formats (e.g., "Rams", "LAR", "LA Rams")
 * - The Odds API uses participant IDs (e.g., "par_01hqmkr1ybfmfb8mhz10drfe21")
 * 
 * By normalizing to a universal team object with multiple identifiers, we create
 * a reliable system for storing and retrieving data regardless of the source API.
 */

import masterTeams from '../data/master-teams.json';

/**
 * Get the standardized team identifier for any team across all sports
 * 
 * This function performs robust matching to find the team:
 * 1. Normalizes input (case-insensitive, trimmed)
 * 2. Searches specified sport or all sports if not specified
 * 3. Checks canonical name for exact match
 * 4. Checks all aliases for exact match (including SIDs)
 * 5. Returns complete team object with sport key added
 * 
 * @param {string} identifier - Can be: team name, abbreviation, ESPN ID, The Odds API SID
 * @param {string} [sport] - Optional: 'nfl', 'nba', 'nhl', 'ncaab'. If omitted, searches all sports.
 * @returns {Object|null} - { id, espnId, canonical, aliases, sport } or null if not found
 * 
 * @example
 * getStandardId("Rams") // Returns { id: "NFL-LAR", espnId: "14", canonical: "Los Angeles Rams", ... }
 * getStandardId("LAR", "nfl") // Returns { id: "NFL-LAR", espnId: "14", ... }
 * getStandardId("14", "nfl") // Returns { id: "NFL-LAR", espnId: "14", ... }
 * getStandardId("par_01hqmkr1ybfmfb8mhz10drfe21") // Returns Rams team object
 */
export function getStandardId(identifier, sport = null) {
  // Validate input
  if (!identifier || typeof identifier !== 'string') {
    return null;
  }
  
  // Normalize input: trim whitespace and convert to lowercase for matching
  const normalized = identifier.trim().toLowerCase();
  
  // If empty after trimming, return null
  if (normalized === '') {
    return null;
  }
  
  // Determine which sports to search
  const sportsToSearch = sport ? [sport] : ['nfl', 'nba', 'nhl', 'ncaab'];
  
  // Search through specified sports
  for (const sportKey of sportsToSearch) {
    const teams = masterTeams[sportKey];
    if (!teams) continue;
    
    for (const team of teams) {
      // Check canonical name (case-insensitive)
      if (team.canonical.toLowerCase() === normalized) {
        return { ...team, sport: sportKey };
      }
      
      // Check ESPN ID match
      if (team.espnId && team.espnId.toLowerCase() === normalized) {
        return { ...team, sport: sportKey };
      }
      
      // Check all aliases (case-insensitive)
      if (team.aliases) {
        for (const alias of team.aliases) {
          if (alias.toLowerCase() === normalized) {
            return { ...team, sport: sportKey };
          }
        }
      }
    }
  }
  
  // No match found
  return null;
}

/**
 * Get team by ESPN ID
 * 
 * @param {string} espnId - ESPN integer ID (e.g., "14")
 * @param {string} [sport] - Optional sport filter ('nfl', 'nba', 'nhl', 'ncaab')
 * @returns {Object|null} - Team object with sport key or null if not found
 * 
 * @example
 * getTeamByEspnId("14", "nfl") // Returns Los Angeles Rams team object
 */
export function getTeamByEspnId(espnId, sport = null) {
  if (!espnId || typeof espnId !== 'string') {
    return null;
  }
  
  const normalized = espnId.trim();
  const sportsToSearch = sport ? [sport] : ['nfl', 'nba', 'nhl', 'ncaab'];
  
  for (const sportKey of sportsToSearch) {
    const teams = masterTeams[sportKey];
    if (!teams) continue;
    
    const team = teams.find(t => t.espnId === normalized);
    if (team) {
      return { ...team, sport: sportKey };
    }
  }
  
  return null;
}

/**
 * Get team by The Odds API SID (participant ID)
 * 
 * @param {string} sid - The Odds API participant ID (e.g., "par_01hqmkr1ybfmfb8mhz10drfe21")
 * @param {string} [sport] - Optional sport filter
 * @returns {Object|null} - Team object with sport key or null if not found
 * 
 * @example
 * getTeamBySid("par_01hqmkr1ybfmfb8mhz10drfe21") // Returns Los Angeles Rams team object
 */
export function getTeamBySid(sid, sport = null) {
  if (!sid || typeof sid !== 'string') {
    return null;
  }
  
  const normalized = sid.trim().toLowerCase();
  const sportsToSearch = sport ? [sport] : ['nfl', 'nba', 'nhl', 'ncaab'];
  
  for (const sportKey of sportsToSearch) {
    const teams = masterTeams[sportKey];
    if (!teams) continue;
    
    for (const team of teams) {
      if (team.aliases && team.aliases.some(alias => alias.toLowerCase() === normalized)) {
        return { ...team, sport: sportKey };
      }
    }
  }
  
  return null;
}

/**
 * Validate if an identifier can be resolved to a team
 * 
 * @param {string} identifier - Any team identifier to validate
 * @param {string} [sport] - Optional sport filter
 * @returns {boolean} - True if the identifier can be resolved, false otherwise
 * 
 * @example
 * isValidTeamName("Rams") // Returns true
 * isValidTeamName("Invalid Team") // Returns false
 */
export function isValidTeamName(identifier, sport = null) {
  return getStandardId(identifier, sport) !== null;
}

/**
 * Get canonical name from any identifier
 * 
 * @param {string} identifier - Any team identifier
 * @param {string} [sport] - Optional sport filter
 * @returns {string|null} - Canonical team name or null if not found
 * 
 * @example
 * getCanonicalName("LAR", "nfl") // Returns "Los Angeles Rams"
 * getCanonicalName("14", "nfl") // Returns "Los Angeles Rams"
 */
export function getCanonicalName(identifier, sport = null) {
  const team = getStandardId(identifier, sport);
  return team ? team.canonical : null;
}
