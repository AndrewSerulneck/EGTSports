/**
 * Unit tests for the normalization utility
 * 
 * Tests the ID-based team name normalization system that enables
 * consistent mapping between different odds providers and ESPN data.
 */

import { getStandardId, isValidTeamName, getCanonicalName } from './normalization';
import nflTeams from '../data/nfl-teams.json';

describe('Team Name Normalization Utility', () => {
  // Test 1: Basic functionality - canonical name matching
  describe('getStandardId with canonical names', () => {
    test('should match exact canonical name for Rams', () => {
      expect(getStandardId('Los Angeles Rams')).toBe('14');
    });
    
    test('should match exact canonical name for Chiefs', () => {
      expect(getStandardId('Kansas City Chiefs')).toBe('12');
    });
    
    test('should match exact canonical name for Cowboys', () => {
      expect(getStandardId('Dallas Cowboys')).toBe('6');
    });
    
    test('should match exact canonical name for Buccaneers', () => {
      expect(getStandardId('Tampa Bay Buccaneers')).toBe('27');
    });
  });

  // Test 2: Abbreviation matching (common in JsonOdds and other APIs)
  describe('getStandardId with abbreviations', () => {
    test('should match LAR abbreviation', () => {
      expect(getStandardId('LAR')).toBe('14');
    });
    
    test('should match KC abbreviation', () => {
      expect(getStandardId('KC')).toBe('12');
    });
    
    test('should match DAL abbreviation', () => {
      expect(getStandardId('DAL')).toBe('6');
    });
    
    test('should match TB abbreviation', () => {
      expect(getStandardId('TB')).toBe('27');
    });
    
    test('should match WSH abbreviation for Washington', () => {
      expect(getStandardId('WSH')).toBe('28');
    });
    
    test('should match WAS abbreviation for Washington', () => {
      expect(getStandardId('WAS')).toBe('28');
    });
  });

  // Test 3: Mascot-only matching (common in The Odds API)
  describe('getStandardId with mascot names', () => {
    test('should match Rams mascot', () => {
      expect(getStandardId('Rams')).toBe('14');
    });
    
    test('should match Chiefs mascot', () => {
      expect(getStandardId('Chiefs')).toBe('12');
    });
    
    test('should match Cowboys mascot', () => {
      expect(getStandardId('Cowboys')).toBe('6');
    });
    
    test('should match Buccaneers mascot', () => {
      expect(getStandardId('Buccaneers')).toBe('27');
    });
    
    test('should match Bucs alternate mascot', () => {
      expect(getStandardId('Bucs')).toBe('27');
    });
    
    test('should match Commanders mascot', () => {
      expect(getStandardId('Commanders')).toBe('28');
    });
  });

  // Test 4: Case-insensitive matching
  describe('getStandardId case-insensitive matching', () => {
    test('should match lowercase rams', () => {
      expect(getStandardId('rams')).toBe('14');
    });
    
    test('should match UPPERCASE RAMS', () => {
      expect(getStandardId('RAMS')).toBe('14');
    });
    
    test('should match MiXeD CaSe RaMs', () => {
      expect(getStandardId('RaMs')).toBe('14');
    });
    
    test('should match lowercase LAR', () => {
      expect(getStandardId('lar')).toBe('14');
    });
    
    test('should match lowercase full name', () => {
      expect(getStandardId('los angeles rams')).toBe('14');
    });
  });

  // Test 5: Whitespace trimming
  describe('getStandardId whitespace handling', () => {
    test('should trim leading whitespace', () => {
      expect(getStandardId('  Rams')).toBe('14');
    });
    
    test('should trim trailing whitespace', () => {
      expect(getStandardId('Rams  ')).toBe('14');
    });
    
    test('should trim both leading and trailing whitespace', () => {
      expect(getStandardId('  Rams  ')).toBe('14');
    });
    
    test('should trim whitespace from full names', () => {
      expect(getStandardId('  Los Angeles Rams  ')).toBe('14');
    });
    
    test('should handle multiple spaces', () => {
      expect(getStandardId('   Chiefs   ')).toBe('12');
    });
  });

  // Test 6: Edge cases and invalid input
  describe('getStandardId edge cases', () => {
    test('should return null for invalid team name', () => {
      expect(getStandardId('Invalid Team Name')).toBe(null);
    });
    
    test('should return null for empty string', () => {
      expect(getStandardId('')).toBe(null);
    });
    
    test('should return null for whitespace-only string', () => {
      expect(getStandardId('   ')).toBe(null);
    });
    
    test('should return null for null input', () => {
      expect(getStandardId(null)).toBe(null);
    });
    
    test('should return null for undefined input', () => {
      expect(getStandardId(undefined)).toBe(null);
    });
    
    test('should return null for number input', () => {
      expect(getStandardId(123)).toBe(null);
    });
    
    test('should return null for object input', () => {
      expect(getStandardId({})).toBe(null);
    });
  });

  // Test 7: Special team cases
  describe('getStandardId special team cases', () => {
    test('should match Raiders with LV abbreviation', () => {
      expect(getStandardId('LV')).toBe('13');
    });
    
    test('should match Raiders with OAK legacy abbreviation', () => {
      expect(getStandardId('OAK')).toBe('13');
    });
    
    test('should match Chargers with LAC abbreviation', () => {
      expect(getStandardId('LAC')).toBe('24');
    });
    
    test('should match Chargers with SD legacy abbreviation', () => {
      expect(getStandardId('SD')).toBe('24');
    });
    
    test('should match 49ers with SF abbreviation', () => {
      expect(getStandardId('SF')).toBe('25');
    });
    
    test('should match 49ers with numeric mascot', () => {
      expect(getStandardId('49ers')).toBe('25');
    });
    
    test('should match Browns with CLE abbreviation', () => {
      expect(getStandardId('CLE')).toBe('5');
    });
    
    test('should match Browns with CLV alternate abbreviation', () => {
      expect(getStandardId('CLV')).toBe('5');
    });
    
    test('should match Cardinals with ARI abbreviation', () => {
      expect(getStandardId('ARI')).toBe('22');
    });
    
    test('should match Cardinals with ARZ alternate abbreviation', () => {
      expect(getStandardId('ARZ')).toBe('22');
    });
  });

  // Test 8: All 32 NFL teams validation
  describe('getStandardId coverage for all 32 NFL teams', () => {
    // Use actual nfl-teams.json data to ensure tests stay in sync
    nflTeams.forEach(team => {
      test(`should match ${team.canonical}`, () => {
        expect(getStandardId(team.canonical)).toBe(team.id);
      });
    });
  });

  // Test 9: isValidTeamName helper function
  describe('isValidTeamName validation helper', () => {
    test('should return true for valid team name', () => {
      expect(isValidTeamName('Rams')).toBe(true);
    });
    
    test('should return true for valid abbreviation', () => {
      expect(isValidTeamName('LAR')).toBe(true);
    });
    
    test('should return false for invalid team name', () => {
      expect(isValidTeamName('Invalid Team')).toBe(false);
    });
    
    test('should return false for empty string', () => {
      expect(isValidTeamName('')).toBe(false);
    });
  });

  // Test 10: getCanonicalName reverse lookup
  describe('getCanonicalName reverse lookup', () => {
    test('should return canonical name for valid ID', () => {
      expect(getCanonicalName('14')).toBe('Los Angeles Rams');
    });
    
    test('should return canonical name for Chiefs', () => {
      expect(getCanonicalName('12')).toBe('Kansas City Chiefs');
    });
    
    test('should return null for invalid ID', () => {
      expect(getCanonicalName('999')).toBe(null);
    });
    
    test('should return null for empty string', () => {
      expect(getCanonicalName('')).toBe(null);
    });
    
    test('should return null for null input', () => {
      expect(getCanonicalName(null)).toBe(null);
    });
  });

  // Test 11: Real-world API format examples
  describe('getStandardId with real API response formats', () => {
    test('should match JsonOdds format (full name)', () => {
      expect(getStandardId('Tampa Bay Buccaneers')).toBe('27');
    });
    
    test('should match The Odds API format (mascot only)', () => {
      expect(getStandardId('Buccaneers')).toBe('27');
    });
    
    test('should match abbreviation format', () => {
      expect(getStandardId('TB')).toBe('27');
    });
    
    test('should match city + mascot format for Packers', () => {
      expect(getStandardId('Green Bay Packers')).toBe('9');
    });
    
    test('should match mascot only for Packers', () => {
      expect(getStandardId('Packers')).toBe('9');
    });
    
    test('should match GB abbreviation for Packers', () => {
      expect(getStandardId('GB')).toBe('9');
    });
  });
});
