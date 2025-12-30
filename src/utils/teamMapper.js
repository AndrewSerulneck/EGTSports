/**
 * Team Mapper Utility
 * Maps The Odds API team names/IDs to canonical team names using local JSON files
 */

import nbaTeams from '../data/nba-teams.json';
import nflTeams from '../data/nfl-teams.json';
import nhlTeams from '../data/nhl-teams.json';
import ncaaFootballTeams from '../data/ncaa_football-teams.json';
import ncaaBasketballTeams from '../data/ncaa_basketball-teams.json';

// Sport key mapping for The Odds API
const SPORT_KEYS = {
  'americanfootball_nfl': 'nfl',
  'basketball_nba': 'nba',
  'icehockey_nhl': 'nhl',
  'americanfootball_ncaaf': 'ncaa_football',
  'basketball_ncaab': 'ncaa_basketball',
};

/**
 * Get all teams for a given sport
 * @param {string} sportKey - The Odds API sport key (e.g., 'basketball_nba')
 * @returns {Array} Array of team objects
 */
export function getTeamsForSport(sportKey) {
  const normalizedSport = SPORT_KEYS[sportKey] || sportKey;
  
  switch (normalizedSport) {
    case 'nfl':
      return nflTeams;
    case 'nba':
      return nbaTeams;
    case 'nhl':
      return nhlTeams;
    case 'ncaa_football':
      return ncaaFootballTeams;
    case 'ncaa_basketball':
      return ncaaBasketballTeams;
    default:
      return [];
  }
}

/**
 * Find canonical team name by matching against aliases
 * @param {string} teamName - Team name from The Odds API
 * @param {string} sportKey - The Odds API sport key
 * @returns {Object|null} Team object with canonical name and metadata
 */
export function findTeamByName(teamName, sportKey) {
  if (!teamName) return null;
  
  const teams = getTeamsForSport(sportKey);
  if (!teams || teams.length === 0) return null;
  
  const normalizedSearchName = teamName.toLowerCase().trim();
  
  // For NCAA Basketball (slim schema), check full_name directly
  const normalizedSport = SPORT_KEYS[sportKey] || sportKey;
  if (normalizedSport === 'ncaa_basketball') {
    const match = teams.find(team => 
      team.full_name?.toLowerCase() === normalizedSearchName
    );
    
    if (match) {
      return {
        id: match.id,
        canonical: match.full_name,
        full_name: match.full_name,
        // NCAAB teams don't have these fields, use optional chaining
        city: undefined,
        mascot: undefined,
        logo: undefined
      };
    }
  }
  
  // For other sports with full schema (canonical + aliases)
  const match = teams.find(team => {
    // Check canonical name
    if (team.canonical?.toLowerCase() === normalizedSearchName) {
      return true;
    }
    
    // Check aliases array
    if (team.aliases && Array.isArray(team.aliases)) {
      return team.aliases.some(alias => 
        alias.toLowerCase() === normalizedSearchName
      );
    }
    
    return false;
  });
  
  if (match) {
    return {
      id: match.id,
      canonical: match.canonical,
      aliases: match.aliases,
      // These fields may not exist in all schemas
      city: match.city,
      mascot: match.mascot,
      logo: match.logo
    };
  }
  
  return null;
}

/**
 * Find team by participant ID (The Odds API format)
 * @param {string} participantId - Participant ID from The Odds API (e.g., "par_01hqmk...")
 * @param {string} sportKey - The Odds API sport key
 * @returns {Object|null} Team object
 */
export function findTeamById(participantId, sportKey) {
  if (!participantId) return null;
  
  const teams = getTeamsForSport(sportKey);
  if (!teams || teams.length === 0) return null;
  
  // Check if team's aliases array contains the participant ID
  const match = teams.find(team => {
    // For NCAAB, check the id field directly
    if (team.id === participantId) {
      return true;
    }
    
    // For other sports, check in aliases
    if (team.aliases && Array.isArray(team.aliases)) {
      return team.aliases.includes(participantId);
    }
    
    return false;
  });
  
  if (match) {
    const normalizedSport = SPORT_KEYS[sportKey] || sportKey;
    if (normalizedSport === 'ncaa_basketball') {
      return {
        id: match.id,
        canonical: match.full_name,
        full_name: match.full_name,
      };
    }
    
    return {
      id: match.id,
      canonical: match.canonical,
      aliases: match.aliases,
      city: match.city,
      mascot: match.mascot,
      logo: match.logo
    };
  }
  
  return null;
}

/**
 * Get canonical team name from any identifier (name or ID)
 * @param {string} identifier - Team name or participant ID
 * @param {string} sportKey - The Odds API sport key
 * @returns {string} Canonical team name or original identifier if not found
 */
export function getCanonicalName(identifier, sportKey) {
  if (!identifier) return '';
  
  // Try finding by ID first
  let team = findTeamById(identifier, sportKey);
  
  // If not found by ID, try by name
  if (!team) {
    team = findTeamByName(identifier, sportKey);
  }
  
  // Return canonical name or original identifier
  return team?.canonical || team?.full_name || identifier;
}

/**
 * Get team logo URL with fallback
 * @param {string} identifier - Team name or participant ID
 * @param {string} sportKey - The Odds API sport key
 * @returns {string|null} Logo URL or null
 */
export function getTeamLogo(identifier, sportKey) {
  if (!identifier) return null;
  
  const team = findTeamById(identifier, sportKey) || findTeamByName(identifier, sportKey);
  
  // Use optional chaining as NCAAB teams don't have logos
  return team?.logo || null;
}

/**
 * Check if a sport uses the slim schema (NCAAB)
 * @param {string} sportKey - The Odds API sport key
 * @returns {boolean} True if sport uses slim schema
 */
export function isSlimSchema(sportKey) {
  const normalizedSport = SPORT_KEYS[sportKey] || sportKey;
  return normalizedSport === 'ncaa_basketball';
}
