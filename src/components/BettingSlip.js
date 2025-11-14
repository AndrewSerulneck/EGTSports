import React, { useState } from 'react';
import './BettingSlip.css';

/**
 * BettingSlip Component - A persistent floating betting slip that follows the user
 * Supports both Single bets and Parlay bets with tab switching
 */
function BettingSlip({ 
  selectedPicks, 
  onRemovePick, 
  onClearAll, 
  onSubmit, 
  betType,
  onBetTypeChange,
  games,
  allSportsGames,
  individualBetAmounts,
  setIndividualBetAmounts,
  MIN_BET,
  MAX_BET
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState(betType || 'single');

  // Calculate pick count
  let pickCount = 0;
  Object.values(selectedPicks).forEach(obj => {
    if (obj.spread) pickCount++;
    if (obj.total) pickCount++;
  });

  // Helper to get pick ID
  const getPickId = (gameId, pickType) => `${gameId}-${pickType}`;

  // Helper to find game
  const findGame = (gameId) => {
    const numericGameId = Number(gameId);
    let game = games?.find(g => g.id === gameId || g.id === numericGameId);
    if (!game && allSportsGames) {
      for (const sportGames of Object.values(allSportsGames)) {
        game = sportGames.find(g => g.id === gameId || g.id === numericGameId);
        if (game) break;
      }
    }
    return game;
  };

  // Calculate total bet amount for singles
  const calculateTotalSingleBet = () => {
    let total = 0;
    Object.values(individualBetAmounts || {}).forEach(amount => {
      const parsed = parseFloat(amount);
      if (!isNaN(parsed) && parsed > 0) {
        total += parsed;
      }
    });
    return total;
  };

  // Calculate potential payout for singles
  const calculateSinglePayout = () => {
    let totalPayout = 0;
    Object.entries(selectedPicks).forEach(([gameId, pickObj]) => {
      const game = findGame(gameId);
      if (!game) return;

      if (pickObj.spread) {
        const pickId = getPickId(gameId, 'spread');
        const betAmount = parseFloat(individualBetAmounts?.[pickId] || 0);
        const moneyline = pickObj.spread === 'away' ? game.awayMoneyline : game.homeMoneyline;
        
        if (betAmount > 0 && moneyline) {
          const ml = parseInt(moneyline);
          if (!isNaN(ml)) {
            const payout = ml > 0 ? betAmount * (ml / 100) : betAmount * (100 / Math.abs(ml));
            totalPayout += payout;
          }
        }
      }

      if (pickObj.total) {
        const pickId = getPickId(gameId, 'total');
        const betAmount = parseFloat(individualBetAmounts?.[pickId] || 0);
        
        if (betAmount > 0) {
          // Over/Under typically pays -110
          const payout = betAmount * (100 / 110);
          totalPayout += payout;
        }
      }
    });
    return totalPayout;
  };

  // Get payout multiplier for parlay
  const getParlayMultiplier = (picks) => {
    const multipliers = {
      3: 8, 4: 15, 5: 25, 6: 50, 7: 100, 8: 150, 9: 200, 10: 250
    };
    return multipliers[picks] || 0;
  };

  // Render picks list
  const renderPicks = () => {
    const picks = [];
    
    Object.entries(selectedPicks).forEach(([gameId, pickObj]) => {
      const game = findGame(gameId);
      if (!game) return;

      const gameName = `${game.awayTeam} @ ${game.homeTeam}`;
      const sportLabel = game.sport ? ` (${game.sport})` : '';

      if (pickObj.spread) {
        const team = pickObj.spread === 'away' ? game.awayTeam : game.homeTeam;
        const spread = pickObj.spread === 'away' ? game.awaySpread : game.homeSpread;
        const moneyline = pickObj.spread === 'away' ? game.awayMoneyline : game.homeMoneyline;
        const pickId = getPickId(gameId, 'spread');

        picks.push(
          <div key={pickId} className="betting-slip-pick">
            <div className="pick-header">
              <span className="pick-team">{team}</span>
              <button 
                className="remove-pick-btn" 
                onClick={() => onRemovePick(gameId, 'spread')}
                title="Remove pick"
              >
                ×
              </button>
            </div>
            <div className="pick-details">
              <div className="pick-game">{gameName}{sportLabel}</div>
              <div className="pick-odds">
                Spread: {spread || '--'} {moneyline && `(${moneyline})`}
              </div>
            </div>
            {activeTab === 'single' && (
              <div className="pick-bet-amount">
                <input
                  type="number"
                  min={MIN_BET}
                  max={MAX_BET}
                  step="0.01"
                  placeholder={`$${MIN_BET} - $${MAX_BET}`}
                  value={individualBetAmounts?.[pickId] || ''}
                  onChange={(e) => setIndividualBetAmounts({
                    ...individualBetAmounts,
                    [pickId]: e.target.value
                  })}
                  className="bet-amount-input"
                />
              </div>
            )}
          </div>
        );
      }

      if (pickObj.total) {
        const pickId = getPickId(gameId, 'total');
        
        picks.push(
          <div key={pickId} className="betting-slip-pick">
            <div className="pick-header">
              <span className="pick-team">{pickObj.total === 'over' ? 'Over' : 'Under'} {game.total}</span>
              <button 
                className="remove-pick-btn" 
                onClick={() => onRemovePick(gameId, 'total')}
                title="Remove pick"
              >
                ×
              </button>
            </div>
            <div className="pick-details">
              <div className="pick-game">{gameName}{sportLabel}</div>
              <div className="pick-odds">Total: {game.total}</div>
            </div>
            {activeTab === 'single' && (
              <div className="pick-bet-amount">
                <input
                  type="number"
                  min={MIN_BET}
                  max={MAX_BET}
                  step="0.01"
                  placeholder={`$${MIN_BET} - $${MAX_BET}`}
                  value={individualBetAmounts?.[pickId] || ''}
                  onChange={(e) => setIndividualBetAmounts({
                    ...individualBetAmounts,
                    [pickId]: e.target.value
                  })}
                  className="bet-amount-input"
                />
              </div>
            )}
          </div>
        );
      }
    });

    return picks;
  };

  const minPicks = activeTab === 'single' ? 1 : 3;
  const canSubmit = pickCount >= minPicks;
  const totalSingleBet = calculateTotalSingleBet();
  const singlePayout = calculateSinglePayout();

  return (
    <div className={`betting-slip ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="betting-slip-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="slip-title">
          <span className="slip-icon">🎟️</span>
          <span>Betting Slip</span>
          {pickCount > 0 && <span className="pick-count-badge">{pickCount}</span>}
        </div>
        <button className="expand-toggle">
          {isExpanded ? '▼' : '▲'}
        </button>
      </div>

      {isExpanded && (
        <div className="betting-slip-content">
          {/* Tabs */}
          <div className="betting-slip-tabs">
            <button
              className={`tab ${activeTab === 'single' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('single');
                if (onBetTypeChange) onBetTypeChange('single');
              }}
            >
              Single
            </button>
            <button
              className={`tab ${activeTab === 'parlay' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('parlay');
                if (onBetTypeChange) onBetTypeChange('parlay');
              }}
            >
              Parlay
            </button>
          </div>

          {/* Picks */}
          <div className="betting-slip-picks">
            {pickCount === 0 ? (
              <div className="empty-slip-message">
                <p>No picks selected</p>
                <p className="empty-slip-hint">
                  Click on odds to add bets to your slip
                </p>
              </div>
            ) : (
              renderPicks()
            )}
          </div>

          {/* Summary */}
          {pickCount > 0 && (
            <div className="betting-slip-summary">
              {activeTab === 'single' ? (
                <>
                  <div className="summary-row">
                    <span>Total Stake:</span>
                    <span className="summary-value">${totalSingleBet.toFixed(2)}</span>
                  </div>
                  <div className="summary-row">
                    <span>Potential Payout:</span>
                    <span className="summary-value highlight">${singlePayout.toFixed(2)}</span>
                  </div>
                  <div className="summary-row">
                    <span>Potential Profit:</span>
                    <span className="summary-value profit">${(singlePayout - totalSingleBet).toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="summary-row">
                    <span>Picks:</span>
                    <span className="summary-value">{pickCount}</span>
                  </div>
                  <div className="summary-row">
                    <span>Multiplier:</span>
                    <span className="summary-value">{getParlayMultiplier(pickCount)}x</span>
                  </div>
                  {!canSubmit && (
                    <div className="min-picks-message">
                      Need {minPicks - pickCount} more pick{minPicks - pickCount > 1 ? 's' : ''}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="betting-slip-actions">
            {pickCount > 0 && (
              <button
                className="btn-clear"
                onClick={onClearAll}
              >
                Clear All
              </button>
            )}
            <button
              className="btn-submit"
              onClick={onSubmit}
              disabled={!canSubmit}
            >
              {canSubmit ? 'Place Bet' : `Select ${minPicks - pickCount} More`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default BettingSlip;
