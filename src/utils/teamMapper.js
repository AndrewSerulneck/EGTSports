/**
 * Team Mapper Utility
 * Maps The Odds API team names/IDs to canonical team names using master-teams.json
 */

import masterTeams from '../data/master-teams.json';
import { getStandardId, getTeamBySid } from './normalization';

// Sport key mapping for The Odds API
const SPORT_KEYS = {
  'americanfootball_nfl': 'nfl',
  'basketball_nba': 'nba',
  'icehockey_nhl': 'nhl',
  'americanfootball_ncaaf': 'ncaa_football',
  'basketball_ncaab': 'ncaab',
};

/**
 * Get all teams for a given sport
 * @param {string} sportKey - The Odds API sport key (e.g., 'basketball_nba')
 * @returns {Array} Array of team objects
 */
export function getTeamsForSport(sportKey) {
  const normalizedSport = SPORT_KEYS[sportKey] || sportKey;
  return masterTeams[normalizedSport] || [];
}

/**
 * Find canonical team name by matching against aliases
 * @param {string} teamName - Team name from The Odds API
 * @param {string} sportKey - The Odds API sport key
 * @returns {Object|null} Team object with canonical name and metadata
 */
export function findTeamByName(teamName, sportKey) {
  if (!teamName) return null;
  
  const normalizedSport = SPORT_KEYS[sportKey] || sportKey;
  const team = getStandardId(teamName, normalizedSport);
  
  if (!team) return null;
  
  // Return in the expected format for compatibility
  return {
    id: team.id,
    canonical: team.canonical,
    aliases: team.aliases,
    espnId: team.espnId,
  };
}

/**
 * Find team by participant ID (The Odds API format) or internal ID
 * @param {string} participantId - Participant ID from The Odds API (e.g., "par_01hqmk...") or internal ID
 * @param {string} sportKey - The Odds API sport key
 * @returns {Object|null} Team object
 */
export function findTeamById(participantId, sportKey) {
  if (!participantId) return null;
  
  const normalizedSport = SPORT_KEYS[sportKey] || sportKey;
  
  // First try to find by The Odds API SID
  if (participantId.startsWith('par_')) {
    const team = getTeamBySid(participantId, normalizedSport);
    if (team) {
      return {
        id: team.id,
        canonical: team.canonical,
        aliases: team.aliases,
        espnId: team.espnId,
      };
    }
  }
  
  // Otherwise find by internal ID
  const teams = getTeamsForSport(sportKey);
  const match = teams.find(team => team.id === participantId);
  
  if (match) {
    return {
      id: match.id,
      canonical: match.canonical,
      aliases: match.aliases,
      espnId: match.espnId,
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
  
  const normalizedSport = SPORT_KEYS[sportKey] || sportKey;
  
  // Try finding by ID first (if it's a SID)
  if (identifier.startsWith('par_')) {
    const team = getTeamBySid(identifier, normalizedSport);
    if (team) return team.canonical;
  }
  
  // Try finding by name/alias
  const team = getStandardId(identifier, normalizedSport);
  return team?.canonical || identifier;
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
  
  // Logos are not stored in master-teams.json, return null
  return team?.logo || null;
}

/**
 * Check if a sport uses the slim schema (NCAAB)
 * @param {string} sportKey - The Odds API sport key
 * @returns {boolean} True if sport uses slim schema
 */
export function isSlimSchema(sportKey) {
  const normalizedSport = SPORT_KEYS[sportKey] || sportKey;
  return normalizedSport === 'ncaab';
}
