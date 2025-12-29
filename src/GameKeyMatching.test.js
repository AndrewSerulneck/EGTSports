/**
 * Integration tests for game key matching between JsonOdds API and ESPN data
 * Tests real-world scenarios where team names differ between data sources
 */

describe('Game Key Matching Integration', () => {
  // Replicate the helper function
  const getGameKey = (away, home) => `${away.trim()}|${home.trim()}`;
  
  describe('Exact Match Scenarios', () => {
    test('should match when team names are identical', () => {
      // JsonOdds stores with these exact names
      const jsonOddsData = {
        [getGameKey('Lakers', 'Celtics')]: {
          awayMoneyline: '+150',
          homeMoneyline: '-175'
        }
      };
      
      // ESPN/local data has same names
      const game = {
        awayTeam: 'Lakers',
        homeTeam: 'Celtics'
      };
      
      const gameKey = getGameKey(game.awayTeam, game.homeTeam);
      const match = jsonOddsData[gameKey];
      
      expect(match).toBeDefined();
      expect(match.awayMoneyline).toBe('+150');
      expect(match.homeMoneyline).toBe('-175');
    });
    
    test('should match with extra whitespace trimmed', () => {
      const jsonOddsData = {
        [getGameKey('  Lakers  ', '  Celtics  ')]: {
          awayMoneyline: '+150',
          homeMoneyline: '-175'
        }
      };
      
      const game = {
        awayTeam: 'Lakers',
        homeTeam: 'Celtics'
      };
      
      const gameKey = getGameKey(game.awayTeam, game.homeTeam);
      const match = jsonOddsData[gameKey];
      
      expect(match).toBeDefined();
    });
  });
  
  describe('Fuzzy Match Scenarios', () => {
    test('should match when local name is more specific than API name', () => {
      // JsonOdds returns short name
      const jsonOddsData = {
        [getGameKey('Rams', '49ers')]: {
          awayMoneyline: '+120',
          homeMoneyline: '-140'
        }
      };
      
      // ESPN has full city names
      const game = {
        awayTeam: 'Los Angeles Rams',
        homeTeam: 'San Francisco 49ers'
      };
      
      // Exact match will fail
      const exactKey = getGameKey(game.awayTeam, game.homeTeam);
      expect(jsonOddsData[exactKey]).toBeUndefined();
      
      // But fuzzy match should work
      let jsonOddsML = null;
      for (const [key, value] of Object.entries(jsonOddsData)) {
        const [oddsAway, oddsHome] = key.split('|');
        
        const awayLower = game.awayTeam.toLowerCase();
        const homeLower = game.homeTeam.toLowerCase();
        const oddsAwayLower = oddsAway.toLowerCase();
        const oddsHomeLower = oddsHome.toLowerCase();
        
        const awayMatch = awayLower.includes(oddsAwayLower) || oddsAwayLower.includes(awayLower);
        const homeMatch = homeLower.includes(oddsHomeLower) || oddsHomeLower.includes(homeLower);
        
        if (awayMatch && homeMatch) {
          jsonOddsML = value;
          break;
        }
      }
      
      expect(jsonOddsML).toBeDefined();
      expect(jsonOddsML.awayMoneyline).toBe('+120');
      expect(jsonOddsML.homeMoneyline).toBe('-140');
    });
    
    test('should match when API name is more specific than local name', () => {
      // JsonOdds returns full name
      const jsonOddsData = {
        [getGameKey('Los Angeles Lakers', 'Boston Celtics')]: {
          awayMoneyline: '+150',
          homeMoneyline: '-175'
        }
      };
      
      // ESPN has short names
      const game = {
        awayTeam: 'Lakers',
        homeTeam: 'Celtics'
      };
      
      // Fuzzy match should work
      let jsonOddsML = null;
      for (const [key, value] of Object.entries(jsonOddsData)) {
        const [oddsAway, oddsHome] = key.split('|');
        
        const awayLower = game.awayTeam.toLowerCase();
        const homeLower = game.homeTeam.toLowerCase();
        const oddsAwayLower = oddsAway.toLowerCase();
        const oddsHomeLower = oddsHome.toLowerCase();
        
        const awayMatch = awayLower.includes(oddsAwayLower) || oddsAwayLower.includes(awayLower);
        const homeMatch = homeLower.includes(oddsHomeLower) || oddsHomeLower.includes(homeLower);
        
        if (awayMatch && homeMatch) {
          jsonOddsML = value;
          break;
        }
      }
      
      expect(jsonOddsML).toBeDefined();
      expect(jsonOddsML.awayMoneyline).toBe('+150');
    });
    
    test('should match NFL teams with city variations', () => {
      const jsonOddsData = {
        [getGameKey('Cowboys', 'Eagles')]: {
          awayMoneyline: '+110',
          homeMoneyline: '-130'
        }
      };
      
      const game = {
        awayTeam: 'Dallas Cowboys',
        homeTeam: 'Philadelphia Eagles'
      };
      
      let jsonOddsML = null;
      for (const [key, value] of Object.entries(jsonOddsData)) {
        const [oddsAway, oddsHome] = key.split('|');
        
        const awayLower = game.awayTeam.toLowerCase();
        const homeLower = game.homeTeam.toLowerCase();
        const oddsAwayLower = oddsAway.toLowerCase();
        const oddsHomeLower = oddsHome.toLowerCase();
        
        const awayMatch = awayLower.includes(oddsAwayLower) || oddsAwayLower.includes(awayLower);
        const homeMatch = homeLower.includes(oddsHomeLower) || oddsHomeLower.includes(homeLower);
        
        if (awayMatch && homeMatch) {
          jsonOddsML = value;
          break;
        }
      }
      
      expect(jsonOddsML).toBeDefined();
    });
    
    test('should not match completely different teams', () => {
      const jsonOddsData = {
        [getGameKey('Lakers', 'Celtics')]: {
          awayMoneyline: '+150',
          homeMoneyline: '-175'
        }
      };
      
      const game = {
        awayTeam: 'Warriors',
        homeTeam: 'Heat'
      };
      
      let jsonOddsML = null;
      for (const [key, value] of Object.entries(jsonOddsData)) {
        const [oddsAway, oddsHome] = key.split('|');
        
        const awayLower = game.awayTeam.toLowerCase();
        const homeLower = game.homeTeam.toLowerCase();
        const oddsAwayLower = oddsAway.toLowerCase();
        const oddsHomeLower = oddsHome.toLowerCase();
        
        const awayMatch = awayLower.includes(oddsAwayLower) || oddsAwayLower.includes(awayLower);
        const homeMatch = homeLower.includes(oddsHomeLower) || oddsHomeLower.includes(homeLower);
        
        if (awayMatch && homeMatch) {
          jsonOddsML = value;
          break;
        }
      }
      
      expect(jsonOddsML).toBeNull();
    });
  });
  
  describe('Priority Layering', () => {
    test('should prioritize JsonOdds over The Odds API when both exist', () => {
      const game = {
        awayMoneyline: '+100', // ESPN
        homeMoneyline: '-120'
      };
      
      const oddsApiData = {
        awayMoneyline: '+110', // The Odds API
        homeMoneyline: '-130'
      };
      
      const jsonOddsML = {
        awayMoneyline: '+120', // JsonOdds (should win)
        homeMoneyline: '-140'
      };
      
      // Priority logic from App.js
      const finalAwayML = (jsonOddsML && jsonOddsML.awayMoneyline !== '-') 
        ? jsonOddsML.awayMoneyline 
        : (oddsApiData.awayMoneyline || game.awayMoneyline);
      
      const finalHomeML = (jsonOddsML && jsonOddsML.homeMoneyline !== '-') 
        ? jsonOddsML.homeMoneyline 
        : (oddsApiData.homeMoneyline || game.homeMoneyline);
      
      expect(finalAwayML).toBe('+120');
      expect(finalHomeML).toBe('-140');
    });
    
    test('should fallback to The Odds API when JsonOdds returns dash', () => {
      const game = {
        awayMoneyline: null,
        homeMoneyline: null
      };
      
      const oddsApiData = {
        awayMoneyline: '+110',
        homeMoneyline: '-130'
      };
      
      const jsonOddsML = {
        awayMoneyline: '-', // JsonOdds has no data
        homeMoneyline: '-'
      };
      
      const finalAwayML = (jsonOddsML && jsonOddsML.awayMoneyline !== '-') 
        ? jsonOddsML.awayMoneyline 
        : (oddsApiData.awayMoneyline || game.awayMoneyline);
      
      expect(finalAwayML).toBe('+110');
    });
  });
  
  describe('Real-World Team Name Variations', () => {
    test('should handle NBA team variations', () => {
      const variations = [
        { api: '76ers', local: 'Philadelphia 76ers' },
        { api: 'Trail Blazers', local: 'Portland Trail Blazers' },
        { api: 'Clippers', local: 'LA Clippers' },
        { api: 'Lakers', local: 'Los Angeles Lakers' }
      ];
      
      variations.forEach(({ api, local }) => {
        const apiLower = api.toLowerCase();
        const localLower = local.toLowerCase();
        
        const match = localLower.includes(apiLower) || apiLower.includes(localLower);
        expect(match).toBe(true);
      });
    });
    
    test('should handle NFL team variations', () => {
      const variations = [
        { api: 'Packers', local: 'Green Bay Packers' },
        { api: 'Saints', local: 'New Orleans Saints' },
        { api: 'Buccaneers', local: 'Tampa Bay Buccaneers' },
        { api: 'Chiefs', local: 'Kansas City Chiefs' }
      ];
      
      variations.forEach(({ api, local }) => {
        const apiLower = api.toLowerCase();
        const localLower = local.toLowerCase();
        
        const match = localLower.includes(apiLower) || apiLower.includes(localLower);
        expect(match).toBe(true);
      });
    });
  });
});
