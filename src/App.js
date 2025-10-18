import './App.css';
import React, { useState, useEffect } from "react";

// Constants
const VENMO_USERNAME = process.env.REACT_APP_VENMO_USERNAME || 'EGTSports';
const MIN_BET = parseInt(process.env.REACT_APP_MIN_BET) || 5;
const MAX_BET = parseInt(process.env.REACT_APP_MAX_BET) || 100;
const GOOGLE_SHEET_URL = process.env.REACT_APP_GOOGLE_SHEET_URL || 'https://script.google.com/macros/s/AKfycbzPastor8yKkWQxKx1z0p-0ZibwBJHkJCuVvHDqP9YX7Dv1-vwakdR9RU6Y6oNw4T2W2PA/exec';

// Payout multipliers based on requirements
const PAYOUT_MULTIPLIERS = {
  3: 6,
  4: 10,
  5: 20,
  6: 40,
  7: 75,
  8: 150
};

// Main App Component
function App() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPicks, setSelectedPicks] = useState({});
  const [showCheckout, setShowCheckout] = useState(false);
  const [ticketNumber, setTicketNumber] = useState('');
  const [contactInfo, setContactInfo] = useState({ name: '', email: '', betAmount: '' });
  const [hasSubmitted, setHasSubmitted] = useState(false);

  useEffect(() => {
    loadGames();
    const interval = setInterval(loadGames, 300000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, []);

  const loadGames = async () => {
    setLoading(true);
    try {
      const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard');
      const data = await response.json();
      const formattedGames = data.events.map((event, index) => {
        const competition = event.competitions[0];
        const awayTeam = competition.competitors[1];
        const homeTeam = competition.competitors[0];
        const status = event.status.type.state;
        
        // Extract odds/spreads if available
        let awaySpread = '';
        let homeSpread = '';
        let total = '';
        
        if (competition.odds && competition.odds.length > 0) {
          const odds = competition.odds[0];
          if (odds.details) {
            awaySpread = odds.details;
          }
          if (odds.overUnder) {
            total = odds.overUnder.toString();
          }
        }

        return {
          id: index + 1,
          espnId: event.id,
          date: new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
          time: new Date(event.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          awayTeam: awayTeam.team.displayName,
          homeTeam: homeTeam.team.displayName,
          awayTeamId: awayTeam.id,
          homeTeamId: homeTeam.id,
          awayScore: awayTeam.score || '0',
          homeScore: homeTeam.score || '0',
          awaySpread: awaySpread,
          homeSpread: homeSpread,
          total: total,
          status: status,
          statusDetail: event.status.type.detail,
          isFinal: status === 'post'
        };
      });
      setGames(formattedGames);
    } catch (error) {
      console.error('Error loading games:', error);
    }
    setLoading(false);
  };

  const saveSubmission = async (submission) => {
    try {
      await fetch(GOOGLE_SHEET_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(submission)
      });
      console.log('Submission sent to Google Sheets');
    } catch (error) {
      console.error('Error sending to Google Sheets:', error);
    }
  };

  const toggleSpread = (gameId, teamType) => {
    setSelectedPicks(prev => {
      const prevPick = prev[gameId] || {};
      return {
        ...prev,
        [gameId]: {
          ...prevPick,
          spread: prevPick.spread === teamType ? undefined : teamType
        }
      };
    });
  };

  const toggleTotal = (gameId, overUnder) => {
    setSelectedPicks(prev => {
      const prevPick = prev[gameId] || {};
      return {
        ...prev,
        [gameId]: {
          ...prevPick,
          total: prevPick.total === overUnder ? undefined : overUnder
        }
      };
    });
  };

  const generateTicketNumber = () => {
    const timestamp = Date.now();
    return `EGT-${timestamp}`;
  };

  const getPickCount = () => {
    let pickCount = 0;
    Object.values(selectedPicks).forEach(obj => {
      if (obj.spread) pickCount++;
      if (obj.total) pickCount++;
    });
    return pickCount;
  };

  const calculatePayout = (betAmount, pickCount) => {
    const multiplier = PAYOUT_MULTIPLIERS[pickCount] || 0;
    return (betAmount * multiplier).toFixed(2);
  };

  const submitPicks = () => {
    const pickCount = getPickCount();
    if (pickCount < 3) {
      alert('Please select at least 3 picks!');
      return;
    }
    const newTicketNumber = generateTicketNumber();
    setTicketNumber(newTicketNumber);
    setShowCheckout(true);
  };

  const openVenmo = () => {
    const betAmount = contactInfo.betAmount;
    const note = encodeURIComponent("EGT Sports - " + ticketNumber);
    
    // Try mobile app first
    const venmoAppUrl = `venmo://paycharge?txn=pay&recipients=${VENMO_USERNAME}&amount=${betAmount}&note=${note}`;
    
    // Fallback to web
    const venmoWebUrl = `https://venmo.com/?txn=pay&audience=private&recipients=${VENMO_USERNAME}&amount=${betAmount}&note=${note}`;
    
    // Try to open the app
    window.location.href = venmoAppUrl;
    
    // If app doesn't open, fallback to web after a delay
    setTimeout(() => {
      window.open(venmoWebUrl, '_blank');
    }, 1000);
  };

  const handleCheckoutSubmit = () => {
    const betAmount = parseFloat(contactInfo.betAmount);

    // Validate contact information
    if (!contactInfo.name || !contactInfo.email) {
      alert('Please fill in all contact information');
      return;
    }
    
    // Validate bet amount exists and is positive
    if (!betAmount || betAmount <= 0) {
      alert('Please enter a valid bet amount');
      return;
    }
    
    // Validate minimum bet
    if (betAmount < MIN_BET) {
      alert(`Minimum bet is $${MIN_BET.toFixed(2)}`);
      return;
    }
    
    // Validate maximum bet
    if (betAmount > MAX_BET) {
      alert(`Maximum bet is $${MAX_BET}`);
      return;
    }

    const picksFormatted = [];
    Object.entries(selectedPicks).forEach(([gameId, pickObj]) => {
      const game = games.find(g => g.id === parseInt(gameId));
      const gameName = `${game.awayTeam} @ ${game.homeTeam}`;
      
      if (pickObj.spread) {
        const team = pickObj.spread === 'away' ? game.awayTeam : game.homeTeam;
        const spread = pickObj.spread === 'away' ? game.awaySpread : game.homeSpread;
        picksFormatted.push({
          gameId: game.espnId,
          gameName: gameName,
          pickType: 'spread',
          team,
          spread,
          pickedTeamType: pickObj.spread
        });
      }
      if (pickObj.total) {
        picksFormatted.push({
          gameId: game.espnId,
          gameName: gameName,
          pickType: 'total',
          overUnder: pickObj.total,
          total: game.total
        });
      }
    });

    const submission = {
      ticketNumber,
      timestamp: new Date().toISOString(),
      contactInfo: {
        name: contactInfo.name,
        email: contactInfo.email,
        confirmMethod: 'email'
      },
      betAmount: betAmount,
      picks: picksFormatted,
      paymentStatus: 'pending'
    };

    saveSubmission(submission);
    setHasSubmitted(true);

    // Open Venmo
    openVenmo();
  };

  if (loading) {
    return (
      <div className="gradient-bg" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh'}}>
        <div className="text-white" style={{fontSize: '24px'}}>Loading games from ESPN...</div>
      </div>
    );
  }

  const pickCount = getPickCount();
  const canSubmit = pickCount >= 3;

  if (hasSubmitted) {
    const payout = contactInfo.betAmount ? calculatePayout(parseFloat(contactInfo.betAmount), pickCount) : '0.00';
    
    return (
      <div className="gradient-bg">
        <div className="container" style={{maxWidth: '600px'}}>
          <div className="card text-center">
            <h2 style={{color: '#28a745', marginBottom: '20px'}}>✅ Ticket Submitted!</h2>
            <div style={{background: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '24px'}}>
              <div style={{fontSize: '12px', color: '#666', marginBottom: '8px'}}>TICKET NUMBER</div>
              <div style={{fontSize: '24px', fontWeight: 'bold', color: '#28a745'}}>{ticketNumber}</div>
            </div>
            <p style={{marginBottom: '20px'}}>Your ticket has been submitted successfully! A confirmation email has been sent to <strong>{contactInfo.email}</strong>.</p>
            <div style={{background: '#d1ecf1', border: '2px solid #0c5460', borderRadius: '8px', padding: '16px', marginBottom: '20px', fontSize: '14px', color: '#0c5460'}}>
              <strong>Payment Required:</strong> Please send <strong>${contactInfo.betAmount}</strong> to <strong>@{VENMO_USERNAME}</strong> on Venmo with note: <strong>"{ticketNumber}"</strong>
              <div style={{marginTop: '12px', fontSize: '16px', fontWeight: 'bold', color: '#28a745'}}>
                Potential Payout: ${payout}
              </div>
            </div>
            <button
              className="btn btn-primary"
              onClick={openVenmo}
              style={{width: '100%', padding: '16px 32px', fontSize: '18px', marginBottom: '20px'}}
            >
              Pay with Venmo
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={() => window.location.reload()}
              style={{width: '100%', fontSize: '18px'}}
            >
              Submit Another Ticket
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showCheckout) {
    const payout = contactInfo.betAmount ? calculatePayout(parseFloat(contactInfo.betAmount), pickCount) : '0.00';
    
    return (
      <div className="gradient-bg">
        <div className="container" style={{maxWidth: '600px'}}>
          <div className="text-center text-white mb-4">
            <h1>🏈 Checkout</h1>
          </div>
          <button className="btn btn-secondary mb-2" onClick={() => setShowCheckout(false)}>← Back to Picks</button>
          <div className="card">
            <div style={{background: '#f8f9fa', padding: '20px', borderRadius: '8px', textAlign: 'center', marginBottom: '24px'}}>
              <div style={{fontSize: '12px', color: '#666', marginBottom: '8px'}}>TICKET NUMBER</div>
              <div style={{fontSize: '24px', fontWeight: 'bold', color: '#28a745'}}>{ticketNumber}</div>
            </div>
            
            <h3 className="mb-2">Your Picks ({pickCount})</h3>
            {Object.entries(selectedPicks).map(([gameId, pickObj]) => {
              const game = games.find(g => g.id === parseInt(gameId));
              return (
                <div key={gameId}>
                  {pickObj.spread && (
                    <div style={{display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#f8f9fa', borderRadius: '8px', marginBottom: '4px'}}>
                      <strong>[SPREAD] {pickObj.spread === 'away' ? game.awayTeam : game.homeTeam}</strong>
                      <span>{pickObj.spread === 'away' ? game.awaySpread : game.homeSpread}</span>
                    </div>
                  )}
                  {pickObj.total && (
                    <div style={{display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#f8f9fa', borderRadius: '8px', marginBottom: '4px'}}>
                      <strong>[TOTAL] {pickObj.total === 'over' ? 'Over' : 'Under'} {game.total}</strong>
                      <span>{game.awayTeam} @ {game.homeTeam}</span>
                    </div>
                  )}
                </div>
              );
            })}
            
            <h3 className="mb-2" style={{marginTop: '32px'}}>Contact Information</h3>
            <p style={{fontSize: '14px', color: '#666', marginBottom: '16px'}}>
              You will receive a confirmation email with your ticket details.
            </p>
            
            <label>Full Name *</label>
            <input 
              type="text" 
              value={contactInfo.name} 
              onChange={(e) => setContactInfo({...contactInfo, name: e.target.value})} 
              placeholder="Enter your full name"
            />

            <label>Email *</label>
            <input 
              type="email" 
              value={contactInfo.email} 
              onChange={(e) => setContactInfo({...contactInfo, email: e.target.value})} 
              placeholder="your.email@example.com"
            />

            <label>Bet Amount * (Min ${MIN_BET}, Max ${MAX_BET})</label>
            <input 
              type="number" 
              value={contactInfo.betAmount} 
              onChange={(e) => setContactInfo({...contactInfo, betAmount: e.target.value})} 
              placeholder={`Enter amount ($${MIN_BET} - $${MAX_BET})`}
              min={MIN_BET}
              max={MAX_BET}
              step="0.01"
            />
            
            {contactInfo.betAmount && parseFloat(contactInfo.betAmount) >= MIN_BET && (
              <div style={{background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', padding: '16px', marginBottom: '16px', textAlign: 'center'}}>
                <div style={{fontSize: '14px', color: '#155724', marginBottom: '4px'}}>Potential Payout</div>
                <div style={{fontSize: '28px', fontWeight: 'bold', color: '#28a745'}}>${payout}</div>
                <div style={{fontSize: '12px', color: '#155724', marginTop: '4px'}}>
                  ({pickCount} picks × {PAYOUT_MULTIPLIERS[pickCount]}x multiplier)
                </div>
              </div>
            )}
            
            <button 
              className="btn btn-success" 
              onClick={handleCheckoutSubmit} 
              style={{width: '100%', fontSize: '18px', marginTop: '16px', padding: '16px'}}
            >
              Submit & Pay
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gradient-bg">
      <div className="container">
        <div className="text-center text-white mb-4">
          <h1 style={{fontSize: '48px', marginBottom: '8px'}}>🏈 EGT Sports Parlay Club</h1>
          <p style={{fontSize: '24px', marginBottom: '0'}}>NFL Picks & Parlays</p>
        </div>
        
        <div className="card">
          <h2 className="text-center mb-2">Payout Odds</h2>
          <div className="payout-grid">
            {[
              {picks: 3, multiplier: 6}, 
              {picks: 4, multiplier: 10}, 
              {picks: 5, multiplier: 20}, 
              {picks: 6, multiplier: 40}, 
              {picks: 7, multiplier: 75}, 
              {picks: 8, multiplier: 150}
            ].map(item => (
              <div key={item.picks} style={{background: '#f8f9fa', padding: '14px', borderRadius: '8px', textAlign: 'center', border: '2px solid #e0e0e0'}}>
                <div style={{fontSize: '14px', fontWeight: '600'}}>{item.picks} Picks</div>
                <div style={{fontSize: '20px', fontWeight: 'bold', color: '#28a745'}}>{item.multiplier}x</div>
              </div>
            ))}
          </div>
        </div>
        {games.map(game => {
          const pickObj = selectedPicks[game.id] || {};
          return (
            <div key={game.id} className="game-card">
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '12px', borderBottom: '2px solid #f0f0f0', flexWrap: 'wrap', gap: '8px'}}>
                <span>{game.date} - {game.time}</span>
              </div>
              {game.isFinal && (
                <div className="final-header">
                  <div style={{textAlign: 'center', fontWeight: '600', color: '#dc3545', marginBottom: '12px', fontSize: '16px'}}>
                    FINAL SCORE
                  </div>
                  <div style={{display: 'flex', justifyContent: 'space-around', alignItems: 'center', fontSize: '18px', fontWeight: 'bold'}}>
                    <div style={{textAlign: 'center'}}>
                      <div style={{color: '#333', marginBottom: '8px'}}>{game.awayTeam}</div>
                      <div style={{fontSize: '32px', color: '#007bff'}}>{game.awayScore}</div>
                    </div>
                    <div style={{fontSize: '24px', color: '#999'}}>-</div>
                    <div style={{textAlign: 'center'}}>
                      <div style={{color: '#333', marginBottom: '8px'}}>{game.homeTeam}</div>
                      <div style={{fontSize: '32px', color: '#007bff'}}>{game.homeScore}</div>
                    </div>
                  </div>
                </div>
              )}
              <div
                className={`team-row ${pickObj.spread === 'away' ? 'selected' : ''} ${game.isFinal ? 'disabled' : ''}`}
                onClick={() => !game.isFinal && toggleSpread(game.id, 'away')}
              >
                <div className="team-info">
                  <span className="team-name">{game.awayTeam}</span>
                  {game.isFinal && <span className="final-score-badge">{game.awayScore}</span>}
                </div>
                <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                  <span className="badge">AWAY</span>
                  <span className="team-spread">{game.awaySpread || '--'}</span>
                </div>
              </div>
              <div style={{textAlign: 'center', color: '#999', margin: '8px 0', fontSize: '14px'}}>@</div>
              <div
                className={`team-row ${pickObj.spread === 'home' ? 'selected' : ''} ${game.isFinal ? 'disabled' : ''}`}
                onClick={() => !game.isFinal && toggleSpread(game.id, 'home')}
              >
                <div className="team-info">
                  <span className="team-name">{game.homeTeam}</span>
                  {game.isFinal && <span className="final-score-badge">{game.homeScore}</span>}
                </div>
                <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                  <span className="badge">HOME</span>
                  <span className="team-spread">{game.homeSpread || '--'}</span>
                </div>
              </div>
              {game.total && (
                <div style={{textAlign: 'center', color: '#333', margin: '16px 0', padding: '12px', background: '#f8f9fa', borderRadius: '8px'}}>
                  <div style={{marginBottom: '8px'}}><strong>Total:</strong> {game.total}</div>
                  <div style={{display: 'flex', justifyContent: 'center', gap: '12px'}}>
                    <button
                      type="button"
                      className="btn"
                      style={{
                        background: pickObj.total === 'over' ? '#28a745' : '#fff',
                        color: pickObj.total === 'over' ? '#fff' : '#333',
                        border: '2px solid #28a745',
                        fontWeight: 'bold',
                        padding: '8px 20px'
                      }}
                      disabled={game.isFinal}
                      onClick={() => !game.isFinal && toggleTotal(game.id, 'over')}
                    >Over</button>
                    <button
                      type="button"
                      className="btn"
                      style={{
                        background: pickObj.total === 'under' ? '#dc3545' : '#fff',
                        color: pickObj.total === 'under' ? '#fff' : '#333',
                        border: '2px solid #dc3545',
                        fontWeight: 'bold',
                        padding: '8px 20px'
                      }}
                      disabled={game.isFinal}
                      onClick={() => !game.isFinal && toggleTotal(game.id, 'under')}
                    >Under</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div className="text-center mb-4">
          <div className="text-white mb-2" style={{fontSize: '20px'}}>
            Selected: {pickCount} pick{pickCount !== 1 ? 's' : ''}
            {!canSubmit && <div style={{color: '#ffc107'}}>(minimum 3 required)</div>}
          </div>
          <button
            className="btn btn-success"
            onClick={submitPicks}
            disabled={!canSubmit}
            style={{padding: '18px 56px', fontSize: '20px'}}
          >
            {canSubmit ? 'Continue to Checkout →' : `Select ${3 - pickCount} More`}
          </button>
        </div>
        
        <div className="card">
          <h3 className="mb-2">Important Rules</h3>
          <ul style={{marginLeft: '20px', lineHeight: '1.8'}}>
            <li><strong>Minimum 3 picks required</strong></li>
            <li><strong>Bet range: ${MIN_BET} - ${MAX_BET}</strong></li>
            <li>All picks must win for parlay to pay out</li>
            <li>Funds must be sent via Venmo to <strong>@{VENMO_USERNAME}</strong> after submission</li>
            <li>Cannot bet on games already completed</li>
            <li>You will receive confirmation via email</li>
          </ul>
        </div>
        
        <div style={{textAlign: 'center', padding: '20px', color: 'white', fontSize: '14px'}}>
          For entertainment only. 21+ only. Private pool among friends.
        </div>
      </div>
    </div>
  );
}

export default App;