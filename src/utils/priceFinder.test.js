/**
 * Tests for priceFinder.js - Price Finder utility for The Odds API
 */

import {
  findBestMoneylinePrices,
  convertToAmericanOdds,
  formatMoneylineForDisplay
} from './priceFinder';

// Mock console methods to avoid noise in test output
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  console.log.mockRestore();
  console.error.mockRestore();
});

describe('priceFinder', () => {
  describe('convertToAmericanOdds', () => {
    test('converts decimal underdog odds correctly', () => {
      expect(convertToAmericanOdds(2.0)).toBe('+100');
      expect(convertToAmericanOdds(2.50)).toBe('+150');
      expect(convertToAmericanOdds(3.00)).toBe('+200');
    });

    test('converts decimal favorite odds correctly', () => {
      expect(convertToAmericanOdds(1.91)).toBe('-110');
      expect(convertToAmericanOdds(1.50)).toBe('-200');
      expect(convertToAmericanOdds(1.67)).toBe('-149');
    });

    test('handles edge cases', () => {
      expect(convertToAmericanOdds(null)).toBe('-');
      expect(convertToAmericanOdds(undefined)).toBe('-');
      expect(convertToAmericanOdds(1.0)).toBe('-');
      expect(convertToAmericanOdds('invalid')).toBe('-');
    });

    test('handles string numbers', () => {
      expect(convertToAmericanOdds('2.50')).toBe('+150');
      expect(convertToAmericanOdds('1.91')).toBe('-110');
    });

    test('handles NaN gracefully', () => {
      expect(convertToAmericanOdds(NaN)).toBe('-');
      expect(convertToAmericanOdds('abc')).toBe('-');
    });
  });

  describe('findBestMoneylinePrices', () => {
    const mockBookmakers = [
      {
        key: 'draftkings',
        title: 'DraftKings',
        markets: [
          {
            key: 'h2h',
            outcomes: [
              { name: 'Los Angeles Lakers', price: 1.91 },
              { name: 'Boston Celtics', price: 2.00 }
            ]
          }
        ]
      },
      {
        key: 'fanduel',
        title: 'FanDuel',
        markets: [
          {
            key: 'h2h',
            outcomes: [
              { name: 'Los Angeles Lakers', price: 1.85 },
              { name: 'Boston Celtics', price: 2.10 }
            ]
          }
        ]
      }
    ];

    test('finds moneyline prices with exact name match', () => {
      const result = findBestMoneylinePrices(
        mockBookmakers,
        'Los Angeles Lakers',
        'Boston Celtics'
      );

      expect(result).not.toBeNull();
      expect(result.homePrice).toBe(1.91);
      expect(result.awayPrice).toBe(2.00);
      expect(result.bookmakerName).toBe('DraftKings');
    });

    test('prioritizes DraftKings over FanDuel', () => {
      const result = findBestMoneylinePrices(
        mockBookmakers,
        'Los Angeles Lakers',
        'Boston Celtics'
      );

      expect(result.bookmakerKey).toBe('draftkings');
    });

    test('falls back to FanDuel if DraftKings missing h2h', () => {
      const bookmakers = [
        {
          key: 'draftkings',
          title: 'DraftKings',
          markets: [
            { key: 'spreads', outcomes: [] }
          ]
        },
        mockBookmakers[1]
      ];

      const result = findBestMoneylinePrices(
        bookmakers,
        'Los Angeles Lakers',
        'Boston Celtics'
      );

      expect(result).not.toBeNull();
      expect(result.bookmakerKey).toBe('fanduel');
    });

    test('handles fuzzy name matching', () => {
      const bookmakers = [
        {
          key: 'draftkings',
          title: 'DraftKings',
          markets: [
            {
              key: 'h2h',
              outcomes: [
                { name: 'Lakers', price: 1.91 },
                { name: 'Celtics', price: 2.00 }
              ]
            }
          ]
        }
      ];

      const result = findBestMoneylinePrices(
        bookmakers,
        'Los Angeles Lakers',
        'Boston Celtics'
      );

      expect(result).not.toBeNull();
      expect(result.homePrice).toBe(1.91);
      expect(result.awayPrice).toBe(2.00);
    });

    test('handles soccer 3-way market with Draw', () => {
      const soccerBookmakers = [
        {
          key: 'draftkings',
          title: 'DraftKings',
          markets: [
            {
              key: 'h2h',
              outcomes: [
                { name: 'Team A', price: 2.50 },
                { name: 'Draw', price: 3.00 },
                { name: 'Team B', price: 2.80 }
              ]
            }
          ]
        }
      ];

      const result = findBestMoneylinePrices(
        soccerBookmakers,
        'Team A',
        'Team B'
      );

      expect(result).not.toBeNull();
      expect(result.homePrice).toBe(2.50);
      expect(result.awayPrice).toBe(2.80);
      expect(result.drawPrice).toBe(3.00);
    });

    test('returns null when no bookmakers provided', () => {
      const result = findBestMoneylinePrices([], 'Team A', 'Team B');
      expect(result).toBeNull();
    });

    test('returns null when no h2h market found', () => {
      const bookmakers = [
        {
          key: 'draftkings',
          title: 'DraftKings',
          markets: [
            { key: 'spreads', outcomes: [] }
          ]
        }
      ];

      const result = findBestMoneylinePrices(
        bookmakers,
        'Team A',
        'Team B'
      );

      expect(result).toBeNull();
    });

    test('handles participant ID matching', () => {
      const bookmakers = [
        {
          key: 'draftkings',
          title: 'DraftKings',
          markets: [
            {
              key: 'h2h',
              outcomes: [
                { name: 'Los Angeles Lakers', participant_id: 'lakers-id', price: 1.91 },
                { name: 'Boston Celtics', participant_id: 'celtics-id', price: 2.00 }
              ]
            }
          ]
        }
      ];

      const result = findBestMoneylinePrices(
        bookmakers,
        'Los Angeles Lakers',
        'Boston Celtics',
        'basketball_nba',
        'lakers-id',
        'celtics-id'
      );

      expect(result).not.toBeNull();
      expect(result.homePrice).toBe(1.91);
      expect(result.awayPrice).toBe(2.00);
    });

    test('handles string prices and converts to number', () => {
      const bookmakers = [
        {
          key: 'draftkings',
          title: 'DraftKings',
          markets: [
            {
              key: 'h2h',
              outcomes: [
                { name: 'Team A', price: '1.91' },
                { name: 'Team B', price: '2.00' }
              ]
            }
          ]
        }
      ];

      const result = findBestMoneylinePrices(
        bookmakers,
        'Team A',
        'Team B'
      );

      expect(result).not.toBeNull();
      expect(result.homePrice).toBe(1.91);
      expect(result.awayPrice).toBe(2.00);
    });
  });

  describe('formatMoneylineForDisplay', () => {
    test('formats valid price result', () => {
      const priceResult = {
        awayPrice: 2.50,
        homePrice: 1.91,
        drawPrice: null,
        bookmakerName: 'DraftKings'
      };

      const formatted = formatMoneylineForDisplay(priceResult);

      expect(formatted.awayMoneyline).toBe('+150');
      expect(formatted.homeMoneyline).toBe('-110');
      expect(formatted.drawMoneyline).toBeUndefined();
    });

    test('formats soccer result with draw', () => {
      const priceResult = {
        awayPrice: 2.50,
        homePrice: 1.91,
        drawPrice: 3.00,
        bookmakerName: 'DraftKings'
      };

      const formatted = formatMoneylineForDisplay(priceResult);

      expect(formatted.awayMoneyline).toBe('+150');
      expect(formatted.homeMoneyline).toBe('-110');
      expect(formatted.drawMoneyline).toBe('+200');
    });

    test('handles null price result', () => {
      const formatted = formatMoneylineForDisplay(null);

      expect(formatted.awayMoneyline).toBe('-');
      expect(formatted.homeMoneyline).toBe('-');
      expect(formatted.drawMoneyline).toBeUndefined();
    });
  });
});
