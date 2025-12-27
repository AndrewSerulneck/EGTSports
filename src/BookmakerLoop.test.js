/**
 * Unit tests for the bookmaker loop functionality
 * Tests the fix for the "Bookmaker 0 trap" issue
 */

describe('Bookmaker Loop Fix', () => {
  // Mock helper function similar to what's in App.js
  const findBookmakerWithMarket = (bookmakers, marketKey, homeTeam, awayTeam) => {
    if (!bookmakers || bookmakers.length === 0) {
      return null;
    }
    
    for (let i = 0; i < bookmakers.length; i++) {
      const bookmaker = bookmakers[i];
      
      if (!bookmaker.markets || bookmaker.markets.length === 0) {
        continue;
      }
      
      const market = bookmaker.markets.find(m => m.key === marketKey);
      
      if (market && market.outcomes && market.outcomes.length >= 2) {
        if (marketKey === 'h2h' || marketKey === 'spreads') {
          const hasHomeTeam = market.outcomes.some(o => 
            o.name === homeTeam || o.name.toLowerCase().includes(homeTeam.toLowerCase())
          );
          const hasAwayTeam = market.outcomes.some(o => 
            o.name === awayTeam || o.name.toLowerCase().includes(awayTeam.toLowerCase())
          );
          
          if (hasHomeTeam && hasAwayTeam) {
            return { bookmaker, market };
          }
        } else if (marketKey === 'totals') {
          const hasOver = market.outcomes.some(o => o.name === 'Over');
          const hasUnder = market.outcomes.some(o => o.name === 'Under');
          
          if (hasOver && hasUnder) {
            return { bookmaker, market };
          }
        }
      }
    }
    
    return null;
  };

  test('should find h2h market in second bookmaker when first lacks it', () => {
    const bookmakers = [
      {
        title: 'FanDuel',
        markets: [
          { key: 'spreads', outcomes: [{ name: 'Lakers' }, { name: 'Celtics' }] }
          // No h2h market - taken off the board
        ]
      },
      {
        title: 'DraftKings',
        markets: [
          { 
            key: 'h2h', 
            outcomes: [
              { name: 'Lakers', price: -110 }, 
              { name: 'Celtics', price: 100 }
            ] 
          }
        ]
      }
    ];

    const result = findBookmakerWithMarket(bookmakers, 'h2h', 'Lakers', 'Celtics');
    
    expect(result).not.toBeNull();
    expect(result.bookmaker.title).toBe('DraftKings');
    expect(result.market.key).toBe('h2h');
  });

  test('should find h2h market in third bookmaker', () => {
    const bookmakers = [
      {
        title: 'FanDuel',
        markets: [
          { key: 'spreads', outcomes: [{ name: 'Lakers' }, { name: 'Celtics' }] }
        ]
      },
      {
        title: 'DraftKings',
        markets: [
          { key: 'totals', outcomes: [{ name: 'Over' }, { name: 'Under' }] }
        ]
      },
      {
        title: 'BetMGM',
        markets: [
          { 
            key: 'h2h', 
            outcomes: [
              { name: 'Lakers', price: -115 }, 
              { name: 'Celtics', price: 105 }
            ] 
          }
        ]
      }
    ];

    const result = findBookmakerWithMarket(bookmakers, 'h2h', 'Lakers', 'Celtics');
    
    expect(result).not.toBeNull();
    expect(result.bookmaker.title).toBe('BetMGM');
  });

  test('should return null when no bookmaker has h2h market', () => {
    const bookmakers = [
      {
        title: 'FanDuel',
        markets: [
          { key: 'spreads', outcomes: [{ name: 'Lakers' }, { name: 'Celtics' }] }
        ]
      },
      {
        title: 'DraftKings',
        markets: [
          { key: 'totals', outcomes: [{ name: 'Over' }, { name: 'Under' }] }
        ]
      }
    ];

    const result = findBookmakerWithMarket(bookmakers, 'h2h', 'Lakers', 'Celtics');
    
    expect(result).toBeNull();
  });

  test('should find spreads market independently from h2h', () => {
    const bookmakers = [
      {
        title: 'FanDuel',
        markets: [
          { 
            key: 'spreads', 
            outcomes: [
              { name: 'Lakers', point: -3.5 }, 
              { name: 'Celtics', point: 3.5 }
            ] 
          }
          // No h2h
        ]
      },
      {
        title: 'DraftKings',
        markets: [
          { 
            key: 'h2h', 
            outcomes: [
              { name: 'Lakers', price: -110 }, 
              { name: 'Celtics', price: 100 }
            ] 
          }
          // No spreads
        ]
      }
    ];

    // Should find spreads in FanDuel
    const spreadsResult = findBookmakerWithMarket(bookmakers, 'spreads', 'Lakers', 'Celtics');
    expect(spreadsResult).not.toBeNull();
    expect(spreadsResult.bookmaker.title).toBe('FanDuel');
    
    // Should find h2h in DraftKings
    const h2hResult = findBookmakerWithMarket(bookmakers, 'h2h', 'Lakers', 'Celtics');
    expect(h2hResult).not.toBeNull();
    expect(h2hResult.bookmaker.title).toBe('DraftKings');
  });

  test('should handle empty bookmakers array', () => {
    const result = findBookmakerWithMarket([], 'h2h', 'Lakers', 'Celtics');
    expect(result).toBeNull();
  });

  test('should handle null bookmakers', () => {
    const result = findBookmakerWithMarket(null, 'h2h', 'Lakers', 'Celtics');
    expect(result).toBeNull();
  });

  test('should skip bookmakers with no markets', () => {
    const bookmakers = [
      {
        title: 'FanDuel',
        markets: []
      },
      {
        title: 'DraftKings',
        markets: [
          { 
            key: 'h2h', 
            outcomes: [
              { name: 'Lakers', price: -110 }, 
              { name: 'Celtics', price: 100 }
            ] 
          }
        ]
      }
    ];

    const result = findBookmakerWithMarket(bookmakers, 'h2h', 'Lakers', 'Celtics');
    
    expect(result).not.toBeNull();
    expect(result.bookmaker.title).toBe('DraftKings');
  });
});
