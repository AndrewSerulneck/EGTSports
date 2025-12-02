import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import BettingSlip from './BettingSlip';

// Mock games data
const mockGames = [
  {
    id: 'NFL-1',
    sport: 'NFL',
    awayTeam: 'Kansas City Chiefs',
    homeTeam: 'San Francisco 49ers',
    awayMoneyline: '+150',
    homeMoneyline: '-180',
    awaySpread: '+3.5',
    homeSpread: '-3.5',
    total: '47.5',
    date: 'Sunday, Dec 1',
    time: '1:00 PM ET'
  },
  {
    id: 'NFL-2',
    sport: 'NFL',
    awayTeam: 'Dallas Cowboys',
    homeTeam: 'Philadelphia Eagles',
    awayMoneyline: '+200',
    homeMoneyline: '-250',
    awaySpread: '+6.5',
    homeSpread: '-6.5',
    total: '45.0',
    date: 'Sunday, Dec 1',
    time: '4:25 PM ET'
  }
];

// Helper to render BettingSlip with default props
const renderBettingSlip = (props = {}) => {
  const defaultProps = {
    selectedPicks: {},
    onRemovePick: jest.fn(),
    onClearAll: jest.fn(),
    onSubmit: jest.fn(),
    betType: 'straight',
    onBetTypeChange: jest.fn(),
    games: mockGames,
    allSportsGames: { NFL: mockGames },
    individualBetAmounts: {},
    setIndividualBetAmounts: jest.fn(),
    parlayBetAmount: '',
    onParlayBetAmountChange: jest.fn(),
    MIN_BET: 5,
    MAX_BET: 250
  };
  
  return render(<BettingSlip {...defaultProps} {...props} />);
};

describe('BettingSlip Component', () => {
  test('renders empty slip message when no picks selected', () => {
    renderBettingSlip();
    expect(screen.getByText(/No picks selected/i)).toBeInTheDocument();
  });

  test('shows pick count badge when picks are selected', () => {
    const selectedPicks = {
      'NFL-1': { winner: 'home' }
    };
    renderBettingSlip({ selectedPicks });
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  test('displays Total Stake as $0.00 when no bet amounts entered', () => {
    const selectedPicks = {
      'NFL-1': { winner: 'home' }
    };
    renderBettingSlip({ selectedPicks });
    const stakeRow = screen.getByText('Total Stake:').parentElement;
    expect(stakeRow).toHaveTextContent('$0.00');
  });
});

describe('BettingSlip Calculations', () => {
  test('Total Stake only includes amounts for active picks', () => {
    // Setup: One active pick with a bet amount
    const selectedPicks = {
      'NFL-1': { winner: 'home' }
    };
    
    const individualBetAmounts = {
      'NFL-1-winner': '50'
    };
    
    renderBettingSlip({ selectedPicks, individualBetAmounts });
    
    // Should show $50.00 as Total Stake
    const stakeRow = screen.getByText('Total Stake:').parentElement;
    expect(stakeRow).toHaveTextContent('$50.00');
  });

  test('Total Stake excludes amounts for removed picks (stale data)', () => {
    // Simulates the bug scenario: bet amount exists but pick was removed
    // The calculation should NOT include the orphaned bet amount
    const selectedPicks = {
      'NFL-1': { winner: 'home' }
    };
    
    // individualBetAmounts has a stale entry for a removed pick
    const individualBetAmounts = {
      'NFL-1-winner': '50',
      'NFL-2-winner': '100' // This pick was removed but amount still exists
    };
    
    renderBettingSlip({ selectedPicks, individualBetAmounts });
    
    // Should only show $50.00, not $150.00
    const stakeRow = screen.getByText('Total Stake:').parentElement;
    expect(stakeRow).toHaveTextContent('$50.00');
  });

  test('Total Stake sums multiple active picks correctly', () => {
    const selectedPicks = {
      'NFL-1': { winner: 'home', spread: 'home' },
      'NFL-2': { total: 'over' }
    };
    
    const individualBetAmounts = {
      'NFL-1-winner': '25',
      'NFL-1-spread': '35',
      'NFL-2-total': '40'
    };
    
    renderBettingSlip({ selectedPicks, individualBetAmounts });
    
    // Should show $100.00 (25 + 35 + 40)
    const stakeRow = screen.getByText('Total Stake:').parentElement;
    expect(stakeRow).toHaveTextContent('$100.00');
  });

  test('Potential Profit is calculated correctly (Payout - Stake)', () => {
    const selectedPicks = {
      'NFL-1': { winner: 'home' } // homeMoneyline: -180
    };
    
    const individualBetAmounts = {
      'NFL-1-winner': '100'
    };
    
    renderBettingSlip({ selectedPicks, individualBetAmounts });
    
    // For -180 odds: Winnings = 100 * (100/180) = 55.56
    // Payout = 100 + 55.56 = 155.56
    // Profit = 155.56 - 100 = 55.56
    const profitRow = screen.getByText('Potential Profit:').parentElement;
    expect(profitRow).toHaveTextContent('$55.56');
  });

  test('handles positive (underdog) odds correctly', () => {
    const selectedPicks = {
      'NFL-1': { winner: 'away' } // awayMoneyline: +150
    };
    
    const individualBetAmounts = {
      'NFL-1-winner': '100'
    };
    
    renderBettingSlip({ selectedPicks, individualBetAmounts });
    
    // For +150 odds: Winnings = 100 * (150/100) = 150
    // Payout = 100 + 150 = 250
    // Profit = 250 - 100 = 150
    const profitRow = screen.getByText('Potential Profit:').parentElement;
    expect(profitRow).toHaveTextContent('$150.00');
  });

  test('remove pick button calls onRemovePick with correct args', () => {
    const mockOnRemovePick = jest.fn();
    const selectedPicks = {
      'NFL-1': { winner: 'home' }
    };
    
    renderBettingSlip({ 
      selectedPicks, 
      onRemovePick: mockOnRemovePick 
    });
    
    // Find and click the remove button (×) using title attribute
    const removeButton = screen.getByTitle('Remove pick');
    fireEvent.click(removeButton);
    
    expect(mockOnRemovePick).toHaveBeenCalledWith('NFL-1', 'winner');
  });

  test('clear all button calls onClearAll', () => {
    const mockOnClearAll = jest.fn();
    const selectedPicks = {
      'NFL-1': { winner: 'home' }
    };
    
    renderBettingSlip({ 
      selectedPicks, 
      onClearAll: mockOnClearAll 
    });
    
    const clearButton = screen.getByRole('button', { name: /Clear All/i });
    fireEvent.click(clearButton);
    
    expect(mockOnClearAll).toHaveBeenCalled();
  });
});

describe('BettingSlip Edge Cases', () => {
  test('handles empty bet amounts gracefully', () => {
    const selectedPicks = {
      'NFL-1': { winner: 'home' }
    };
    
    const individualBetAmounts = {
      'NFL-1-winner': '' // Empty string
    };
    
    renderBettingSlip({ selectedPicks, individualBetAmounts });
    
    // Should show $0.00 for empty amount
    const stakeRow = screen.getByText('Total Stake:').parentElement;
    expect(stakeRow).toHaveTextContent('$0.00');
  });

  test('handles undefined bet amounts gracefully', () => {
    const selectedPicks = {
      'NFL-1': { winner: 'home' }
    };
    
    // No entry in individualBetAmounts for this pick
    const individualBetAmounts = {};
    
    renderBettingSlip({ selectedPicks, individualBetAmounts });
    
    // Should show $0.00
    const stakeRow = screen.getByText('Total Stake:').parentElement;
    expect(stakeRow).toHaveTextContent('$0.00');
  });

  test('handles NaN bet amounts gracefully', () => {
    const selectedPicks = {
      'NFL-1': { winner: 'home' }
    };
    
    const individualBetAmounts = {
      'NFL-1-winner': 'not-a-number'
    };
    
    renderBettingSlip({ selectedPicks, individualBetAmounts });
    
    // Should show $0.00 for invalid amount
    const stakeRow = screen.getByText('Total Stake:').parentElement;
    expect(stakeRow).toHaveTextContent('$0.00');
  });
});
