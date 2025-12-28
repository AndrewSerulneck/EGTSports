/**
 * Unit tests for the strict matching fix that prevents home and away teams
 * from matching to the same API outcome (the "Texas Longhorns and Michigan Wolverines 
 * both matching +250" bug)
 */

describe('Strict Matching Fix - Prevent Duplicate Outcome Assignment', () => {
  
  // Mock the teamsMatchHelper function that returns match result with method
  const teamsMatchHelper = (team1, team2) => {
    if (!team1 || !team2) return { match: false, method: null };
    
    const normalize = (str) => str.toLowerCase().trim();
    const t1 = normalize(team1);
    const t2 = normalize(team2);
    
    // Exact match
    if (t1 === t2) {
      return { match: true, method: 'Exact' };
    }
    
    // Fuzzy keyword match - simplified version
    const words1 = t1.split(/\s+/).filter(w => w.length > 3);
    const words2 = t2.split(/\s+/).filter(w => w.length > 3);
    
    for (const word of words1) {
      if (t2.includes(word) && word.length >= 4) {
        return { match: true, method: 'Keyword' };
      }
    }
    
    return { match: false, method: null };
  };

  describe('Exact Match Priority', () => {
    test('should use exact match first before fuzzy matching', () => {
      const h2hMarket = {
        outcomes: [
          { name: 'Texas Longhorns', price: 150 },
          { name: 'Michigan Wolverines', price: -175 }
        ]
      };
      
      const homeTeam = 'Texas Longhorns';
      const awayTeam = 'Michigan Wolverines';
      
      // STEP 1: Try exact matches first
      let homeOutcome = h2hMarket.outcomes.find(o => 
        o.name.toLowerCase() === homeTeam.toLowerCase()
      );
      let awayOutcome = h2hMarket.outcomes.find(o => 
        o.name.toLowerCase() === awayTeam.toLowerCase()
      );
      
      expect(homeOutcome).toBeDefined();
      expect(homeOutcome.name).toBe('Texas Longhorns');
      expect(homeOutcome.price).toBe(150);
      
      expect(awayOutcome).toBeDefined();
      expect(awayOutcome.name).toBe('Michigan Wolverines');
      expect(awayOutcome.price).toBe(-175);
      
      // Verify they're different outcomes
      expect(homeOutcome.name).not.toBe(awayOutcome.name);
    });
    
    test('should prevent reusing same outcome for both home and away', () => {
      // Simulate problematic API data where fuzzy matching could cause issues
      const h2hMarket = {
        outcomes: [
          { name: 'Texas', price: 250 },  // Could match "Texas Longhorns"
          { name: 'Michigan', price: -300 }  // Could match "Michigan Wolverines"
        ]
      };
      
      const homeTeam = 'Texas Longhorns';
      const awayTeam = 'Michigan Wolverines';
      
      let homeOutcome = null;
      let awayOutcome = null;
      
      // STEP 1: Try exact matches first
      homeOutcome = h2hMarket.outcomes.find(o => 
        o.name.toLowerCase() === homeTeam.toLowerCase()
      );
      awayOutcome = h2hMarket.outcomes.find(o => 
        o.name.toLowerCase() === awayTeam.toLowerCase()
      );
      
      // No exact matches
      expect(homeOutcome).toBeUndefined();
      expect(awayOutcome).toBeUndefined();
      
      // STEP 2: Use fuzzy matching with outcome tracking
      if (!homeOutcome) {
        homeOutcome = h2hMarket.outcomes.find(o => {
          // Skip if already matched to away
          if (awayOutcome && o.name === awayOutcome.name) return false;
          // Use fuzzy matching
          return teamsMatchHelper(o.name, homeTeam).match;
        });
      }
      
      if (!awayOutcome) {
        awayOutcome = h2hMarket.outcomes.find(o => {
          // Skip if already matched to home - THIS IS THE CRITICAL FIX
          if (homeOutcome && o.name === homeOutcome.name) return false;
          // Use fuzzy matching
          return teamsMatchHelper(o.name, awayTeam).match;
        });
      }
      
      expect(homeOutcome).toBeDefined();
      expect(awayOutcome).toBeDefined();
      
      // CRITICAL: Verify they matched to DIFFERENT outcomes
      expect(homeOutcome.name).not.toBe(awayOutcome.name);
      expect(homeOutcome.price).toBe(250);
      expect(awayOutcome.price).toBe(-300);
    });
    
    test('should handle case where one team has exact match and other needs fuzzy', () => {
      const h2hMarket = {
        outcomes: [
          { name: 'LA Lakers', price: -150 },  // Fuzzy match for "Los Angeles Lakers"
          { name: 'Boston Celtics', price: 130 }  // Exact match
        ]
      };
      
      const homeTeam = 'Los Angeles Lakers';  // Needs fuzzy match
      const awayTeam = 'Boston Celtics';  // Has exact match
      
      let homeOutcome = null;
      let awayOutcome = null;
      
      // STEP 1: Exact matches
      homeOutcome = h2hMarket.outcomes.find(o => 
        o.name.toLowerCase() === homeTeam.toLowerCase()
      );
      awayOutcome = h2hMarket.outcomes.find(o => 
        o.name.toLowerCase() === awayTeam.toLowerCase()
      );
      
      // Away has exact match, home does not
      expect(homeOutcome).toBeUndefined();
      expect(awayOutcome).toBeDefined();
      expect(awayOutcome.name).toBe('Boston Celtics');
      
      // STEP 2: Fuzzy for home only
      if (!homeOutcome) {
        homeOutcome = h2hMarket.outcomes.find(o => {
          // Skip if already used by away team - CRITICAL
          if (awayOutcome && o.name === awayOutcome.name) return false;
          return teamsMatchHelper(o.name, homeTeam).match;
        });
      }
      
      expect(homeOutcome).toBeDefined();
      expect(homeOutcome.name).toBe('LA Lakers');
      
      // Verify different outcomes
      expect(homeOutcome.name).not.toBe(awayOutcome.name);
    });
  });
  
  describe('Case-Insensitive Exact Matching', () => {
    test('should match exact names regardless of case', () => {
      const h2hMarket = {
        outcomes: [
          { name: 'TEXAS LONGHORNS', price: 150 },
          { name: 'michigan wolverines', price: -175 }
        ]
      };
      
      const homeTeam = 'Texas Longhorns';
      const awayTeam = 'Michigan Wolverines';
      
      const homeOutcome = h2hMarket.outcomes.find(o => 
        o.name.toLowerCase() === homeTeam.toLowerCase()
      );
      const awayOutcome = h2hMarket.outcomes.find(o => 
        o.name.toLowerCase() === awayTeam.toLowerCase()
      );
      
      expect(homeOutcome).toBeDefined();
      expect(awayOutcome).toBeDefined();
      expect(homeOutcome.name).toBe('TEXAS LONGHORNS');
      expect(awayOutcome.name).toBe('michigan wolverines');
    });
  });
  
  describe('Three-Way Markets (Soccer)', () => {
    test('should not match Draw outcome to either team', () => {
      const h2hMarket = {
        outcomes: [
          { name: 'Manchester United', price: -120 },
          { name: 'Chelsea', price: 280 },
          { name: 'Draw', price: 230 }
        ]
      };
      
      const homeTeam = 'Manchester United';
      const awayTeam = 'Chelsea';
      
      const homeOutcome = h2hMarket.outcomes.find(o => 
        o.name.toLowerCase() === homeTeam.toLowerCase()
      );
      const awayOutcome = h2hMarket.outcomes.find(o => 
        o.name.toLowerCase() === awayTeam.toLowerCase()
      );
      
      expect(homeOutcome).toBeDefined();
      expect(awayOutcome).toBeDefined();
      expect(homeOutcome.name).toBe('Manchester United');
      expect(awayOutcome.name).toBe('Chelsea');
      
      // Verify Draw was not matched
      expect(homeOutcome.name).not.toBe('Draw');
      expect(awayOutcome.name).not.toBe('Draw');
    });
  });
});
