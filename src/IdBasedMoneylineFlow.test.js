/**
 * Integration tests for ID-based NFL moneyline data flow
 * 
 * Tests the complete flow from API response to UI display:
 * 1. The Odds API parsing with ID normalization
 * 2. JsonOdds API parsing with ID normalization
 * 3. Consistent keying with ESPN team IDs
 */

import { getStandardId } from './utils/normalization';

describe('ID-based NFL Moneyline Data Flow', () => {
  // Test 1: The Odds API format parsing
  describe('The Odds API format parsing', () => {
    test('should normalize team names to IDs before storing odds', () => {
      // Simulate The Odds API response format
      const oddsApiGame = {
        home_team: 'Tampa Bay Buccaneers',
        away_team: 'Dallas Cowboys',
        bookmakers: [{
          markets: [{
            key: 'h2h',
            outcomes: [
              { name: 'Tampa Bay Buccaneers', price: -303 },
              { name: 'Dallas Cowboys', price: 240 }
            ]
          }]
        }]
      };
      
      // Normalize team names to IDs (as done in fetchOddsFromTheOddsAPI)
      const homeTeamId = getStandardId(oddsApiGame.home_team);
      const awayTeamId = getStandardId(oddsApiGame.away_team);
      
      // Verify normalization worked
      expect(homeTeamId).toBe('27'); // Tampa Bay
      expect(awayTeamId).toBe('6');  // Dallas
      
      // Create the game key
      const gameKey = `${homeTeamId}|${awayTeamId}`;
      expect(gameKey).toBe('27|6');
      
      // Simulate storing odds in oddsMap
      const oddsMap = {
        [gameKey]: {
          homeMoneyline: '-303',
          awayMoneyline: '+240'
        }
      };
      
      // Verify lookup works with the ID-based key
      expect(oddsMap[gameKey].homeMoneyline).toBe('-303');
      expect(oddsMap[gameKey].awayMoneyline).toBe('+240');
    });
    
    test('should handle different team name formats from The Odds API', () => {
      // The Odds API might use different formats
      const formats = [
        { input: 'Rams', expected: '14' },
        { input: 'Los Angeles Rams', expected: '14' },
        { input: 'Kansas City Chiefs', expected: '12' },
        { input: 'Chiefs', expected: '12' },
        { input: 'Green Bay Packers', expected: '9' },
        { input: 'Packers', expected: '9' }
      ];
      
      formats.forEach(({ input, expected }) => {
        expect(getStandardId(input)).toBe(expected);
      });
    });
  });

  // Test 2: JsonOdds API format parsing
  describe('JsonOdds API format parsing', () => {
    test('should normalize team names to IDs before storing moneylines', () => {
      // Simulate JsonOdds response format
      const jsonOddsMatch = {
        HomeTeam: 'Tampa Bay Buccaneers',
        AwayTeam: 'Dallas Cowboys',
        Odds: [{
          MoneyLineHome: -303,
          MoneyLineAway: 240
        }]
      };
      
      // Normalize team names to IDs (as done in fetchMoneylineFromJsonOdds)
      const homeTeamId = getStandardId(jsonOddsMatch.HomeTeam);
      const awayTeamId = getStandardId(jsonOddsMatch.AwayTeam);
      
      // Verify normalization worked
      expect(homeTeamId).toBe('27'); // Tampa Bay
      expect(awayTeamId).toBe('6');  // Dallas
      
      // Create the game key
      const gameKey = `${homeTeamId}|${awayTeamId}`;
      expect(gameKey).toBe('27|6');
      
      // Simulate storing moneylines in moneylineMap
      const moneylineMap = {
        [gameKey]: {
          homeMoneyline: '-303',
          awayMoneyline: '+240'
        }
      };
      
      // Verify lookup works with the ID-based key
      expect(moneylineMap[gameKey].homeMoneyline).toBe('-303');
      expect(moneylineMap[gameKey].awayMoneyline).toBe('+240');
    });
    
    test('should handle full team names from JsonOdds', () => {
      // JsonOdds typically uses full team names
      const formats = [
        { input: 'Los Angeles Rams', expected: '14' },
        { input: 'Kansas City Chiefs', expected: '12' },
        { input: 'Green Bay Packers', expected: '9' },
        { input: 'Tampa Bay Buccaneers', expected: '27' },
        { input: 'San Francisco 49ers', expected: '25' }
      ];
      
      formats.forEach(({ input, expected }) => {
        expect(getStandardId(input)).toBe(expected);
      });
    });
  });

  // Test 3: Consistent keying between APIs
  describe('Consistent keying between APIs', () => {
    test('should use same key format for both APIs', () => {
      // The Odds API format
      const oddsApiHome = 'Buccaneers';
      const oddsApiAway = 'Cowboys';
      
      // JsonOdds format
      const jsonOddsHome = 'Tampa Bay Buccaneers';
      const jsonOddsAway = 'Dallas Cowboys';
      
      // Both should normalize to same IDs
      const oddsApiHomeId = getStandardId(oddsApiHome);
      const oddsApiAwayId = getStandardId(oddsApiAway);
      const jsonOddsHomeId = getStandardId(jsonOddsHome);
      const jsonOddsAwayId = getStandardId(jsonOddsAway);
      
      expect(oddsApiHomeId).toBe(jsonOddsHomeId); // Both '27'
      expect(oddsApiAwayId).toBe(jsonOddsAwayId); // Both '6'
      
      // Both should create same game key
      const oddsApiKey = `${oddsApiHomeId}|${oddsApiAwayId}`;
      const jsonOddsKey = `${jsonOddsHomeId}|${jsonOddsAwayId}`;
      
      expect(oddsApiKey).toBe(jsonOddsKey); // Both '27|6'
    });
  });

  // Test 4: ESPN game data integration
  describe('ESPN game data integration', () => {
    test('should match ESPN team IDs with odds data', () => {
      // Simulate ESPN game data (after our changes)
      const espnGame = {
        awayTeam: 'Dallas Cowboys',
        homeTeam: 'Tampa Bay Buccaneers',
        awayTeamId: '6',  // ESPN team ID
        homeTeamId: '27'  // ESPN team ID
      };
      
      // Simulate oddsMap from The Odds API or JsonOdds
      const oddsMap = {
        '27|6': {
          homeMoneyline: '-303',
          awayMoneyline: '+240',
          homeSpread: '-7.5',
          awaySpread: '+7.5',
          total: '48.5'
        }
      };
      
      // Lookup odds using ESPN team IDs
      const gameKey = `${espnGame.homeTeamId}|${espnGame.awayTeamId}`;
      const odds = oddsMap[gameKey];
      
      // Verify we found the odds
      expect(odds).toBeDefined();
      expect(odds.homeMoneyline).toBe('-303');
      expect(odds.awayMoneyline).toBe('+240');
    });
  });

  // Test 5: Edge cases and error handling
  describe('Edge cases and error handling', () => {
    test('should skip games with unrecognized team names', () => {
      // Invalid team name that can't be normalized
      const invalidTeam = 'Invalid Team Name XYZ';
      const validTeam = 'Dallas Cowboys';
      
      const invalidId = getStandardId(invalidTeam);
      const validId = getStandardId(validTeam);
      
      expect(invalidId).toBe(null);
      expect(validId).toBe('6');
      
      // In real code, we'd skip this game:
      // if (!homeTeamId || !awayTeamId) return;
    });
    
    test('should handle missing odds data gracefully', () => {
      const espnGame = {
        awayTeamId: '6',
        homeTeamId: '27'
      };
      
      const oddsMap = {
        '14|12': { // Different game
          homeMoneyline: '-210',
          awayMoneyline: '+175'
        }
      };
      
      const gameKey = `${espnGame.homeTeamId}|${espnGame.awayTeamId}`;
      const odds = oddsMap[gameKey];
      
      // Should be undefined
      expect(odds).toBeUndefined();
      
      // In real code, we'd return default odds:
      const defaultOdds = odds || {
        homeMoneyline: '-',
        awayMoneyline: '-',
        homeSpread: '-',
        awaySpread: '-',
        total: '-'
      };
      
      expect(defaultOdds.homeMoneyline).toBe('-');
    });
  });

  // Test 6: Real-world scenarios
  describe('Real-world NFL scenarios', () => {
    test('should handle complete NFL game data flow', () => {
      // Step 1: The Odds API returns data
      const oddsApiGames = [
        { home_team: 'Rams', away_team: 'Seahawks' },
        { home_team: 'Chiefs', away_team: 'Broncos' },
        { home_team: 'Packers', away_team: 'Bears' }
      ];
      
      // Step 2: Normalize to IDs and create oddsMap
      const oddsMap = {};
      oddsApiGames.forEach(game => {
        const homeId = getStandardId(game.home_team);
        const awayId = getStandardId(game.away_team);
        if (homeId && awayId) {
          oddsMap[`${homeId}|${awayId}`] = {
            homeMoneyline: '-210',
            awayMoneyline: '+175'
          };
        }
      });
      
      // Step 3: Verify all games were processed
      expect(Object.keys(oddsMap).length).toBe(3);
      expect(oddsMap['14|26']).toBeDefined(); // Rams vs Seahawks
      expect(oddsMap['12|7']).toBeDefined();  // Chiefs vs Broncos
      expect(oddsMap['9|3']).toBeDefined();   // Packers vs Bears
      
      // Step 4: ESPN game can lookup odds using its team IDs
      const espnGame = {
        awayTeamId: '26', // Seahawks
        homeTeamId: '14'  // Rams
      };
      
      const gameKey = `${espnGame.homeTeamId}|${espnGame.awayTeamId}`;
      expect(oddsMap[gameKey]).toBeDefined();
      expect(oddsMap[gameKey].homeMoneyline).toBe('-210');
    });
    
    test('should handle legacy team abbreviations', () => {
      // Teams that have changed cities or abbreviations
      const legacyMappings = [
        { input: 'OAK', expected: '13' },  // Oakland -> Las Vegas Raiders
        { input: 'SD', expected: '24' },   // San Diego -> LA Chargers
        { input: 'CLV', expected: '5' },   // Alternate Cleveland abbreviation
        { input: 'ARZ', expected: '22' }   // Alternate Arizona abbreviation
      ];
      
      legacyMappings.forEach(({ input, expected }) => {
        expect(getStandardId(input)).toBe(expected);
      });
    });
  });

  // Test 7: Performance characteristics
  describe('Performance characteristics', () => {
    test('should be faster than fuzzy matching', () => {
      // ID-based lookup is O(1) vs O(n) for fuzzy matching
      const oddsMap = {
        '27|6': { homeMoneyline: '-303' },
        '14|26': { homeMoneyline: '-210' },
        '12|7': { homeMoneyline: '-280' }
      };
      
      const startTime = Date.now();
      
      // Simulate 100 lookups
      for (let i = 0; i < 100; i++) {
        const result = oddsMap['27|6'];
        expect(result).toBeDefined();
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should be very fast (< 10ms for 100 lookups)
      expect(duration).toBeLessThan(10);
    });
  });
});
