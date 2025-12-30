/**
 * Tests for oddsExtraction.js
 * Validates odds extraction and formatting logic for American odds
 */

import {
  getTeamOdds,
  formatAmericanOdds,
  convertToAmericanOdds,
  extractMoneylineOdds,
  validateGameStructure,
  formatOddsForDisplay,
  validateApiKey
} from './oddsExtraction';

// Mock console methods to avoid test output noise
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  console.log.mockRestore();
  console.warn.mockRestore();
  console.error.mockRestore();
});

describe('oddsExtraction', () => {
  describe('formatAmericanOdds', () => {
    test('formats positive odds with + prefix', () => {
      expect(formatAmericanOdds(150)).toBe('+150');
      expect(formatAmericanOdds(200)).toBe('+200');
      expect(formatAmericanOdds(110)).toBe('+110');
    });

    test('formats negative odds as-is', () => {
      expect(formatAmericanOdds(-110)).toBe('-110');
      expect(formatAmericanOdds(-200)).toBe('-200');
      expect(formatAmericanOdds(-120)).toBe('-120');
    });

    test('handles edge cases', () => {
      expect(formatAmericanOdds(NaN)).toBe('-');
      expect(formatAmericanOdds(null)).toBe('-');
      expect(formatAmericanOdds(undefined)).toBe('-');
    });

    test('returns string input as-is', () => {
      expect(formatAmericanOdds('N/A')).toBe('N/A');
      expect(formatAmericanOdds('OFF')).toBe('OFF');
    });
  });

  describe('convertToAmericanOdds', () => {
    test('handles already-American format odds', () => {
      expect(convertToAmericanOdds(150)).toBe('+150');
      expect(convertToAmericanOdds(-110)).toBe('-110');
      expect(convertToAmericanOdds(200)).toBe('+200');
    });

    test('converts decimal underdog odds to American format', () => {
      expect(convertToAmericanOdds(2.50)).toBe('+150');
      expect(convertToAmericanOdds(3.00)).toBe('+200');
      expect(convertToAmericanOdds(2.10)).toBe('+110');
    });

    test('converts decimal favorite odds to American format', () => {
      expect(convertToAmericanOdds(1.91)).toBe('-110');
      expect(convertToAmericanOdds(1.50)).toBe('-200');
      expect(convertToAmericanOdds(1.83)).toBe('-120');
    });

    test('handles edge cases', () => {
      expect(convertToAmericanOdds(1.0)).toBe('-');
      expect(convertToAmericanOdds(NaN)).toBe('-');
      expect(convertToAmericanOdds(null)).toBe('-');
      expect(convertToAmericanOdds(undefined)).toBe('-');
    });
  });

  describe('getTeamOdds', () => {
    test('extracts American odds from valid game with h2h market', () => {
      const game = {
        id: 'test-game-1',
        bookmakers: [
          {
            key: 'draftkings',
            markets: [
              {
                key: 'h2h',
                outcomes: [
                  { name: 'Team A', price: -110 },
                  { name: 'Team B', price: 150 }
                ]
              }
            ]
          }
        ]
      };

      expect(getTeamOdds(game, null, 'Team A')).toBe(-110);
      expect(getTeamOdds(game, null, 'Team B')).toBe(150);
    });

    test('matches by SID when available', () => {
      const game = {
        id: 'test-game-2',
        bookmakers: [
          {
            key: 'fanduel',
            markets: [
              {
                key: 'h2h',
                outcomes: [
                  { name: 'Team A', price: -120, sid: 'sid-team-a' },
                  { name: 'Team B', price: 180, sid: 'sid-team-b' }
                ]
              }
            ]
          }
        ]
      };

      expect(getTeamOdds(game, 'sid-team-a', 'Team A')).toBe(-120);
      expect(getTeamOdds(game, 'sid-team-b', 'Team B')).toBe(180);
    });

    test('handles case-insensitive name matching', () => {
      const game = {
        id: 'test-game-3',
        bookmakers: [
          {
            key: 'betmgm',
            markets: [
              {
                key: 'h2h',
                outcomes: [
                  { name: 'Los Angeles Lakers', price: -150 },
                  { name: 'Boston Celtics', price: 200 }
                ]
              }
            ]
          }
        ]
      };

      expect(getTeamOdds(game, null, 'los angeles lakers')).toBe(-150);
      expect(getTeamOdds(game, null, 'BOSTON CELTICS')).toBe(200);
    });

    test('returns N/A when no bookmakers available', () => {
      const game = {
        id: 'test-game-4',
        bookmakers: []
      };

      expect(getTeamOdds(game, null, 'Team A')).toBe('N/A');
    });

    test('returns N/A when h2h market missing', () => {
      const game = {
        id: 'test-game-5',
        bookmakers: [
          {
            key: 'draftkings',
            markets: [
              {
                key: 'spreads',
                outcomes: []
              }
            ]
          }
        ]
      };

      expect(getTeamOdds(game, null, 'Team A')).toBe('N/A');
    });

    test('returns MISSING when team not found in outcomes', () => {
      const game = {
        id: 'test-game-6',
        bookmakers: [
          {
            key: 'draftkings',
            markets: [
              {
                key: 'h2h',
                outcomes: [
                  { name: 'Team A', price: -110 },
                  { name: 'Team B', price: 150 }
                ]
              }
            ]
          }
        ]
      };

      expect(getTeamOdds(game, null, 'Team C')).toBe('MISSING');
    });

    test('returns ERR when price is invalid', () => {
      const game = {
        id: 'test-game-7',
        bookmakers: [
          {
            key: 'draftkings',
            markets: [
              {
                key: 'h2h',
                outcomes: [
                  { name: 'Team A', price: 'invalid' }
                ]
              }
            ]
          }
        ]
      };

      expect(getTeamOdds(game, null, 'Team A')).toBe('ERR');
    });
  });

  describe('extractMoneylineOdds', () => {
    test('extracts and formats American odds for both teams', () => {
      const game = {
        id: 'test-game-8',
        bookmakers: [
          {
            key: 'draftkings',
            markets: [
              {
                key: 'h2h',
                outcomes: [
                  { name: 'Home Team', price: -110 },
                  { name: 'Away Team', price: 150 }
                ]
              }
            ]
          }
        ]
      };

      const result = extractMoneylineOdds(game, 'home-id', 'Home Team', 'away-id', 'Away Team');
      
      expect(result.homeML).toBe('-110');
      expect(result.awayML).toBe('+150');
      expect(result.drawML).toBeUndefined();
    });

    test('includes draw odds for soccer games', () => {
      const game = {
        id: 'test-game-9',
        bookmakers: [
          {
            key: 'draftkings',
            markets: [
              {
                key: 'h2h',
                outcomes: [
                  { name: 'Home Team', price: 180 },
                  { name: 'Away Team', price: 220 },
                  { name: 'Draw', price: 250 }
                ]
              }
            ]
          }
        ]
      };

      const result = extractMoneylineOdds(game, 'home-id', 'Home Team', 'away-id', 'Away Team', 'soccer_usa_mls');
      
      expect(result.homeML).toBe('+180');
      expect(result.awayML).toBe('+220');
      expect(result.drawML).toBe('+250');
    });
  });

  describe('validateGameStructure', () => {
    test('validates correct game structure', () => {
      const game = {
        id: 'test-game-10',
        bookmakers: [
          {
            key: 'draftkings',
            markets: [
              { key: 'h2h', outcomes: [] }
            ]
          }
        ]
      };

      expect(validateGameStructure(game)).toBe(true);
    });

    test('rejects null or undefined game', () => {
      expect(validateGameStructure(null)).toBe(false);
      expect(validateGameStructure(undefined)).toBe(false);
    });

    test('rejects game without id', () => {
      const game = {
        bookmakers: []
      };

      expect(validateGameStructure(game)).toBe(false);
    });

    test('rejects game without bookmakers', () => {
      const game = {
        id: 'test-game-11'
      };

      expect(validateGameStructure(game)).toBe(false);
    });

    test('rejects game with empty bookmakers array', () => {
      const game = {
        id: 'test-game-12',
        bookmakers: []
      };

      expect(validateGameStructure(game)).toBe(false);
    });
  });

  describe('formatOddsForDisplay', () => {
    test('formats American odds integers', () => {
      expect(formatOddsForDisplay(150)).toBe('+150');
      expect(formatOddsForDisplay(-110)).toBe('-110');
    });

    test('preserves American odds strings', () => {
      expect(formatOddsForDisplay('+150')).toBe('+150');
      expect(formatOddsForDisplay('-110')).toBe('-110');
    });

    test('converts status strings to dashes', () => {
      expect(formatOddsForDisplay('N/A')).toBe('-');
      expect(formatOddsForDisplay('MISSING')).toBe('-');
      expect(formatOddsForDisplay('')).toBe('-');
      expect(formatOddsForDisplay(null)).toBe('-');
      expect(formatOddsForDisplay(undefined)).toBe('-');
    });

    test('preserves error status', () => {
      expect(formatOddsForDisplay('ERR')).toBe('ERR');
      expect(formatOddsForDisplay('OFF')).toBe('OFF');
    });
  });

  describe('validateApiKey', () => {
    const originalEnv = process.env.REACT_APP_THE_ODDS_API_KEY;

    afterEach(() => {
      process.env.REACT_APP_THE_ODDS_API_KEY = originalEnv;
    });

    test('returns true when API key is set', () => {
      process.env.REACT_APP_THE_ODDS_API_KEY = 'test-api-key-123';
      expect(validateApiKey()).toBe(true);
    });

    test('returns false when API key is missing', () => {
      delete process.env.REACT_APP_THE_ODDS_API_KEY;
      expect(validateApiKey()).toBe(false);
    });

    test('returns false when API key is undefined string', () => {
      process.env.REACT_APP_THE_ODDS_API_KEY = 'undefined';
      expect(validateApiKey()).toBe(false);
    });

    test('returns false when API key is empty', () => {
      process.env.REACT_APP_THE_ODDS_API_KEY = '';
      expect(validateApiKey()).toBe(false);
    });
  });
});
