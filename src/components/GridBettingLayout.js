import React, { useState, useEffect } from 'react';
import './GridBettingLayout.css';

/**
 * PeriodSelector Component - Single-select toggle for game periods
 * Sport-specific periods with mobile-first "Pyramid" layout
 * Includes helper labels for clarity on rules
 */
function PeriodSelector({ selectedPeriod, onPeriodSelect, sport, availablePeriods = [] }) {
  // Define period options based on sport with helper labels
  const getPeriodOptions = () => {
    const isSoccer = sport === 'World Cup' || sport === 'Soccer' || sport === 'MLS';
    const isCombat = sport === 'Boxing' || sport === 'UFC';
    
    if (isCombat) {
      // Combat Sports: No period selector, will show fight props below
      return [];
    } else if (sport === 'NHL') {
      // NHL: 2 Rows
      return [
        { id: 'whole_game', label: 'Full Game', shortLabel: 'Full', helper: '(Includes Overtime)', row: 1 },
        { id: 'first_period', label: '1st Per', shortLabel: '1st Per', helper: '', row: 2 },
        { id: 'second_period', label: '2nd Per', shortLabel: '2nd Per', helper: '', row: 2 },
        { id: 'third_period', label: '3rd Per', shortLabel: '3rd Per', helper: '', row: 2 }
      ];
    } else if (isSoccer) {
      // Soccer/World Cup/MLS: 2 Rows
      return [
        { id: 'whole_game', label: 'Full Game', shortLabel: 'Full', helper: '(Includes Overtime)', row: 1 },
        { id: 'first_half', label: '1st Half', shortLabel: '1st Half', helper: '', row: 2 },
        { id: 'second_half', label: '2nd Half', shortLabel: '2nd Half', helper: '', row: 2 }
      ];
    } else {
      // NFL/NBA/NCAA: 3 Rows - STRICT LABELING: "Qtr" not "Q", "Half" not "H"
      return [
        { id: 'whole_game', label: 'Full Game', shortLabel: 'Full', helper: '(Includes Overtime)', row: 1 },
        { id: 'first_half', label: '1st Half', shortLabel: '1st Half', helper: '', row: 2 },
        { id: 'second_half', label: '2nd Half', shortLabel: '2nd Half', helper: '', row: 2 },
        { id: 'first_quarter', label: '1st Qtr', shortLabel: '1st Qtr', helper: '', row: 3 },
        { id: 'second_quarter', label: '2nd Qtr', shortLabel: '2nd Qtr', helper: '', row: 3 },
        { id: 'third_quarter', label: '3rd Qtr', shortLabel: '3rd Qtr', helper: '', row: 3 },
        { id: 'fourth_quarter', label: '4th Qtr', shortLabel: '4th Qtr', helper: '', row: 3 }
      ];
    }
  };

  const periods = getPeriodOptions();
  
  // If combat sport with no periods, return null
  if (periods.length === 0) {
    return null;
  }
  
  // Filter periods based on availability
  const visiblePeriods = periods.filter(period => {
    if (period.id === 'whole_game') return true;
    return availablePeriods.length === 0 || availablePeriods.includes(period.id);
  });

  // Group periods by row for mobile pyramid layout
  const groupedPeriods = visiblePeriods.reduce((acc, period) => {
    const row = period.row || 1;
    if (!acc[row]) acc[row] = [];
    acc[row].push(period);
    return acc;
  }, {});

  // Sort row keys once during grouping
  const sortedRows = Object.keys(groupedPeriods).sort((a, b) => Number(a) - Number(b));

  return (
    <div className="period-selector sport-type-selection">
      <div className="period-buttons-pyramid">
        {sortedRows.map((row) => (
          <div key={row} className={`period-row period-row-${row}`}>
            {groupedPeriods[row].map((period) => (
              <button
                key={period.id}
                onClick={() => onPeriodSelect(period.id)}
                className={`period-btn ${selectedPeriod === period.id ? 'active' : ''}`}
                title={period.label}
              >
                <span className="period-label-desktop">{period.label}</span>
                <span className="period-label-mobile">{period.shortLabel}</span>
                {period.helper && (
                  <span className="period-helper">{period.helper}</span>
                )}
              </button>
            ))}
          </div>
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

// Default odds for unavailable markets
const DEFAULT_DRAW_ODDS = '+250';

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
    } else if (pickType === 'distance') {
      return pick.distance === value;
    }
    return false;
  };

  // Helper to extract team mascot from full team name
  const extractMascot = (teamName) => {
    if (!teamName) return '';
    const words = teamName.toLowerCase().trim().split(' ');
    // Return the last word (mascot), capitalize first letter
    const mascot = words[words.length - 1];
    return mascot.charAt(0).toUpperCase() + mascot.slice(1);
  };

  // Helper to format odds - replace N/A with dash
  const formatOdds = (odds) => {
    if (!odds || odds === '' || odds === 'undefined') return '-';
    if (odds === 'OFF') return 'OFF';
    if (odds === 'N/A') return '-';
    return odds;
  };

  // Helper to check if odds are valid (not N/A, OFF, or empty)
  const isValidOdds = (odds) => {
    if (!odds || odds === '' || odds === 'undefined') return false;
    if (odds === 'OFF' || odds === 'N/A' || odds === '-') return false;
    return true;
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
    const isComingSoon = selectedPeriod !== 'whole_game'; // For now, only whole game has odds
    const isSoccer = sport === 'World Cup' || sport === 'Soccer' || sport === 'MLS';
    const isCombat = sport === 'Boxing' || sport === 'UFC';
    
    return (
      <>
        {showPeriodHeader && (
          <div className="period-header">
            <h3 className="period-title">{periodLabel}</h3>
            {isComingSoon && (
              <div className="period-coming-soon">
                <span className="badge badge-info">Coming Soon</span>
              </div>
            )}
          </div>
        )}
        
        <div className="games-grid">
          {games.map((game) => {
            // Handle fighter name mapping for combat sports (Red Corner = Top, Blue Corner = Bottom)
            // If away team is Red Corner, swap the display order
            const isRedCorner = game.awayTeam && (game.awayTeam.includes('Red Corner') || game.awayTeam.includes('Red'));
            const fighterTop = isRedCorner ? game.awayTeam : game.homeTeam;
            const fighterBottom = isRedCorner ? game.homeTeam : game.awayTeam;
            
            return (
              <div key={game.id} className={`game-grid-card ${game.isFinal ? 'final' : ''} ${isSoccer ? 'soccer-layout' : ''} ${isCombat ? 'combat-layout' : ''}`}>
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

                {/* Game Info - Teams/Fighters */}
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
                // Show betting options based on sport type
                <div className={`bet-buttons-row ${isSoccer ? 'soccer-3way' : ''} ${isCombat ? 'combat-props' : ''}`}>
                  {/* Combat Sports Special Layout (Boxing/UFC) */}
                  {isCombat ? (
                    <>
                      {/* Fighter Moneylines - 2 Column Grid */}
                      <div className="bet-type-group combat-moneyline">
                        <div className="bet-type-label">Winner</div>
                        <div className="bet-options combat-fighters">
                          <button
                            className={`bet-btn combat-fighter-btn ${isSelected(game.id, 'winner', 'away') ? 'selected' : ''} ${game.isFinal ? 'disabled' : ''}`}
                            onClick={() => !game.isFinal && isValidOdds(game.awayMoneyline) && onSelectPick(game.id, 'winner', 'away')}
                            disabled={game.isFinal || !isValidOdds(game.awayMoneyline)}
                            aria-label={`${fighterTop} to win ${formatOdds(game.awayMoneyline)}`}
                          >
                            <span className="btn-team">{fighterTop}</span>
                            <span className="btn-odds">{formatOdds(game.awayMoneyline)}</span>
                          </button>
                          <button
                            className={`bet-btn combat-fighter-btn ${isSelected(game.id, 'winner', 'home') ? 'selected' : ''} ${game.isFinal ? 'disabled' : ''}`}
                            onClick={() => !game.isFinal && isValidOdds(game.homeMoneyline) && onSelectPick(game.id, 'winner', 'home')}
                            disabled={game.isFinal || !isValidOdds(game.homeMoneyline)}
                            aria-label={`${fighterBottom} to win ${formatOdds(game.homeMoneyline)}`}
                          >
                            <span className="btn-team">{fighterBottom}</span>
                            <span className="btn-odds">{formatOdds(game.homeMoneyline)}</span>
                          </button>
                        </div>
                      </div>

                      {/* Fight Props Section */}
                      <div className="combat-props-section">
                        {/* Total Rounds */}
                        <div className="bet-type-group combat-prop">
                          <div className="bet-type-label">Total Rounds</div>
                          <div className="bet-options">
                            <button
                              className={`bet-btn ${isSelected(game.id, 'total', 'over') ? 'selected' : ''} ${game.isFinal ? 'disabled' : ''}`}
                              onClick={() => !game.isFinal && isValidOdds(game.total) && onSelectPick(game.id, 'total', 'over')}
                              disabled={game.isFinal || !isValidOdds(game.total)}
                              aria-label={`Over ${formatOdds(game.total)} rounds`}
                            >
                              <span className="btn-team">Over</span>
                              <span className="btn-odds">{formatOdds(game.total)}</span>
                            </button>
                            <button
                              className={`bet-btn ${isSelected(game.id, 'total', 'under') ? 'selected' : ''} ${game.isFinal ? 'disabled' : ''}`}
                              onClick={() => !game.isFinal && isValidOdds(game.total) && onSelectPick(game.id, 'total', 'under')}
                              disabled={game.isFinal || !isValidOdds(game.total)}
                              aria-label={`Under ${formatOdds(game.total)} rounds`}
                            >
                              <span className="btn-team">Under</span>
                              <span className="btn-odds">{formatOdds(game.total)}</span>
                            </button>
                          </div>
                        </div>

                        {/* To Go the Distance */}
                        <div className="bet-type-group combat-prop">
                          <div className="bet-type-label">Go the Distance</div>
                          <div className="bet-options">
                            <button
                              className={`bet-btn ${isSelected(game.id, 'distance', 'yes') ? 'selected' : ''} ${game.isFinal ? 'disabled' : ''}`}
                              onClick={() => !game.isFinal && onSelectPick(game.id, 'distance', 'yes')}
                              disabled={game.isFinal}
                              aria-label="Fight to go the distance - Yes"
                            >
                              <span className="btn-team">Yes</span>
                              <span className="btn-odds">--</span>
                            </button>
                            <button
                              className={`bet-btn ${isSelected(game.id, 'distance', 'no') ? 'selected' : ''} ${game.isFinal ? 'disabled' : ''}`}
                              onClick={() => !game.isFinal && onSelectPick(game.id, 'distance', 'no')}
                              disabled={game.isFinal}
                              aria-label="Fight to go the distance - No"
                            >
                              <span className="btn-team">No</span>
                              <span className="btn-odds">--</span>
                            </button>
                          </div>
                        </div>

                        {/* Method of Victory - Coming Soon */}
                        <div className="bet-type-group combat-prop">
                          <div className="bet-type-label">Method of Victory</div>
                          <div className="combat-coming-soon">
                            <span className="text-muted">Coming Soon</span>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Soccer 3-Way Market (Home | Draw | Away) */}
                      {isSoccer && (
                        <div className="bet-type-group soccer-moneyline">
                          <div className="bet-type-label">Match Result</div>
                          <div className="bet-options bet-options-3way">
                            <button
                              className={`bet-btn ${isSelected(game.id, 'winner', 'home') ? 'selected' : ''} ${game.isFinal ? 'disabled' : ''}`}
                              onClick={() => !game.isFinal && isValidOdds(game.homeMoneyline) && onSelectPick(game.id, 'winner', 'home')}
                              disabled={game.isFinal || !isValidOdds(game.homeMoneyline)}
                              aria-label={`${game.homeTeam} win ${formatOdds(game.homeMoneyline)}`}
                            >
                              <span className="btn-team">{extractMascot(game.homeTeam)}</span>
                              <span className="btn-odds">{formatOdds(game.homeMoneyline)}</span>
                            </button>
                            <button
                              className={`bet-btn ${isSelected(game.id, 'winner', 'draw') ? 'selected' : ''} ${game.isFinal ? 'disabled' : ''}`}
                              onClick={() => !game.isFinal && isValidOdds(game.drawMoneyline) && onSelectPick(game.id, 'winner', 'draw')}
                              disabled={game.isFinal || !isValidOdds(game.drawMoneyline)}
                              aria-label={`Draw ${formatOdds(game.drawMoneyline)}`}
                            >
                              <span className="btn-team">Draw</span>
                              <span className="btn-odds">{formatOdds(game.drawMoneyline || DEFAULT_DRAW_ODDS)}</span>
                            </button>
                            <button
                              className={`bet-btn ${isSelected(game.id, 'winner', 'away') ? 'selected' : ''} ${game.isFinal ? 'disabled' : ''}`}
                              onClick={() => !game.isFinal && isValidOdds(game.awayMoneyline) && onSelectPick(game.id, 'winner', 'away')}
                              disabled={game.isFinal || !isValidOdds(game.awayMoneyline)}
                              aria-label={`${game.awayTeam} win ${formatOdds(game.awayMoneyline)}`}
                            >
                              <span className="btn-team">{extractMascot(game.awayTeam)}</span>
                              <span className="btn-odds">{formatOdds(game.awayMoneyline)}</span>
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {/* Standard Moneyline (Non-Soccer, Non-Combat) */}
                      {!isSoccer && (
                        <div className="bet-type-group">
                          <div className="bet-type-label">Moneyline</div>
                          <div className="bet-options">
                            <button
                              className={`bet-btn ${isSelected(game.id, 'winner', 'away') ? 'selected' : ''} ${game.isFinal ? 'disabled' : ''}`}
                              onClick={() => !game.isFinal && isValidOdds(game.awayMoneyline) && onSelectPick(game.id, 'winner', 'away')}
                              disabled={game.isFinal || !isValidOdds(game.awayMoneyline)}
                              aria-label={`${game.awayTeam} moneyline ${formatOdds(game.awayMoneyline)}`}
                            >
                              <span className="btn-team">{extractMascot(game.awayTeam)}</span>
                              <span className="btn-odds">{formatOdds(game.awayMoneyline)}</span>
                            </button>
                            <button
                              className={`bet-btn ${isSelected(game.id, 'winner', 'home') ? 'selected' : ''} ${game.isFinal ? 'disabled' : ''}`}
                              onClick={() => !game.isFinal && isValidOdds(game.homeMoneyline) && onSelectPick(game.id, 'winner', 'home')}
                              disabled={game.isFinal || !isValidOdds(game.homeMoneyline)}
                              aria-label={`${game.homeTeam} moneyline ${formatOdds(game.homeMoneyline)}`}
                            >
                              <span className="btn-team">{extractMascot(game.homeTeam)}</span>
                              <span className="btn-odds">{formatOdds(game.homeMoneyline)}</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Spread (Non-Combat only) */}
                      {!isCombat && (
                        <div className="bet-type-group">
                          <div className="bet-type-label">Spread</div>
                          <div className="bet-options">
                            <button
                              className={`bet-btn ${isSelected(game.id, 'spread', 'away') ? 'selected' : ''} ${game.isFinal ? 'disabled' : ''}`}
                              onClick={() => !game.isFinal && isValidOdds(game.awaySpread) && onSelectPick(game.id, 'spread', 'away')}
                              disabled={game.isFinal || !isValidOdds(game.awaySpread)}
                              aria-label={`${game.awayTeam} spread ${formatOdds(game.awaySpread)}`}
                            >
                              <span className="btn-team">{extractMascot(game.awayTeam)}</span>
                              <span className="btn-odds">{formatOdds(game.awaySpread)}</span>
                            </button>
                            <button
                              className={`bet-btn ${isSelected(game.id, 'spread', 'home') ? 'selected' : ''} ${game.isFinal ? 'disabled' : ''}`}
                              onClick={() => !game.isFinal && isValidOdds(game.homeSpread) && onSelectPick(game.id, 'spread', 'home')}
                              disabled={game.isFinal || !isValidOdds(game.homeSpread)}
                              aria-label={`${game.homeTeam} spread ${formatOdds(game.homeSpread)}`}
                            >
                              <span className="btn-team">{extractMascot(game.homeTeam)}</span>
                              <span className="btn-odds">{formatOdds(game.homeSpread)}</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Over/Under (Non-Combat only) */}
                      {!isCombat && (
                        <div className="bet-type-group">
                          <div className="bet-type-label">O/U</div>
                          <div className="bet-options">
                            <button
                              className={`bet-btn ${isSelected(game.id, 'total', 'over') ? 'selected' : ''} ${game.isFinal ? 'disabled' : ''}`}
                              onClick={() => !game.isFinal && isValidOdds(game.total) && onSelectPick(game.id, 'total', 'over')}
                              disabled={game.isFinal || !isValidOdds(game.total)}
                              aria-label={`Over ${formatOdds(game.total)}`}
                            >
                              <span className="btn-team">Over</span>
                              <span className="btn-odds">{formatOdds(game.total)}</span>
                            </button>
                            <button
                              className={`bet-btn ${isSelected(game.id, 'total', 'under') ? 'selected' : ''} ${game.isFinal ? 'disabled' : ''}`}
                              onClick={() => !game.isFinal && isValidOdds(game.total) && onSelectPick(game.id, 'total', 'under')}
                              disabled={game.isFinal || !isValidOdds(game.total)}
                              aria-label={`Under ${formatOdds(game.total)}`}
                            >
                              <span className="btn-team">Under</span>
                              <span className="btn-odds">{formatOdds(game.total)}</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
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
          );
        })}
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
        availablePeriods={[]} // TODO: Pass available periods from API
      />
      
      {/* Render games for selected period */}
      {renderGames()}
    </div>
  );
}

export default GridBettingLayout;
