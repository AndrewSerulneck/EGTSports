/**
 * Team Name Normalization Utility
 * 
 * Provides ID-based normalization for team names across different odds providers.
 * Uses the expanded nfl-teams.json mapping file to convert various team name
 * formats (abbreviations, full names, mascots) to standardized ESPN team IDs.
 * 
 * This solves the naming mismatch problem where:
 * - ESPN uses canonical names (e.g., "Los Angeles Rams")
 * - JsonOdds uses full names (e.g., "Los Angeles Rams")
 * - The Odds API uses various formats (e.g., "Rams", "LAR", "LA Rams")
 * 
 * By normalizing to ESPN IDs, we create a reliable key for storing and
 * retrieving odds data regardless of the source API's naming convention.
 */

import nflTeams from '../data/nfl-teams.json';

/**
 * Get the standardized ESPN team ID for a given team name
 * 
 * This function performs robust matching to find the team in the mapping file:
 * 1. Normalizes input (case-insensitive, trimmed)
 * 2. Checks canonical name for exact match
 * 3. Checks all aliases in the aliases array for exact match
 * 4. Returns the ESPN team ID when found
 * 
 * Note: This uses exact string matching (after normalization), not fuzzy matching algorithms.
 * The comprehensive alias list provides flexibility without needing fuzzy logic.
 * 
 * @param {string} teamName - Team name from any source (e.g., "Rams", "LAR", "Los Angeles Rams")
 * @returns {string|null} - ESPN team ID (e.g., "14") or null if no match found
 * 
 * @example
 * getStandardId("Rams") // Returns "14"
 * getStandardId("LAR") // Returns "14"
 * getStandardId("Los Angeles Rams") // Returns "14"
 * getStandardId("  rams  ") // Returns "14" (trimmed and case-insensitive)
 * getStandardId("Invalid Team") // Returns null
 */
export function getStandardId(teamName) {
  // Validate input
  if (!teamName || typeof teamName !== 'string') {
    return null;
  }
  
  // Normalize input: trim whitespace and convert to lowercase for matching
  const normalized = teamName.trim().toLowerCase();
  
  // If empty after trimming, return null
  if (normalized === '') {
    return null;
  }
  
  // Search through all teams
  for (const team of nflTeams) {
    // Check canonical name (case-insensitive)
    if (team.canonical.toLowerCase() === normalized) {
      // CRITICAL: Return ESPN Integer ID from aliases array, not custom ID
      // ESPN IDs are numeric strings in aliases (e.g., "1", "22", "34")
      // This ensures oddsMap keys match what GridBettingLayout expects
      const espnId = team.aliases && team.aliases.find(a => /^\d+$/.test(a));
      return espnId || team.id; // Fallback to custom ID if ESPN ID not found
    }
    
    // Check all aliases (case-insensitive)
    if (team.aliases) {
      for (const alias of team.aliases) {
        if (alias.toLowerCase() === normalized) {
          // CRITICAL: Return ESPN Integer ID from aliases array
          const espnId = team.aliases.find(a => /^\d+$/.test(a));
          return espnId || team.id; // Fallback to custom ID if ESPN ID not found
        }
      }
    }
  }
  
  // No match found
  return null;
}

/**
 * Validate if a team name can be normalized to an ESPN ID
 * 
 * @param {string} teamName - Team name to validate
 * @returns {boolean} - True if the team name can be normalized, false otherwise
 * 
 * @example
 * isValidTeamName("Rams") // Returns true
 * isValidTeamName("Invalid Team") // Returns false
 */
export function isValidTeamName(teamName) {
  return getStandardId(teamName) !== null;
}

/**
 * Get team canonical name from ESPN ID
 * 
 * @param {string} teamId - ESPN team ID
 * @returns {string|null} - Canonical team name or null if not found
 * 
 * @example
 * getCanonicalName("14") // Returns "Los Angeles Rams"
 */
export function getCanonicalName(teamId) {
  if (!teamId || typeof teamId !== 'string') {
    return null;
  }
  
  const team = nflTeams.find(t => t.id === teamId);
  return team ? team.canonical : null;
}
