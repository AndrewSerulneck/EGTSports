/**
 * Odds Utilities
 * Handles conversion between decimal and American odds formats
 */

/**
 * Convert decimal odds to American odds format
 * @param {number} decimalOdds - Decimal odds from The Odds API (e.g., 1.91, 2.50)
 * @returns {string} American odds with + or - prefix (e.g., "+150", "-200")
 */
export function decimalToAmerican(decimalOdds) {
  // Handle edge cases
  if (!decimalOdds || decimalOdds === 1.0 || typeof decimalOdds !== 'number') {
    return '-';
  }

  let american;
  
  if (decimalOdds >= 2.0) {
    // Underdog: American = (Decimal - 1) × 100
    american = Math.round((decimalOdds - 1) * 100);
    return `+${american}`;
  } else {
    // Favorite: American = -100 / (Decimal - 1)
    american = Math.round(-100 / (decimalOdds - 1));
    return american.toString();
  }
}

/**
 * Format odds for display with optional team prefix
 * @param {number} decimalOdds - Decimal odds
 * @param {string} teamName - Optional team name prefix
 * @returns {string} Formatted odds string
 */
export function formatOdds(decimalOdds, teamName = '') {
  const americanOdds = decimalToAmerican(decimalOdds);
  if (teamName) {
    return `${teamName} ${americanOdds}`;
  }
  return americanOdds;
}

/**
 * Get CSS class for odds styling (favorite vs underdog)
 * @param {number} decimalOdds - Decimal odds
 * @returns {string} CSS class name
 */
export function getOddsClass(decimalOdds) {
  if (!decimalOdds || decimalOdds === 1.0) {
    return 'odds-unavailable';
  }
  return decimalOdds >= 2.0 ? 'odds-underdog' : 'odds-favorite';
}

/**
 * Determine if team is favorite or underdog based on odds
 * @param {number} decimalOdds - Decimal odds
 * @returns {string} "favorite", "underdog", or "even"
 */
export function getOddsType(decimalOdds) {
  if (!decimalOdds || decimalOdds === 1.0) {
    return 'even';
  }
  return decimalOdds >= 2.0 ? 'underdog' : 'favorite';
}
