import React from 'react';
import './GridBettingLayout.css';

/**
 * GridBettingLayout Component - Displays games in a grid with bet options
 * Columns: Winner (Moneyline), Points Handicap (Spread), Total Points (Over/Under)
 * Inspired by bet777.be design
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

            {/* Teams Column */}
            <div className="game-grid-body">
              <div className="teams-column">
                <div className="team-row-grid away-team">
                  <span className="team-name-grid">{game.awayTeam}</span>
                  {game.isFinal && <span className="score">{game.awayScore}</span>}
                </div>
                <div className="team-row-grid home-team">
                  <span className="team-name-grid">{game.homeTeam}</span>
                  {game.isFinal && <span className="score">{game.homeScore}</span>}
                </div>
              </div>

              {/* Moneyline Column */}
              <div className="bet-column">
                <div className="column-header">Moneyline</div>
                <button
                  className={`bet-button ${isSelected(game.id, 'winner', 'away') ? 'selected' : ''} ${game.isFinal ? 'disabled' : ''}`}
                  onClick={() => !game.isFinal && onSelectPick(game.id, 'winner', 'away')}
                  disabled={game.isFinal || !game.awayMoneyline}
                >
                  <span className="bet-label">Away</span>
                  <span className="bet-odds">{formatOdds(game.awayMoneyline)}</span>
                </button>
                <button
                  className={`bet-button ${isSelected(game.id, 'winner', 'home') ? 'selected' : ''} ${game.isFinal ? 'disabled' : ''}`}
                  onClick={() => !game.isFinal && onSelectPick(game.id, 'winner', 'home')}
                  disabled={game.isFinal || !game.homeMoneyline}
                >
                  <span className="bet-label">Home</span>
                  <span className="bet-odds">{formatOdds(game.homeMoneyline)}</span>
                </button>
              </div>

              {/* Points Handicap Column (Spread) */}
              <div className="bet-column">
                <div className="column-header">Points Handicap</div>
                <button
                  className={`bet-button ${isSelected(game.id, 'spread', 'away') ? 'selected' : ''} ${game.isFinal ? 'disabled' : ''}`}
                  onClick={() => !game.isFinal && onSelectPick(game.id, 'spread', 'away')}
                  disabled={game.isFinal || !game.awaySpread}
                >
                  <span className="bet-label">{game.awayTeam.split(' ').pop()}</span>
                  <span className="bet-odds">{formatOdds(game.awaySpread)}</span>
                </button>
                <button
                  className={`bet-button ${isSelected(game.id, 'spread', 'home') ? 'selected' : ''} ${game.isFinal ? 'disabled' : ''}`}
                  onClick={() => !game.isFinal && onSelectPick(game.id, 'spread', 'home')}
                  disabled={game.isFinal || !game.homeSpread}
                >
                  <span className="bet-label">{game.homeTeam.split(' ').pop()}</span>
                  <span className="bet-odds">{formatOdds(game.homeSpread)}</span>
                </button>
              </div>

              {/* Total Points Column (Over/Under) */}
              <div className="bet-column">
                <div className="column-header">Total Points</div>
                <button
                  className={`bet-button ${isSelected(game.id, 'total', 'over') ? 'selected' : ''} ${game.isFinal ? 'disabled' : ''}`}
                  onClick={() => !game.isFinal && onSelectPick(game.id, 'total', 'over')}
                  disabled={game.isFinal || !game.total}
                >
                  <span className="bet-label">Over</span>
                  <span className="bet-odds">{formatOdds(game.total)}</span>
                </button>
                <button
                  className={`bet-button ${isSelected(game.id, 'total', 'under') ? 'selected' : ''} ${game.isFinal ? 'disabled' : ''}`}
                  onClick={() => !game.isFinal && onSelectPick(game.id, 'total', 'under')}
                  disabled={game.isFinal || !game.total}
                >
                  <span className="bet-label">Under</span>
                  <span className="bet-odds">{formatOdds(game.total)}</span>
                </button>
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
