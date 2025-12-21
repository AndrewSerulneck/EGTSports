import React, { useState } from 'react';
import './GridBettingLayout.css';

/**
 * PeriodSelector Component - Multi-select toggle for game periods
 * Allows users to filter/view different line types: Whole Game, 1st Half, 1st Quarter
 */
function PeriodSelector({ selectedPeriods, onPeriodToggle }) {
  const periods = [
    { id: 'whole_game', label: 'Whole Game', shortLabel: 'Full Game' },
    { id: 'first_half', label: '1st Half', shortLabel: '1H' },
    { id: 'first_quarter', label: '1st Quarter', shortLabel: '1Q' }
  ];

  return (
    <div className="period-selector sport-type-selection">
      <div className="period-buttons">
        {periods.map((period) => (
          <button
            key={period.id}
            onClick={() => onPeriodToggle(period.id)}
            className={`period-btn ${selectedPeriods.includes(period.id) ? 'active' : ''}`}
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
 * Now supports period filtering (Whole Game, 1st Half, 1st Quarter)
 */
function GridBettingLayout({ 
  games, 
  selectedPicks, 
  onSelectPick,
  betType 
}) {
  // State for period selection (multi-select)
  const [selectedPeriods, setSelectedPeriods] = useState(['whole_game']);
  
  // Toggle period selection
  const handlePeriodToggle = (periodId) => {
    setSelectedPeriods((prev) => {
      if (prev.includes(periodId)) {
        // Deselect - but ensure at least one is selected
        const newSelection = prev.filter(id => id !== periodId);
        return newSelection.length > 0 ? newSelection : prev;
      } else {
        // Select - add to array
        return [...prev, periodId];
      }
    });
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
  
  // Render games grouped by selected periods
  const renderGamesByPeriod = () => {
    if (!games || games.length === 0) {
      return null;
    }
    
    return (
      <>
        {selectedPeriods.map((periodId) => {
          let periodLabel = '';
          let periodGames = games; // For now, show same games for all periods
          
          if (periodId === 'whole_game') {
            periodLabel = 'WHOLE GAME';
          } else if (periodId === 'first_half') {
            periodLabel = '1ST HALF';
            // Note: Period-specific odds would be filtered here when available from API
            // For now, we show the same games with a note that period odds are coming soon
          } else if (periodId === 'first_quarter') {
            periodLabel = '1ST QUARTER';
            // Note: Period-specific odds would be filtered here when available from API
          }
          
          return (
            <div key={periodId} className="period-section">
              {selectedPeriods.length > 1 && (
                <div className="period-header">
                  <h3 className="period-title">{periodLabel}</h3>
                  {periodId !== 'whole_game' && (
                    <div className="period-coming-soon">
                      <span className="badge badge-info">Coming Soon</span>
                    </div>
                  )}
                </div>
              )}
              
              <div className="games-grid">
                {periodGames.map((game) => (
                  <div key={`${periodId}-${game.id}`} className={`game-grid-card ${game.isFinal ? 'final' : ''}`}>
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
                    {periodId === 'whole_game' ? (
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
                              <span className="btn-team">O</span>
                              <span className="btn-odds">{formatOdds(game.total)}</span>
                            </button>
                            <button
                              className={`bet-btn ${isSelected(game.id, 'total', 'under') ? 'selected' : ''} ${game.isFinal ? 'disabled' : ''}`}
                              onClick={() => !game.isFinal && onSelectPick(game.id, 'total', 'under')}
                              disabled={game.isFinal || !game.total}
                              aria-label={`Under ${formatOdds(game.total)}`}
                            >
                              <span className="btn-team">U</span>
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
            </div>
          );
        })}
      </>
    );
  };

  return (
    <div className="grid-betting-layout">
      {/* Period Selector */}
      <PeriodSelector 
        selectedPeriods={selectedPeriods} 
        onPeriodToggle={handlePeriodToggle} 
      />
      
      {games && games.length > 0 ? (
        renderGamesByPeriod()
      ) : (
        <div className="no-games-message">
          <p>No games available at this time.</p>
        </div>
      )}
    </div>
  );
}

export default GridBettingLayout;
