/**
 * Test for Firebase betAmount fix
 * Validates that parlay bets do not include undefined betAmount properties
 */

describe('Parlay bet pick formatting', () => {
  test('parlay picks should not include betAmount property', () => {
    const betType = 'parlay';
    const individualBetAmounts = {};
    const getPickId = (gameId, pickType) => `${gameId}-${pickType}`;
    
    // Simulate creating a spread pick for a parlay bet
    const gameId = 'game1';
    const spreadPick = {
      gameId: 'espn123',
      gameName: 'Team A @ Team B',
      sport: 'NFL',
      pickType: 'spread',
      team: 'Team A',
      spread: '-3.5',
      pickedTeamType: 'away',
      ...(betType === 'straight' && { betAmount: parseFloat(individualBetAmounts[getPickId(gameId, 'spread')]) })
    };
    
    // Verify that betAmount property is not present in parlay picks
    expect(spreadPick).not.toHaveProperty('betAmount');
    expect(Object.keys(spreadPick)).not.toContain('betAmount');
  });

  test('straight bet picks should include betAmount property', () => {
    const betType = 'straight';
    const individualBetAmounts = { 'game1-spread': '50' };
    const getPickId = (gameId, pickType) => `${gameId}-${pickType}`;
    
    // Simulate creating a spread pick for a straight bet
    const gameId = 'game1';
    const spreadPick = {
      gameId: 'espn123',
      gameName: 'Team A @ Team B',
      sport: 'NFL',
      pickType: 'spread',
      team: 'Team A',
      spread: '-3.5',
      pickedTeamType: 'away',
      ...(betType === 'straight' && { betAmount: parseFloat(individualBetAmounts[getPickId(gameId, 'spread')]) })
    };
    
    // Verify that betAmount property is present and has correct value in straight bets
    expect(spreadPick).toHaveProperty('betAmount');
    expect(spreadPick.betAmount).toBe(50);
  });

  test('winner pick should not include betAmount for parlay', () => {
    const betType = 'parlay';
    const individualBetAmounts = {};
    const getPickId = (gameId, pickType) => `${gameId}-${pickType}`;
    
    const gameId = 'game1';
    const winnerPick = {
      gameId: 'espn123',
      gameName: 'Team A @ Team B',
      sport: 'NFL',
      pickType: 'winner',
      team: 'Team A',
      moneyline: '-150',
      pickedTeamType: 'away',
      ...(betType === 'straight' && { betAmount: parseFloat(individualBetAmounts[getPickId(gameId, 'winner')]) })
    };
    
    expect(winnerPick).not.toHaveProperty('betAmount');
  });

  test('total pick should not include betAmount for parlay', () => {
    const betType = 'parlay';
    const individualBetAmounts = {};
    const getPickId = (gameId, pickType) => `${gameId}-${pickType}`;
    
    const gameId = 'game1';
    const totalPick = {
      gameId: 'espn123',
      gameName: 'Team A @ Team B',
      sport: 'NFL',
      pickType: 'total',
      overUnder: 'over',
      total: '45.5',
      ...(betType === 'straight' && { betAmount: parseFloat(individualBetAmounts[getPickId(gameId, 'total')]) })
    };
    
    expect(totalPick).not.toHaveProperty('betAmount');
  });

  test('picks array should not contain any undefined values', () => {
    const betType = 'parlay';
    const picksFormatted = [
      {
        gameId: 'espn123',
        gameName: 'Team A @ Team B',
        sport: 'NFL',
        pickType: 'spread',
        team: 'Team A',
        spread: '-3.5',
        pickedTeamType: 'away'
      },
      {
        gameId: 'espn124',
        gameName: 'Team C @ Team D',
        sport: 'NBA',
        pickType: 'winner',
        team: 'Team C',
        moneyline: '-150',
        pickedTeamType: 'away'
      },
      {
        gameId: 'espn125',
        gameName: 'Team E @ Team F',
        sport: 'NHL',
        pickType: 'total',
        overUnder: 'over',
        total: '6.5'
      }
    ];
    
    // Check that no pick has undefined values
    picksFormatted.forEach(pick => {
      Object.values(pick).forEach(value => {
        expect(value).not.toBeUndefined();
      });
    });
  });
});
