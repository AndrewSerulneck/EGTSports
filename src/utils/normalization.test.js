/**
 * Unit tests for the normalization utility
 * 
 * Tests the universal team identification system that enables
 * consistent mapping across all sports and odds providers.
 */

import { 
  getStandardId, 
  getTeamByEspnId,
  getTeamBySid,
  isValidTeamName, 
  getCanonicalName 
} from './normalization';

describe('Team Name Normalization Utility - Multi-Sport Support', () => {
  // Test 1: NFL team lookups
  describe('NFL team lookups', () => {
    test('should find Rams by canonical name', () => {
      const result = getStandardId('Los Angeles Rams', 'nfl');
      expect(result).not.toBeNull();
      expect(result.id).toBe('NFL-LAR');
      expect(result.espnId).toBe('14');
      expect(result.canonical).toBe('Los Angeles Rams');
      expect(result.sport).toBe('nfl');
    });
    
    test('should find Rams by abbreviation', () => {
      const result = getStandardId('LAR', 'nfl');
      expect(result).not.toBeNull();
      expect(result.id).toBe('NFL-LAR');
      expect(result.espnId).toBe('14');
    });
    
    test('should find Rams by mascot', () => {
      const result = getStandardId('Rams', 'nfl');
      expect(result).not.toBeNull();
      expect(result.canonical).toBe('Los Angeles Rams');
    });
    
    test('should find Rams by ESPN ID', () => {
      const result = getStandardId('14', 'nfl');
      expect(result).not.toBeNull();
      expect(result.canonical).toBe('Los Angeles Rams');
    });
    
    test('should find Rams by The Odds API SID', () => {
      const result = getStandardId('par_01hqmkr1ybfmfb8mhz10drfe21', 'nfl');
      expect(result).not.toBeNull();
      expect(result.canonical).toBe('Los Angeles Rams');
    });
  });

  // Test 2: NBA team lookups
  describe('NBA team lookups', () => {
    test('should find Knicks by canonical name', () => {
      const result = getStandardId('New York Knicks', 'nba');
      expect(result).not.toBeNull();
      expect(result.id).toBe('NBA-020');
      expect(result.canonical).toBe('New York Knicks');
      expect(result.sport).toBe('nba');
    });
    
    test('should find Knicks by abbreviation', () => {
      const result = getStandardId('NYK', 'nba');
      expect(result).not.toBeNull();
      expect(result.canonical).toBe('New York Knicks');
    });
    
    test('should find Lakers by various aliases', () => {
      expect(getStandardId('Lakers', 'nba')?.canonical).toBe('Los Angeles Lakers');
      expect(getStandardId('LAL', 'nba')?.canonical).toBe('Los Angeles Lakers');
      expect(getStandardId('L.A. Lakers', 'nba')?.canonical).toBe('Los Angeles Lakers');
    });
    
    test('should find Knicks by The Odds API SID', () => {
      const result = getStandardId('par_01hqmkq6fzfvyvrsb30jj85ade', 'nba');
      expect(result).not.toBeNull();
      expect(result.canonical).toBe('New York Knicks');
    });
  });

  // Test 3: NHL team lookups
  describe('NHL team lookups', () => {
    test('should find Maple Leafs by canonical name', () => {
      const result = getStandardId('Toronto Maple Leafs', 'nhl');
      expect(result).not.toBeNull();
      expect(result.canonical).toBe('Toronto Maple Leafs');
      expect(result.sport).toBe('nhl');
    });
    
    test('should find Maple Leafs by abbreviation', () => {
      const result = getStandardId('TOR', 'nhl');
      expect(result).not.toBeNull();
      expect(result.canonical).toBe('Toronto Maple Leafs');
    });
    
    test('should find Maple Leafs by mascot', () => {
      const result = getStandardId('Leafs', 'nhl');
      expect(result).not.toBeNull();
      expect(result.canonical).toBe('Toronto Maple Leafs');
    });
  });

  // Test 4: NCAA Basketball team lookups
  describe('NCAA Basketball team lookups', () => {
    test('should find team by canonical name', () => {
      const result = getStandardId('Abilene Christian Wildcats', 'ncaab');
      expect(result).not.toBeNull();
      expect(result.id).toBe('NCAAB-001');
      expect(result.canonical).toBe('Abilene Christian Wildcats');
      expect(result.espnId).toBeNull(); // NCAA teams don't have ESPN IDs
      expect(result.sport).toBe('ncaab');
    });
    
    test('should find team by The Odds API SID', () => {
      const result = getStandardId('par_01hqmkq8nwfphb97yww9yn0caa', 'ncaab');
      expect(result).not.toBeNull();
      expect(result.canonical).toBe('Abilene Christian Wildcats');
    });
  });

  // Test 5: Cross-sport searches (no sport specified)
  describe('Cross-sport searches', () => {
    test('should find NFL team without sport parameter', () => {
      const result = getStandardId('Rams');
      expect(result).not.toBeNull();
      expect(result.sport).toBe('nfl');
      expect(result.canonical).toBe('Los Angeles Rams');
    });
    
    test('should find NBA team without sport parameter', () => {
      const result = getStandardId('Lakers');
      expect(result).not.toBeNull();
      expect(result.sport).toBe('nba');
      expect(result.canonical).toBe('Los Angeles Lakers');
    });
    
    test('should find by The Odds API SID across all sports', () => {
      const result = getStandardId('par_01hqmkr1ybfmfb8mhz10drfe21');
      expect(result).not.toBeNull();
      expect(result.sport).toBe('nfl');
      expect(result.canonical).toBe('Los Angeles Rams');
    });
  });

  // Test 6: Case-insensitive matching
  describe('Case-insensitive matching', () => {
    test('should match lowercase', () => {
      expect(getStandardId('rams', 'nfl')?.canonical).toBe('Los Angeles Rams');
    });
    
    test('should match UPPERCASE', () => {
      expect(getStandardId('RAMS', 'nfl')?.canonical).toBe('Los Angeles Rams');
    });
    
    test('should match MiXeD CaSe', () => {
      expect(getStandardId('RaMs', 'nfl')?.canonical).toBe('Los Angeles Rams');
    });
  });

  // Test 7: Whitespace handling
  describe('Whitespace handling', () => {
    test('should trim leading whitespace', () => {
      expect(getStandardId('  Rams', 'nfl')?.canonical).toBe('Los Angeles Rams');
    });
    
    test('should trim trailing whitespace', () => {
      expect(getStandardId('Rams  ', 'nfl')?.canonical).toBe('Los Angeles Rams');
    });
    
    test('should trim both leading and trailing', () => {
      expect(getStandardId('  Rams  ', 'nfl')?.canonical).toBe('Los Angeles Rams');
    });
  });

  // Test 8: Invalid inputs
  describe('Invalid inputs', () => {
    test('should return null for invalid team name', () => {
      expect(getStandardId('Invalid Team Name', 'nfl')).toBeNull();
    });
    
    test('should return null for empty string', () => {
      expect(getStandardId('', 'nfl')).toBeNull();
    });
    
    test('should return null for whitespace-only', () => {
      expect(getStandardId('   ', 'nfl')).toBeNull();
    });
    
    test('should return null for null input', () => {
      expect(getStandardId(null, 'nfl')).toBeNull();
    });
    
    test('should return null for undefined input', () => {
      expect(getStandardId(undefined, 'nfl')).toBeNull();
    });
  });

  // Test 9: getTeamByEspnId function
  describe('getTeamByEspnId', () => {
    test('should find team by ESPN ID', () => {
      const result = getTeamByEspnId('14', 'nfl');
      expect(result).not.toBeNull();
      expect(result.canonical).toBe('Los Angeles Rams');
      expect(result.sport).toBe('nfl');
    });
    
    test('should return null for invalid ESPN ID', () => {
      expect(getTeamByEspnId('999', 'nfl')).toBeNull();
    });
    
    test('should work without sport parameter', () => {
      const result = getTeamByEspnId('14');
      expect(result).not.toBeNull();
      expect(result.canonical).toBe('Los Angeles Rams');
    });
  });

  // Test 10: getTeamBySid function
  describe('getTeamBySid', () => {
    test('should find team by The Odds API SID', () => {
      const result = getTeamBySid('par_01hqmkr1ybfmfb8mhz10drfe21', 'nfl');
      expect(result).not.toBeNull();
      expect(result.canonical).toBe('Los Angeles Rams');
      expect(result.sport).toBe('nfl');
    });
    
    test('should return null for invalid SID', () => {
      expect(getTeamBySid('par_invalid', 'nfl')).toBeNull();
    });
    
    test('should work without sport parameter', () => {
      const result = getTeamBySid('par_01hqmkr1ybfmfb8mhz10drfe21');
      expect(result).not.toBeNull();
      expect(result.canonical).toBe('Los Angeles Rams');
    });
  });

  // Test 11: isValidTeamName helper
  describe('isValidTeamName', () => {
    test('should return true for valid team name', () => {
      expect(isValidTeamName('Rams', 'nfl')).toBe(true);
    });
    
    test('should return true for valid abbreviation', () => {
      expect(isValidTeamName('LAR', 'nfl')).toBe(true);
    });
    
    test('should return false for invalid team name', () => {
      expect(isValidTeamName('Invalid Team', 'nfl')).toBe(false);
    });
    
    test('should return false for empty string', () => {
      expect(isValidTeamName('', 'nfl')).toBe(false);
    });
  });

  // Test 12: getCanonicalName helper
  describe('getCanonicalName', () => {
    test('should return canonical name for valid identifier', () => {
      expect(getCanonicalName('LAR', 'nfl')).toBe('Los Angeles Rams');
    });
    
    test('should return canonical name for ESPN ID', () => {
      expect(getCanonicalName('14', 'nfl')).toBe('Los Angeles Rams');
    });
    
    test('should return canonical name for The Odds API SID', () => {
      expect(getCanonicalName('par_01hqmkr1ybfmfb8mhz10drfe21', 'nfl')).toBe('Los Angeles Rams');
    });
    
    test('should return null for invalid identifier', () => {
      expect(getCanonicalName('Invalid', 'nfl')).toBeNull();
    });
  });

  // Test 13: Real-world API format examples
  describe('Real-world API format examples', () => {
    test('should handle JsonOdds format (full name)', () => {
      expect(getStandardId('Tampa Bay Buccaneers', 'nfl')?.espnId).toBe('27');
    });
    
    test('should handle The Odds API format (mascot)', () => {
      expect(getStandardId('Buccaneers', 'nfl')?.espnId).toBe('27');
    });
    
    test('should handle abbreviation format', () => {
      expect(getStandardId('TB', 'nfl')?.espnId).toBe('27');
    });
  });
});
