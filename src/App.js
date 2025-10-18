import './App.css';
import React, { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue } from "firebase/database";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyA9FsWV7hA4ow2Xaq0Krx9kCCMfMibkVOQ",
  authDomain: "marcs-parlays.firebaseapp.com",
  databaseURL: "https://marcs-parlays-default-rtdb.firebaseio.com",
  projectId: "marcs-parlays",
  storageBucket: "marcs-parlays.firebasestorage.app",
  messagingSenderId: "631281528889",
  appId: "1:631281528889:web:e3befe34907902387c1de8"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

const VENMO_USERNAME = 'EGTSports';
const MAX_BET = 100;
const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbwUU7CtC2OY-jHq3P5W5ytDm02WSuGQ8R8bSmYvsE20sYb7HZHBKJQIcG8n6Z_K6SlW/exec';

// Admin Panel Component
function AdminPanel({ user, games, setGames, isSyncing, setIsSyncing, recentlyUpdated, setRecentlyUpdated, submissions }) {
  const [showSubmissions, setShowSubmissions] = useState(false);

  const saveSpreadToFirebase = async () => {
    try {
      setIsSyncing(true);
      const spreadsData = {};
      games.forEach(game => {
        spreadsData[game.espnId] = {
          awaySpread: game.awaySpread || '',
          homeSpread: game.homeSpread || '',
          total: game.total || '',
          timestamp: new Date().toISOString()
        };
      });
      await set(ref(database, 'spreads'), spreadsData);
      alert('✅ Spreads saved! All devices will update in real-time.');
      setIsSyncing(false);
    } catch (error) {
      alert('❌ Error saving spreads:\n' + error.message);
      setIsSyncing(false);
    }
  };

  const updateSpread = (gameId, team, value) => {
    setGames(prevGames =>
      prevGames.map(game =>
        game.id === gameId
          ? { ...game, [team === 'away' ? 'awaySpread' : 'homeSpread']: value }
          : game
      )
    );
  };

  const updateTotal = (gameId, value) => {
    setGames(prevGames =>
      prevGames.map(game =>
        game.id === gameId
          ? { ...game, total: value }
          : game
      )
    );
  };

  const calculateResult = (submission) => {
    let wins = 0;
    let losses = 0;
    let pending = 0;

    submission.picks.forEach(pick => {
      const game = games.find(g => g.espnId === pick.gameId);
      if (!game || !game.isFinal) {
        pending++;
        return;
      }

      if (pick.pickType === 'spread') {
        const awayScore = parseInt(game.awayScore);
        const homeScore = parseInt(game.homeScore);
        const spread = parseFloat(pick.spread);
        let won = false;

        if (pick.pickedTeamType === 'away') {
          const adjustedScore = awayScore + spread;
          won = adjustedScore > homeScore;
        } else {
          const adjustedScore = homeScore + spread;
          won = adjustedScore > awayScore;
        }

        if (won) wins++;
        else losses++;
      } else if (pick.pickType === 'total') {
        const awayScore = parseInt(game.awayScore);
        const homeScore = parseInt(game.homeScore);
        const totalScore = awayScore + homeScore;
        const total = parseFloat(pick.total);
        let won = false;

        if (pick.overUnder === 'over') {
          won = totalScore > total;
        } else {
          won = totalScore < total;
        }

        if (won) wins++;
        else losses++;
      }
    });

    const allGamesComplete = pending === 0;
    const parlayWon = allGamesComplete && losses === 0 && wins === submission.picks.length;

    return { wins, losses, pending, allGamesComplete, parlayWon };
  };

  if (showSubmissions) {
    return (
      <div className="gradient-bg">
        <div className="container">
          <div className="card">
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
              <h1>Submissions ({submissions.length})</h1>
              <button className="btn btn-secondary" onClick={() => setShowSubmissions(false)}>Back</button>
            </div>
          </div>
          {submissions.length === 0 ? (
            <div className="card text-center">
              <p>No submissions yet</p>
            </div>
          ) : (
            submissions.slice().reverse().map((sub, idx) => {
              const result = calculateResult(sub);
              return (
                <div key={idx} className="card">
                  <div style={{marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'start'}}>
                    <div>
                      <strong style={{fontSize: '20px', color: '#28a745'}}>{sub.ticketNumber}</strong>
                      {sub.freePlay > 0 && <span className="free-play-badge">${sub.freePlay}</span>}
                      <div style={{color: '#666', fontSize: '14px'}}>{new Date(sub.timestamp).toLocaleString()}</div>
                    </div>
                    {result.allGamesComplete && (
                      <div style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        background: result.parlayWon ? '#28a745' : '#dc3545',
                        color: 'white'
                      }}>
                        {result.parlayWon ? 'WON' : 'LOST'}
                      </div>
                    )}
                  </div>
                  <div style={{marginBottom: '16px', padding: '16px', background: '#f8f9fa', borderRadius: '8px'}}>
                    <div><strong>Name:</strong> {sub.contactInfo.name}</div>
                    <div><strong>Email:</strong> {sub.contactInfo.email}</div>
                    <div><strong>Phone:</strong> {sub.contactInfo.phone}</div>
                    <div><strong>Bet:</strong> ${sub.betAmount.toFixed(2)}</div>
                  </div>
                  <div style={{marginBottom: '16px'}}>
                    <strong>Record: {result.wins}-{result.losses}</strong>
                    {result.pending > 0 && <span style={{color: '#666'}}> ({result.pending} pending)</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="gradient-bg">
      <div className="container">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <h1>Admin Panel <span className={`sync-indicator ${isSyncing ? 'syncing' : ''}`}></span></h1>
            <div style={{display: 'flex', gap: '8px'}}>
              <button className="btn btn-primary" onClick={() => setShowSubmissions(true)}>
                Submissions ({submissions.length})
              </button>
              <button className="btn btn-secondary" onClick={() => signOut(auth)}>Sign Out</button>
            </div>
          </div>
        </div>
        {games.map(game => (
          <div key={game.id} className="card">
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
              <span>{game.date} - {game.time}</span>
              {game.isFinal && (
                <span style={{ color: '#666', fontWeight: '600' }}>
                  FINAL: {game.awayTeam} {game.awayScore} - {game.homeScore} {game.homeTeam}
                </span>
              )}
            </div>
            <div>
              <label><strong>{game.awayTeam} (Away)</strong></label>
              <input type="text" value={game.awaySpread} onChange={(e) => updateSpread(game.id, 'away', e.target.value)} placeholder="+3.5" />
            </div>
            <div>
              <label><strong>{game.homeTeam} (Home)</strong></label>
              <input type="text" value={game.homeSpread} onChange={(e) => updateSpread(game.id, 'home', e.target.value)} placeholder="-3.5" />
            </div>
            <div>
              <label><strong>Total (O/U)</strong></label>
              <input
                type="text"
                value={game.total}
                onChange={(e) => updateTotal(game.id, e.target.value)}
                placeholder="42.5"
              />
            </div>
          </div>
        ))}
        <div className="card">
          <button className="btn btn-success" onClick={saveSpreadToFirebase} disabled={isSyncing} style={{ width: '100%', fontSize: '18px', padding: '16px' }}>
            {isSyncing ? 'Saving to Firebase...' : 'Save & Broadcast to All Devices'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Landing Page Component (for visitors)
function LandingPage({ games, loading }) {
  const [selectedPicks, setSelectedPicks] = useState({});
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [ticketNumber, setTicketNumber] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [contactInfo, setContactInfo] = useState({ name: '', email: '', phone: '', betAmount: '', confirmMethod: 'email', freePlay: 0 });
  const [submissions, setSubmissions] = useState([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('marcs-parlays-submissions');
    if (stored) setSubmissions(JSON.parse(stored));
  }, []);

  const saveSubmission = async (submission) => {
    const allSubmissions = [...submissions, submission];
    setSubmissions(allSubmissions);
    localStorage.setItem('marcs-parlays-submissions', JSON.stringify(allSubmissions));

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
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `TKT-${timestamp}-${random}`;
  };

  const submitPicks = () => {
    let pickCount = 0;
    Object.values(selectedPicks).forEach(obj => {
      if (obj.spread) pickCount++;
      if (obj.total) pickCount++;
    });
    if (pickCount < 3) {
      alert('Please select at least 3 picks!');
      return;
    }
    setTicketNumber(generateTicketNumber());
    setShowConfirmation(true);
  };

  const openVenmo = () => {
    const betAmount = contactInfo.betAmount;
    const note = encodeURIComponent("Marc's Parlays - " + ticketNumber);
    
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

    if (!contactInfo.name || !contactInfo.email || !contactInfo.phone) {
      alert('Please fill in all contact information');
      return;
    }
    if (!betAmount || betAmount <= 0) {
      alert('Please enter a valid bet amount');
      return;
    }
    if (betAmount > MAX_BET) {
      alert(`Maximum bet is $${MAX_BET}`);
      return;
    }

    const picksFormatted = [];
    Object.entries(selectedPicks).forEach(([gameId, pickObj]) => {
      const game = games.find(g => g.id === gameId);
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
        phone: contactInfo.phone,
        confirmMethod: contactInfo.confirmMethod
      },
      betAmount: betAmount,
      freePlay: 0,
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

  let pickCount = 0;
  Object.values(selectedPicks).forEach(obj => {
    if (obj.spread) pickCount++;
    if (obj.total) pickCount++;
  });
  const canSubmit = pickCount >= 3;

  const handleAdminClick = () => {
    window.location.href = '?admin=true';
  };

  if (hasSubmitted) {
    return (
      <div className="gradient-bg">
        <div className="container" style={{maxWidth: '600px'}}>
          <div className="card text-center">
            <h2 style={{color: '#28a745', marginBottom: '20px'}}>✅ Ticket Submitted!</h2>
            <div style={{background: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '24px'}}>
              <div style={{fontSize: '12px', color: '#666', marginBottom: '8px'}}>TICKET NUMBER</div>
              <div style={{fontSize: '24px', fontWeight: 'bold', color: '#28a745'}}>{ticketNumber}</div>
            </div>
            <p style={{marginBottom: '20px'}}>Your ticket has been submitted successfully!</p>
            <div style={{background: '#d1ecf1', border: '2px solid #0c5460', borderRadius: '8px', padding: '16px', marginBottom: '20px', fontSize: '14px', color: '#0c5460'}}>
              <strong>Payment Required:</strong> Please send <strong>${contactInfo.betAmount}</strong> to <strong>{VENMO_USERNAME}</strong> on Venmo with note: <strong>"{ticketNumber}"</strong>
            </div>
            <button
              className="btn btn-primary"
              onClick={openVenmo}
              style={{width: '100%', padding: '16px 32px', fontSize: '18px', marginBottom: '20px'}}
            >
              Open Venmo to Pay
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
    return (
      <div className="gradient-bg">
        <div className="container" style={{maxWidth: '600px'}}>
          <div className="text-center text-white mb-4">
            <h1>Checkout</h1>
          </div>
          <button className="btn btn-secondary mb-2" onClick={() => setShowCheckout(false)}>Back</button>
          <div className="card">
            <div style={{background: '#f8f9fa', padding: '20px', borderRadius: '8px', textAlign: 'center', marginBottom: '24px'}}>
              <div style={{fontSize: '12px', color: '#666', marginBottom: '8px'}}>TICKET NUMBER</div>
              <div style={{fontSize: '24px', fontWeight: 'bold', color: '#28a745'}}>{ticketNumber}</div>
            </div>
            <h3 className="mb-2">Your Picks ({pickCount})</h3>
            {Object.entries(selectedPicks).map(([gameId, pickObj]) => {
              const game = games.find(g => g.id === gameId);
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
            <label>Full Name *</label>
            <input type="text" value={contactInfo.name} onChange={(e) => setContactInfo({...contactInfo, name: e.target.value})} />

            <label>Email *</label>
            <input type="email" value={contactInfo.email} onChange={(e) => setContactInfo({...contactInfo, email: e.target.value})} />

            <label>Phone *</label>
            <input type="tel" value={contactInfo.phone} onChange={(e) => setContactInfo({...contactInfo, phone: e.target.value})} placeholder="(555) 123-4567" />

            <label>Bet Amount * (Max ${MAX_BET})</label>
            <input 
              type="number" 
              value={contactInfo.betAmount} 
              onChange={(e) => setContactInfo({...contactInfo, betAmount: e.target.value})} 
              placeholder="Enter amount"
              min="1"
              max={MAX_BET}
              step="0.01"
            />
            <label style={{marginBottom: '8px', display: 'block'}}>Confirmation Method *</label>
            <div className="radio-group">
              <label className="radio-label">
                <input 
                  type="radio" 
                  name="confirmMethod" 
                  value="email"
                  checked={contactInfo.confirmMethod === 'email'}
                  onChange={(e) => setContactInfo({...contactInfo, confirmMethod: e.target.value})}
                />
                Email
              </label>
              <label className="radio-label">
                <input 
                  type="radio" 
                  name="confirmMethod" 
                  value="text"
                  checked={contactInfo.confirmMethod === 'text'}
                  onChange={(e) => setContactInfo({...contactInfo, confirmMethod: e.target.value})}
                />
                Text Message
              </label>
            </div>
            <button className="btn btn-success" onClick={handleCheckoutSubmit} style={{width: '100%', fontSize: '18px', marginTop: '16px'}}>
              Continue to Payment
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
          <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', marginBottom: '16px', flexWrap: 'wrap'}}>
            <div>
              <h1 style={{fontSize: '42px'}}>Welcome to the EGT Sports Parlay Club!</h1>
              <p style={{fontSize: '22px'}}>Make your selections below to get started.</p>
            </div>
            <button className="btn btn-secondary" onClick={handleAdminClick} style={{height: 'fit-content'}}>
              Admin Login
            </button>
          </div>
        </div>
        <div className="card">
          <h2 className="text-center mb-2">Payout Odds</h2>
          <div className="payout-grid">
            {[
              {picks: 3, payout: '10 to 1'}, 
              {picks: 4, payout: '15 to 1'}, 
              {picks: 5, payout: '25 to 1'}, 
              {picks: 6, payout: '50 to 1'}, 
              {picks: 7, payout: '100 to 1'}, 
              {picks: 8, payout: '150 to 1'}, 
              {picks: 9, payout: '200 to 1'}, 
              {picks: 10, payout: '250 to 1'}
            ].map(item => (
              <div key={item.picks} style={{background: '#f8f9fa', padding: '14px', borderRadius: '8px', textAlign: 'center', border: '2px solid #e0e0e0'}}>
                <div style={{fontSize: '14px'}}>{item.picks} for {item.picks} pays</div>
                <div style={{fontSize: '18px', fontWeight: 'bold', color: '#28a745'}}>{item.payout}</div>
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
            {!canSubmit && <div style={{color: '#ffc107'}}>( minimum 3 required)</div>}
          </div>
          <button
            className="btn btn-success"
            onClick={submitPicks}
            disabled={!canSubmit}
            style={{padding: '18px 56px', fontSize: '20px'}}
          >
            {canSubmit ? 'Submit Picks' : `Select ${3 - pickCount} More`}
          </button>
        </div>
        <div className="card">
          <h3 className="mb-2">Important Rules</h3>
          <ul style={{marginLeft: '20px', lineHeight: '1.8'}}>
            <li><strong>Minimum 3 picks required</strong></li>
            <li><strong>Maximum bet: ${MAX_BET}</strong></li>
            <li>Missing info = voided ticket</li>
            <li>Ties count as a LOSS</li>
            <li>Funds must be deposited into players pool <strong>@{VENMO_USERNAME}</strong> prior  to games starting or ticket is not valid</li>
            <li>Winners paid following Tuesday</li>
            <li>Cannot bet on games already completed</li>
            <li>You will receive confirmation via your chosen method (email or text)</li>
            <li>Each time you participate, your club membership is renewed</li>
          </ul>
          <div style={{background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', padding: '16px', marginTop: '20px', fontSize: '14px', color: '#856404'}}>
            <strong>Legal Disclaimer:</strong> For entertainment only. 21+ only. Private pool among friends. Check local laws. By participating, you acknowledge responsibility for compliance with all applicable laws and regulations.
          </div>
        </div>
      </div>
      <div className={`modal ${showConfirmation ? 'active' : ''}`}>
        <div className="modal-content">
          <h2 className="text-center" style={{fontSize: '32px', color: '#28a745', marginBottom: '20px'}}>Picks Submitted!</h2>
          <div style={{background: '#f8f9fa', padding: '20px', borderRadius: '8px', textAlign: 'center', marginBottom: '24px'}}>
            <div style={{fontSize: '24px', fontWeight: 'bold'}}>{ticketNumber}</div>
          </div>
          <p className="text-center mb-4">Save this ticket number!</p>
          <button
            className="btn btn-primary"
            onClick={() => { setShowConfirmation(false); setShowCheckout(true); }}
            style={{width: '100%', fontSize: '18px'}}
          >
            Continue to Checkout
          </button>
        </div>
      </div>
    </div>
  );
}

// Main App Component
function App() {
  const [authState, setAuthState] = useState({
    loading: true,
    user: null,
    isAdmin: false,
    error: "",
  });
  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [recentlyUpdated, setRecentlyUpdated] = useState({});
  const [submissions, setSubmissions] = useState([]);

  useEffect(() => {
    loadGames();
    setTimeout(() => {
      setupFirebaseListener();
    }, 500);
    const interval = setInterval(loadGames, 300000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  const setupFirebaseListener = () => {
    try {
      const spreadsRef = ref(database, 'spreads');
      onValue(spreadsRef, (snapshot) => {
        if (snapshot.exists()) {
          const firebaseData = snapshot.val();
          setGames(prevGames => {
            let updated = false;
            const newGames = prevGames.map(game => {
              const espnId = game.espnId;
              if (firebaseData[espnId]) {
                const fbGame = firebaseData[espnId];
                const awaySpreadChanged = game.awaySpread !== fbGame.awaySpread;
                const homeSpreadChanged = game.homeSpread !== fbGame.homeSpread;
                const totalChanged = game.total !== fbGame.total;
                const changed = awaySpreadChanged || homeSpreadChanged || totalChanged;
                if (changed) {
                  updated = true;
                  setRecentlyUpdated(prev => ({
                    ...prev,
                    [game.id]: true
                  }));
                  setTimeout(() => {
                    setRecentlyUpdated(prev => ({
                      ...prev,
                      [game.id]: false
                    }));
                  }, 600);
                }
                return {
                  ...game,
                  awaySpread: fbGame.awaySpread || '',
                  homeSpread: fbGame.homeSpread || '',
                  total: fbGame.total || ''
                };
              }
              return game;
            });
            if (updated) {
              setIsSyncing(false);
            }
            return newGames;
          });
        }
      });
    } catch (error) {
      // ignore
    }
  };

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
        return {
          id: index + 1,
          espnId: event.id,
          date: new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
          time: new Date(event.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + ' ET',
          awayTeam: awayTeam.team.displayName,
          homeTeam: homeTeam.team.displayName,
          awayTeamId: awayTeam.id,
          homeTeamId: homeTeam.id,
          awayScore: awayTeam.score || '0',
          homeScore: homeTeam.score || '0',
          awaySpread: '',
          homeSpread: '',
          total: '',
          status: status,
          statusDetail: event.status.type.detail,
          isFinal: status === 'post'
        };
      });
      setGames(formattedGames);
    } catch (error) {
      // ignore
    }
    setLoading(false);
  };

  useEffect(() => {
    const stored = localStorage.getItem('marcs-parlays-submissions');
    if (stored) setSubmissions(JSON.parse(stored));
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const tokenResult = await user.getIdTokenResult(true);
        setAuthState({
          loading: false,
          user,
          isAdmin: tokenResult.claims.admin === true,
          error: "",
        });
      } else {
        setAuthState({
          loading: false,
          user: null,
          isAdmin: false,
          error: "",
        });
      }
    });
    return unsub;
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthState((a) => ({ ...a, loading: true, error: "" }));
    try {
      await signInWithEmailAndPassword(
        auth,
        loginForm.email,
        loginForm.password
      );
    } catch (err) {
      setAuthState((a) => ({
        ...a,
        loading: false,
        error: "Login failed: " + err.message,
      }));
    }
  };

  // Render UI
  if (authState.loading || loading) return (
    <div className="gradient-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="text-white" style={{ fontSize: '24px' }}>Loading games from ESPN...</div>
    </div>
  );

  if (authState.user && authState.isAdmin)
    return <AdminPanel user={authState.user} games={games} setGames={setGames} isSyncing={isSyncing} setIsSyncing={setIsSyncing} recentlyUpdated={recentlyUpdated} setRecentlyUpdated={setRecentlyUpdated} submissions={submissions} />;

  if (authState.user && !authState.isAdmin)
    return (
      <div className="gradient-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="card" style={{ maxWidth: '400px', width: '100%', margin: '0 auto', padding: 40 }}>
          <h2 className="text-center mb-4">Not Authorized</h2>
          <p style={{ textAlign: 'center', marginBottom: '20px' }}>You do not have admin access.</p>
          <button className="btn btn-secondary" onClick={() => signOut(auth)} style={{ width: '100%' }}>Sign Out</button>
        </div>
      </div>
    );

  // Show landing page OR admin login
  const showingLandingPage = true; // Default to landing page for visitors

  if (showingLandingPage) {
    // Check if they clicked admin login button
    const urlParams = new URLSearchParams(window.location.search);
    const showAdminLogin = urlParams.get('admin') === 'true';

    if (showAdminLogin || authState.user) {
      return (
        <div className="gradient-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <div className="card" style={{ maxWidth: '400px', width: '100%', margin: '0 auto', padding: 40 }}>
            <h2 className="text-center mb-4">Admin Login</h2>
            <form onSubmit={handleLogin} style={{ maxWidth: 300 }}>
              <input
                type="email"
                placeholder="Admin Email"
                required
                value={loginForm.email}
                onChange={(e) =>
                  setLoginForm((f) => ({ ...f, email: e.target.value }))
                }
              />
              <input
                type="password"
                placeholder="Password"
                required
                value={loginForm.password}
                onChange={(e) =>
                  setLoginForm((f) => ({ ...f, password: e.target.value }))
                }
              />
              <button className="btn btn-primary" type="submit" style={{ width: '100%', marginBottom: '12px' }}>Login</button>
              <button 
                className="btn btn-secondary" 
                type="button" 
                onClick={() => window.history.back()} 
                style={{ width: '100%' }}
              >
                Back
              </button>
              {authState.error && (
                <div style={{ color: "red", marginTop: 10, textAlign: 'center' }}>{authState.error}</div>
              )}
            </form>
          </div>
        </div>
      );
    }

    // Show landing page with admin login button
    return (
      <LandingPage games={games} loading={loading} />
    );
  }
}

export default App;
