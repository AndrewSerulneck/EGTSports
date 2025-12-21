import React, { useState, useEffect } from 'react';
import './GridBettingLayout.css';

/**
 * PeriodSelector Component - Single-select toggle for game periods
 * Sport-specific periods: NFL/NBA/NCAAB show quarters/halves, NHL shows periods
 * Only one period can be active at a time
 */
function PeriodSelector({ selectedPeriod, onPeriodSelect, sport, availablePeriods = [] }) {
  // Define period options based on sport
  const getPeriodOptions = () => {
    if (sport === 'NHL') {
      return [
        { id: 'whole_game', label: 'Whole Game', shortLabel: 'Full' },
        { id: 'first_period', label: '1st Period', shortLabel: '1P' },
        { id: 'second_period', label: '2nd Period', shortLabel: '2P' },
        { id: 'third_period', label: '3rd Period', shortLabel: '3P' }
      ];
    } else {
      // Default for NFL, NBA, College Football, College Basketball, MLB
      return [
        { id: 'whole_game', label: 'Whole Game', shortLabel: 'Full' },
        { id: 'first_half', label: '1st Half', shortLabel: '1H' },
        { id: 'second_half', label: '2nd Half', shortLabel: '2H' },
        { id: 'first_quarter', label: '1st Quarter', shortLabel: '1Q' },
        { id: 'second_quarter', label: '2nd Quarter', shortLabel: '2Q' },
        { id: 'third_quarter', label: '3rd Quarter', shortLabel: '3Q' },
        { id: 'fourth_quarter', label: '4th Quarter', shortLabel: '4Q' }
      ];
    }
  };

  const periods = getPeriodOptions();
  
  // Filter periods based on availability (hide if not available in API data)
  const visiblePeriods = periods.filter(period => {
    // Whole game is always visible
    if (period.id === 'whole_game') return true;
    // Show period if it's in the availablePeriods list or if list is empty (show all)
    return availablePeriods.length === 0 || availablePeriods.includes(period.id);
  });

  return (
    <div className="period-selector sport-type-selection">
      <div className="period-buttons">
        {visiblePeriods.map((period) => (
          <button
            key={period.id}
            onClick={() => onPeriodSelect(period.id)}
            className={`period-btn ${selectedPeriod === period.id ? 'active' : ''}`}
            title={period.label}
          >
            <span className="period-label-desktop">{period.label}</span>
            <span className="period-label-mobile">{period.shortLabel}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * GridBettingLayout Component - Displays games vertically with horizontal bet options
 * Mobile-first design with three bet types (Moneyline, Spread, O/U) displayed horizontally
 * Now supports single-select period filtering with sport-specific logic
 */
function GridBettingLayout({ 
  games, 
  selectedPicks, 
  onSelectPick,
  betType,
  sport = 'NFL' // Default to NFL if not provided
}) {
  // State for period selection (single-select, default to whole_game)
  const [selectedPeriod, setSelectedPeriod] = useState('whole_game');
  
  // Reset to whole_game when sport changes
  useEffect(() => {
    setSelectedPeriod('whole_game');
  }, [sport]);
  
  // Handle period selection (single-select)
  const handlePeriodSelect = (periodId) => {
    setSelectedPeriod(periodId);
  };
  
  // Helper to check if a pick is selected
  const isSelected = (gameId, pickType, value) => {
    const pick = selectedPicks[gameId];
    if (!pick) return false;
    
    if (pickType === 'winner') {
      return pick.winner === value;
    } else if (pickType === 'spread') {
      return pick.spread === value;
    } else if (pickType === 'total') {
      return pick.total === value;
    }
    return false;
  };

  // Helper to format odds
  const formatOdds = (odds) => {
    if (!odds) return '--';
    return odds;
  };

  // Helper to extract short team name with fallback
  const getShortTeamName = (teamName) => {
    if (!teamName) return '--';
    const parts = teamName.split(' ');
    return parts.length > 0 ? parts[parts.length - 1] : teamName;
  };
  
  // Get period label for display
  const getPeriodLabel = (periodId) => {
    const labels = {
      'whole_game': 'WHOLE GAME',
      'first_half': '1ST HALF',
      'second_half': '2ND HALF',
      'first_quarter': '1ST QUARTER',
      'second_quarter': '2ND QUARTER',
      'third_quarter': '3RD QUARTER',
      'fourth_quarter': '4TH QUARTER',
      'first_period': '1ST PERIOD',
      'second_period': '2ND PERIOD',
      'third_period': '3RD PERIOD'
    };
    return labels[periodId] || 'WHOLE GAME';
  };
  
  // Render games for selected period
  const renderGames = () => {
    if (!games || games.length === 0) {
      return (
        <div className="no-games-message">
          <p>No games available at this time.</p>
        </div>
      );
    }
    
    const periodLabel = getPeriodLabel(selectedPeriod);
    const showPeriodHeader = selectedPeriod !== 'whole_game';
    
    return (
      <>
        {showPeriodHeader && (
          <div className="period-header">
            <h3 className="period-title">{periodLabel}</h3>
            <div className="period-coming-soon">
              <span className="badge badge-info">Coming Soon</span>
            </div>
          </div>
        )}
        
        <div className="games-grid">
          {games.map((game) => (
            <div key={game.id} className={`game-grid-card ${game.isFinal ? 'final' : ''}`}>
              {/* Game Header */}
              <div className="game-grid-header">
                <div className="game-date-time">
                  {game.date} · {game.time}
                  {game.status === 'in' && (
                    <span className="live-indicator">🔴 LIVE</span>
                  )}
                </div>
                {game.isFinal && (
                  <div className="final-badge">FINAL</div>
                )}
                {showPeriodHeader && (
                  <div className="period-indicator">{periodLabel}</div>
                )}
              </div>

              {/* Game Info - Teams */}
              <div className="game-info">
                <div className="teams-display">
                  <div className="team-row away-team">
                    <span className="team-name">{game.awayTeam}</span>
                    {game.isFinal && <span className="score">{game.awayScore}</span>}
                  </div>
                  <div className="vs-divider">@</div>
                  <div className="team-row home-team">
                    <span className="team-name">{game.homeTeam}</span>
                    {game.isFinal && <span className="score">{game.homeScore}</span>}
                  </div>
                </div>
              </div>

              {/* Horizontal Bet Buttons */}
              {selectedPeriod === 'whole_game' ? (
                // Show normal betting options for whole game
                <div className="bet-buttons-row">
                  {/* Moneyline */}
                  <div className="bet-type-group">
                    <div className="bet-type-label">Moneyline</div>
                    <div className="bet-options">
                      <button
                        className={`bet-btn ${isSelected(game.id, 'winner', 'away') ? 'selected' : ''} ${game.isFinal ? 'disabled' : ''}`}
                        onClick={() => !game.isFinal && onSelectPick(game.id, 'winner', 'away')}
                        disabled={game.isFinal || !game.awayMoneyline}
                        aria-label={`${game.awayTeam} moneyline ${formatOdds(game.awayMoneyline)}`}
                      >
                        <span className="btn-team">{getShortTeamName(game.awayTeam)}</span>
                        <span className="btn-odds">{formatOdds(game.awayMoneyline)}</span>
                      </button>
                      <button
                        className={`bet-btn ${isSelected(game.id, 'winner', 'home') ? 'selected' : ''} ${game.isFinal ? 'disabled' : ''}`}
                        onClick={() => !game.isFinal && onSelectPick(game.id, 'winner', 'home')}
                        disabled={game.isFinal || !game.homeMoneyline}
                        aria-label={`${game.homeTeam} moneyline ${formatOdds(game.homeMoneyline)}`}
                      >
                        <span className="btn-team">{getShortTeamName(game.homeTeam)}</span>
                        <span className="btn-odds">{formatOdds(game.homeMoneyline)}</span>
                      </button>
                    </div>
                  </div>

                  {/* Spread */}
                  <div className="bet-type-group">
                    <div className="bet-type-label">Spread</div>
                    <div className="bet-options">
                      <button
                        className={`bet-btn ${isSelected(game.id, 'spread', 'away') ? 'selected' : ''} ${game.isFinal ? 'disabled' : ''}`}
                        onClick={() => !game.isFinal && onSelectPick(game.id, 'spread', 'away')}
                        disabled={game.isFinal || !game.awaySpread}
                        aria-label={`${game.awayTeam} spread ${formatOdds(game.awaySpread)}`}
                      >
                        <span className="btn-team">{getShortTeamName(game.awayTeam)}</span>
                        <span className="btn-odds">{formatOdds(game.awaySpread)}</span>
                      </button>
                      <button
                        className={`bet-btn ${isSelected(game.id, 'spread', 'home') ? 'selected' : ''} ${game.isFinal ? 'disabled' : ''}`}
                        onClick={() => !game.isFinal && onSelectPick(game.id, 'spread', 'home')}
                        disabled={game.isFinal || !game.homeSpread}
                        aria-label={`${game.homeTeam} spread ${formatOdds(game.homeSpread)}`}
                      >
                        <span className="btn-team">{getShortTeamName(game.homeTeam)}</span>
                        <span className="btn-odds">{formatOdds(game.homeSpread)}</span>
                      </button>
                    </div>
                  </div>

                  {/* Over/Under */}
                  <div className="bet-type-group">
                    <div className="bet-type-label">O/U</div>
                    <div className="bet-options">
                      <button
                        className={`bet-btn ${isSelected(game.id, 'total', 'over') ? 'selected' : ''} ${game.isFinal ? 'disabled' : ''}`}
                        onClick={() => !game.isFinal && onSelectPick(game.id, 'total', 'over')}
                        disabled={game.isFinal || !game.total}
                        aria-label={`Over ${formatOdds(game.total)}`}
                      >
                        <span className="btn-team">Over</span>
                        <span className="btn-odds">{formatOdds(game.total)}</span>
                      </button>
                      <button
                        className={`bet-btn ${isSelected(game.id, 'total', 'under') ? 'selected' : ''} ${game.isFinal ? 'disabled' : ''}`}
                        onClick={() => !game.isFinal && onSelectPick(game.id, 'total', 'under')}
                        disabled={game.isFinal || !game.total}
                        aria-label={`Under ${formatOdds(game.total)}`}
                      >
                        <span className="btn-team">Under</span>
                        <span className="btn-odds">{formatOdds(game.total)}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                // Show "Coming Soon" message for period-specific betting
                <div className="bet-buttons-row">
                  <div className="period-odds-placeholder">
                    <p className="text-gray-500 text-sm text-center py-4">
                      📊 Period-specific odds coming soon
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </>
    );
  };

  return (
    <div className="grid-betting-layout">
      {/* Period Selector */}
      <PeriodSelector 
        selectedPeriod={selectedPeriod} 
        onPeriodSelect={handlePeriodSelect}
        sport={sport}
        availablePeriods={[]} // TODO: Pass available periods from API when wager-manager provides period data
      />
      
      {/* Render games for selected period */}
      {renderGames()}
    </div>
  );
}

export default GridBettingLayout;
