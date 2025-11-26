import React from 'react';
import './GridBettingLayout.css';

/**
 * GridBettingLayout Component - Displays games vertically with horizontal bet options
 * Mobile-first design with three bet types (Moneyline, Spread, O/U) displayed horizontally
 */
function GridBettingLayout({ 
  games, 
  selectedPicks, 
  onSelectPick,
  betType 
}) {
  
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

  return (
    <div className="grid-betting-layout">
      {games && games.length > 0 ? (
        games.map((game) => (
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
                    <span className="btn-team">{game.awayTeam.split(' ').pop()}</span>
                    <span className="btn-odds">{formatOdds(game.awayMoneyline)}</span>
                  </button>
                  <button
                    className={`bet-btn ${isSelected(game.id, 'winner', 'home') ? 'selected' : ''} ${game.isFinal ? 'disabled' : ''}`}
                    onClick={() => !game.isFinal && onSelectPick(game.id, 'winner', 'home')}
                    disabled={game.isFinal || !game.homeMoneyline}
                    aria-label={`${game.homeTeam} moneyline ${formatOdds(game.homeMoneyline)}`}
                  >
                    <span className="btn-team">{game.homeTeam.split(' ').pop()}</span>
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
                    <span className="btn-team">{game.awayTeam.split(' ').pop()}</span>
                    <span className="btn-odds">{formatOdds(game.awaySpread)}</span>
                  </button>
                  <button
                    className={`bet-btn ${isSelected(game.id, 'spread', 'home') ? 'selected' : ''} ${game.isFinal ? 'disabled' : ''}`}
                    onClick={() => !game.isFinal && onSelectPick(game.id, 'spread', 'home')}
                    disabled={game.isFinal || !game.homeSpread}
                    aria-label={`${game.homeTeam} spread ${formatOdds(game.homeSpread)}`}
                  >
                    <span className="btn-team">{game.homeTeam.split(' ').pop()}</span>
                    <span className="btn-odds">{formatOdds(game.homeSpread)}</span>
                  </button>
                </div>
              </div>

              {/* O/U (Over/Under) */}
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
          </div>
        ))
      ) : (
        <div className="no-games-message">
          <p>No games available at this time</p>
        </div>
      )}
    </div>
  );
}

export default GridBettingLayout;
