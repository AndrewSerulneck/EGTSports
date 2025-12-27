/**
 * Unit tests for enhanced mascot matching logic
 * Tests suffix removal and fuzzy matching for college team names
 */

describe('Mascot Matching Enhancement Tests', () => {
  // Mock implementation of extractMascotFromName for testing
  const extractMascotFromName = (teamName) => {
    if (!teamName) return '';
    
    let cleaned = teamName
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    
    const suffixesToRemove = ['st', 'saint', 'state', 'university', 'college', 'tech', 'a&m'];
    const words = cleaned.split(' ');
    
    const filteredWords = words.filter((word, index) => {
      if (index === words.length - 1) return true;
      return !suffixesToRemove.includes(word);
    });
    
    const mascot = filteredWords[filteredWords.length - 1];
    return mascot;
  };

  describe('extractMascotFromName', () => {
    test('should extract mascot from simple team name', () => {
      expect(extractMascotFromName('Duke Blue Devils')).toBe('devils');
      expect(extractMascotFromName('Kentucky Wildcats')).toBe('wildcats');
    });

    test('should remove "St" suffix and extract mascot', () => {
      expect(extractMascotFromName('St Marys Gaels')).toBe('gaels');
      expect(extractMascotFromName('St Johns Red Storm')).toBe('storm');
    });

    test('should remove "Saint" suffix and extract mascot', () => {
      expect(extractMascotFromName('Saint Marys Gaels')).toBe('gaels');
      expect(extractMascotFromName('Saint Johns Red Storm')).toBe('storm');
    });

    test('should remove "State" suffix and extract mascot', () => {
      expect(extractMascotFromName('Michigan State Spartans')).toBe('spartans');
      expect(extractMascotFromName('Ohio State Buckeyes')).toBe('buckeyes');
    });

    test('should remove "University" suffix and extract mascot', () => {
      expect(extractMascotFromName('Boston University Terriers')).toBe('terriers');
    });

    test('should remove "College" suffix and extract mascot', () => {
      expect(extractMascotFromName('Boston College Eagles')).toBe('eagles');
    });

    test('should handle apostrophes and special characters', () => {
      expect(extractMascotFromName("St. Mary's Gaels")).toBe('gaels');
      expect(extractMascotFromName("Saint Mary's Rattlers")).toBe('rattlers');
    });

    test('should handle multiple suffixes', () => {
      expect(extractMascotFromName('Louisiana State University Tigers')).toBe('tigers');
    });

    test('should handle empty or null input', () => {
      expect(extractMascotFromName('')).toBe('');
      expect(extractMascotFromName(null)).toBe('');
      expect(extractMascotFromName(undefined)).toBe('');
    });

    test('should handle single word team names', () => {
      expect(extractMascotFromName('Heat')).toBe('heat');
      expect(extractMascotFromName('Jazz')).toBe('jazz');
    });
  });

  describe('Enhanced mascot matching with .includes()', () => {
    const teamsMatchHelper = (team1, team2) => {
      if (!team1 || !team2) return { match: false, method: null };
      
      if (team1.toLowerCase() === team2.toLowerCase()) {
        return { match: true, method: 'Exact' };
      }
      
      const mascot1 = extractMascotFromName(team1);
      const mascot2 = extractMascotFromName(team2);
      
      if (mascot1 && mascot2 && mascot1.length > 2 && mascot2.length > 2) {
        if (mascot1 === mascot2) {
          return { match: true, method: 'Mascot' };
        }
        const clean1 = team1.toLowerCase();
        const clean2 = team2.toLowerCase();
        if (clean1.includes(mascot2) || clean2.includes(mascot1)) {
          return { match: true, method: 'Mascot' };
        }
      }
      
      return { match: false, method: null };
    };

    test('should match exact team names', () => {
      const result = teamsMatchHelper('Duke Blue Devils', 'Duke Blue Devils');
      expect(result.match).toBe(true);
      expect(result.method).toBe('Exact');
    });

    test('should match teams with same mascot', () => {
      const result = teamsMatchHelper('St. Marys Gaels', 'Saint Marys Gaels');
      expect(result.match).toBe(true);
      expect(result.method).toBe('Mascot');
    });

    test('should match when mascot is included in full name', () => {
      const result = teamsMatchHelper('Kentucky Wildcats', 'Wildcats');
      expect(result.match).toBe(true);
      expect(result.method).toBe('Mascot');
    });

    test('should match college teams with different formatting', () => {
      const result = teamsMatchHelper('Michigan State Spartans', 'Spartans');
      expect(result.match).toBe(true);
      expect(result.method).toBe('Mascot');
    });

    test('should not match teams with different mascots', () => {
      const result = teamsMatchHelper('Duke Blue Devils', 'Kentucky Wildcats');
      expect(result.match).toBe(false);
    });

    test('should handle short mascots correctly', () => {
      // Short mascots (length <= 2) should not use .includes() matching
      const result = teamsMatchHelper('Boston College BC', 'BC');
      expect(result.match).toBe(false); // 'bc' is only 2 chars, won't match
    });
  });
});
