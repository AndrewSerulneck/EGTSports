/**
 * Tests for oddsUtils.js - Odds conversion and formatting utilities
 */

import {
  decimalToAmerican,
  formatOdds,
  getOddsClass,
  getOddsType
} from './oddsUtils';

describe('oddsUtils', () => {
  describe('decimalToAmerican', () => {
    test('converts underdog odds (>= 2.0) correctly', () => {
      expect(decimalToAmerican(2.0)).toBe('+100');
      expect(decimalToAmerican(2.50)).toBe('+150');
      expect(decimalToAmerican(3.00)).toBe('+200');
      expect(decimalToAmerican(1.91)).toBe('-110');
    });

    test('converts favorite odds (< 2.0) correctly', () => {
      expect(decimalToAmerican(1.50)).toBe('-200');
      expect(decimalToAmerican(1.83)).toBe('-120');
      expect(decimalToAmerican(1.67)).toBe('-149');
    });

    test('handles edge cases', () => {
      expect(decimalToAmerican(null)).toBe('-');
      expect(decimalToAmerican(undefined)).toBe('-');
      expect(decimalToAmerican(1.0)).toBe('-');
      expect(decimalToAmerican('invalid')).toBe('-');
    });

    test('rounds to nearest integer', () => {
      expect(decimalToAmerican(2.55)).toBe('+155');
      expect(decimalToAmerican(1.73)).toBe('-137');
    });
  });

  describe('formatOdds', () => {
    test('formats odds without team name', () => {
      expect(formatOdds(2.50)).toBe('+150');
      expect(formatOdds(1.50)).toBe('-200');
    });

    test('formats odds with team name prefix', () => {
      expect(formatOdds(2.50, 'Lakers')).toBe('Lakers +150');
      expect(formatOdds(1.50, 'Celtics')).toBe('Celtics -200');
    });

    test('handles null odds', () => {
      expect(formatOdds(null)).toBe('-');
      expect(formatOdds(null, 'Lakers')).toBe('-');
    });
  });

  describe('getOddsClass', () => {
    test('returns correct CSS class for underdog', () => {
      expect(getOddsClass(2.50)).toBe('odds-underdog');
      expect(getOddsClass(3.00)).toBe('odds-underdog');
    });

    test('returns correct CSS class for favorite', () => {
      expect(getOddsClass(1.50)).toBe('odds-favorite');
      expect(getOddsClass(1.83)).toBe('odds-favorite');
    });

    test('returns unavailable class for invalid odds', () => {
      expect(getOddsClass(null)).toBe('odds-unavailable');
      expect(getOddsClass(undefined)).toBe('odds-unavailable');
      expect(getOddsClass(1.0)).toBe('odds-unavailable');
    });
  });

  describe('getOddsType', () => {
    test('identifies underdog correctly', () => {
      expect(getOddsType(2.50)).toBe('underdog');
      expect(getOddsType(3.00)).toBe('underdog');
    });

    test('identifies favorite correctly', () => {
      expect(getOddsType(1.50)).toBe('favorite');
      expect(getOddsType(1.83)).toBe('favorite');
    });

    test('handles even odds', () => {
      expect(getOddsType(null)).toBe('even');
      expect(getOddsType(1.0)).toBe('even');
    });
  });
});
