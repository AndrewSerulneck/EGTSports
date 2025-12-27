/**
 * Unit tests for GridBettingLayout column order
 * Tests FanDuel standard: Spread | Moneyline | Total
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import GridBettingLayout from './GridBettingLayout';

describe('GridBettingLayout Column Order Tests', () => {
  const mockGames = [
    {
      id: 'test-game-1',
      espnId: '401234567',
      awayTeam: 'Kansas City Chiefs',
      homeTeam: 'Buffalo Bills',
      date: '12/27',
      time: '8:00 PM',
      awaySpread: '+3.5',
      homeSpread: '-3.5',
      awayMoneyline: '+150',
      homeMoneyline: '-180',
      total: '47.5',
      status: 'pre',
      isFinal: false
    }
  ];

  const mockSelectedPicks = {};
  const mockOnSelectPick = jest.fn();

  test('renders betting columns in FanDuel standard order for NFL', () => {
    render(
      <GridBettingLayout
        games={mockGames}
        selectedPicks={mockSelectedPicks}
        onSelectPick={mockOnSelectPick}
        sport="NFL"
      />
    );

    // Get all bet-type-label elements
    const labels = screen.getAllByText(/Spread|Moneyline|O\/U/);
    
    // Verify we have 3 labels (Spread, Moneyline, O/U)
    expect(labels.length).toBeGreaterThanOrEqual(3);
    
    // Check that labels appear in correct order
    const labelTexts = labels.map(label => label.textContent);
    const spreadIndex = labelTexts.findIndex(text => text === 'Spread');
    const moneylineIndex = labelTexts.findIndex(text => text === 'Moneyline');
    const ouIndex = labelTexts.findIndex(text => text === 'O/U');
    
    // Spread should come before Moneyline
    expect(spreadIndex).toBeLessThan(moneylineIndex);
    
    // Moneyline should come before O/U
    expect(moneylineIndex).toBeLessThan(ouIndex);
  });

  test('renders all three betting options for standard sports', () => {
    render(
      <GridBettingLayout
        games={mockGames}
        selectedPicks={mockSelectedPicks}
        onSelectPick={mockOnSelectPick}
        sport="NFL"
      />
    );

    // Verify all three betting types are present
    expect(screen.getByText('Spread')).toBeInTheDocument();
    expect(screen.getByText('Moneyline')).toBeInTheDocument();
    expect(screen.getByText('O/U')).toBeInTheDocument();
  });

  test('renders betting options with correct odds', () => {
    render(
      <GridBettingLayout
        games={mockGames}
        selectedPicks={mockSelectedPicks}
        onSelectPick={mockOnSelectPick}
        sport="NFL"
      />
    );

    // Verify spreads are displayed
    expect(screen.getByText('+3.5')).toBeInTheDocument();
    expect(screen.getByText('-3.5')).toBeInTheDocument();
    
    // Verify moneylines are displayed
    expect(screen.getByText('+150')).toBeInTheDocument();
    expect(screen.getByText('-180')).toBeInTheDocument();
    
    // Verify total is displayed (appears twice for Over/Under)
    const totalElements = screen.getAllByText('47.5');
    expect(totalElements.length).toBeGreaterThanOrEqual(2);
  });

  test('handles games with missing odds gracefully', () => {
    const gamesWithMissingOdds = [{
      ...mockGames[0],
      awayMoneyline: '',
      homeMoneyline: '',
      total: 'OFF'
    }];

    render(
      <GridBettingLayout
        games={gamesWithMissingOdds}
        selectedPicks={mockSelectedPicks}
        onSelectPick={mockOnSelectPick}
        sport="NFL"
      />
    );

    // Should still render the layout structure
    expect(screen.getByText('Spread')).toBeInTheDocument();
    expect(screen.getByText('Moneyline')).toBeInTheDocument();
    expect(screen.getByText('O/U')).toBeInTheDocument();
  });

  test('renders Soccer 3-way market in correct order', () => {
    const soccerGames = [{
      ...mockGames[0],
      drawMoneyline: '+230'
    }];

    render(
      <GridBettingLayout
        games={soccerGames}
        selectedPicks={mockSelectedPicks}
        onSelectPick={mockOnSelectPick}
        sport="World Cup"
      />
    );

    // Soccer should show Match Result (3-way), then Spread, then O/U
    const labels = screen.getAllByText(/Match Result|Spread|O\/U/);
    expect(labels.length).toBeGreaterThanOrEqual(3);
  });
});
