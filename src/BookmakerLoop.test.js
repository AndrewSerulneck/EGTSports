/**
 * Unit tests for the bookmaker loop functionality with priority system
 * Tests the priority-based bookmaker selection: DraftKings > FanDuel > BetMGM > Pinnacle > WilliamHill
 */

describe('Bookmaker Priority System', () => {
  // Mock helper function matching App.js priority logic
  const BOOKMAKER_PRIORITY = ['draftkings', 'fanduel', 'betmgm', 'pinnacle', 'williamhill_us'];
  
  const normalizeBookmakerName = (title) => {
    if (!title) return '';
    return title.toLowerCase().replace(/[^a-z0-9]/g, '');
  };
  
  const validateMarket = (market, marketKey, homeTeam, awayTeam) => {
    if (!market || !market.outcomes || market.outcomes.length < 2) {
      return false;
    }
    
    if (marketKey === 'h2h' || marketKey === 'spreads') {
      const hasHomeTeam = market.outcomes.some(o => 
        o.name === homeTeam || o.name.toLowerCase().includes(homeTeam.toLowerCase())
      );
      const hasAwayTeam = market.outcomes.some(o => 
        o.name === awayTeam || o.name.toLowerCase().includes(awayTeam.toLowerCase())
      );
      return hasHomeTeam && hasAwayTeam;
    } else if (marketKey === 'totals') {
      const hasOver = market.outcomes.some(o => o.name === 'Over');
      const hasUnder = market.outcomes.some(o => o.name === 'Under');
      return hasOver && hasUnder;
    }
    return true;
  };
  
  const findBookmakerWithMarket = (bookmakers, marketKey, homeTeam, awayTeam) => {
    if (!bookmakers || bookmakers.length === 0) {
      return null;
    }
    
    // PRIORITY SEARCH
    for (const priorityBook of BOOKMAKER_PRIORITY) {
      for (let i = 0; i < bookmakers.length; i++) {
        const bookmaker = bookmakers[i];
        const normalizedName = normalizeBookmakerName(bookmaker.title || bookmaker.key);
        
        if (normalizedName.includes(priorityBook) || priorityBook.includes(normalizedName)) {
          if (!bookmaker.markets || bookmaker.markets.length === 0) {
            continue;
          }
          
          const market = bookmaker.markets.find(m => m.key === marketKey);
          
          if (validateMarket(market, marketKey, homeTeam, awayTeam)) {
            return { bookmaker, market };
          }
        }
      }
    }
    
    // FALLBACK: Check remaining bookmakers
    for (let i = 0; i < bookmakers.length; i++) {
      const bookmaker = bookmakers[i];
      const normalizedName = normalizeBookmakerName(bookmaker.title || bookmaker.key);
      
      const isPriorityBook = BOOKMAKER_PRIORITY.some(pb => 
        normalizedName.includes(pb) || pb.includes(normalizedName)
      );
      if (isPriorityBook) {
        continue;
      }
      
      if (!bookmaker.markets || bookmaker.markets.length === 0) {
        continue;
      }
      
      const market = bookmaker.markets.find(m => m.key === marketKey);
      
      if (validateMarket(market, marketKey, homeTeam, awayTeam)) {
        return { bookmaker, market };
      }
    }
    
    return null;
  };

  test('should prioritize DraftKings over FanDuel when both have market', () => {
    const bookmakers = [
      {
        title: 'FanDuel',
        markets: [
          { 
            key: 'h2h', 
            outcomes: [
              { name: 'Lakers', price: -110 }, 
              { name: 'Celtics', price: 100 }
            ] 
          }
        ]
      },
      {
        title: 'DraftKings',
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
    expect(result.bookmaker.title).toBe('DraftKings');
  });

  test('should use FanDuel when DraftKings lacks market', () => {
    const bookmakers = [
      {
        title: 'FanDuel',
        markets: [
          { 
            key: 'h2h', 
            outcomes: [
              { name: 'Lakers', price: -110 }, 
              { name: 'Celtics', price: 100 }
            ] 
          }
        ]
      },
      {
        title: 'DraftKings',
        markets: [
          { key: 'spreads', outcomes: [{ name: 'Lakers' }, { name: 'Celtics' }] }
          // No h2h market
        ]
      }
    ];

    const result = findBookmakerWithMarket(bookmakers, 'h2h', 'Lakers', 'Celtics');
    
    expect(result).not.toBeNull();
    expect(result.bookmaker.title).toBe('FanDuel');
  });

  test('should prioritize BetMGM over non-priority bookmaker', () => {
    const bookmakers = [
      {
        title: 'SomeOtherBook',
        markets: [
          { 
            key: 'h2h', 
            outcomes: [
              { name: 'Lakers', price: -110 }, 
              { name: 'Celtics', price: 100 }
            ] 
          }
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

  test('should find h2h market in third priority bookmaker', () => {
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

  test('should find spreads market independently from h2h using priority', () => {
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

    // Should find h2h in DraftKings (higher priority)
    const h2hResult = findBookmakerWithMarket(bookmakers, 'h2h', 'Lakers', 'Celtics');
    expect(h2hResult).not.toBeNull();
    expect(h2hResult.bookmaker.title).toBe('DraftKings');
    
    // Should find spreads in FanDuel (only one with spreads)
    const spreadsResult = findBookmakerWithMarket(bookmakers, 'spreads', 'Lakers', 'Celtics');
    expect(spreadsResult).not.toBeNull();
    expect(spreadsResult.bookmaker.title).toBe('FanDuel');
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
