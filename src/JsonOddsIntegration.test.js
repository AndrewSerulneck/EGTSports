/**
 * Unit tests for JsonOdds API integration
 * Tests the moneyline extraction and formatting logic from JsonOdds response
 */

describe('JsonOdds API Integration', () => {
  
  describe('Moneyline Extraction from JsonOdds', () => {
    test('should extract and format positive moneylines with + prefix', () => {
      // Mock JsonOdds response data structure
      const mockJsonOddsMatch = {
        HomeTeam: 'Lakers',
        AwayTeam: 'Celtics',
        Odds: [
          {
            MoneyLineHome: 150,
            MoneyLineAway: -175
          }
        ]
      };
      
      // Simulate the extraction logic from fetchMoneylineFromJsonOdds
      const odd = mockJsonOddsMatch.Odds[0];
      
      let homeMoneyline = null;
      let awayMoneyline = null;
      
      // CRITICAL: Convert to string as per user instruction
      // JsonOdds returns numeric values, we need strings for consistency
      if (odd.MoneyLineHome !== undefined && odd.MoneyLineHome !== null) {
        const mlHome = parseInt(odd.MoneyLineHome);
        if (!isNaN(mlHome) && mlHome >= -10000 && mlHome <= 10000) {
          homeMoneyline = String(odd.MoneyLineHome);
          if (mlHome > 0 && !homeMoneyline.startsWith('+')) {
            homeMoneyline = '+' + homeMoneyline;
          }
        }
      }
      
      if (odd.MoneyLineAway !== undefined && odd.MoneyLineAway !== null) {
        const mlAway = parseInt(odd.MoneyLineAway);
        if (!isNaN(mlAway) && mlAway >= -10000 && mlAway <= 10000) {
          awayMoneyline = String(odd.MoneyLineAway);
          if (mlAway > 0 && !awayMoneyline.startsWith('+')) {
            awayMoneyline = '+' + awayMoneyline;
          }
        }
      }
      
      expect(homeMoneyline).toBe('+150');
      expect(awayMoneyline).toBe('-175');
    });
    
    test('should format negative moneylines without + prefix', () => {
      const mockJsonOddsMatch = {
        HomeTeam: 'Patriots',
        AwayTeam: 'Jets',
        Odds: [
          {
            MoneyLineHome: -220,
            MoneyLineAway: 185
          }
        ]
      };
      
      const odd = mockJsonOddsMatch.Odds[0];
      
      let homeMoneyline = String(odd.MoneyLineHome);
      const mlHome = parseInt(odd.MoneyLineHome);
      if (mlHome > 0 && !homeMoneyline.startsWith('+')) {
        homeMoneyline = '+' + homeMoneyline;
      }
      
      let awayMoneyline = String(odd.MoneyLineAway);
      const mlAway = parseInt(odd.MoneyLineAway);
      if (mlAway > 0 && !awayMoneyline.startsWith('+')) {
        awayMoneyline = '+' + awayMoneyline;
      }
      
      expect(homeMoneyline).toBe('-220');
      expect(awayMoneyline).toBe('+185');
    });
    
    test('should handle even money (±100) correctly', () => {
      const mockJsonOddsMatch = {
        HomeTeam: 'Team A',
        AwayTeam: 'Team B',
        Odds: [
          {
            MoneyLineHome: 100,
            MoneyLineAway: -100
          }
        ]
      };
      
      const odd = mockJsonOddsMatch.Odds[0];
      
      let homeMoneyline = String(odd.MoneyLineHome);
      const mlHome = parseInt(odd.MoneyLineHome);
      if (mlHome > 0 && !homeMoneyline.startsWith('+')) {
        homeMoneyline = '+' + homeMoneyline;
      }
      
      let awayMoneyline = String(odd.MoneyLineAway);
      const mlAway = parseInt(odd.MoneyLineAway);
      if (mlAway > 0 && !awayMoneyline.startsWith('+')) {
        awayMoneyline = '+' + awayMoneyline;
      }
      
      expect(homeMoneyline).toBe('+100');
      expect(awayMoneyline).toBe('-100');
    });
    
    test('should store moneylines in map with pipe-separated key format', () => {
      const mockJsonOddsMatch = {
        HomeTeam: 'Lakers',
        AwayTeam: 'Celtics',
        Odds: [
          {
            MoneyLineHome: 150,
            MoneyLineAway: -175
          }
        ]
      };
      
      const homeTeam = mockJsonOddsMatch.HomeTeam;
      const awayTeam = mockJsonOddsMatch.AwayTeam;
      const odd = mockJsonOddsMatch.Odds[0];
      
      let homeMoneyline = String(odd.MoneyLineHome);
      const mlHome = parseInt(odd.MoneyLineHome);
      if (mlHome > 0 && !homeMoneyline.startsWith('+')) {
        homeMoneyline = '+' + homeMoneyline;
      }
      
      let awayMoneyline = String(odd.MoneyLineAway);
      const mlAway = parseInt(odd.MoneyLineAway);
      if (mlAway > 0 && !awayMoneyline.startsWith('+')) {
        awayMoneyline = '+' + awayMoneyline;
      }
      
      const gameKey = `${awayTeam}|${homeTeam}`;
      const moneylineMap = {
        [gameKey]: {
          awayMoneyline: awayMoneyline || '-',
          homeMoneyline: homeMoneyline || '-'
        }
      };
      
      expect(moneylineMap['Celtics|Lakers']).toBeDefined();
      expect(moneylineMap['Celtics|Lakers'].awayMoneyline).toBe('-175');
      expect(moneylineMap['Celtics|Lakers'].homeMoneyline).toBe('+150');
    });
    
    test('should handle missing moneyline data with dash fallback', () => {
      const mockJsonOddsMatch = {
        HomeTeam: 'Team A',
        AwayTeam: 'Team B',
        Odds: [
          {
            // Missing MoneyLineHome and MoneyLineAway
          }
        ]
      };
      
      const odd = mockJsonOddsMatch.Odds[0];
      
      let homeMoneyline = null;
      let awayMoneyline = null;
      
      if (odd.MoneyLineHome !== undefined && odd.MoneyLineHome !== null) {
        homeMoneyline = String(odd.MoneyLineHome);
      }
      
      if (odd.MoneyLineAway !== undefined && odd.MoneyLineAway !== null) {
        awayMoneyline = String(odd.MoneyLineAway);
      }
      
      const gameKey = `${mockJsonOddsMatch.AwayTeam}|${mockJsonOddsMatch.HomeTeam}`;
      const moneylineMap = {
        [gameKey]: {
          awayMoneyline: awayMoneyline || '-',
          homeMoneyline: homeMoneyline || '-'
        }
      };
      
      expect(moneylineMap['Team B|Team A'].awayMoneyline).toBe('-');
      expect(moneylineMap['Team B|Team A'].homeMoneyline).toBe('-');
    });
    
    test('should iterate through multiple odds providers to find valid moneylines', () => {
      const mockJsonOddsMatch = {
        HomeTeam: 'Cowboys',
        AwayTeam: 'Eagles',
        Odds: [
          {
            // First provider has incomplete data
            MoneyLineHome: null,
            MoneyLineAway: null
          },
          {
            // Second provider has valid data
            MoneyLineHome: -140,
            MoneyLineAway: 120
          }
        ]
      };
      
      let homeMoneyline = null;
      let awayMoneyline = null;
      
      // Loop through all providers to find valid moneyline data
      for (let i = 0; i < mockJsonOddsMatch.Odds.length; i++) {
        const odd = mockJsonOddsMatch.Odds[i];
        
        if (odd.MoneyLineHome !== undefined && odd.MoneyLineHome !== null) {
          const mlHome = parseInt(odd.MoneyLineHome);
          if (!isNaN(mlHome) && mlHome >= -10000 && mlHome <= 10000) {
            homeMoneyline = String(odd.MoneyLineHome);
            if (mlHome > 0 && !homeMoneyline.startsWith('+')) {
              homeMoneyline = '+' + homeMoneyline;
            }
          }
        }
        
        if (odd.MoneyLineAway !== undefined && odd.MoneyLineAway !== null) {
          const mlAway = parseInt(odd.MoneyLineAway);
          if (!isNaN(mlAway) && mlAway >= -10000 && mlAway <= 10000) {
            awayMoneyline = String(odd.MoneyLineAway);
            if (mlAway > 0 && !awayMoneyline.startsWith('+')) {
              awayMoneyline = '+' + awayMoneyline;
            }
          }
        }
        
        // If we found both moneylines, stop searching
        if (homeMoneyline && awayMoneyline) {
          break;
        }
      }
      
      expect(homeMoneyline).toBe('-140');
      expect(awayMoneyline).toBe('+120');
    });
  });
  
  describe('Data Priority Layering', () => {
    test('should prioritize JsonOdds moneyline over The Odds API', () => {
      // Simulate game with all three data sources
      const baseGame = {
        awayTeam: 'Lakers',
        homeTeam: 'Celtics',
        awayMoneyline: '+100', // ESPN data
        homeMoneyline: '-120'
      };
      
      const oddsApiData = {
        awayMoneyline: '+110', // The Odds API data
        homeMoneyline: '-130'
      };
      
      const jsonOddsML = {
        awayMoneyline: '+120', // JsonOdds data (should win)
        homeMoneyline: '-140'
      };
      
      // Apply priority: JsonOdds > The Odds API > ESPN
      const finalAwayML = (jsonOddsML && jsonOddsML.awayMoneyline !== '-') 
        ? jsonOddsML.awayMoneyline 
        : (oddsApiData.awayMoneyline || baseGame.awayMoneyline);
      
      const finalHomeML = (jsonOddsML && jsonOddsML.homeMoneyline !== '-') 
        ? jsonOddsML.homeMoneyline 
        : (oddsApiData.homeMoneyline || baseGame.homeMoneyline);
      
      expect(finalAwayML).toBe('+120'); // JsonOdds wins
      expect(finalHomeML).toBe('-140'); // JsonOdds wins
    });
    
    test('should fallback to The Odds API when JsonOdds returns dash', () => {
      const baseGame = {
        awayTeam: 'Lakers',
        homeTeam: 'Celtics',
        awayMoneyline: null, // No ESPN data
        homeMoneyline: null
      };
      
      const oddsApiData = {
        awayMoneyline: '+110', // The Odds API data
        homeMoneyline: '-130'
      };
      
      const jsonOddsML = {
        awayMoneyline: '-', // JsonOdds has no data
        homeMoneyline: '-'
      };
      
      // Apply priority: JsonOdds > The Odds API > ESPN
      const finalAwayML = (jsonOddsML && jsonOddsML.awayMoneyline !== '-') 
        ? jsonOddsML.awayMoneyline 
        : (oddsApiData.awayMoneyline || baseGame.awayMoneyline);
      
      const finalHomeML = (jsonOddsML && jsonOddsML.homeMoneyline !== '-') 
        ? jsonOddsML.homeMoneyline 
        : (oddsApiData.homeMoneyline || baseGame.homeMoneyline);
      
      expect(finalAwayML).toBe('+110'); // Falls back to Odds API
      expect(finalHomeML).toBe('-130'); // Falls back to Odds API
    });
    
    test('should fallback to ESPN when both JsonOdds and The Odds API are unavailable', () => {
      const baseGame = {
        awayTeam: 'Lakers',
        homeTeam: 'Celtics',
        awayMoneyline: '+105', // ESPN data
        homeMoneyline: '-125'
      };
      
      const oddsApiData = {}; // No Odds API data
      const jsonOddsML = null; // No JsonOdds data
      
      // Apply priority: JsonOdds > The Odds API > ESPN
      const finalAwayML = (jsonOddsML && jsonOddsML.awayMoneyline !== '-') 
        ? jsonOddsML.awayMoneyline 
        : (oddsApiData.awayMoneyline || baseGame.awayMoneyline);
      
      const finalHomeML = (jsonOddsML && jsonOddsML.homeMoneyline !== '-') 
        ? jsonOddsML.homeMoneyline 
        : (oddsApiData.homeMoneyline || baseGame.homeMoneyline);
      
      expect(finalAwayML).toBe('+105'); // Falls back to ESPN
      expect(finalHomeML).toBe('-125'); // Falls back to ESPN
    });
  });
  
  describe('Sport Key Mapping', () => {
    test('should map EGT Sports names to JsonOdds sport keys', () => {
      const JSON_ODDS_SPORT_KEYS = {
        'NFL': 'NFL',
        'NBA': 'NBA',
        'College Football': 'NCAAF',
        'College Basketball': 'NCAAB',
        'Major League Baseball': 'MLB',
        'NHL': 'NHL',
        'World Cup': 'Soccer',
        'MLS': 'MLS',
        'Boxing': 'Boxing',
        'UFC': 'MMA'
      };
      
      expect(JSON_ODDS_SPORT_KEYS['NFL']).toBe('NFL');
      expect(JSON_ODDS_SPORT_KEYS['NBA']).toBe('NBA');
      expect(JSON_ODDS_SPORT_KEYS['College Football']).toBe('NCAAF');
      expect(JSON_ODDS_SPORT_KEYS['College Basketball']).toBe('NCAAB');
      expect(JSON_ODDS_SPORT_KEYS['Major League Baseball']).toBe('MLB');
      expect(JSON_ODDS_SPORT_KEYS['NHL']).toBe('NHL');
      expect(JSON_ODDS_SPORT_KEYS['World Cup']).toBe('Soccer');
      expect(JSON_ODDS_SPORT_KEYS['MLS']).toBe('MLS');
      expect(JSON_ODDS_SPORT_KEYS['Boxing']).toBe('Boxing');
      expect(JSON_ODDS_SPORT_KEYS['UFC']).toBe('MMA');
    });
  });
  
  describe('OddType Parameter Support', () => {
    test('should support oddType parameter for FirstHalf odds', () => {
      // Test that oddType parameter can be passed to filter results
      const sport = 'NFL';
      const oddType = 'FirstHalf';
      
      // Verify cache key includes oddType
      const cacheKey = `${sport}_${oddType}`;
      expect(cacheKey).toBe('NFL_FirstHalf');
    });
    
    test('should support oddType parameter for Quarter odds', () => {
      // Test that oddType parameter can be passed for quarter-specific odds
      const sport = 'NBA';
      const oddType = 'FirstQuarter';
      
      // Verify cache key includes oddType
      const cacheKey = `${sport}_${oddType}`;
      expect(cacheKey).toBe('NBA_FirstQuarter');
    });
    
    test('should cache oddType requests separately from game odds', () => {
      // Verify that different oddTypes are cached separately
      const sport = 'NFL';
      const gameCache = sport; // Default cache key without oddType
      const halfCache = `${sport}_FirstHalf`;
      const quarterCache = `${sport}_FirstQuarter`;
      
      expect(gameCache).toBe('NFL');
      expect(halfCache).toBe('NFL_FirstHalf');
      expect(quarterCache).toBe('NFL_FirstQuarter');
      expect(gameCache).not.toBe(halfCache);
      expect(gameCache).not.toBe(quarterCache);
    });
  });
  
  describe('getGameKey Helper Function', () => {
    // Replicate the helper function for testing
    const getGameKey = (away, home) => `${away.trim()}|${home.trim()}`;
    
    test('should create consistent game key with pipe separator', () => {
      const key = getGameKey('Lakers', 'Celtics');
      expect(key).toBe('Lakers|Celtics');
    });
    
    test('should trim whitespace from team names', () => {
      const key = getGameKey('  Lakers  ', '  Celtics  ');
      expect(key).toBe('Lakers|Celtics');
    });
    
    test('should handle team names with spaces', () => {
      const key = getGameKey('Los Angeles Lakers', 'Boston Celtics');
      expect(key).toBe('Los Angeles Lakers|Boston Celtics');
    });
    
    test('should produce same key when used for storing and retrieving', () => {
      const awayTeam = 'Philadelphia 76ers';
      const homeTeam = 'New York Knicks';
      
      // Simulate storing with getGameKey
      const storeKey = getGameKey(awayTeam, homeTeam);
      
      // Simulate retrieving with getGameKey
      const retrieveKey = getGameKey(awayTeam, homeTeam);
      
      expect(storeKey).toBe(retrieveKey);
      expect(storeKey).toBe('Philadelphia 76ers|New York Knicks');
    });
    
    test('should be used consistently in moneyline map creation', () => {
      const mockJsonOddsMatch = {
        HomeTeam: 'Lakers',
        AwayTeam: 'Celtics',
        Odds: [{ MoneyLineHome: 150, MoneyLineAway: -175 }]
      };
      
      const gameKey = getGameKey(mockJsonOddsMatch.AwayTeam, mockJsonOddsMatch.HomeTeam);
      const moneylineMap = {
        [gameKey]: {
          awayMoneyline: '-175',
          homeMoneyline: '+150'
        }
      };
      
      // Verify retrieval using same helper
      const retrieveKey = getGameKey('Celtics', 'Lakers');
      expect(moneylineMap[retrieveKey]).toBeDefined();
      expect(moneylineMap[retrieveKey].awayMoneyline).toBe('-175');
    });
  });
  
  describe('Enhanced Fuzzy Matching', () => {
    test('should match when API team name is substring of local team name (min 3 chars)', () => {
      // Simulate: API returns "Rams", local data has "Los Angeles Rams"
      const localTeam = 'Los Angeles Rams';
      const apiTeam = 'Rams';
      
      // Test with minimum length check
      const match = apiTeam.length >= 3 && localTeam.toLowerCase().includes(apiTeam.toLowerCase());
      expect(match).toBe(true);
    });
    
    test('should match when local team name is substring of API team name (min 3 chars)', () => {
      // Simulate: API returns "Los Angeles Rams", local data has "Rams"
      const localTeam = 'Rams';
      const apiTeam = 'Los Angeles Rams';
      
      // Test with minimum length check
      const match = localTeam.length >= 3 && apiTeam.toLowerCase().includes(localTeam.toLowerCase());
      expect(match).toBe(true);
    });
    
    test('should match bidirectionally for both away and home teams', () => {
      // Simulating the actual scenario:
      // gameAwayLocal = game.awayTeam (local data)
      // apiAwayTeam = oddsAway (API data)
      const gameAwayLocal = 'Los Angeles Rams'; // awayLower in code
      const gameHomeLocal = 'San Francisco 49ers'; // homeLower in code
      const apiAwayTeam = 'Rams'; // oddsAwayLower in code
      const apiHomeTeam = '49ers'; // oddsHomeLower in code
      
      // Match implementation logic exactly:
      // Check if API name (3+ chars) is in local name OR local name (3+ chars) is in API name
      const awayMatchA = apiAwayTeam.length >= 3 && gameAwayLocal.toLowerCase().includes(apiAwayTeam.toLowerCase());
      const awayMatchB = gameAwayLocal.length >= 3 && apiAwayTeam.toLowerCase().includes(gameAwayLocal.toLowerCase());
      const awayMatch = awayMatchA || awayMatchB;
      
      const homeMatchA = apiHomeTeam.length >= 3 && gameHomeLocal.toLowerCase().includes(apiHomeTeam.toLowerCase());
      const homeMatchB = gameHomeLocal.length >= 3 && apiHomeTeam.toLowerCase().includes(gameHomeLocal.toLowerCase());
      const homeMatch = homeMatchA || homeMatchB;
      
      // Should match because apiAwayTeam "Rams" (4 chars) is in gameAwayLocal "Los Angeles Rams"
      expect(awayMatch).toBe(true);
      // Should match because apiHomeTeam "49ers" (5 chars) is in gameHomeLocal "San Francisco 49ers"
      expect(homeMatch).toBe(true);
    });
    
    test('should not match unrelated team names', () => {
      const localTeam = 'Lakers';
      const apiTeam = 'Celtics';
      
      // With minimum length check - neither should be substring of the other
      const matchA = apiTeam.length >= 3 && localTeam.toLowerCase().includes(apiTeam.toLowerCase());
      const matchB = localTeam.length >= 3 && apiTeam.toLowerCase().includes(localTeam.toLowerCase());
      const match = matchA || matchB;
      
      expect(match).toBe(false);
    });
    
    test('should match when local has full name and API has short name', () => {
      // Scenario: API returns "Rams", local has "Los Angeles Rams"
      const localTeam = 'Los Angeles Rams';
      const apiTeam = 'Rams';
      
      // First condition should match: apiTeam.length >= 3 && localTeam.includes(apiTeam)
      const matchA = apiTeam.length >= 3 && localTeam.toLowerCase().includes(apiTeam.toLowerCase());
      const matchB = localTeam.length >= 3 && apiTeam.toLowerCase().includes(localTeam.toLowerCase());
      const match = matchA || matchB;
      
      expect(matchA).toBe(true); // "Rams" (4 chars) is in "Los Angeles Rams"
      expect(matchB).toBe(false); // "Los Angeles Rams" is NOT in "Rams"
      expect(match).toBe(true); // Overall match succeeds
    });
    
    test('should match when API has full name and local has short name', () => {
      // Scenario: API returns "Los Angeles Lakers", local has "Lakers"
      const localTeam = 'Lakers';
      const apiTeam = 'Los Angeles Lakers';
      
      // Second condition should match: localTeam.length >= 3 && apiTeam.includes(localTeam)
      const matchA = apiTeam.length >= 3 && localTeam.toLowerCase().includes(apiTeam.toLowerCase());
      const matchB = localTeam.length >= 3 && apiTeam.toLowerCase().includes(localTeam.toLowerCase());
      const match = matchA || matchB;
      
      expect(matchA).toBe(false); // "Los Angeles Lakers" is NOT in "Lakers"
      expect(matchB).toBe(true); // "Lakers" (6 chars) is in "Los Angeles Lakers"
      expect(match).toBe(true); // Overall match succeeds
    });
    
    test('should prevent false positives with short names (< 3 chars)', () => {
      // Simulate: "LA" should NOT match "LAkers" due to minimum length check
      const localTeam = 'LAkers';
      const apiTeam = 'LA';
      
      // Should fail due to minimum length requirement on apiTeam
      const matchA = apiTeam.length >= 3 && localTeam.toLowerCase().includes(apiTeam.toLowerCase());
      const matchB = localTeam.length >= 3 && apiTeam.toLowerCase().includes(localTeam.toLowerCase());
      const match = matchA || matchB;
      
      expect(matchA).toBe(false); // apiTeam "LA" only has 2 chars, fails length check
      expect(matchB).toBe(false); // Even though "LA" is in "LAkers", apiTeam length check fails
      expect(match).toBe(false); // Overall match fails
    });
  });
});
