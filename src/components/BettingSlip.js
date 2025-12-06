import React, { useState, useEffect } from 'react';
import './BettingSlip.css';

/**
 * BettingSlip Component - A persistent floating betting slip that follows the user
 * Supports both Single bets and Parlay bets with tab switching
 */

// Mobile breakpoint constant
const MOBILE_BREAKPOINT = 768;

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
  parlayBetAmount,
  onParlayBetAmountChange,
  MIN_BET,
  MAX_BET,
  userCredit
}) {
  // On mobile, start collapsed; on desktop, start expanded
  // Default to expanded for SSR safety, then update on mount
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState(betType === 'straight' ? 'single' : 'parlay');
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile on mount and set initial expanded state
  useEffect(() => {
    const checkMobile = typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT;
    setIsMobile(checkMobile);
    setIsExpanded(!checkMobile);
  }, []);

  // Update expanded state on window resize
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleResize = () => {
      const checkMobile = window.innerWidth <= MOBILE_BREAKPOINT;
      setIsMobile(checkMobile);
      // If transitioning from mobile to desktop, expand the slip
      if (!checkMobile && !isExpanded) {
        setIsExpanded(true);
      }
      // If on mobile and expanded, optionally collapse (maintain user choice)
      // We don't auto-collapse on mobile to respect user preference
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isExpanded]);

  // Sync activeTab when betType changes externally
  useEffect(() => {
    setActiveTab(betType === 'straight' ? 'single' : 'parlay');
  }, [betType]);

  // Calculate pick count
  let pickCount = 0;
  Object.values(selectedPicks).forEach(obj => {
    if (obj.winner) pickCount++;
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

  // Calculate total bet amount for singles - only sum amounts for active picks
  const calculateTotalSingleBet = () => {
    let total = 0;
    // Iterate over active picks only, not all bet amounts
    // This ensures removed bets are never included in the total
    Object.entries(selectedPicks).forEach(([gameId, pickObj]) => {
      if (pickObj.winner) {
        const pickId = getPickId(gameId, 'winner');
        const amount = parseFloat(individualBetAmounts?.[pickId] || 0);
        if (!isNaN(amount) && amount > 0) {
          total += amount;
        }
      }
      if (pickObj.spread) {
        const pickId = getPickId(gameId, 'spread');
        const amount = parseFloat(individualBetAmounts?.[pickId] || 0);
        if (!isNaN(amount) && amount > 0) {
          total += amount;
        }
      }
      if (pickObj.total) {
        const pickId = getPickId(gameId, 'total');
        const amount = parseFloat(individualBetAmounts?.[pickId] || 0);
        if (!isNaN(amount) && amount > 0) {
          total += amount;
        }
      }
    });
    return total;
  };

  // Calculate winnings based on American odds
  const calculateWinnings = (stake, odds) => {
    const numericOdds = parseFloat(odds);
    if (isNaN(numericOdds) || stake <= 0) return 0;
    
    if (numericOdds < 0) {
      // Favorites: Amount won = Stake × (100 / |odds|)
      return stake * (100 / Math.abs(numericOdds));
    } else {
      // Underdogs: Amount won = Stake × (odds / 100)
      return stake * (numericOdds / 100);
    }
  };

  // Calculate potential payout for singles (returns total payout = stake + winnings)
  const calculateSinglePayout = () => {
    let totalPayout = 0;
    Object.entries(selectedPicks).forEach(([gameId, pickObj]) => {
      const game = findGame(gameId);
      if (!game) return;

      // Winner (Moneyline) bets
      if (pickObj.winner) {
        const pickId = getPickId(gameId, 'winner');
        const betAmount = parseFloat(individualBetAmounts?.[pickId] || 0);
        const moneyline = pickObj.winner === 'away' ? game.awayMoneyline : game.homeMoneyline;
        
        if (betAmount > 0 && moneyline) {
          const winnings = calculateWinnings(betAmount, moneyline);
          totalPayout += betAmount + winnings; // stake + winnings
        }
      }

      // Spread (Points Handicap) bets
      if (pickObj.spread) {
        const pickId = getPickId(gameId, 'spread');
        const betAmount = parseFloat(individualBetAmounts?.[pickId] || 0);
        // Spread bets typically have -110 odds (sometimes varies)
        const spreadOdds = pickObj.spread === 'away' ? (game.awaySpreadOdds || '-110') : (game.homeSpreadOdds || '-110');
        
        if (betAmount > 0) {
          const winnings = calculateWinnings(betAmount, spreadOdds);
          totalPayout += betAmount + winnings; // stake + winnings
        }
      }

      // Total (Over/Under) bets
      if (pickObj.total) {
        const pickId = getPickId(gameId, 'total');
        const betAmount = parseFloat(individualBetAmounts?.[pickId] || 0);
        // Totals typically have -110 odds
        const totalOdds = '-110';
        
        if (betAmount > 0) {
          const winnings = calculateWinnings(betAmount, totalOdds);
          totalPayout += betAmount + winnings; // stake + winnings
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

      // Handle winner (moneyline) picks
      if (pickObj.winner) {
        const team = pickObj.winner === 'away' ? game.awayTeam : game.homeTeam;
        const moneyline = pickObj.winner === 'away' ? game.awayMoneyline : game.homeMoneyline;
        const pickId = getPickId(gameId, 'winner');

        picks.push(
          <div key={pickId} className="betting-slip-pick">
            <div className="pick-header">
              <span className="pick-team">{team}</span>
              <button 
                className="remove-pick-btn" 
                onClick={() => onRemovePick(gameId, 'winner')}
                title="Remove pick"
              >
                ×
              </button>
            </div>
            <div className="pick-details">
              <div className="pick-game">{gameName}{sportLabel}</div>
              <div className="pick-odds">
                Moneyline: {moneyline || '--'}
              </div>
            </div>
            {activeTab === 'single' && (
              <div className="pick-bet-amount">
                <input
                  type="number"
                  min={MIN_BET}
                  max={MAX_BET}
                  step="0.01"
                  placeholder={`$${5} - $${250}`}
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

      // Handle spread (points handicap) picks
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
                  placeholder={`$${5} - $${250}`}
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
                  placeholder={`$${5} - $${250}`}
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
          <span>
            {isMobile 
              ? (isExpanded 
                  ? 'Betting Slip (Minimize to Continue Betting)' 
                  : 'Betting Slip (Expand to Place Bet)')
              : 'Betting Slip'}
          </span>
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
                if (onBetTypeChange) onBetTypeChange('straight');
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
              {/* Credit Limit Display */}
              {userCredit && (
                <div className="credit-limit-display" style={{
                  marginBottom: '12px',
                  padding: '10px',
                  background: '#e7f3ff',
                  borderRadius: '6px',
                  border: '1px solid #b8daff'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                    <span style={{ color: '#004085' }}>💰 Credit Limit:</span>
                    <span style={{ fontWeight: 'bold', color: '#004085' }}>${userCredit.creditLimit.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                    <span style={{ color: '#856404' }}>📊 Total Wagered:</span>
                    <span style={{ fontWeight: 'bold', color: '#856404' }}>${userCredit.totalWagered.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold' }}>
                    <span style={{ color: (userCredit.creditLimit - userCredit.totalWagered) > 0 ? '#155724' : '#721c24' }}>
                      ✅ Remaining:
                    </span>
                    <span style={{ color: (userCredit.creditLimit - userCredit.totalWagered) > 0 ? '#155724' : '#721c24' }}>
                      ${(userCredit.creditLimit - userCredit.totalWagered).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

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
                  {/* Warning if exceeding credit limit */}
                  {userCredit && totalSingleBet > (userCredit.creditLimit - userCredit.totalWagered) && (
                    <div style={{
                      marginTop: '10px',
                      padding: '8px',
                      background: '#f8d7da',
                      borderRadius: '6px',
                      border: '1px solid #f5c6cb',
                      color: '#721c24',
                      fontSize: '12px',
                      textAlign: 'center'
                    }}>
                      ⚠️ Wager exceeds remaining credit by ${(totalSingleBet - (userCredit.creditLimit - userCredit.totalWagered)).toFixed(2)}
                    </div>
                  )}
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
                  {canSubmit && (
                    <>
                      <div className="parlay-bet-input">
                        <label htmlFor="parlay-amount">Parlay Wager:</label>
                        <input
                          id="parlay-amount"
                          type="number"
                          min="1"
                          max={MAX_BET}
                          step="0.01"
                          placeholder={`$1 - $${MAX_BET}`}
                          value={parlayBetAmount || ''}
                          onChange={(e) => onParlayBetAmountChange && onParlayBetAmountChange(e.target.value)}
                          className="bet-amount-input"
                        />
                      </div>
                      {parlayBetAmount && parseFloat(parlayBetAmount) > 0 && (
                        <>
                          <div className="summary-row">
                            <span>Potential Payout:</span>
                            <span className="summary-value highlight">
                              ${(parseFloat(parlayBetAmount) * getParlayMultiplier(pickCount)).toFixed(2)}
                            </span>
                          </div>
                          <div className="summary-row">
                            <span>Potential Profit:</span>
                            <span className="summary-value profit">
                              ${((parseFloat(parlayBetAmount) * getParlayMultiplier(pickCount)) - parseFloat(parlayBetAmount)).toFixed(2)}
                            </span>
                          </div>
                          {/* Warning if parlay exceeds credit limit */}
                          {userCredit && parseFloat(parlayBetAmount) > (userCredit.creditLimit - userCredit.totalWagered) && (
                            <div style={{
                              marginTop: '10px',
                              padding: '8px',
                              background: '#f8d7da',
                              borderRadius: '6px',
                              border: '1px solid #f5c6cb',
                              color: '#721c24',
                              fontSize: '12px',
                              textAlign: 'center'
                            }}>
                              ⚠️ Wager exceeds remaining credit by ${(parseFloat(parlayBetAmount) - (userCredit.creditLimit - userCredit.totalWagered)).toFixed(2)}
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
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
