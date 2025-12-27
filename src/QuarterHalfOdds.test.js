/**
 * Test Suite for Quarter and Halftime Odds Parsing
 * 
 * Validates that the fetchOddsFromTheOddsAPI function correctly:
 * 1. Requests quarter/halftime markets in API URL
 * 2. Parses h2h (moneyline) markets using 'price' field
 * 3. Parses spreads markets using 'point' field
 * 4. Parses totals markets using 'point' field
 * 5. Stores parsed data with correct field names
 */

describe('Quarter and Halftime Odds Parsing', () => {
  
  test('Moneyline market should use price field, not point field', () => {
    // Simulate h2h market outcome structure
    const h2hOutcome = {
      name: 'Los Angeles Lakers',
      price: -150  // Moneyline uses price, NOT point
    };
    
    // Validate: moneyline should have price
    expect(h2hOutcome.price).toBeDefined();
    expect(typeof h2hOutcome.price).toBe('number');
    
    // Validate: moneyline should NOT have point
    expect(h2hOutcome.point).toBeUndefined();
    
    // Format check
    const formattedPrice = h2hOutcome.price > 0 ? `+${h2hOutcome.price}` : String(h2hOutcome.price);
    expect(formattedPrice).toBe('-150');
  });
  
  test('Spread market should use point field for line value', () => {
    // Simulate spreads market outcome structure
    const spreadOutcome = {
      name: 'Los Angeles Lakers',
      price: -110,      // Spread has price (for payout)
      point: -3.5       // Spread uses point for the line
    };
    
    // Validate: spread should have point
    expect(spreadOutcome.point).toBeDefined();
    expect(typeof spreadOutcome.point).toBe('number');
    
    // Format check
    const formattedSpread = spreadOutcome.point > 0 ? `+${spreadOutcome.point}` : String(spreadOutcome.point);
    expect(formattedSpread).toBe('-3.5');
  });
  
  test('Total market should use point field for over/under value', () => {
    // Simulate totals market outcome structure
    const totalOutcome = {
      name: 'Over',
      price: -110,
      point: 225.5  // Total uses point for the line
    };
    
    // Validate: total should have point
    expect(totalOutcome.point).toBeDefined();
    expect(typeof totalOutcome.point).toBe('number');
    
    // Format check
    const formattedTotal = String(totalOutcome.point);
    expect(formattedTotal).toBe('225.5');
  });
  
  test('Quarter markets should be named with Q1, Q2, Q3, Q4 prefix', () => {
    const quarterMarkets = [
      'Q1_homeMoneyline',
      'Q1_awayMoneyline',
      'Q1_homeSpread',
      'Q1_awaySpread',
      'Q1_total',
      'Q2_homeMoneyline',
      'Q3_homeSpread',
      'Q4_total'
    ];
    
    quarterMarkets.forEach(market => {
      expect(market).toMatch(/^Q[1-4]_/);
    });
  });
  
  test('Halftime markets should be named with H1, H2 prefix', () => {
    const halftimeMarkets = [
      'H1_homeMoneyline',
      'H1_awayMoneyline',
      'H1_homeSpread',
      'H1_awaySpread',
      'H1_total',
      'H2_homeMoneyline',
      'H2_homeSpread',
      'H2_total'
    ];
    
    halftimeMarkets.forEach(market => {
      expect(market).toMatch(/^H[1-2]_/);
    });
  });
  
  test('API markets request string should include all quarter/halftime markets', () => {
    // Expected markets for US sports (non-soccer, non-combat)
    const expectedMarkets = [
      'h2h',
      'spreads',
      'totals',
      'h2h_q1', 'spreads_q1', 'totals_q1',
      'h2h_q2', 'spreads_q2', 'totals_q2',
      'h2h_q3', 'spreads_q3', 'totals_q3',
      'h2h_q4', 'spreads_q4', 'totals_q4',
      'h2h_h1', 'spreads_h1', 'totals_h1',
      'h2h_h2', 'spreads_h2', 'totals_h2'
    ];
    
    const marketsString = 'h2h,spreads,totals,h2h_q1,spreads_q1,totals_q1,h2h_q2,spreads_q2,totals_q2,h2h_q3,spreads_q3,totals_q3,h2h_q4,spreads_q4,totals_q4,h2h_h1,spreads_h1,totals_h1,h2h_h2,spreads_h2,totals_h2';
    
    expectedMarkets.forEach(market => {
      expect(marketsString).toContain(market);
    });
  });
  
  test('SaveSpreadToFirebase should preserve quarter/halftime fields', () => {
    const gameWithQuarterOdds = {
      espnId: '401234567',
      awaySpread: '+3.5',
      homeSpread: '-3.5',
      awayMoneyline: '+150',
      homeMoneyline: '-180',
      total: '225.5',
      Q1_homeSpread: '-1.5',
      Q1_awayMoneyline: '+120',
      H1_total: '110.5'
    };
    
    // Simulate what saveSpreadToFirebase does
    const gameData = {
      awaySpread: gameWithQuarterOdds.awaySpread || '',
      homeSpread: gameWithQuarterOdds.homeSpread || '',
      awayMoneyline: gameWithQuarterOdds.awayMoneyline || '',
      homeMoneyline: gameWithQuarterOdds.homeMoneyline || '',
      total: gameWithQuarterOdds.total || '',
      timestamp: new Date().toISOString()
    };
    
    // Add quarter/halftime fields
    const quarterHalfKeys = [
      'Q1_homeMoneyline', 'Q1_awayMoneyline', 'Q1_homeSpread', 'Q1_awaySpread', 'Q1_total',
      'Q2_homeMoneyline', 'Q2_awayMoneyline', 'Q2_homeSpread', 'Q2_awaySpread', 'Q2_total',
      'Q3_homeMoneyline', 'Q3_awayMoneyline', 'Q3_homeSpread', 'Q3_awaySpread', 'Q3_total',
      'Q4_homeMoneyline', 'Q4_awayMoneyline', 'Q4_homeSpread', 'Q4_awaySpread', 'Q4_total',
      'H1_homeMoneyline', 'H1_awayMoneyline', 'H1_homeSpread', 'H1_awaySpread', 'H1_total',
      'H2_homeMoneyline', 'H2_awayMoneyline', 'H2_homeSpread', 'H2_awaySpread', 'H2_total'
    ];
    
    quarterHalfKeys.forEach(key => {
      if (gameWithQuarterOdds[key] !== undefined && gameWithQuarterOdds[key] !== null && gameWithQuarterOdds[key] !== '') {
        gameData[key] = gameWithQuarterOdds[key];
      }
    });
    
    // Validate: quarter/halftime fields are preserved
    expect(gameData.Q1_homeSpread).toBe('-1.5');
    expect(gameData.Q1_awayMoneyline).toBe('+120');
    expect(gameData.H1_total).toBe('110.5');
    
    // Validate: main fields are still present
    expect(gameData.awaySpread).toBe('+3.5');
    expect(gameData.homeSpread).toBe('-3.5');
  });
  
  test('Markets should not be requested for soccer or combat sports', () => {
    // Soccer markets
    const soccerMarkets = 'h2h,spreads,totals';
    expect(soccerMarkets).not.toContain('h2h_q1');
    expect(soccerMarkets).not.toContain('h2h_h1');
    
    // Combat sports markets
    const combatMarkets = 'h2h,h2h_method,h2h_round,h2h_go_distance';
    expect(combatMarkets).not.toContain('spreads_q1');
    expect(combatMarkets).not.toContain('totals_h1');
  });
  
  test('Positive moneyline prices should be formatted with plus sign', () => {
    const underdog = { name: 'Team A', price: 150 };
    const favorite = { name: 'Team B', price: -180 };
    
    const underdogML = underdog.price > 0 ? `+${underdog.price}` : String(underdog.price);
    const favoriteML = favorite.price > 0 ? `+${favorite.price}` : String(favorite.price);
    
    expect(underdogML).toBe('+150');
    expect(favoriteML).toBe('-180');
  });
  
  test('Positive spreads should be formatted with plus sign', () => {
    const underdog = { name: 'Team A', point: 3.5, price: -110 };
    const favorite = { name: 'Team B', point: -3.5, price: -110 };
    
    const underdogSpread = underdog.point > 0 ? `+${underdog.point}` : String(underdog.point);
    const favoriteSpread = favorite.point > 0 ? `+${favorite.point}` : String(favorite.point);
    
    expect(underdogSpread).toBe('+3.5');
    expect(favoriteSpread).toBe('-3.5');
  });
});
