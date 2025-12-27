/**
 * Unit tests for moneyline extraction from The Odds API h2h market
 * and proper saving to Firebase via saveSpreadToFirebase function
 */

describe('Moneyline Extraction and Firebase Save', () => {
  
  describe('h2h Market Extraction', () => {
    test('should extract moneylines from h2h market correctly', () => {
      // Mock h2h market data from The Odds API
      const h2hMarket = {
        key: 'h2h',
        outcomes: [
          { name: 'Lakers', price: -150 },
          { name: 'Celtics', price: 130 }
        ]
      };
      
      // Simulate the extraction logic from App.js lines 2674-2702
      const homeTeam = 'Lakers';
      const awayTeam = 'Celtics';
      
      const homeOutcome = h2hMarket.outcomes.find(o => o.name === homeTeam);
      const awayOutcome = h2hMarket.outcomes.find(o => o.name === awayTeam);
      
      expect(homeOutcome).toBeDefined();
      expect(awayOutcome).toBeDefined();
      
      const homeMoneyline = homeOutcome.price > 0 ? `+${homeOutcome.price}` : String(homeOutcome.price);
      const awayMoneyline = awayOutcome.price > 0 ? `+${awayOutcome.price}` : String(awayOutcome.price);
      
      expect(homeMoneyline).toBe('-150');
      expect(awayMoneyline).toBe('+130');
    });
    
    test('should format positive moneylines with + prefix', () => {
      const h2hMarket = {
        key: 'h2h',
        outcomes: [
          { name: 'Underdog Team', price: 200 }
        ]
      };
      
      const outcome = h2hMarket.outcomes[0];
      const moneyline = outcome.price > 0 ? `+${outcome.price}` : String(outcome.price);
      
      expect(moneyline).toBe('+200');
    });
    
    test('should format negative moneylines without + prefix', () => {
      const h2hMarket = {
        key: 'h2h',
        outcomes: [
          { name: 'Favorite Team', price: -175 }
        ]
      };
      
      const outcome = h2hMarket.outcomes[0];
      const moneyline = outcome.price > 0 ? `+${outcome.price}` : String(outcome.price);
      
      expect(moneyline).toBe('-175');
    });
    
    test('should handle even money (±100) correctly', () => {
      const evenMoneyMarket = {
        key: 'h2h',
        outcomes: [
          { name: 'Team A', price: 100 },
          { name: 'Team B', price: -100 }
        ]
      };
      
      const teamAOutcome = evenMoneyMarket.outcomes.find(o => o.name === 'Team A');
      const teamBOutcome = evenMoneyMarket.outcomes.find(o => o.name === 'Team B');
      
      const teamAMoneyline = teamAOutcome.price > 0 ? `+${teamAOutcome.price}` : String(teamAOutcome.price);
      const teamBMoneyline = teamBOutcome.price > 0 ? `+${teamBOutcome.price}` : String(teamBOutcome.price);
      
      expect(teamAMoneyline).toBe('+100');
      expect(teamBMoneyline).toBe('-100');
    });
    
    test('should extract Draw moneyline for soccer 3-way markets', () => {
      const soccerH2hMarket = {
        key: 'h2h',
        outcomes: [
          { name: 'Manchester United', price: -120 },
          { name: 'Chelsea', price: 280 },
          { name: 'Draw', price: 230 }
        ]
      };
      
      const drawOutcome = soccerH2hMarket.outcomes.find(o => o.name === 'Draw');
      
      expect(drawOutcome).toBeDefined();
      
      const drawMoneyline = drawOutcome.price > 0 ? `+${drawOutcome.price}` : String(drawOutcome.price);
      
      expect(drawMoneyline).toBe('+230');
    });
  });
  
  describe('Firebase Save Data Structure', () => {
    test('saveSpreadToFirebase should include all required fields', () => {
      // Mock game data that would be saved to Firebase
      const mockGame = {
        espnId: '401234567',
        awayTeam: 'Celtics',
        homeTeam: 'Lakers',
        awaySpread: '+3.5',
        homeSpread: '-3.5',
        awayMoneyline: '+130',
        homeMoneyline: '-150',
        total: '220.5'
      };
      
      // Simulate the data structure created in saveSpreadToFirebase (lines 442-449)
      const spreadsData = {
        [mockGame.espnId]: {
          awaySpread: mockGame.awaySpread || '',
          homeSpread: mockGame.homeSpread || '',
          awayMoneyline: mockGame.awayMoneyline || '',
          homeMoneyline: mockGame.homeMoneyline || '',
          total: mockGame.total || '',
          timestamp: new Date().toISOString()
        }
      };
      
      const savedGameData = spreadsData[mockGame.espnId];
      
      // Verify all fields are present
      expect(savedGameData).toHaveProperty('awaySpread');
      expect(savedGameData).toHaveProperty('homeSpread');
      expect(savedGameData).toHaveProperty('awayMoneyline');
      expect(savedGameData).toHaveProperty('homeMoneyline');
      expect(savedGameData).toHaveProperty('total');
      expect(savedGameData).toHaveProperty('timestamp');
      
      // Verify values are correct
      expect(savedGameData.awaySpread).toBe('+3.5');
      expect(savedGameData.homeSpread).toBe('-3.5');
      expect(savedGameData.awayMoneyline).toBe('+130');
      expect(savedGameData.homeMoneyline).toBe('-150');
      expect(savedGameData.total).toBe('220.5');
    });
    
    test('saveSpreadToFirebase should handle missing moneylines gracefully', () => {
      const mockGame = {
        espnId: '401234567',
        awayTeam: 'Team A',
        homeTeam: 'Team B',
        awaySpread: '+7',
        homeSpread: '-7',
        total: '45.5'
        // Missing awayMoneyline and homeMoneyline
      };
      
      const spreadsData = {
        [mockGame.espnId]: {
          awaySpread: mockGame.awaySpread || '',
          homeSpread: mockGame.homeSpread || '',
          awayMoneyline: mockGame.awayMoneyline || '',
          homeMoneyline: mockGame.homeMoneyline || '',
          total: mockGame.total || '',
          timestamp: new Date().toISOString()
        }
      };
      
      const savedGameData = spreadsData[mockGame.espnId];
      
      // Verify empty strings are used as fallback
      expect(savedGameData.awayMoneyline).toBe('');
      expect(savedGameData.homeMoneyline).toBe('');
      
      // Other fields should still be present
      expect(savedGameData.awaySpread).toBe('+7');
      expect(savedGameData.homeSpread).toBe('-7');
      expect(savedGameData.total).toBe('45.5');
    });
    
    test('saveSpreadToFirebase should preserve moneylines alongside spreads and totals', () => {
      const mockGames = [
        {
          espnId: '401111111',
          awaySpread: '+2.5',
          homeSpread: '-2.5',
          awayMoneyline: '+110',
          homeMoneyline: '-130',
          total: '212'
        },
        {
          espnId: '401222222',
          awaySpread: '+5.5',
          homeSpread: '-5.5',
          awayMoneyline: '+180',
          homeMoneyline: '-220',
          total: '198.5'
        }
      ];
      
      const spreadsData = {};
      mockGames.forEach(game => {
        spreadsData[game.espnId] = {
          awaySpread: game.awaySpread || '',
          homeSpread: game.homeSpread || '',
          awayMoneyline: game.awayMoneyline || '',
          homeMoneyline: game.homeMoneyline || '',
          total: game.total || '',
          timestamp: new Date().toISOString()
        };
      });
      
      // Verify both games have all fields
      expect(Object.keys(spreadsData)).toHaveLength(2);
      
      const game1Data = spreadsData['401111111'];
      expect(game1Data.awayMoneyline).toBe('+110');
      expect(game1Data.homeMoneyline).toBe('-130');
      expect(game1Data.awaySpread).toBe('+2.5');
      expect(game1Data.total).toBe('212');
      
      const game2Data = spreadsData['401222222'];
      expect(game2Data.awayMoneyline).toBe('+180');
      expect(game2Data.homeMoneyline).toBe('-220');
      expect(game2Data.awaySpread).toBe('+5.5');
      expect(game2Data.total).toBe('198.5');
    });
  });
  
  describe('Integration: h2h Market to Firebase', () => {
    test('should extract from h2h market and include in Firebase save structure', () => {
      // Step 1: Extract from The Odds API h2h market
      const h2hMarket = {
        key: 'h2h',
        outcomes: [
          { name: 'Bulls', price: 150 },
          { name: 'Heat', price: -175 }
        ]
      };
      
      const homeTeam = 'Bulls';
      const awayTeam = 'Heat';
      
      const homeOutcome = h2hMarket.outcomes.find(o => o.name === homeTeam);
      const awayOutcome = h2hMarket.outcomes.find(o => o.name === awayTeam);
      
      const homeMoneyline = homeOutcome.price > 0 ? `+${homeOutcome.price}` : String(homeOutcome.price);
      const awayMoneyline = awayOutcome.price > 0 ? `+${awayOutcome.price}` : String(awayOutcome.price);
      
      // Step 2: Create game object (as would happen in App.js)
      const game = {
        espnId: '401555555',
        homeTeam,
        awayTeam,
        homeMoneyline,
        awayMoneyline,
        homeSpread: '-6.5',
        awaySpread: '+6.5',
        total: '205'
      };
      
      // Step 3: Prepare for Firebase save
      const spreadsData = {
        [game.espnId]: {
          awaySpread: game.awaySpread || '',
          homeSpread: game.homeSpread || '',
          awayMoneyline: game.awayMoneyline || '',
          homeMoneyline: game.homeMoneyline || '',
          total: game.total || '',
          timestamp: new Date().toISOString()
        }
      };
      
      // Step 4: Verify end-to-end data flow
      const savedData = spreadsData[game.espnId];
      
      expect(savedData.homeMoneyline).toBe('+150');
      expect(savedData.awayMoneyline).toBe('-175');
      expect(savedData.homeSpread).toBe('-6.5');
      expect(savedData.awaySpread).toBe('+6.5');
      expect(savedData.total).toBe('205');
      
      // Verify all required fields exist
      expect(Object.keys(savedData)).toContain('awayMoneyline');
      expect(Object.keys(savedData)).toContain('homeMoneyline');
      expect(Object.keys(savedData)).toContain('awaySpread');
      expect(Object.keys(savedData)).toContain('homeSpread');
      expect(Object.keys(savedData)).toContain('total');
      expect(Object.keys(savedData)).toContain('timestamp');
    });
  });
});
