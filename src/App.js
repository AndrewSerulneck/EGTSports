
import './App.css';
import React, { useState, useEffect, useCallback, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, push } from "firebase/database";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import AuthLanding from './components/AuthLanding';
import UserManagement from './components/UserManagement';
import BettingSlip from './components/BettingSlip';
import SportsMenu from './components/SportsMenu';
import GridBettingLayout from './components/GridBettingLayout';

// ESPN API Endpoints for all sports
const ESPN_API_ENDPOINTS = {
  'NFL': 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  'NBA': 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  'College Football': 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
  'College Basketball': 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard',
  'Major League Baseball': 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
  'NHL': 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard'
};

// Helper function to get date range URLs for ESPN API
// ESPN API supports fetching games for specific dates using ?dates=YYYYMMDD format
const getESPNDateRangeURLs = (baseURL) => {
  const urls = [];
  const today = new Date();
  
  // Get games from 7 days ago to 14 days in the future (3 week window)
  for (let i = -7; i <= 14; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, ''); // Format: YYYYMMDD
    urls.push(`${baseURL}?dates=${dateStr}`);
  }
  
  return urls;
};

// The Odds API Configuration
const ODDS_API_KEY = '4e1df4cc99838c371ae1822316b8eb7c';
const ODDS_API_BASE_URL = 'https://api.the-odds-api.com/v4';

// Sport keys for The Odds API
const ODDS_API_SPORT_KEYS = {
  'College Basketball': 'basketball_ncaab'
};

// Longer cache for College Basketball to conserve API calls
const COLLEGE_BASKETBALL_CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const REFRESH_INTERVAL_ACTIVE = 2 * 60 * 1000; // 2 minutes when games are live
const REFRESH_INTERVAL_INACTIVE = 30 * 60 * 1000; // 30 minutes when no active games
const gameCache = {};

// API Usage Tracking
let apiCallCount = {
  total: 0,
  byEndpoint: {},
  errors: 0,
  cacheHits: 0,
  lastReset: Date.now()
};

// Firebase Config
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyA9FsWV7hA4ow2Xaq0Krx9kCCMfMibkVOQ",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "marcs-parlays.firebaseapp.com",
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL || "https://marcs-parlays-default-rtdb.firebaseio.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "marcs-parlays",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "marcs-parlays.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "631281528889",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:631281528889:web:e3befe34907902387c1de8"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

const VENMO_USERNAME = process.env.REACT_APP_VENMO_USERNAME || 'EGTSports';
const ZELLE_EMAIL = process.env.REACT_APP_ZELLE_EMAIL || 'EGTSports@proton.me';
const MIN_BET = parseInt(process.env.REACT_APP_MIN_BET) || 5;
const MAX_BET = parseInt(process.env.REACT_APP_MAX_BET) || 100;
const GOOGLE_SHEET_URL = process.env.REACT_APP_GOOGLE_SHEET_URL || 'https://script.google.com/macros/s/AKfycbzPastor8yKkWQxKx1z0p-0ZibwBJHkJCuVvHDqP9YX7Dv1-vwakdR9RU6Y6oNw4T2W2PA/exec';
console.log('🔗 GOOGLE_SHEET_URL:', GOOGLE_SHEET_URL);

// Utility: Log API usage to Firebase (for admin monitoring)
const logAPIUsage = async (sport, success, fromCache) => {
  try {
    const usageRef = ref(database, 'analytics/apiUsage');
    await push(usageRef, {
      timestamp: new Date().toISOString(),
      sport: sport,
      success: success,
      fromCache: fromCache,
      user: auth.currentUser ? auth.currentUser.uid : 'anonymous'
    });
  } catch (error) {
    console.error('Error logging API usage:', error);
  }
};

// Utility: Check if there are any active/live games
const hasActiveGames = (games) => {
  return games.some(game => game.status === 'in' || game.status === 'pre');
};

// Utility: Get API stats for display
const getAPIStats = () => {
  const hoursSinceReset = (Date.now() - apiCallCount.lastReset) / (1000 * 60 * 60);
  return {
    total: apiCallCount.total,
    cacheHits: apiCallCount.cacheHits,
    errors: apiCallCount.errors,
    cacheHitRate: apiCallCount.total > 0 ? ((apiCallCount.cacheHits / (apiCallCount.total + apiCallCount.cacheHits)) * 100).toFixed(1) : 0,
    callsPerHour: hoursSinceReset > 0 ? (apiCallCount.total / hoursSinceReset).toFixed(1) : 0,
    byEndpoint: apiCallCount.byEndpoint
  };
};
// Send win/loss status update to Google Sheets
const updateSubmissionStatus = async (submission, status, wins, losses, pickCount) => {
  try {
    const statusUpdate = {
      ticketNumber: submission.ticketNumber,
      status: status,
      wins: wins,
      losses: losses,
      finalizedAt: new Date().toISOString(),
      payout: status === 'won' ? (submission.betAmount * getPayoutMultiplier(pickCount)) : 0
    };
    
    console.log('📤 Sending status update to Google Sheets:', statusUpdate);
    
    await fetch(GOOGLE_SHEET_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'status_update',
        ...statusUpdate
      })
    });
    
    console.log('✅ Status update sent successfully');
  } catch (error) {
    console.error('❌ Error updating status:', error);
  }
};

// Helper function to get payout multiplier
const getPayoutMultiplier = (pickCount) => {
  const multipliers = {
    3: 8,
    4: 15,
    5: 25,
    6: 50,
    7: 100,
    8: 150,
    9: 200,
    10: 250
  };
  return multipliers[pickCount] || 0;
};

// Admin Panel Component - NOW SPORT-SPECIFIC WITH API STATS
function AdminPanel({ user, games, setGames, isSyncing, setIsSyncing, recentlyUpdated, setRecentlyUpdated, submissions, sport, onBackToMenu }) {
  const [showSubmissions, setShowSubmissions] = useState(false);
  const [showAPIStats, setShowAPIStats] = useState(false);
  const [apiStats, setApiStats] = useState(getAPIStats());

  // Update API stats every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setApiStats(getAPIStats());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const calculateResult = useCallback((submission) => {
    // Return early if games array is not available
    if (!games || !Array.isArray(games)) {
      return { wins: 0, losses: 0, pending: submission.picks ? submission.picks.length : 0 };
    }
    
    // Return early if submission has no picks
    if (!submission || !submission.picks || !Array.isArray(submission.picks)) {
      return { wins: 0, losses: 0, pending: 0 };
    }
    
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
  }, [games]);

  // Auto-update win/loss status when games finalize
  useEffect(() => {
    // Only run if submissions array is available
    if (!submissions || !Array.isArray(submissions)) return;
    
    submissions.forEach(submission => {
      // Skip if submission is invalid
      if (!submission || !submission.picks || !Array.isArray(submission.picks)) return;
      
      const result = calculateResult(submission);
      
      // Check if this submission just finalized
      const storedSubmission = localStorage.getItem(`submission-${submission.ticketNumber}`);
      const wasFinalized = storedSubmission ? JSON.parse(storedSubmission).finalized : false;
      
      if (result.allGamesComplete && !wasFinalized) {
        const status = result.parlayWon ? 'won' : 'lost';
        updateSubmissionStatus(submission, status, result.wins, result.losses, submission.picks.length);
        
        // Mark as finalized
        localStorage.setItem(`submission-${submission.ticketNumber}`, JSON.stringify({
          ...submission,
          finalized: true,
          status: status
        }));
      }
    });
  }, [submissions, games, calculateResult]);
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
      // SPORT-SPECIFIC FIREBASE PATH
      await set(ref(database, `spreads/${sport}`), spreadsData);
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

  if (showAPIStats) {
    return (
      <div className="gradient-bg">
        <div className="container">
          <div className="card">
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
              <h1>📊 API Usage Analytics</h1>
              <button className="btn btn-secondary" onClick={() => setShowAPIStats(false)}>Back</button>
            </div>
          </div>
          
          <div className="card">
            <h3 className="mb-2">Overall Stats</h3>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px'}}>
              <div style={{padding: '16px', background: '#f8f9fa', borderRadius: '8px', textAlign: 'center'}}>
                <div style={{fontSize: '32px', fontWeight: 'bold', color: '#007bff'}}>{apiStats.total}</div>
                <div style={{color: '#666'}}>Total API Calls</div>
              </div>
              <div style={{padding: '16px', background: '#f8f9fa', borderRadius: '8px', textAlign: 'center'}}>
                <div style={{fontSize: '32px', fontWeight: 'bold', color: '#28a745'}}>{apiStats.cacheHits}</div>
                <div style={{color: '#666'}}>Cache Hits</div>
              </div>
              <div style={{padding: '16px', background: '#f8f9fa', borderRadius: '8px', textAlign: 'center'}}>
                <div style={{fontSize: '32px', fontWeight: 'bold', color: '#ffc107'}}>{apiStats.cacheHitRate}%</div>
                <div style={{color: '#666'}}>Cache Hit Rate</div>
              </div>
              <div style={{padding: '16px', background: '#f8f9fa', borderRadius: '8px', textAlign: 'center'}}>
                <div style={{fontSize: '32px', fontWeight: 'bold', color: '#dc3545'}}>{apiStats.errors}</div>
                <div style={{color: '#666'}}>Errors</div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="mb-2">Calls Per Sport</h3>
            {Object.entries(apiStats.byEndpoint).map(([sport, count]) => (
              <div key={sport} style={{display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#f8f9fa', borderRadius: '8px', marginBottom: '8px'}}>
                <strong>{sport}</strong>
                <span>{count} calls</span>
              </div>
            ))}
          </div>

          <div className="card">
            <p style={{color: '#666', marginBottom: '0'}}>
              <strong>Average:</strong> {apiStats.callsPerHour} calls per hour
            </p>
          </div>
        </div>
      </div>
    );
  }

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
                      <div style={{fontSize: '12px', color: '#999', marginTop: '4px'}}>Sport: {sub.sport}</div>
                    </div>
                    {result.allGamesComplete && (
                      <div style={{display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end'}}>
                        <div style={{
                          padding: '8px 16px',
                          borderRadius: '8px',
                          fontWeight: 'bold',
                          background: result.parlayWon ? '#28a745' : '#dc3545',
                          color: 'white'
                        }}>
                          {result.parlayWon ? 'WON' : 'LOST'}
                        </div>
                        {result.parlayWon && (
                          <div style={{fontSize: '14px', fontWeight: 'bold', color: '#28a745'}}>
                            Payout: ${(sub.betAmount * getPayoutMultiplier(sub.picks.length)).toFixed(2)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{marginBottom: '16px', padding: '16px', background: '#f8f9fa', borderRadius: '8px'}}>
                    <div><strong>Name:</strong> {sub.contactInfo.name}</div>
                    <div><strong>Email:</strong> {sub.contactInfo.email}</div>
                    <div><strong>Bet:</strong> ${sub.betAmount.toFixed(2)}</div>
                  </div>
                                    <div style={{marginBottom: '16px'}}>
                    <strong>Record: {result.wins}-{result.losses}</strong>
                    {result.pending > 0 && <span style={{color: '#666'}}> ({result.pending} pending)</span>}
                    {result.allGamesComplete && (
                      <div style={{
                        marginTop: '8px',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        display: 'inline-block',
                        fontWeight: 'bold',
                        background: result.parlayWon ? '#d4edda' : '#f8d7da',
                        color: result.parlayWon ? '#155724' : '#721c24',
                        border: result.parlayWon ? '1px solid #c3e6cb' : '1px solid #f5c6cb'
                      }}>
                        {result.parlayWon ? '✅ ALL PICKS WON' : '❌ SOME PICKS LOST'}
                      </div>
                    )}
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
            <h1>{sport} Admin Panel <span className={`sync-indicator ${isSyncing ? 'syncing' : ''}`}></span></h1>
            <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
              <button className="btn btn-secondary" onClick={onBackToMenu}>← Back to Admin Menu</button>
              <button className="btn btn-info" onClick={() => setShowAPIStats(true)}>
                📊 API Stats
              </button>
              <button className="btn btn-primary" onClick={() => setShowSubmissions(true)}>
                Submissions ({submissions.length})
              </button>
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
              {game.status === 'in' && (
                <span style={{ color: '#28a745', fontWeight: '600' }}>
                  🔴 LIVE: {game.awayTeam} {game.awayScore} - {game.homeScore} {game.homeTeam}
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

// Admin Landing Page Component - Admin menu before sport selection
function AdminLandingPage({ onSelectSport, onManageUsers, onSignOut }) {
  const sports = [
    { name: 'NFL', available: true },
    { name: 'NBA', available: true },
    { name: 'College Football', available: true },
    { name: 'College Basketball', available: true },
    { name: 'Major League Baseball', available: true },
    { name: 'NHL', available: true }
  ];

  return (
    <div className="gradient-bg">
      <div className="container" style={{ maxWidth: '800px', paddingTop: '60px' }}>
        <div className="text-center text-white mb-4">
          <h1 style={{ fontSize: '48px', marginBottom: '16px' }}>Admin Dashboard</h1>
          <p style={{ fontSize: '20px', marginBottom: '40px' }}>Manage users or select a sport to adjust odds</p>
        </div>
        
        {/* Admin Actions */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <h2 style={{ marginBottom: '16px' }}>Admin Actions</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <button
              className="btn btn-success"
              onClick={onManageUsers}
              style={{
                padding: '32px 24px',
                fontSize: '18px',
                fontWeight: 'bold',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span style={{ fontSize: '48px' }}>👥</span>
              <span>Manage Users</span>
            </button>
            <button
              className="btn btn-secondary"
              onClick={onSignOut}
              style={{
                padding: '32px 24px',
                fontSize: '18px',
                fontWeight: 'bold',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span style={{ fontSize: '48px' }}>🚪</span>
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Sport Selection */}
        <div className="card">
          <h2 style={{ marginBottom: '16px' }}>Select Sport to Manage Odds</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            {sports.map((sport) => (
              <button
                key={sport.name}
                className="btn"
                onClick={() => sport.available && onSelectSport(sport.name)}
                disabled={!sport.available}
                style={{
                  padding: '32px 24px',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  background: sport.available ? '#007bff' : '#e9ecef',
                  color: sport.available ? 'white' : '#6c757d',
                  border: 'none',
                  cursor: sport.available ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  position: 'relative'
                }}
              >
                <span>{sport.name}</span>
                {!sport.available && (
                  <span style={{ fontSize: '12px', fontStyle: 'italic', color: '#999' }}>
                    Coming Soon
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Landing Page Component - WITH MANUAL REFRESH BUTTON AND CROSS-SPORT SUPPORT
function LandingPage({ games, allSportsGames, currentViewSport, onChangeSport, loading, onBackToMenu, sport, betType, onBetTypeChange, apiError, onManualRefresh, lastRefreshTime }) {
  const [selectedPicks, setSelectedPicks] = useState({});
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [ticketNumber, setTicketNumber] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [contactInfo, setContactInfo] = useState({ name: '', email: '', betAmount: '', confirmMethod: 'email', freePlay: 0, paymentMethod: 'venmo' });
  const [individualBetAmounts, setIndividualBetAmounts] = useState({}); // For straight bets: {pickId: amount}
  const [submissions, setSubmissions] = useState([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const processedTicketsRef = useRef(new Set()); // Track processed tickets to avoid re-processing

  useEffect(() => {
    // Load from localStorage first (backup)
    const stored = localStorage.getItem('marcs-parlays-submissions');
    if (stored) setSubmissions(JSON.parse(stored));
    
    // Also listen to Firebase for real-time submissions
    const submissionsRef = ref(database, 'submissions');
    const unsubscribe = onValue(submissionsRef, (snapshot) => {
      if (snapshot.exists()) {
        const firebaseSubmissions = [];
        snapshot.forEach((childSnapshot) => {
          firebaseSubmissions.push(childSnapshot.val());
        });
        console.log(`📥 Loaded ${firebaseSubmissions.length} submissions from Firebase`);
        setSubmissions(firebaseSubmissions);
      }
    });
    
    return () => unsubscribe();
  }, []);
// ADD THIS NEW useEffect RIGHT AFTER THE ONE ABOVE:
useEffect(() => {
  // Auto-calculate and update win/loss status for finalized games
  // Only run if games array is available
  if (!games || !Array.isArray(games)) return;
  
  // Only run if submissions array is available
  if (!submissions || !Array.isArray(submissions)) return;
  
  submissions.forEach(submission => {
    // Skip if submission is invalid
    if (!submission || !submission.picks || !Array.isArray(submission.picks)) return;
    
    // Skip if already processed
    if (processedTicketsRef.current.has(submission.ticketNumber)) return;
    
    // Only process submissions for the current sport
    if (submission.sport !== sport) return;
    
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
    
    // Check if this submission just finalized
    const storedSubmission = localStorage.getItem(`submission-${submission.ticketNumber}`);
    const wasFinalized = storedSubmission ? JSON.parse(storedSubmission).finalized : false;
    
    if (allGamesComplete && !wasFinalized) {
      const status = parlayWon ? 'won' : 'lost';
      console.log(`🎯 Ticket ${submission.ticketNumber} finalized: ${status.toUpperCase()}`);
      
      // Mark as processed immediately to prevent duplicate calls
      processedTicketsRef.current.add(submission.ticketNumber);
      
      updateSubmissionStatus(submission, status, wins, losses, submission.picks.length);
      
      // Mark as finalized in localStorage
      localStorage.setItem(`submission-${submission.ticketNumber}`, JSON.stringify({
        ...submission,
        finalized: true,
        status: status
      }));
    }
  });
}, [submissions, games, sport]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await onManualRefresh();
    setIsRefreshing(false);
  };

  const getTimeSinceRefresh = () => {
    if (!lastRefreshTime) return '';
    const seconds = Math.floor((Date.now() - lastRefreshTime) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

const saveSubmission = async (submission) => {
  console.log('🚀 saveSubmission function called');
  console.log('📋 Submission data:', submission);
  
  // Save to localStorage (backup)
  const allSubmissions = [...submissions, submission];
  setSubmissions(allSubmissions);
  localStorage.setItem('marcs-parlays-submissions', JSON.stringify(allSubmissions));
  console.log('✅ Saved to localStorage');

  try {
    // Save to Firebase for admin access
    console.log('💾 Attempting to save to Firebase...');
    const submissionsRef = ref(database, `submissions/${submission.ticketNumber}`);
    await set(submissionsRef, submission);
    console.log('✅ Submission saved to Firebase');
    
    // Send to Google Sheets
    console.log('📤 Attempting to send to Google Sheets...');
    console.log('🔗 Target URL:', GOOGLE_SHEET_URL);
    console.log('📦 Payload being sent:', JSON.stringify(submission, null, 2));
    
    const fetchStartTime = Date.now();
    const response = await fetch(GOOGLE_SHEET_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(submission)
    });
    const fetchDuration = Date.now() - fetchStartTime;
    
    console.log(`✅ Fetch request completed in ${fetchDuration}ms`);
    console.log('📊 Response status:', response.status);
    console.log('📊 Response type:', response.type);
    console.log('📊 Full response object:', response);
    
    // Store submission with sync status
    const submissionWithStatus = {
      ...submission,
      syncedToSheets: true,
      syncedAt: new Date().toISOString()
    };
    
    localStorage.setItem(`submission-${submission.ticketNumber}`, JSON.stringify(submissionWithStatus));
    console.log('✅ Marked as synced in localStorage');
    
  } catch (error) {
    console.error('❌ Error in saveSubmission:', error);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    
    // Only alert if it's a Firebase error (not Google Sheets)
    if (error.message.includes('Firebase') || error.message.includes('database')) {
      // Store failed submission for retry
      const failedSubmissions = JSON.parse(localStorage.getItem('failed-submissions') || '[]');
      failedSubmissions.push({
        ...submission,
        failedAt: new Date().toISOString(),
        error: error.message
      });
      localStorage.setItem('failed-submissions', JSON.stringify(failedSubmissions));
      
      alert('⚠️ Your bet was saved locally but may not have synced to our system. Please contact support with your ticket number: ' + submission.ticketNumber);
    } else {
      // Google Sheets error - not critical, just log it
      console.warn('⚠️ Google Sheets sync may have failed, but submission is saved to Firebase');
    }
  }
};
  // Helper function to handle pick selection for grid layout
  const handleGridPickSelection = (gameId, pickType, value) => {
    if (pickType === 'winner') {
      // Winner picks are mutually exclusive with spread picks for the same game
      setSelectedPicks(prev => {
        const prevPick = prev[gameId] || {};
        const newPick = {
          ...prevPick,
          winner: prevPick.winner === value ? undefined : value,
          spread: undefined // Clear spread when selecting winner
        };
        // Remove empty picks
        if (!newPick.winner && !newPick.spread && !newPick.total) {
          const { [gameId]: removed, ...rest } = prev;
          return rest;
        }
        return {
          ...prev,
          [gameId]: newPick
        };
      });
    } else if (pickType === 'spread') {
      // Spread picks are mutually exclusive with winner picks for the same game
      setSelectedPicks(prev => {
        const prevPick = prev[gameId] || {};
        const newPick = {
          ...prevPick,
          spread: prevPick.spread === value ? undefined : value,
          winner: undefined // Clear winner when selecting spread
        };
        // Remove empty picks
        if (!newPick.winner && !newPick.spread && !newPick.total) {
          const { [gameId]: removed, ...rest } = prev;
          return rest;
        }
        return {
          ...prev,
          [gameId]: newPick
        };
      });
    } else if (pickType === 'total') {
      toggleTotal(gameId, value);
    }
  };

  // Helper function to remove a pick
  const handleRemovePick = (gameId, pickType) => {
    setSelectedPicks(prev => {
      const newPicks = { ...prev };
      if (newPicks[gameId]) {
        if (pickType === 'winner') {
          delete newPicks[gameId].winner;
        } else if (pickType === 'spread') {
          delete newPicks[gameId].spread;
        } else if (pickType === 'total') {
          delete newPicks[gameId].total;
        }
        // Remove the game entry if no picks left
        if (!newPicks[gameId].winner && !newPicks[gameId].spread && !newPicks[gameId].total) {
          delete newPicks[gameId];
        }
      }
      return newPicks;
    });
  };

  // Helper function to clear all picks
  const handleClearAll = () => {
    setSelectedPicks({});
    setIndividualBetAmounts({});
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
      if (obj.winner) pickCount++;
      if (obj.spread) pickCount++;
      if (obj.total) pickCount++;
    });
    const minPicks = betType === 'straight' ? 1 : 3;
    if (pickCount < minPicks) {
      alert(`Please select at least ${minPicks} pick${minPicks > 1 ? 's' : ''}!`);
      return;
    }
    setTicketNumber(generateTicketNumber());
    setShowConfirmation(true);
  };

  const openVenmo = (amount) => {
    const betAmount = amount || contactInfo.betAmount;
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

  const handleCheckoutSubmit = async () => {
    // Helper function to generate unique pick ID
    const getPickId = (gameId, pickType) => `${gameId}-${pickType}`;
    
    // Validate contact information
    if (!contactInfo.name || !contactInfo.email) {
      alert('Please fill in all contact information');
      return;
    }
    
    let totalBetAmount = 0;
    const picksFormatted = [];
    
    if (betType === 'straight') {
      // For straight bets: validate individual bet amounts
      let hasInvalidBet = false;
      let missingBetAmount = false;
      
      Object.entries(selectedPicks).forEach(([gameId, pickObj]) => {
        // Find game in either single sport games or all sports games
        // Convert gameId to match type (string for cross-sport, number for single sport)
        const numericGameId = Number(gameId);
        let game = games.find(g => g.id === gameId || g.id === numericGameId);
        if (!game && allSportsGames) {
          for (const sportGames of Object.values(allSportsGames)) {
            game = sportGames.find(g => g.id === gameId || g.id === numericGameId);
            if (game) break;
          }
        }
        
        if (!game) {
          console.error(`Could not find game with ID: ${gameId}`);
          return;
        }
        
        const gameName = `${game.awayTeam} @ ${game.homeTeam}`;
        const sportLabel = game.sport ? ` (${game.sport})` : '';
        
        if (pickObj.spread) {
          const pickId = getPickId(gameId, 'spread');
          const betAmount = parseFloat(individualBetAmounts[pickId]);
          
          if (!individualBetAmounts[pickId] || betAmount <= 0) {
            missingBetAmount = true;
          } else if (betAmount < MIN_BET || betAmount > MAX_BET) {
            hasInvalidBet = true;
          } else {
            totalBetAmount += betAmount;
            
            const team = pickObj.spread === 'away' ? game.awayTeam : game.homeTeam;
            const spread = pickObj.spread === 'away' ? game.awaySpread : game.homeSpread;
            const moneyline = pickObj.spread === 'away' ? game.awayMoneyline : game.homeMoneyline;
            
            picksFormatted.push({
              gameId: game.espnId,
              gameName: gameName + sportLabel,
              sport: game.sport,
              pickType: 'moneyline',
              team,
              spread,
              moneyline,
              pickedTeamType: pickObj.spread,
              betAmount: betAmount
            });
          }
        }
        
        if (pickObj.total) {
          const pickId = getPickId(gameId, 'total');
          const betAmount = parseFloat(individualBetAmounts[pickId]);
          
          if (!individualBetAmounts[pickId] || betAmount <= 0) {
            missingBetAmount = true;
          } else if (betAmount < MIN_BET || betAmount > MAX_BET) {
            hasInvalidBet = true;
          } else {
            totalBetAmount += betAmount;
            
            picksFormatted.push({
              gameId: game.espnId,
              gameName: gameName + sportLabel,
              sport: game.sport,
              pickType: 'total',
              overUnder: pickObj.total,
              total: game.total,
              betAmount: betAmount
            });
          }
        }
      });
      
      if (missingBetAmount) {
        alert('Please enter a bet amount for all of your selections');
        return;
      }
      
      if (hasInvalidBet) {
        alert(`Each bet must be between $${MIN_BET} and $${MAX_BET}`);
        return;
      }
    } else {
      // For parlays: validate single bet amount
      const betAmount = parseFloat(contactInfo.betAmount);
      
      if (!betAmount || betAmount <= 0) {
        alert('Please enter a valid bet amount');
        return;
      }
      
      if (betAmount < MIN_BET) {
        alert(`Minimum bet is $${MIN_BET.toFixed(2)}`);
        return;
      }
      
      if (betAmount > MAX_BET) {
        alert(`Maximum bet is $${MAX_BET}`);
        return;
      }
      
      totalBetAmount = betAmount;
      
      Object.entries(selectedPicks).forEach(([gameId, pickObj]) => {
        // Find game in either single sport games or all sports games
        // Convert gameId to match type (string for cross-sport, number for single sport)
        const numericGameId = Number(gameId);
        let game = games.find(g => g.id === gameId || g.id === numericGameId);
        if (!game && allSportsGames) {
          for (const sportGames of Object.values(allSportsGames)) {
            game = sportGames.find(g => g.id === gameId || g.id === numericGameId);
            if (game) break;
          }
        }
        
        if (!game) {
          console.error(`Could not find game with ID: ${gameId}`);
          return;
        }
        
        const gameName = `${game.awayTeam} @ ${game.homeTeam}`;
        const sportLabel = game.sport ? ` (${game.sport})` : '';
        
        if (pickObj.spread) {
          const team = pickObj.spread === 'away' ? game.awayTeam : game.homeTeam;
          const spread = pickObj.spread === 'away' ? game.awaySpread : game.homeSpread;
          
          picksFormatted.push({
            gameId: game.espnId,
            gameName: gameName + sportLabel,
            sport: game.sport,
            pickType: 'spread',
            team,
            spread,
            pickedTeamType: pickObj.spread
          });
        }
        if (pickObj.total) {
          picksFormatted.push({
            gameId: game.espnId,
            gameName: gameName + sportLabel,
            sport: game.sport,
            pickType: 'total',
            overUnder: pickObj.total,
            total: game.total
          });
        }
      });
    }

    const submission = {
      ticketNumber,
      timestamp: new Date().toISOString(),
      contactInfo: {
        name: contactInfo.name,
        email: contactInfo.email,
        confirmMethod: 'email'
      },
      betAmount: totalBetAmount,
      freePlay: 0,
      picks: picksFormatted,
      paymentStatus: 'pending',
      paymentMethod: contactInfo.paymentMethod,
      sport: betType === 'parlay' ? 'Multi-Sport' : sport,
      betType: betType
    };
    saveSubmission(submission);
    // Send confirmation email
try {
  const emailResponse = await fetch('https://api.egtsports.ws/api/send-ticket-confirmation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ticketNumber: ticketNumber,
      contactInfo: {
        name: contactInfo.name,
        email: contactInfo.email,
        paymentMethod: contactInfo.paymentMethod
      },
      picks: picksFormatted,
      betAmount: totalBetAmount,
      sport: sport,
      timestamp: submission.timestamp
    })
  });

  const emailResult = await emailResponse.json();
  
  if (emailResult.success) {
    console.log('✅ Confirmation email sent to', contactInfo.email);
  } else {
    console.error('❌ Email failed:', emailResult.error);
  }
} catch (emailError) {
  console.error('❌ Email error:', emailError);
  // Don't block ticket submission if email fails
}
    
    setHasSubmitted(true);

    // Open Venmo only if Venmo is selected
    if (contactInfo.paymentMethod === 'venmo') {
      openVenmo(totalBetAmount);
        } else if (contactInfo.paymentMethod === 'zelle') {
      // Copy Zelle email to clipboard
      navigator.clipboard.writeText(ZELLE_EMAIL).then(() => {
        alert(`⚠️ IMPORTANT - PAYMENT REQUIRED ⚠️\n\n📋 Zelle email copied to clipboard!\n\nYou MUST open your banking app NOW and send $${totalBetAmount.toFixed(2)} via Zelle to:\n\n${ZELLE_EMAIL}\n\nNote: ${ticketNumber}\n\n🚨 Tickets without payment before games start will be VOID 🚨`);
      }).catch(() => {
        alert(`⚠️ IMPORTANT - PAYMENT REQUIRED ⚠️\n\nYou MUST open your banking app NOW and send $${totalBetAmount.toFixed(2)} via Zelle to:\n\n${ZELLE_EMAIL}\n\nNote: ${ticketNumber}\n\n🚨 Tickets without payment before games start will be VOID 🚨`);
      });
    }
  };

  if (loading) {
    return (
      <div className="gradient-bg" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh'}}>
        <div className="text-white" style={{fontSize: '24px'}}>Loading {sport} games from ESPN...</div>
      </div>
    );
  }

  // Show API Error if exists
  if (apiError) {
    return (
      <div className="gradient-bg">
        <div className="container" style={{maxWidth: '600px', paddingTop: '60px'}}>
          <div className="card text-center">
            <h2 style={{color: '#dc3545', marginBottom: '20px'}}>⚠️ Unable to Load Games</h2>
            <p style={{marginBottom: '20px'}}>{apiError}</p>
            <div style={{display: 'flex', gap: '12px', justifyContent: 'center'}}>
              <button className="btn btn-primary" onClick={handleManualRefresh} disabled={isRefreshing}>
                {isRefreshing ? 'Refreshing...' : '🔄 Retry'}
              </button>
              <button className="btn btn-secondary" onClick={onBackToMenu}>← Back to Menu</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show message if no games available
  if (games.length === 0) {
    return (
      <div className="gradient-bg">
        <div className="container" style={{maxWidth: '600px', paddingTop: '60px'}}>
          <div className="card text-center">
            <h2 style={{marginBottom: '20px'}}>No {sport} Games Available</h2>
            <p style={{marginBottom: '20px', color: '#666'}}>
              There are currently no upcoming {sport} games. This could be due to the off-season or no scheduled games at this time.
            </p>
            <div style={{display: 'flex', gap: '12px', justifyContent: 'center'}}>
              <button className="btn btn-primary" onClick={handleManualRefresh} disabled={isRefreshing}>
                {isRefreshing ? 'Refreshing...' : '🔄 Refresh'}
              </button>
              <button className="btn btn-secondary" onClick={onBackToMenu}>← Back to Menu</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Debug logging
  console.log('🎮 LandingPage render:', {
    gamesCount: games ? games.length : 'undefined',
    allSportsGamesKeys: allSportsGames ? Object.keys(allSportsGames) : 'undefined',
    betType,
    sport,
    selectedPicksCount: Object.keys(selectedPicks).length
  });

  let pickCount = 0;
  Object.values(selectedPicks).forEach(obj => {
    if (obj.winner) pickCount++;
    if (obj.spread) pickCount++;
    if (obj.total) pickCount++;
  });
  const minPicks = betType === 'straight' ? 1 : 3;
  // canSubmit used in BettingSlip component
  // eslint-disable-next-line no-unused-vars
  const canSubmit = pickCount >= minPicks;

  // Count active games - with null check
  const activeGamesCount = (games && Array.isArray(games)) ? games.filter(g => g.status === 'in' || g.status === 'pre').length : 0;

  if (hasSubmitted) {
    // Helper function to generate unique pick ID
    const getPickId = (gameId, pickType) => `${gameId}-${pickType}`;
    
    // Calculate payout odds and format picks based on bet type
    let pickCount = 0;
    const picksFormatted = [];
    let totalAmount = 0;
    
    Object.entries(selectedPicks).forEach(([gameId, pickObj]) => {
      // Find game in either single sport games or all sports games
      // Convert gameId to match type (string for cross-sport, number for single sport)
      const numericGameId = Number(gameId);
      let game = games.find(g => g.id === gameId || g.id === numericGameId);
      if (!game && allSportsGames) {
        for (const sportGames of Object.values(allSportsGames)) {
          game = sportGames.find(g => g.id === gameId || g.id === numericGameId);
          if (game) break;
        }
      }
      if (!game) return;
      
      if (pickObj.winner) {
        pickCount++;
        const team = pickObj.winner === 'away' ? game.awayTeam : game.homeTeam;
        const moneyline = pickObj.winner === 'away' ? game.awayMoneyline : game.homeMoneyline;
        
        if (betType === 'straight') {
          const betAmount = parseFloat(individualBetAmounts[getPickId(gameId, 'winner')]) || 0;
          totalAmount += betAmount;
          picksFormatted.push(`${team} ${moneyline || 'ML'} - $${betAmount.toFixed(2)}`);
        } else {
          picksFormatted.push(`${team} ${moneyline || 'ML'}`);
        }
      }
      if (pickObj.spread) {
        pickCount++;
        const team = pickObj.spread === 'away' ? game.awayTeam : game.homeTeam;
        const spread = pickObj.spread === 'away' ? game.awaySpread : game.homeSpread;
        
        if (betType === 'straight') {
          const betAmount = parseFloat(individualBetAmounts[getPickId(gameId, 'spread')]) || 0;
          totalAmount += betAmount;
          picksFormatted.push(`${team} ${spread} - $${betAmount.toFixed(2)}`);
        } else {
          picksFormatted.push(`${team} ${spread}`);
        }
      }
      if (pickObj.total) {
        pickCount++;
        if (betType === 'straight') {
          const betAmount = parseFloat(individualBetAmounts[getPickId(gameId, 'total')]) || 0;
          totalAmount += betAmount;
          picksFormatted.push(`[TOTAL] ${pickObj.total === 'over' ? 'OVER' : 'UNDER'} ${game.total} - ${game.awayTeam} @ ${game.homeTeam} - $${betAmount.toFixed(2)}`);
        } else {
          picksFormatted.push(`[TOTAL] ${pickObj.total === 'over' ? 'OVER' : 'UNDER'} ${game.total} total points - ${game.awayTeam} @ ${game.homeTeam}`);
        }
      }
    });

    if (betType === 'parlay') {
      totalAmount = parseFloat(contactInfo.betAmount);
    }

    const payoutOdds = betType === 'parlay' ? ({
      3: '8 to 1',
      4: '15 to 1',
      5: '25 to 1',
      6: '50 to 1',
      7: '100 to 1',
      8: '150 to 1',
      9: '200 to 1',
      10: '250 to 1'
    }[pickCount] || 'N/A') : 'Varies by odds';

    const timestamp = new Date().toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });

    // Email functionality
    const handleEmailTicket = () => {
      const subject = `EGT Sports Betting Ticket - ${ticketNumber}`;
      const body = `EGT SPORTS BETTING TICKET
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CONFIRMATION NUMBER
${ticketNumber}

SUBMITTED
${timestamp}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BET DETAILS

Type: ${betType === 'straight' ? 'Straight Bets' : 'Parlay'}
Sport: ${sport}
Total Amount: $${totalAmount.toFixed(2)}
Picks: ${pickCount}
${betType === 'parlay' ? `Payout: ${payoutOdds}` : 'Payout: Based on individual odds'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR ${betType === 'straight' ? 'BETS' : 'PICKS'}

${picksFormatted.map((pick, idx) => `${idx + 1}. ${pick}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PAYMENT REQUIRED

${contactInfo.paymentMethod === 'venmo' 
  ? `Send $${totalAmount.toFixed(2)} to @${VENMO_USERNAME} on Venmo\nNote: "${ticketNumber}"`
  : `Send $${totalAmount.toFixed(2)} via Zelle to ${ZELLE_EMAIL}\nNote: "${ticketNumber}"`
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPORTANT: Save this email for your records. You will need your ticket number to claim winnings.

Contact: ${contactInfo.name}
Email: ${contactInfo.email}
`;
      window.location.href = `mailto:${contactInfo.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    };

    return (
      <div className="gradient-bg">
        <div className="container" style={{maxWidth: '700px', paddingTop: '20px', paddingBottom: '40px'}}>
          {/* SCREENSHOT INSTRUCTIONS - PROMINENT */}
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            padding: '20px',
            borderRadius: '12px',
            marginBottom: '20px',
            textAlign: 'center',
            boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
          }}>
            <div style={{fontSize: '36px', marginBottom: '10px'}}>📸</div>
            <h2 style={{fontSize: '24px', fontWeight: 'bold', marginBottom: '10px'}}>SAVE THIS SCREENSHOT!</h2>
            <p style={{fontSize: '16px', marginBottom: '0'}}>
              Take a screenshot now or email this ticket to yourself
            </p>
          </div>

          {/* TICKET CARD - ENHANCED DESIGN */}
          <div className="ticket-card" style={{
            background: 'white',
            borderRadius: '16px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
            overflow: 'hidden',
            border: '3px dashed #e0e0e0'
          }}>
            {/* TICKET HEADER */}
            <div style={{
              background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
              color: 'white',
              padding: '24px',
              textAlign: 'center',
              borderBottom: '3px dashed #e0e0e0'
            }}>
              <div style={{fontSize: '24px', fontWeight: 'bold', marginBottom: '8px'}}>
                🎯 EGT SPORTS BETTING TICKET
              </div>
              <div style={{fontSize: '14px', opacity: '0.9'}}>
                {sport} • {timestamp}
              </div>
            </div>

            {/* TICKET NUMBER - PROMINENT */}
            <div style={{
              background: 'white',
              padding: '32px 24px',
              textAlign: 'center',
              borderBottom: '2px solid #f0f0f0'
            }}>
              <div style={{fontSize: '14px', color: '#666', marginBottom: '12px', fontWeight: '600', letterSpacing: '1px'}}>
                CONFIRMATION NUMBER
              </div>
              <div style={{
                background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                color: 'white',
                padding: '20px',
                borderRadius: '12px',
                fontSize: '28px',
                fontWeight: 'bold',
                letterSpacing: '1px',
                fontFamily: 'monospace',
                boxShadow: '0 4px 15px rgba(40, 167, 69, 0.3)',
                border: '3px solid #1e7e34'
              }}>
                {ticketNumber}
              </div>
            </div>

            {/* BET DETAILS SECTION */}
            <div style={{
              padding: '24px',
              background: '#f8f9fa',
              borderBottom: '2px solid #e0e0e0'
            }}>
              <h3 style={{fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: '#333'}}>
                📋 BET DETAILS
              </h3>
              <div style={{display: 'grid', gridTemplateColumns: betType === 'straight' ? '1fr' : '1fr 1fr', gap: '12px'}}>
                <div style={{background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e0e0e0'}}>
                  <div style={{fontSize: '12px', color: '#666', marginBottom: '4px'}}>Bet Type</div>
                  <div style={{fontSize: '16px', fontWeight: 'bold', color: '#333'}}>{betType === 'straight' ? 'Straight Bets' : 'Parlay'}</div>
                </div>
                <div style={{background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e0e0e0'}}>
                  <div style={{fontSize: '12px', color: '#666', marginBottom: '4px'}}>Sport</div>
                  <div style={{fontSize: '16px', fontWeight: 'bold', color: '#333'}}>{sport}</div>
                </div>
                <div style={{background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e0e0e0'}}>
                  <div style={{fontSize: '12px', color: '#666', marginBottom: '4px'}}>Total Amount</div>
                  <div style={{fontSize: '16px', fontWeight: 'bold', color: '#28a745'}}>${totalAmount.toFixed(2)}</div>
                </div>
                <div style={{background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e0e0e0'}}>
                  <div style={{fontSize: '12px', color: '#666', marginBottom: '4px'}}>Total Picks</div>
                  <div style={{fontSize: '16px', fontWeight: 'bold', color: '#333'}}>{pickCount}</div>
                </div>
                {betType === 'parlay' && (
                  <div style={{background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e0e0e0', gridColumn: 'span 2'}}>
                    <div style={{fontSize: '12px', color: '#666', marginBottom: '4px'}}>Payout Odds</div>
                    <div style={{fontSize: '16px', fontWeight: 'bold', color: '#007bff'}}>{payoutOdds}</div>
                  </div>
                )}
              </div>
            </div>

            {/* YOUR PICKS SECTION */}
            <div style={{
              padding: '24px',
              background: 'white',
              borderBottom: '2px solid #e0e0e0'
            }}>
              <h3 style={{fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: '#333'}}>
                🎲 YOUR PICKS
              </h3>
              <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                {picksFormatted.map((pick, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px',
                    background: '#f8f9fa',
                    borderRadius: '8px',
                    border: '1px solid #e0e0e0'
                  }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      background: '#007bff',
                      color: 'white',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      marginRight: '12px',
                      flexShrink: 0
                    }}>
                      {idx + 1}
                    </div>
                    <div style={{fontSize: '15px', fontWeight: '600', color: '#333'}}>
                      {pick}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* PAYMENT SECTION */}
            <div style={{
              padding: '24px',
              background: '#fff3cd',
              borderBottom: '3px dashed #e0e0e0'
            }}>
              <h3 style={{fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: '#856404'}}>
                💳 PAYMENT REQUIRED
              </h3>
              {contactInfo.paymentMethod === 'venmo' ? (
                <div style={{
                  background: 'white',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '2px solid #ffc107'
                }}>
                  <div style={{marginBottom: '12px', fontSize: '15px', color: '#333'}}>
                    <strong>Send:</strong> <span style={{fontSize: '18px', fontWeight: 'bold', color: '#28a745'}}>${contactInfo.betAmount}</span>
                  </div>
                  <div style={{marginBottom: '12px', fontSize: '15px', color: '#333'}}>
                    <strong>To:</strong> <span style={{fontSize: '16px', fontWeight: 'bold', color: '#007bff'}}>@{VENMO_USERNAME}</span> on Venmo
                  </div>
                  <div style={{fontSize: '15px', color: '#333'}}>
                    <strong>Note:</strong> <span style={{fontSize: '16px', fontWeight: 'bold', fontFamily: 'monospace', background: '#f8f9fa', padding: '4px 8px', borderRadius: '4px'}}>"{ticketNumber}"</span>
                  </div>
                </div>
              ) : (
                <div style={{
                  background: 'white',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '2px solid #ffc107'
                }}>
                  <div style={{marginBottom: '12px', fontSize: '15px', color: '#333'}}>
                    <strong>Send:</strong> <span style={{fontSize: '18px', fontWeight: 'bold', color: '#28a745'}}>${contactInfo.betAmount}</span>
                  </div>
                  <div style={{marginBottom: '12px', fontSize: '15px', color: '#333'}}>
                    <strong>To:</strong> <span style={{fontSize: '16px', fontWeight: 'bold', color: '#007bff'}}>{ZELLE_EMAIL}</span> via Zelle
                  </div>
                  <div style={{fontSize: '15px', color: '#333'}}>
                    <strong>Note:</strong> <span style={{fontSize: '16px', fontWeight: 'bold', fontFamily: 'monospace', background: '#f8f9fa', padding: '4px 8px', borderRadius: '4px'}}>"{ticketNumber}"</span>
                  </div>
                </div>
              )}
            </div>

            {/* CONTACT INFO */}
            <div style={{
              padding: '16px 24px',
              background: '#f8f9fa',
              fontSize: '13px',
              color: '#666',
              textAlign: 'center'
            }}>
              Contact: {contactInfo.name} • {contactInfo.email}
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div style={{marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px'}}>
            <button
              className="btn btn-info"
              onClick={handleEmailTicket}
              style={{
                width: '100%',
                padding: '16px',
                fontSize: '18px',
                fontWeight: 'bold',
                background: '#17a2b8',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }}
            >
              <span>📧</span>
              <span>Email This Ticket</span>
            </button>

            {contactInfo.paymentMethod === 'venmo' && (
              <button
                className="btn btn-primary"
                onClick={openVenmo}
                style={{
                  width: '100%',
                  padding: '16px',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px'
                }}
              >
                <span>💰</span>
                <span>Open Venmo to Pay</span>
              </button>
            )}

            <button 
              className="btn btn-secondary" 
              onClick={() => window.location.reload()}
              style={{
                width: '100%',
                padding: '16px',
                fontSize: '18px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }}
            >
              <span>📄</span>
              <span>Submit Another Ticket</span>
            </button>
          </div>

          {/* IMPORTANT NOTICE */}
          <div style={{
            marginTop: '24px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '12px',
            padding: '16px',
            textAlign: 'center',
            color: 'white'
          }}>
            <p style={{fontSize: '14px', marginBottom: '0', lineHeight: '1.6'}}>
              ⚠️ <strong>Keep your ticket number safe!</strong> You will need it to verify your ticket and claim winnings.
              Payment must be received before games start or ticket will be voided.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (showCheckout) {
    // Helper function to generate unique pick ID
    const getPickId = (gameId, pickType) => `${gameId}-${pickType}`;
    
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
            
            {betType === 'straight' ? (
              // Straight Bets: Individual bet amounts for each pick
              <>
                <h3 className="mb-2">Your Bets ({pickCount})</h3>
                <div style={{background: '#e7f3ff', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px'}}>
                  <strong>💡 Straight Bets:</strong> Set an individual wager amount for each bet below (Min ${MIN_BET}, Max ${MAX_BET} per bet)
                </div>
                {Object.entries(selectedPicks).map(([gameId, pickObj]) => {
                  // Find game in either single sport games or all sports games
                  // Convert gameId to match type (string for cross-sport, number for single sport)
                  const numericGameId = Number(gameId);
                  let game = games.find(g => g.id === gameId || g.id === numericGameId);
                  if (!game && allSportsGames) {
                    for (const sportGames of Object.values(allSportsGames)) {
                      game = sportGames.find(g => g.id === gameId || g.id === numericGameId);
                      if (game) break;
                    }
                  }
                  if (!game) return null;
                  
                  const sportBadge = game.sport ? (
                    <span style={{
                      fontSize: '10px',
                      background: '#007bff',
                      color: 'white',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      marginLeft: '8px'
                    }}>
                      {game.sport}
                    </span>
                  ) : null;
                  
                  return (
                    <div key={gameId}>
                      {pickObj.spread && (
                        <div style={{padding: '16px', background: '#f8f9fa', borderRadius: '8px', marginBottom: '12px', border: '2px solid #e0e0e0'}}>
                          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'}}>
                            <div style={{flex: 1}}>
                              <div style={{fontWeight: 'bold', fontSize: '16px', marginBottom: '4px'}}>
                                {pickObj.spread === 'away' ? game.awayTeam : game.homeTeam}
                                {sportBadge}
                              </div>
                              <div style={{fontSize: '13px', color: '#666'}}>
                                {game.awayTeam} @ {game.homeTeam}
                              </div>
                            </div>
                            <div style={{textAlign: 'right'}}>
                              <div style={{fontSize: '12px', color: '#666'}}>Moneyline</div>
                              <div style={{fontWeight: 'bold', fontSize: '18px', color: '#007bff'}}>
                                {pickObj.spread === 'away' ? game.awayMoneyline : game.homeMoneyline}
                              </div>
                            </div>
                          </div>
                          <div>
                            <label style={{fontSize: '14px', fontWeight: '600', marginBottom: '4px', display: 'block'}}>
                              Wager Amount *
                            </label>
                            <input 
                              type="number" 
                              value={individualBetAmounts[getPickId(gameId, 'spread')] || ''} 
                              onChange={(e) => setIndividualBetAmounts({
                                ...individualBetAmounts,
                                [getPickId(gameId, 'spread')]: e.target.value
                              })} 
                              placeholder={`$${MIN_BET} - $${MAX_BET}`}
                              min={MIN_BET}
                              max={MAX_BET}
                              step="0.01"
                              style={{width: '100%', padding: '10px', fontSize: '16px', border: '2px solid #ccc', borderRadius: '6px'}}
                            />
                          </div>
                        </div>
                      )}
                      {pickObj.total && (
                        <div style={{padding: '16px', background: '#f8f9fa', borderRadius: '8px', marginBottom: '12px', border: '2px solid #e0e0e0'}}>
                          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'}}>
                            <div style={{flex: 1}}>
                              <div style={{fontWeight: 'bold', fontSize: '16px', marginBottom: '4px'}}>
                                {pickObj.total === 'over' ? 'Over' : 'Under'} {game.total}
                                {sportBadge}
                              </div>
                              <div style={{fontSize: '13px', color: '#666'}}>
                                {game.awayTeam} @ {game.homeTeam}
                              </div>
                            </div>
                            <div style={{textAlign: 'right'}}>
                              <div style={{fontSize: '12px', color: '#666'}}>Odds</div>
                              <div style={{fontWeight: 'bold', fontSize: '18px', color: '#007bff'}}>
                                -110
                              </div>
                            </div>
                          </div>
                          <div>
                            <label style={{fontSize: '14px', fontWeight: '600', marginBottom: '4px', display: 'block'}}>
                              Wager Amount *
                            </label>
                            <input 
                              type="number" 
                              value={individualBetAmounts[getPickId(gameId, 'total')] || ''} 
                              onChange={(e) => setIndividualBetAmounts({
                                ...individualBetAmounts,
                                [getPickId(gameId, 'total')]: e.target.value
                              })} 
                              placeholder={`$${MIN_BET} - $${MAX_BET}`}
                              min={MIN_BET}
                              max={MAX_BET}
                              step="0.01"
                              style={{width: '100%', padding: '10px', fontSize: '16px', border: '2px solid #ccc', borderRadius: '6px'}}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            ) : (
              // Parlays: Single bet amount for entire parlay
              <>
                <h3 className="mb-2">Your Picks ({pickCount})</h3>
                {Object.entries(selectedPicks).map(([gameId, pickObj]) => {
                  // Find game in either single sport games or all sports games
                  // Convert gameId to match type (string for cross-sport, number for single sport)
                  const numericGameId = Number(gameId);
                  let game = games.find(g => g.id === gameId || g.id === numericGameId);
                  if (!game && betType === 'parlay' && allSportsGames) {
                    for (const sportGames of Object.values(allSportsGames)) {
                      game = sportGames.find(g => g.id === gameId || g.id === numericGameId);
                      if (game) break;
                    }
                  }
                  if (!game) return null;
                  
                  const sportBadge = game.sport && betType === 'parlay' ? (
                    <span style={{
                      fontSize: '10px',
                      background: '#007bff',
                      color: 'white',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      marginLeft: '8px'
                    }}>
                      {game.sport}
                    </span>
                  ) : null;
                  
                  return (
                    <div key={gameId}>
                      {pickObj.spread && (
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f8f9fa', borderRadius: '8px', marginBottom: '4px'}}>
                          <div>
                            <strong>[SPREAD] {pickObj.spread === 'away' ? game.awayTeam : game.homeTeam}</strong>
                            {sportBadge}
                          </div>
                          <span>{pickObj.spread === 'away' ? game.awaySpread : game.homeSpread}</span>
                        </div>
                      )}
                      {pickObj.total && (
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f8f9fa', borderRadius: '8px', marginBottom: '4px'}}>
                          <div>
                            <strong>[TOTAL] {pickObj.total === 'over' ? 'Over' : 'Under'} {game.total}</strong>
                            {sportBadge}
                          </div>
                          <span>{game.awayTeam} @ {game.homeTeam}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
            
            <h3 className="mb-2" style={{marginTop: '32px'}}>Contact Information</h3>
            <label>Full Name *</label>
            <input type="text" value={contactInfo.name} onChange={(e) => setContactInfo({...contactInfo, name: e.target.value})} />

            <label>Email *</label>
            <input type="email" value={contactInfo.email} onChange={(e) => setContactInfo({...contactInfo, email: e.target.value})} />

            {betType === 'parlay' && (
              <>
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
              </>
            )}
            
            <h3 className="mb-2" style={{marginTop: '32px'}}>Payment Method</h3>
            <div style={{display: 'flex', gap: '12px', marginBottom: '16px'}}>
              <button
                type="button"
                className="btn"
                style={{
                  flex: 1,
                  background: contactInfo.paymentMethod === 'venmo' ? '#007bff' : '#fff',
                  color: contactInfo.paymentMethod === 'venmo' ? '#fff' : '#333',
                  border: '2px solid #007bff',
                  fontWeight: 'bold',
                  padding: '12px 20px'
                }}
                onClick={() => setContactInfo({...contactInfo, paymentMethod: 'venmo'})}
              >
                Venmo
              </button>
              <button
                type="button"
                className="btn"
                style={{
                  flex: 1,
                  background: contactInfo.paymentMethod === 'zelle' ? '#007bff' : '#fff',
                  color: contactInfo.paymentMethod === 'zelle' ? '#fff' : '#333',
                  border: '2px solid #007bff',
                  fontWeight: 'bold',
                  padding: '12px 20px'
                }}
                onClick={() => setContactInfo({...contactInfo, paymentMethod: 'zelle'})}
              >
                Zelle
              </button>
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
    <div className="gradient-bg" style={{display: 'flex', minHeight: '100vh'}}>
      {/* Left Sidebar - Sports Menu - Always show when allSportsGames is available */}
      {allSportsGames && Object.keys(allSportsGames).length > 0 && (
        <SportsMenu
          currentSport={currentViewSport}
          onSelectSport={onChangeSport}
          allSportsGames={allSportsGames}
          betType={betType}
        />
      )}
      
      {/* Main Content */}
      <div className={`container ${allSportsGames && Object.keys(allSportsGames).length > 0 ? 'with-sidebar' : ''}`} style={{
        marginLeft: allSportsGames && Object.keys(allSportsGames).length > 0 ? '250px' : '0',
        marginRight: '370px',
        width: allSportsGames && Object.keys(allSportsGames).length > 0 ? 'calc(100% - 620px)' : 'calc(100% - 370px)',
        transition: 'all 0.3s ease'
      }}>
        <div className="text-center text-white mb-4">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px'}}>
            <button className="btn btn-secondary" onClick={onBackToMenu} style={{height: 'fit-content'}}>
              🚪 Sign Out
            </button>
            <div style={{flex: 1, textAlign: 'center'}}>
              <h1 style={{fontSize: '42px'}}>
                {betType === 'parlay' ? 'Multi-Sport Parlays' : `${sport} ${betType === 'straight' ? 'Straight Bets' : 'Bets'}`}
              </h1>
              <p style={{fontSize: '22px'}}>
                {betType === 'parlay' 
                  ? 'Select picks across multiple sports for bigger payouts'
                  : 'Make your selections below to get started.'}
              </p>
              {activeGamesCount > 0 && (
                <div style={{fontSize: '14px', color: '#ffc107', marginTop: '8px'}}>
                  🔴 {activeGamesCount} live game{activeGamesCount > 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>
          
          {/* Sport indicator for single sport mode */}
          {betType !== 'parlay' && (
            <div style={{
              display: 'inline-block',
              background: 'rgba(255, 255, 255, 0.2)',
              padding: '10px 20px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '16px',
              fontWeight: '600'
            }}>
              🏈 {sport}
            </div>
          )}
          
          {/* MANUAL REFRESH BUTTON */}
          <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginBottom: '16px'}}>
            <button 
              className="btn btn-info" 
              onClick={handleManualRefresh} 
              disabled={isRefreshing}
              style={{padding: '8px 20px', fontSize: '14px'}}
            >
              {isRefreshing ? '🔄 Refreshing...' : '🔄 Refresh Games'}
            </button>
            {lastRefreshTime && (
              <span style={{fontSize: '12px', color: '#ddd'}}>
                Updated {getTimeSinceRefresh()}
              </span>
            )}
          </div>
          
        </div>
        
        {/* New Grid Betting Layout */}
        <GridBettingLayout
          games={games}
          selectedPicks={selectedPicks}
          onSelectPick={handleGridPickSelection}
          betType={betType}
        />
        
        <div className="card">
          {betType === 'parlay' ? (
            <>
              <h2 className="text-center mb-2">Payout Odds</h2>
              <div className="payout-grid">
                {[
                  {picks: 3, payout: '8 to 1'}, 
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
            </>
          ) : (
            <>
              <h2 className="text-center mb-2">Straight Bet Odds</h2>
              <p style={{textAlign: 'center', color: '#666', fontSize: '14px', marginBottom: '0'}}>
                Each selection shows moneyline odds. Your payout will be calculated based on these odds.
                <br />
                <strong>Example:</strong> A $100 bet at +150 returns $150 profit ($250 total). At -110, returns $91 profit ($191 total).
              </p>
            </>
          )}
        </div>
        
        {/* Replaced old game cards with new GridBettingLayout - rendered above */}
        
        <div className="card">
          <h3 className="mb-2">Important Rules</h3>
          <ul style={{marginLeft: '20px', lineHeight: '1.8'}}>
            <li><strong>Minimum {minPicks} pick{minPicks > 1 ? 's' : ''} required</strong></li>
            <li><strong>Minimum Bet = $5</strong></li>
             <li><strong>Maximum Bet = $100</strong></li>
            <li>Missing info = voided ticket</li>
            <li>Funds must be deposited into players pool <strong>@{VENMO_USERNAME}</strong> prior to games starting or ticket is not valid</li>
             <li>A tie counts as a loss</li>
            {betType === 'parlay' && <li><strong>✨ NEW: Cross-sports parlays are now allowed!</strong> Mix picks from different leagues</li>}
            {betType === 'straight' && <li><strong>Straight Bet Payouts:</strong> Based on moneyline odds shown for each game</li>}
            <li>Winners paid following Tuesday</li>
            <li>Cannot bet on games already completed</li>
             <li>If you have questions or issues, please contact support@EGTSports.ws</li>
            <li>Each time you participate, your club membership is renewed</li>
          </ul>
          <div style={{background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', padding: '16px', marginTop: '20px', fontSize: '14px', color: '#856404'}}>
            <strong>Legal Disclaimer:</strong> For entertainment only. 21+ only. Private pool among friends. Check local laws. By participating, you acknowledge responsibility for compliance with local laws.
          </div>
        </div>
      </div>
      
      {/* Betting Slip - Floating on the right side */}
      <BettingSlip
        selectedPicks={selectedPicks}
        onRemovePick={handleRemovePick}
        onClearAll={handleClearAll}
        onSubmit={submitPicks}
        betType={betType}
        onBetTypeChange={onBetTypeChange}
        games={games}
        allSportsGames={allSportsGames}
        individualBetAmounts={individualBetAmounts}
        setIndividualBetAmounts={setIndividualBetAmounts}
        MIN_BET={MIN_BET}
        MAX_BET={MAX_BET}
      />
      
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

// Error Boundary Component to catch React errors
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding: '40px', textAlign: 'center', fontFamily: 'Arial'}}>
          <h1 style={{color: '#dc3545'}}>Something went wrong</h1>
          <p>We're sorry for the inconvenience. The application encountered an error.</p>
          <details style={{whiteSpace: 'pre-wrap', textAlign: 'left', maxWidth: '800px', margin: '20px auto', padding: '20px', background: '#f8f9fa', borderRadius: '8px'}}>
            <summary style={{cursor: 'pointer', fontWeight: 'bold', marginBottom: '10px'}}>Error Details</summary>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
          <button 
            onClick={() => window.location.reload()} 
            style={{padding: '12px 24px', fontSize: '16px', background: '#007bff', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer'}}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Main App Component - WITH SMART REFRESH LOGIC
function App() {
  const [authState, setAuthState] = useState({
    loading: true,
    user: null,
    isAdmin: false,
    error: "",
  });
  const [userRole, setUserRole] = useState(null); // 'user', 'admin', 'guest', or null
  const [showAdminUserManagement, setShowAdminUserManagement] = useState(false);
  const [betType, setBetType] = useState('parlay'); // Default to 'parlay' mode - users can switch via betting slip
  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });
  const [games, setGames] = useState([]);
  const [allSportsGames, setAllSportsGames] = useState({}); // For cross-sport parlays
  const [currentViewSport, setCurrentViewSport] = useState(null); // Currently displayed sport in tabs
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [recentlyUpdated, setRecentlyUpdated] = useState({});
  const [submissions, setSubmissions] = useState([]);
  const [selectedSport, setSelectedSport] = useState(null);
  const [lastRefreshTime, setLastRefreshTime] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(null);

  // Fetch College Basketball odds from The Odds API
  const fetchCollegeBasketballOdds = async () => {
    try {
      const sportKey = ODDS_API_SPORT_KEYS['College Basketball'];
      const url = `${ODDS_API_BASE_URL}/sports/${sportKey}/odds/?apiKey=${ODDS_API_KEY}&regions=us&markets=spreads,totals&oddsFormat=american`;
      
      console.log('🏀 Fetching College Basketball odds from The Odds API...');
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`⚠️ The Odds API returned status ${response.status}`);
        return null;
      }
      
      const data = await response.json();
      console.log(`✅ Fetched odds for ${data.length} College Basketball games from The Odds API`);
      
      // Parse The Odds API response into a map of team names to odds
      const oddsMap = {};
      
      data.forEach(game => {
        const homeTeam = game.home_team;
        const awayTeam = game.away_team;
        
        // Find spread and total markets
        const spreadMarket = game.bookmakers?.[0]?.markets?.find(m => m.key === 'spreads');
        const totalMarket = game.bookmakers?.[0]?.markets?.find(m => m.key === 'totals');
        
        let homeSpread = '';
        let awaySpread = '';
        let total = '';
        
        if (spreadMarket?.outcomes) {
          const homeOutcome = spreadMarket.outcomes.find(o => o.name === homeTeam);
          const awayOutcome = spreadMarket.outcomes.find(o => o.name === awayTeam);
          
          if (homeOutcome?.point !== undefined) {
            homeSpread = homeOutcome.point > 0 ? `+${homeOutcome.point}` : String(homeOutcome.point);
          }
          if (awayOutcome?.point !== undefined) {
            awaySpread = awayOutcome.point > 0 ? `+${awayOutcome.point}` : String(awayOutcome.point);
          }
        }
        
        if (totalMarket?.outcomes?.[0]?.point !== undefined) {
          total = String(totalMarket.outcomes[0].point);
        }
        
        // Store by both team names for easy lookup
        const gameKey = `${awayTeam}|${homeTeam}`;
        oddsMap[gameKey] = { homeSpread, awaySpread, total };
        
        console.log(`📊 ${awayTeam} @ ${homeTeam}: Away ${awaySpread}, Home ${homeSpread}, Total ${total}`);
      });
      
      return oddsMap;
    } catch (error) {
      console.error('❌ Error fetching College Basketball odds:', error);
      return null;
    }
  };

  // Match ESPN game data with The Odds API odds data
  const matchOddsToGame = (game, oddsMap) => {
    if (!oddsMap) return { awaySpread: '', homeSpread: '', total: '' };
    
    // Try exact match
    const gameKey = `${game.awayTeam}|${game.homeTeam}`;
    if (oddsMap[gameKey]) {
      return oddsMap[gameKey];
    }
    
    // Try fuzzy match (handles name variations)
    for (const [key, value] of Object.entries(oddsMap)) {
      const [oddsAway, oddsHome] = key.split('|');
      
      // Check if team names contain each other
      if (game.awayTeam.includes(oddsAway) || oddsAway.includes(game.awayTeam)) {
        if (game.homeTeam.includes(oddsHome) || oddsHome.includes(game.homeTeam)) {
          console.log(`✅ Fuzzy matched: "${game.awayTeam} @ ${game.homeTeam}" with "${oddsAway} @ ${oddsHome}"`);
          return value;
        }
      }
    }
    
    console.warn(`⚠️ No odds found for ${game.awayTeam} @ ${game.homeTeam}`);
    return { awaySpread: '', homeSpread: '', total: '' };
  };

  // Helper function to parse ESPN odds
  const parseESPNOdds = useCallback((competition, sport) => {
    let awaySpread = '';
    let homeSpread = '';
    let total = '';
    let awayMoneyline = '';
    let homeMoneyline = '';
    
    try {
      if (!competition.odds || competition.odds.length === 0) {
        console.log(`No odds data available for this game`);
        return { awaySpread, homeSpread, total, awayMoneyline, homeMoneyline };
      }
      
      const odds = competition.odds[0];
      const gameName = `${competition.competitors[1].team.displayName} @ ${competition.competitors[0].team.displayName}`;
      console.log(`\n=== Parsing odds for ${sport}: ${gameName} ===`);
      console.log('Full odds object:', JSON.stringify(odds, null, 2));
      
      // Try different ESPN API structures
      
      // Method 1: Check if details string exists (e.g., "KC -3.5")
      if (odds.details) {
        console.log('Found odds.details:', odds.details);
        // Parse details string to extract spreads if needed
      }
      
      // Method 2: Check direct spread property (PRIMARY METHOD - PR #16 fix)
      if (odds.spread !== undefined) {
        console.log('Found odds.spread:', odds.spread);
        const spreadValue = parseFloat(odds.spread);
        if (!isNaN(spreadValue) && Math.abs(spreadValue) < 50) {
          // ESPN provides the spread from the favorite's perspective
          // Negative means home team is favored, positive means away team is favored
          homeSpread = spreadValue > 0 ? `+${spreadValue}` : String(spreadValue);
          awaySpread = spreadValue > 0 ? String(-spreadValue) : `+${-spreadValue}`;
          console.log('✅ Using odds.spread - Home:', homeSpread, 'Away:', awaySpread);
        }
      }
      
      // Method 3: Check homeTeamOdds/awayTeamOdds structure (fallback)
      if (!homeSpread && !awaySpread && (odds.homeTeamOdds || odds.awayTeamOdds)) {
        console.log('homeTeamOdds:', JSON.stringify(odds.homeTeamOdds, null, 2));
        console.log('awayTeamOdds:', JSON.stringify(odds.awayTeamOdds, null, 2));
        
        // The issue: we were using 'spreadOdds' which is the betting odds (-110)
        // We need the actual point spread which might be in 'line', 'point', or 'spread'
        const homeSpreadValue = odds.homeTeamOdds?.line || odds.homeTeamOdds?.point || odds.homeTeamOdds?.spread;
        const awaySpreadValue = odds.awayTeamOdds?.line || odds.awayTeamOdds?.point || odds.awayTeamOdds?.spread;
        
        console.log('Extracted home spread value:', homeSpreadValue);
        console.log('Extracted away spread value:', awaySpreadValue);
        
        // Sanity check - spreads should be reasonable
        if (homeSpreadValue !== undefined && Math.abs(homeSpreadValue) < 50) {
          homeSpread = homeSpreadValue > 0 ? `+${homeSpreadValue}` : String(homeSpreadValue);
        } else if (homeSpreadValue !== undefined) {
          console.warn(`⚠️ Home spread ${homeSpreadValue} seems unrealistic, skipping`);
        }
        
        if (awaySpreadValue !== undefined && Math.abs(awaySpreadValue) < 50) {
          awaySpread = awaySpreadValue > 0 ? `+${awaySpreadValue}` : String(awaySpreadValue);
        } else if (awaySpreadValue !== undefined) {
          console.warn(`⚠️ Away spread ${awaySpreadValue} seems unrealistic, skipping`);
        }
      }
      
      // Method 4: Check for overUnder/total
      if (odds.overUnder !== undefined) {
        console.log('Found odds.overUnder:', odds.overUnder);
        if (odds.overUnder > 30 && odds.overUnder < 300) { // Sanity check
          total = String(odds.overUnder);
        }
      } else if (odds.total !== undefined) {
        console.log('Found odds.total:', odds.total);
        if (odds.total > 30 && odds.total < 300) { // Sanity check
          total = String(odds.total);
        }
      }
      
      // Method 5: Check for moneyline odds (for straight bets)
      // Moneyline odds are typically in homeTeamOdds.moneyLine or awayTeamOdds.moneyLine
      if (odds.homeTeamOdds?.moneyLine !== undefined) {
        const ml = parseInt(odds.homeTeamOdds.moneyLine);
        if (!isNaN(ml) && ml >= -10000 && ml <= 10000) {
          homeMoneyline = ml > 0 ? `+${ml}` : String(ml);
          console.log('✅ Found home moneyline:', homeMoneyline);
        }
      }
      
      if (odds.awayTeamOdds?.moneyLine !== undefined) {
        const ml = parseInt(odds.awayTeamOdds.moneyLine);
        if (!isNaN(ml) && ml >= -10000 && ml <= 10000) {
          awayMoneyline = ml > 0 ? `+${ml}` : String(ml);
          console.log('✅ Found away moneyline:', awayMoneyline);
        }
      }
      
      // Alternative: Check for 'price' or 'odds' fields
      if (!homeMoneyline && odds.homeTeamOdds?.price !== undefined) {
        const price = parseInt(odds.homeTeamOdds.price);
        if (!isNaN(price) && price >= -10000 && price <= 10000) {
          homeMoneyline = price > 0 ? `+${price}` : String(price);
          console.log('✅ Found home moneyline from price:', homeMoneyline);
        }
      }
      
      if (!awayMoneyline && odds.awayTeamOdds?.price !== undefined) {
        const price = parseInt(odds.awayTeamOdds.price);
        if (!isNaN(price) && price >= -10000 && price <= 10000) {
          awayMoneyline = price > 0 ? `+${price}` : String(price);
          console.log('✅ Found away moneyline from price:', awayMoneyline);
        }
      }
      
      console.log('✅ Final parsed values:', { awaySpread, homeSpread, total, awayMoneyline, homeMoneyline });
      console.log('=====================================\n');
      
    } catch (error) {
      console.error('❌ Error parsing odds:', error);
    }
    
    return { awaySpread, homeSpread, total, awayMoneyline, homeMoneyline };
  }, []);

  // IMPROVED: SPORT-SPECIFIC GAME LOADING WITH SMART REFRESH AND DATE RANGE
  const loadGames = useCallback(async (sport, forceRefresh = false) => {
    setLoading(true);
    setApiError(null);
    
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = gameCache[sport];
      const cacheExpiry = sport === 'College Basketball' 
        ? COLLEGE_BASKETBALL_CACHE_DURATION 
        : CACHE_DURATION;
      
      if (cached && Date.now() - cached.timestamp < cacheExpiry) {
        console.log(`✅ Using cached data for ${sport}`);
        apiCallCount.cacheHits++;
        setGames(cached.data);
        setLoading(false);
        setLastRefreshTime(cached.timestamp);
        logAPIUsage(sport, true, true);
        return;
      }
    }
    
    try {
      const apiEndpoint = ESPN_API_ENDPOINTS[sport];
      const dateURLs = getESPNDateRangeURLs(apiEndpoint);
      console.log(`🔄 Fetching ${sport} games for ${dateURLs.length} dates from ESPN API...`);
      
      // Track API call
      apiCallCount.total += dateURLs.length;
      apiCallCount.byEndpoint[sport] = (apiCallCount.byEndpoint[sport] || 0) + dateURLs.length;
      
      // Fetch all dates in parallel
      const responses = await Promise.all(
        dateURLs.map(url => fetch(url).catch(err => {
          console.error(`Error fetching ${url}:`, err);
          return null;
        }))
      );
      
      // Filter out failed requests
      const validResponses = responses.filter(r => r !== null);
      
      if (validResponses.length === 0) {
        throw new Error('All API requests failed');
      }
      
      // Check for rate limiting on any response
      const rateLimited = validResponses.some(r => r.status === 429);
      if (rateLimited) {
        console.error('⚠️ ESPN API rate limit exceeded');
        apiCallCount.errors++;
        setApiError('ESPN API is temporarily unavailable due to rate limiting. Please try again in a few minutes.');
        
        // Try to use stale cache if available
        const cached = gameCache[sport];
        if (cached) {
          console.log('📦 Using stale cache due to rate limit');
          setGames(cached.data);
          setLastRefreshTime(cached.timestamp);
        }
        setLoading(false);
        logAPIUsage(sport, false, false);
        return;
      }
      
      // Parse all responses
      const allData = await Promise.all(
        validResponses.map(r => r.ok ? r.json() : null)
      );
      
      // Combine all events from all dates
      const allEvents = [];
      allData.forEach(data => {
        if (data && data.events && data.events.length > 0) {
          allEvents.push(...data.events);
        }
      });
      
      // Check if events exist
      if (allEvents.length === 0) {
        console.log(`ℹ️ No games available for ${sport}`);
        setGames([]);
        
        // Cache empty result to avoid repeated API calls
        const timestamp = Date.now();
        gameCache[sport] = {
          data: [],
          timestamp: timestamp
        };
        
        setLoading(false);
        setLastRefreshTime(timestamp);
        logAPIUsage(sport, true, false);
        return;
      }
      
      // Debug: Log the entire odds structure for the first 2 games
      allEvents.slice(0, 2).forEach((event, index) => {
        const competition = event.competitions[0];
        console.log('=== DEBUG: ESPN API Odds Structure ===');
        console.log('Game:', competition.competitors[1].team.displayName, '@', competition.competitors[0].team.displayName);
        console.log('Full odds object:', JSON.stringify(competition.odds, null, 2));
        console.log('======================================');
      });
      
      // Remove duplicate games (same espnId)
      const uniqueEvents = [];
      const seenIds = new Set();
      allEvents.forEach(event => {
        if (!seenIds.has(event.id)) {
          seenIds.add(event.id);
          uniqueEvents.push(event);
        }
      });
      
      // Sort events by date (past games first, then upcoming)
      uniqueEvents.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      const formattedGames = uniqueEvents.map((event, index) => {
        const competition = event.competitions[0];
        const awayTeam = competition.competitors[1];
        const homeTeam = competition.competitors[0];
        const status = event.status.type.state;
        
        // Parse odds from ESPN API
        const { awaySpread, homeSpread, total, awayMoneyline, homeMoneyline } = parseESPNOdds(competition, sport);
        
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
          awaySpread: awaySpread,
          homeSpread: homeSpread,
          total: total,
          awayMoneyline: awayMoneyline,
          homeMoneyline: homeMoneyline,
          status: status,
          statusDetail: event.status.type.detail,
          isFinal: status === 'post'
        };
      });
      
      // Special handling for College Basketball - fetch odds from The Odds API
      let finalFormattedGames = formattedGames;
      if (sport === 'College Basketball') {
        console.log('🏀 Fetching College Basketball odds from The Odds API...');
        const oddsMap = await fetchCollegeBasketballOdds();
        
        if (oddsMap) {
          // Match odds to games
          finalFormattedGames = formattedGames.map(game => {
            const odds = matchOddsToGame(game, oddsMap);
            return {
              ...game,
              awaySpread: odds.awaySpread,
              homeSpread: odds.homeSpread,
              total: odds.total
            };
          });
          console.log(`✅ Merged The Odds API data with ${finalFormattedGames.length} College Basketball games`);
        }
      }
      
      // Cache the results
      const timestamp = Date.now();
      gameCache[sport] = {
        data: finalFormattedGames,
        timestamp: timestamp
      };
      
      console.log(`✅ Loaded ${finalFormattedGames.length} ${sport} games`);
      setGames(finalFormattedGames);
      setLastRefreshTime(timestamp);
      
      // SMART REFRESH: Determine next refresh interval based on game states
      const activeGames = hasActiveGames(finalFormattedGames);
      const newInterval = activeGames ? REFRESH_INTERVAL_ACTIVE : REFRESH_INTERVAL_INACTIVE;
      setRefreshInterval(newInterval);
      
      console.log(`⏱️ Next refresh in ${newInterval / 60000} minutes (${activeGames ? 'games active' : 'no active games'})`);
      
      logAPIUsage(sport, true, false);
    } catch (error) {
      console.error(`❌ Error loading ${sport} games:`, error);
      apiCallCount.errors++;
      setApiError(`Unable to load ${sport} games. ${error.message}`);
      
      // Try to use stale cache if available
      const cached = gameCache[sport];
      if (cached) {
        console.log('📦 Using stale cache due to error');
        setGames(cached.data);
        setLastRefreshTime(cached.timestamp);
      }
      logAPIUsage(sport, false, false);
    }
    setLoading(false);
  }, [parseESPNOdds]);

  // SPORT-SPECIFIC FIREBASE LISTENER
  const setupFirebaseListener = useCallback((sport) => {
    try {
      const spreadsRef = ref(database, `spreads/${sport}`);
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
            
            // Update cache with Firebase data
            if (gameCache[sport]) {
              gameCache[sport].data = newGames;
            }
            
            return newGames;
          });
        }
      });
    } catch (error) {
      console.error('Error setting up Firebase listener:', error);
    }
  }, [setGames, setIsSyncing, setRecentlyUpdated]);

  // NEW: Load all sports for cross-sport parlays
  const loadAllSports = useCallback(async (initialSport, forceRefresh = false) => {
    const allSports = ['NFL', 'NBA', 'College Football', 'College Basketball', 'Major League Baseball', 'NHL'];
    const sportsData = {};
    
    setLoading(true);
    setApiError(null);
    
    // Load all sports in parallel
    await Promise.all(allSports.map(async (sport) => {
      try {
        // Check cache first unless force refresh
        if (!forceRefresh) {
          const cached = gameCache[sport];
          const cacheExpiry = sport === 'College Basketball' 
            ? COLLEGE_BASKETBALL_CACHE_DURATION 
            : CACHE_DURATION;
          
          if (cached && Date.now() - cached.timestamp < cacheExpiry) {
            console.log(`✅ Using cached data for ${sport}`);
            apiCallCount.cacheHits++;
            sportsData[sport] = cached.data;
            logAPIUsage(sport, true, true);
            return;
          }
        }
        
        const apiEndpoint = ESPN_API_ENDPOINTS[sport];
        const dateURLs = getESPNDateRangeURLs(apiEndpoint);
        console.log(`🔄 Fetching ${sport} games for ${dateURLs.length} dates (cross-sport parlay)...`);
        
        apiCallCount.total += dateURLs.length;
        apiCallCount.byEndpoint[sport] = (apiCallCount.byEndpoint[sport] || 0) + dateURLs.length;
        
        // Fetch all dates in parallel
        const responses = await Promise.all(
          dateURLs.map(url => fetch(url).catch(err => {
            console.error(`Error fetching ${url}:`, err);
            return null;
          }))
        );
        
        // Filter out failed requests
        const validResponses = responses.filter(r => r !== null);
        
        if (validResponses.length === 0) {
          sportsData[sport] = [];
          return;
        }
        
        const rateLimited = validResponses.some(r => r.status === 429);
        if (rateLimited) {
          console.error(`⚠️ ESPN API rate limit exceeded for ${sport}`);
          apiCallCount.errors++;
          const cached = gameCache[sport];
          if (cached) {
            sportsData[sport] = cached.data;
          } else {
            sportsData[sport] = [];
          }
          return;
        }
        
        // Parse all responses
        const allData = await Promise.all(
          validResponses.map(r => r.ok ? r.json() : null)
        );
        
        // Combine all events from all dates
        const allEvents = [];
        allData.forEach(data => {
          if (data && data.events && data.events.length > 0) {
            allEvents.push(...data.events);
          }
        });
        
        if (allEvents.length === 0) {
          console.log(`ℹ️ No games available for ${sport}`);
          sportsData[sport] = [];
          const timestamp = Date.now();
          gameCache[sport] = { data: [], timestamp };
          return;
        }
        
        // Remove duplicate games and sort by date
        const uniqueEvents = [];
        const seenIds = new Set();
        allEvents.forEach(event => {
          if (!seenIds.has(event.id)) {
            seenIds.add(event.id);
            uniqueEvents.push(event);
          }
        });
        uniqueEvents.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        const formattedGames = uniqueEvents.map((event, index) => {
          const competition = event.competitions[0];
          const awayTeam = competition.competitors[1];
          const homeTeam = competition.competitors[0];
          const status = event.status.type.state;
          
          const { awaySpread, homeSpread, total, awayMoneyline, homeMoneyline } = parseESPNOdds(competition, sport);
          
          return {
            id: `${sport}-${index + 1}`, // Unique ID with sport prefix
            espnId: event.id,
            sport: sport, // Add sport identifier
            date: new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
            time: new Date(event.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + ' ET',
            awayTeam: awayTeam.team.displayName,
            homeTeam: homeTeam.team.displayName,
            awayTeamId: awayTeam.id,
            homeTeamId: homeTeam.id,
            awayScore: awayTeam.score || '0',
            homeScore: homeTeam.score || '0',
            awaySpread: awaySpread,
            homeSpread: homeSpread,
            total: total,
            awayMoneyline: awayMoneyline,
            homeMoneyline: homeMoneyline,
            status: status,
            statusDetail: event.status.type.detail,
            isFinal: status === 'post'
          };
        });
        
        // Special handling for College Basketball
        if (sport === 'College Basketball') {
          const oddsMap = await fetchCollegeBasketballOdds();
          if (oddsMap) {
            const finalFormattedGames = formattedGames.map(game => {
              const odds = matchOddsToGame(game, oddsMap);
              return { ...game, awaySpread: odds.awaySpread, homeSpread: odds.homeSpread, total: odds.total };
            });
            sportsData[sport] = finalFormattedGames;
          } else {
            sportsData[sport] = formattedGames;
          }
        } else {
          sportsData[sport] = formattedGames;
        }
        
        const timestamp = Date.now();
        gameCache[sport] = { data: sportsData[sport], timestamp };
        console.log(`✅ Loaded ${sportsData[sport].length} ${sport} games`);
        logAPIUsage(sport, true, false);
        
      } catch (error) {
        console.error(`❌ Error loading ${sport} games:`, error);
        apiCallCount.errors++;
        sportsData[sport] = [];
        logAPIUsage(sport, false, false);
      }
    }));
    
    setAllSportsGames(sportsData);
    setCurrentViewSport(initialSport);
    setGames(sportsData[initialSport] || []);
    setLoading(false);
    setLastRefreshTime(Date.now());
  }, [parseESPNOdds]);

  // LOAD GAMES WHEN SPORT IS SELECTED - WITH DYNAMIC REFRESH INTERVAL
  useEffect(() => {
    let intervalId = null;
    
    if (selectedSport) {
      // Always load all sports to populate the sidebar
      loadAllSports(selectedSport);
      // Setup Firebase listeners for all sports
      setTimeout(() => {
        Object.keys(ESPN_API_ENDPOINTS).forEach(sport => {
          setupFirebaseListener(sport);
        });
      }, 500);
      
      // Set up interval
      intervalId = setInterval(() => {
        loadAllSports(selectedSport);
      }, refreshInterval || REFRESH_INTERVAL_INACTIVE);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [selectedSport, betType, refreshInterval, loadAllSports, setupFirebaseListener]);

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

  // Manual refresh handler
  const handleManualRefresh = async () => {
    if (selectedSport) {
      await loadGames(selectedSport, true); // Force refresh
    }
  };

  // Sign out handler
  const handleSignOut = async () => {
    await signOut(auth);
    setUserRole(null);
    setBetType(null);
    setSelectedSport(null);
    setShowAdminUserManagement(false);
  };

  // Render UI
  if (authState.loading) return (
    <div className="gradient-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="text-white" style={{ fontSize: '24px' }}>
        Loading...
      </div>
    </div>
  );

  // Show user management if admin selected it
  if (authState.user && authState.isAdmin && showAdminUserManagement) {
    return <UserManagement onBack={() => setShowAdminUserManagement(false)} />;
  }

  // Show admin panel if logged in as admin and sport is selected
  if (authState.user && authState.isAdmin && selectedSport) {
    return <AdminPanel 
      user={authState.user} 
      games={games} 
      setGames={setGames} 
      isSyncing={isSyncing} 
      setIsSyncing={setIsSyncing} 
      recentlyUpdated={recentlyUpdated} 
      setRecentlyUpdated={setRecentlyUpdated} 
      submissions={submissions} 
      sport={selectedSport}
      onBackToMenu={() => setSelectedSport(null)}
    />;
  }

  // Show admin landing page if logged in as admin (no sport selected)
  if (authState.user && authState.isAdmin && !selectedSport) {
    return <AdminLandingPage 
      onSelectSport={(sport) => setSelectedSport(sport)}
      onManageUsers={() => setShowAdminUserManagement(true)}
      onSignOut={handleSignOut}
    />;
  }

  // Show user welcome screen if logged in as non-admin user
  // Skip sport selection - default to NFL and go directly to betting interface
  if (authState.user && !authState.isAdmin && !selectedSport) {
    setSelectedSport('NFL'); // Set default sport
    setCurrentViewSport('NFL'); // Also set current view sport
    return null; // Will re-render with sport selected
  }

  // Show role selection if not determined yet
  if (!userRole) {
    return <AuthLanding onSelectRole={(role) => setUserRole(role)} />;
  }

  // Handle user login
  if (userRole === 'user' && !authState.user) {
    return (
      <div className="gradient-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="card" style={{ maxWidth: '400px', width: '100%', margin: '0 auto', padding: 40 }}>
          <h2 className="text-center mb-4">User Login</h2>
          <form onSubmit={handleLogin} style={{ maxWidth: 300 }}>
            <input
              type="email"
              placeholder="Email"
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
              onClick={() => setUserRole(null)} 
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

  // Handle admin login
  if (userRole === 'admin' && !authState.user) {
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
              onClick={() => setUserRole(null)} 
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

  // Show sport selection if no sport selected (for guest and logged-in user)
  // Skip sport selection - default to NFL and go directly to betting interface
  if (!selectedSport) {
    setSelectedSport('NFL'); // Set default sport
    setCurrentViewSport('NFL'); // Also set current view sport
    return null; // Will re-render with sport selected
  }

  // Show loading while games are loading
  if (loading && !apiError) {
    return (
      <div className="gradient-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="text-white" style={{ fontSize: '24px' }}>
          Loading {selectedSport} games from ESPN...
        </div>
      </div>
    );
  }

  // Show Sport-Specific Parlays page
  return <LandingPage 
    games={games} 
    allSportsGames={allSportsGames}
    currentViewSport={currentViewSport}
    onChangeSport={(sport) => {
      setCurrentViewSport(sport);
      setGames(allSportsGames[sport] || []);
    }}
    loading={loading} 
    onBackToMenu={handleSignOut} 
    sport={selectedSport}
    betType={betType}
    onBetTypeChange={(type) => setBetType(type)}
    apiError={apiError}
    onManualRefresh={handleManualRefresh}
    lastRefreshTime={lastRefreshTime}
  />;
}

// Wrap App with ErrorBoundary
function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

export default AppWithErrorBoundary;
