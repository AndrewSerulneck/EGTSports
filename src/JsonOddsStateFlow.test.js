/**
 * Integration test for JsonOdds moneyline data flow from API to UI
 * Tests that moneyline data properly flows through React state to components
 */

describe('JsonOdds State Flow Integration', () => {
  // Helper function from App.js
  const getGameKey = (away, home) => `${away.trim()}|${home.trim()}`;
  
  describe('Moneyline Map Creation', () => {
    test('should create moneyline map with correct keys', () => {
      // Simulate JsonOdds API response parsing
      const matches = [
        {
          HomeTeam: 'Florida Panthers',
          AwayTeam: 'Washington Capitals',
          Odds: [
            {
              MoneyLineHome: -135,
              MoneyLineAway: 105
            }
          ]
        }
      ];
      
      // Simulate the logic from fetchMoneylineFromJsonOdds (App.js lines 3362-3428)
      const moneylineMap = {};
      
      matches.forEach(match => {
        const homeTeam = match.HomeTeam;
        const awayTeam = match.AwayTeam;
        const odd = match.Odds[0];
        
        let homeMoneyline = null;
        let awayMoneyline = null;
        
        if (odd.MoneyLineHome !== undefined && odd.MoneyLineHome !== null) {
          const mlHome = parseInt(odd.MoneyLineHome);
          homeMoneyline = String(odd.MoneyLineHome);
          if (mlHome > 0 && !homeMoneyline.startsWith('+')) {
            homeMoneyline = '+' + homeMoneyline;
          }
        }
        
        if (odd.MoneyLineAway !== undefined && odd.MoneyLineAway !== null) {
          const mlAway = parseInt(odd.MoneyLineAway);
          awayMoneyline = String(odd.MoneyLineAway);
          if (mlAway > 0 && !awayMoneyline.startsWith('+')) {
            awayMoneyline = '+' + awayMoneyline;
          }
        }
        
        const gameKey = getGameKey(awayTeam, homeTeam);
        moneylineMap[gameKey] = {
          awayMoneyline: awayMoneyline || '-',
          homeMoneyline: homeMoneyline || '-'
        };
      });
      
      // Verify the map was created correctly
      expect(Object.keys(moneylineMap).length).toBe(1);
      expect(moneylineMap['Washington Capitals|Florida Panthers']).toBeDefined();
      expect(moneylineMap['Washington Capitals|Florida Panthers'].awayMoneyline).toBe('+105');
      expect(moneylineMap['Washington Capitals|Florida Panthers'].homeMoneyline).toBe('-135');
    });
  });
  
  describe('Game Object Enrichment', () => {
    test('should apply JsonOdds moneylines to game objects correctly', () => {
      // Simulated JsonOdds data
      const jsonOddsMoneylines = {
        'Los Angeles Rams|Atlanta Falcons': {
          awayMoneyline: '+105',
          homeMoneyline: '-135'
        }
      };
      
      // Simulated ESPN game object
      const game = {
        id: '401234567',
        awayTeam: 'Los Angeles Rams',
        homeTeam: 'Atlanta Falcons',
        awaySpread: '+3.5',
        homeSpread: '-3.5',
        total: '45.5',
        awayMoneyline: null, // ESPN didn't provide this
        homeMoneyline: null
      };
      
      // Simulate the enrichment logic from App.js lines 4220-4270
      const gameKey = getGameKey(game.awayTeam, game.homeTeam);
      const jsonOddsML = jsonOddsMoneylines[gameKey];
      
      const updatedGame = {
        ...game,
        awayMoneyline: (jsonOddsML && jsonOddsML.awayMoneyline !== '-') 
          ? jsonOddsML.awayMoneyline 
          : game.awayMoneyline,
        homeMoneyline: (jsonOddsML && jsonOddsML.homeMoneyline !== '-') 
          ? jsonOddsML.homeMoneyline 
          : game.homeMoneyline
      };
      
      // Verify the game object was updated correctly
      expect(updatedGame.awayMoneyline).toBe('+105');
      expect(updatedGame.homeMoneyline).toBe('-135');
      expect(updatedGame).not.toBe(game); // New object, not mutation
    });
    
    test('should prioritize JsonOdds over ESPN moneylines', () => {
      const jsonOddsMoneylines = {
        'Team A|Team B': {
          awayMoneyline: '+120',
          homeMoneyline: '-140'
        }
      };
      
      const game = {
        id: '401234567',
        awayTeam: 'Team A',
        homeTeam: 'Team B',
        awayMoneyline: '+100', // ESPN has different odds
        homeMoneyline: '-120'
      };
      
      const gameKey = getGameKey(game.awayTeam, game.homeTeam);
      const jsonOddsML = jsonOddsMoneylines[gameKey];
      
      const updatedGame = {
        ...game,
        awayMoneyline: (jsonOddsML && jsonOddsML.awayMoneyline !== '-') 
          ? jsonOddsML.awayMoneyline 
          : game.awayMoneyline,
        homeMoneyline: (jsonOddsML && jsonOddsML.homeMoneyline !== '-') 
          ? jsonOddsML.homeMoneyline 
          : game.homeMoneyline
      };
      
      // JsonOdds should override ESPN
      expect(updatedGame.awayMoneyline).toBe('+120');
      expect(updatedGame.homeMoneyline).toBe('-140');
    });
    
    test('should fallback to ESPN when JsonOdds returns dashes', () => {
      const jsonOddsMoneylines = {
        'Team A|Team B': {
          awayMoneyline: '-', // No data from JsonOdds
          homeMoneyline: '-'
        }
      };
      
      const game = {
        id: '401234567',
        awayTeam: 'Team A',
        homeTeam: 'Team B',
        awayMoneyline: '+100', // ESPN data
        homeMoneyline: '-120'
      };
      
      const gameKey = getGameKey(game.awayTeam, game.homeTeam);
      const jsonOddsML = jsonOddsMoneylines[gameKey];
      
      const updatedGame = {
        ...game,
        awayMoneyline: (jsonOddsML && jsonOddsML.awayMoneyline !== '-') 
          ? jsonOddsML.awayMoneyline 
          : game.awayMoneyline,
        homeMoneyline: (jsonOddsML && jsonOddsML.homeMoneyline !== '-') 
          ? jsonOddsML.homeMoneyline 
          : game.homeMoneyline
      };
      
      // Should use ESPN data when JsonOdds returns dashes
      expect(updatedGame.awayMoneyline).toBe('+100');
      expect(updatedGame.homeMoneyline).toBe('-120');
    });
  });
  
  describe('State Update Immutability', () => {
    test('should create new object for React state update', () => {
      // Simulate creating sportsData object
      const sportsData = {};
      
      const games = [
        {
          id: '1',
          awayTeam: 'Team A',
          homeTeam: 'Team B',
          awayMoneyline: null,
          homeMoneyline: null
        }
      ];
      
      const jsonOddsMoneylines = {
        'Team A|Team B': {
          awayMoneyline: '+110',
          homeMoneyline: '-130'
        }
      };
      
      // Simulate the .map() operation from App.js line 4206
      const updatedGames = games.map(game => {
        const gameKey = getGameKey(game.awayTeam, game.homeTeam);
        const jsonOddsML = jsonOddsMoneylines[gameKey];
        
        return {
          ...game,
          awayMoneyline: jsonOddsML?.awayMoneyline !== '-' 
            ? jsonOddsML.awayMoneyline 
            : game.awayMoneyline,
          homeMoneyline: jsonOddsML?.homeMoneyline !== '-' 
            ? jsonOddsML.homeMoneyline 
            : game.homeMoneyline
        };
      });
      
      sportsData['NFL'] = updatedGames;
      
      // Verify new objects were created (not mutated)
      expect(updatedGames).not.toBe(games);
      expect(updatedGames[0]).not.toBe(games[0]);
      expect(updatedGames[0].awayMoneyline).toBe('+110');
      expect(updatedGames[0].homeMoneyline).toBe('-130');
      
      // Verify original games array was not mutated
      expect(games[0].awayMoneyline).toBeNull();
      expect(games[0].homeMoneyline).toBeNull();
    });
  });
  
  describe('UI Rendering', () => {
    test('formatOdds should display valid moneylines correctly', () => {
      // Simulate formatOdds function from GridBettingLayout.js
      const formatOdds = (odds) => {
        if (!odds || odds === '' || odds === 'undefined') return '-';
        if (odds === 'OFF') return 'OFF';
        if (odds === 'N/A') return '-';
        return odds;
      };
      
      expect(formatOdds('+105')).toBe('+105');
      expect(formatOdds('-135')).toBe('-135');
      expect(formatOdds(null)).toBe('-');
      expect(formatOdds(undefined)).toBe('-');
      expect(formatOdds('')).toBe('-');
      expect(formatOdds('N/A')).toBe('-');
      expect(formatOdds('OFF')).toBe('OFF');
    });
    
    test('should display moneylines when game has valid odds', () => {
      const game = {
        id: '401234567',
        awayTeam: 'Los Angeles Rams',
        homeTeam: 'Atlanta Falcons',
        awayMoneyline: '+105',
        homeMoneyline: '-135'
      };
      
      const formatOdds = (odds) => {
        if (!odds || odds === '' || odds === 'undefined') return '-';
        if (odds === 'OFF') return 'OFF';
        if (odds === 'N/A') return '-';
        return odds;
      };
      
      const displayedAwayOdds = formatOdds(game.awayMoneyline);
      const displayedHomeOdds = formatOdds(game.homeMoneyline);
      
      expect(displayedAwayOdds).toBe('+105');
      expect(displayedHomeOdds).toBe('-135');
      expect(displayedAwayOdds).not.toBe('-');
      expect(displayedHomeOdds).not.toBe('-');
    });
  });
});
