
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
import GridBettingLayout from './components/GridBettingLayout';
import PropBetsView from './components/PropBetsView';
import BettingSlip from './components/BettingSlip';

function SportsMenu({ currentSport, onSelectSport, allSportsGames, onSignOut, onManualRefresh, isRefreshing }) {
    const sportOrder = ['NFL', 'College Football', 'NBA', 'College Basketball', 'Major League Baseball', 'NHL'];
    
    const sortedSports = Object.keys(allSportsGames).filter(sport => sportOrder.includes(sport)).sort((a, b) => sportOrder.indexOf(a) - sportOrder.indexOf(b));

    const showPropBets = sortedSports.some(sport => ['NFL', 'NBA', 'College Football', 'College Basketball', 'NHL'].includes(sport));

    return (
        <div className="sports-menu">
            <div className="sports-menu-content">
                <h2 className="sports-menu-title">Sports Menu</h2>
                <div className="sports-menu-buttons">
                    {sortedSports.map(sport => (
                        <button
                            key={sport}
                            className={`menu-button ${currentSport === sport ? 'active' : ''}`}
                            onClick={() => onSelectSport(sport)}
                        >
                            <span>{getSportDisplayName(sport)}</span>
                            <span className="game-count">({allSportsGames[sport] ? allSportsGames[sport].length : 0})</span>
                        </button>
                    ))}
                    {showPropBets && (
                        <button
                            key="prop-bets"
                            className={`menu-button ${currentSport === 'Prop Bets' ? 'active' : ''}`}
                            onClick={() => onSelectSport('Prop Bets')}
                        >
                            Prop Bets
                        </button>
                    )}
                </div>
                <div className="sports-menu-actions">
                    <button onClick={onManualRefresh} disabled={isRefreshing} className="btn btn-info">
                        {isRefreshing ? '🔄 Refreshing...' : '🔄 Refresh Games'}
                    </button>
                    <button onClick={onSignOut} className="btn btn-secondary">
                        🚪 Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
}

function MobileSportsMenu({ currentSport, onSelectSport, allSportsGames }) {
    const sportOrder = ['NFL', 'College Football', 'NBA', 'College Basketball', 'Major League Baseball', 'NHL'];
    const sortedSports = Object.keys(allSportsGames).filter(sport => sportOrder.includes(sport)).sort((a, b) => sportOrder.indexOf(a) - sportOrder.indexOf(b));
    const showPropBets = sortedSports.some(sport => ['NFL', 'NBA', 'College Football', 'College Basketball', 'NHL'].includes(sport));

    return (
        <div className="mobile-sports-menu">
            {sortedSports.map(sport => (
                <button
                    key={sport}
                    className={`mobile-menu-button ${currentSport === sport ? 'active' : ''}`}
                    onClick={() => onSelectSport(sport)}
                >
                    {getSportDisplayName(sport)}
                </button>
            ))}
            {showPropBets && (
                <button
                    key="prop-bets"
                    className={`mobile-menu-button ${currentSport === 'Prop Bets' ? 'active' : ''}`}
                    onClick={() => onSelectSport('Prop Bets')}
                >
                    Prop Bets
                </button>
            )}
        </div>
    );
}

// ESPN API Endpoints for all sports
const ESPN_API_ENDPOINTS = {
  'NFL': 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  'NBA': 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  'College Football': 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
  'College Basketball': 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard',
  'Major League Baseball': 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
  'NHL': 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard'
};

// Helper function to get sport display name with emoji
const getSportDisplayName = (sport) => {
  const sportNames = {
    'NFL': 'NFL 🏈',
    'College Football': 'CFB 🏈',
    'NBA': 'NBA 🏀',
    'College Basketball': 'CBB 🏀',
    'Major League Baseball': 'MLB ⚾',
    'NHL': 'NHL 🏒'
  };
  return sportNames[sport] || sport;
};

// Helper function to get date range URLs for ESPN API
// Fetches events from 1 day in the past to 7 days in the future
const getESPNDateRangeURLs = (baseURL) => {
  const urls = [];
  const today = new Date();
  
  for (let i = -1; i <= 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, ''); // Format: YYYYMMDD
    urls.push(`${baseURL}?dates=${dateStr}`);
  }
  
  return urls;
};

// The Odds API Configuration
const ODDS_API_KEY = process.env.REACT_APP_ODDS_API_KEY;
const ODDS_API_BASE_URL = 'https://api.the-odds-api.com/v4';
const USE_ODDS_API_FALLBACK = true;

const ODDS_API_SPORT_KEYS = {
  'NFL': 'americanfootball_nfl',
  'NBA': 'basketball_nba',
  'College Football': 'americanfootball_ncaaf',
  'College Basketball': 'basketball_ncaab',
  'Major League Baseball': 'baseball_mlb',
  'NHL': 'icehockey_nhl'
};

const PROP_BETS_CACHE_DURATION = 2 * 60 * 60 * 1000;

const CACHE_DURATION = 6 * 60 * 60 * 1000;
const COLLEGE_BASKETBALL_CACHE_DURATION = 6 * 60 * 60 * 1000;
const ODDS_API_CACHE_DURATION = 12 * 60 * 60 * 1000;

const gameCache = {};
const oddsAPICache = {};

let apiCallCount = {
  total: 0,
  byEndpoint: {},
  errors: 0,
  cacheHits: 0,
  lastReset: Date.now()
};

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

const MIN_BET = parseInt(process.env.REACT_APP_MIN_BET) || 5;
const MAX_BET = parseInt(process.env.REACT_APP_MAX_BET) || 100;
const GOOGLE_SHEET_URL = process.env.REACT_APP_GOOGLE_SHEET_URL || 'https://script.google.com/macros/s/AKfycbzPastor8yKkWQxKx1z0p-0ZibwBJHkJCuVvHDqP9YX7Dv1-vwakdR9RU6Y6oNw4T2W2PA/exec';

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
    
    const response = await fetch(GOOGLE_SHEET_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'status_update',
        ...statusUpdate
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update status: ${response.status} ${response.statusText}`);
    }
    
  } catch (error) {
    console.error('❌ Error updating status:', error);
  }
};

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

function AdminPanel({ user, games, setGames, isSyncing, setIsSyncing, recentlyUpdated, setRecentlyUpdated, submissions, sport, onBackToMenu }) {
  const [showSubmissions, setShowSubmissions] = useState(false);
  const [showAPIStats, setShowAPIStats] = useState(false);
  const [apiStats, setApiStats] = useState(getAPIStats());

  useEffect(() => {
    const interval = setInterval(() => {
      setApiStats(getAPIStats());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const calculateResult = useCallback((submission) => {
    if (!games || !Array.isArray(games)) {
      return { wins: 0, losses: 0, pending: submission.picks ? submission.picks.length : 0 };
    }
    
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

  useEffect(() => {
    if (!submissions || !Array.isArray(submissions)) return;
    
    submissions.forEach(submission => {
      if (!submission || !submission.picks || !Array.isArray(submission.picks)) return;
      
      const result = calculateResult(submission);
      
      const storedSubmission = localStorage.getItem(`submission-${submission.ticketNumber}`);
      const wasFinalized = storedSubmission ? JSON.parse(storedSubmission).finalized : false;
      
      if (result.allGamesComplete && !wasFinalized) {
        const status = result.parlayWon ? 'won' : 'lost';
        updateSubmissionStatus(submission, status, result.wins, result.losses, submission.picks.length);
        
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
          awayMoneyline: game.awayMoneyline || '',
          homeMoneyline: game.homeMoneyline || '',
          total: game.total || '',
          timestamp: new Date().toISOString()
        };
      });
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

  const updateMoneyline = (gameId, team, value) => {
    setGames(prevGames =>
      prevGames.map(game =>
        game.id === gameId
          ? { ...game, [team === 'away' ? 'awayMoneyline' : 'homeMoneyline']: value }
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
              <input type="text" value={game.awaySpread} onChange={(e) => updateSpread(game.id, 'away', e.target.value)} placeholder="Spread, e.g. +3.5" />
            </div>
            <div>
              <label><strong>{game.homeTeam} (Home)</strong></label>
              <input type="text" value={game.homeSpread} onChange={(e) => updateSpread(game.id, 'home', e.target.value)} placeholder="Spread, e.g. -3.5" />
            </div>
            <div>
              <label><strong>Moneyline</strong></label>
              <input type="text" value={game.awayMoneyline} onChange={(e) => updateMoneyline(game.id, 'away', e.target.value)} placeholder={`${game.awayTeam} ML, e.g. +150`} />
              <input type="text" value={game.homeMoneyline} onChange={(e) => updateMoneyline(game.id, 'home', e.target.value)} placeholder={`${game.homeTeam} ML, e.g. -180`} />
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

function LandingPage({ games, allSportsGames, currentViewSport, onChangeSport, loading, onBackToMenu, sport, betType, onBetTypeChange, apiError, onManualRefresh, lastRefreshTime, propBets, propBetsLoading, propBetsError, onSignOut, isRefreshing }) {
  const [selectedPicks, setSelectedPicks] = useState({});
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [ticketNumber, setTicketNumber] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [contactInfo, setContactInfo] = useState({ name: '', email: '', betAmount: '' });
  const [individualBetAmounts, setIndividualBetAmounts] = useState({});
  const [submissions, setSubmissions] = useState([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const processedTicketsRef = useRef(new Set());

  const calculateAmericanOddsPayout = (stake, odds) => {
    if (odds > 0) {
      return stake * (odds / 100);
    }
    return stake / (Math.abs(odds) / 100);
  };

  const getBetCalculations = (betType, picks, games, allSportsGames, individualBetAmounts, parlayBetAmount) => {
    let totalStake = 0;
    let potentialPayout = 0;
  
    if (betType === 'straight') {
      Object.keys(picks).forEach(gameId => {
        const pick = picks[gameId];
        let game = games.find(g => g.id === gameId);
        if (!game) {
          for (const sport in allSportsGames) {
            game = allSportsGames[sport].find(g => g.id === gameId);
            if (game) break;
          }
        }
        if (!game) return;
  
        const processPick = (pickType, oddsStr) => {
          const pickId = `${gameId}-${pickType}`;
          const stake = parseFloat(individualBetAmounts[pickId] || 0);
          if (stake > 0) {
            totalStake += stake;
            const odds = parseInt(oddsStr);
            const profit = calculateAmericanOddsPayout(stake, odds);
            potentialPayout += stake + profit;
          }
        };
  
        if (pick.winner) {
          const odds = pick.winner === 'away' ? game.awayMoneyline : game.homeMoneyline;
          processPick('winner', odds);
        }
        if (pick.spread) {
           const odds = pick.spread === 'away' ? game.awayMoneyline : game.homeMoneyline;
           processPick('spread', odds);
        }
        if (pick.total) {
          processPick('total', -110);
        }
      });
    } else {
      totalStake = parseFloat(parlayBetAmount || 0);
      if (totalStake > 0) {
        const pickCount = Object.values(picks).reduce((acc, p) => acc + (p.winner ? 1 : 0) + (p.spread ? 1 : 0) + (p.total ? 1 : 0), 0);
        const multiplier = getPayoutMultiplier(pickCount);
        potentialPayout = totalStake * multiplier;
      }
    }
  
    return {
      totalStake,
      potentialPayout,
      potentialProfit: potentialPayout > 0 ? potentialPayout - totalStake : 0,
    };
  };
  
  const checkoutCalculations = React.useMemo(() => 
      getBetCalculations(betType, selectedPicks, games, allSportsGames, individualBetAmounts, contactInfo.betAmount),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [betType, selectedPicks, games, allSportsGames, individualBetAmounts, contactInfo.betAmount]
  );
  
  useEffect(() => {
    const stored = localStorage.getItem('marcs-parlays-submissions');
    if (stored) setSubmissions(JSON.parse(stored));
    
    const submissionsRef = ref(database, 'submissions');
    const unsubscribe = onValue(submissionsRef, (snapshot) => {
      if (snapshot.exists()) {
        const firebaseSubmissions = [];
        snapshot.forEach((childSnapshot) => {
          firebaseSubmissions.push(childSnapshot.val());
        });
        setSubmissions(firebaseSubmissions);
      }
    });
    
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!games || !Array.isArray(games) || !submissions || !Array.isArray(submissions)) return;
    
    submissions.forEach(submission => {
      if (!submission || !submission.picks || !Array.isArray(submission.picks) || processedTicketsRef.current.has(submission.ticketNumber)) return;
      
      let wins = 0;
      let losses = 0;
      let pending = 0;

      submission.picks.forEach(pick => {
        let game;
        for (const sport of Object.keys(allSportsGames)) {
            game = allSportsGames[sport].find(g => g.espnId === pick.gameId);
            if (game) break;
        }

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
      
      const storedSubmission = localStorage.getItem(`submission-${submission.ticketNumber}`);
      const wasFinalized = storedSubmission ? JSON.parse(storedSubmission).finalized : false;
      
      if (allGamesComplete && !wasFinalized) {
        const status = parlayWon ? 'won' : 'lost';
        
        processedTicketsRef.current.add(submission.ticketNumber);
        
        updateSubmissionStatus(submission, status, wins, losses, submission.picks.length);
        
        localStorage.setItem(`submission-${submission.ticketNumber}`, JSON.stringify({
          ...submission,
          finalized: true,
          status: status
        }));
      }
    });
  }, [submissions, games, allSportsGames]);

const saveSubmission = async (submission) => {
  const allSubmissions = [...submissions, submission];
  setSubmissions(allSubmissions);
  localStorage.setItem('marcs-parlays-submissions', JSON.stringify(allSubmissions));
  
  // Step 1: Save to Firebase (critical)
  try {
    const submissionsRef = ref(database, `submissions/${submission.ticketNumber}`);
    await set(submissionsRef, submission);
    console.log('✅ Submission saved to Firebase:', submission.ticketNumber);
  } catch (firebaseError) {
    console.error('❌ Firebase save failed:', firebaseError);
    
    // Firebase failure is critical - store locally for retry
    const failedSubmissions = JSON.parse(localStorage.getItem('failed-submissions') || '[]');
    failedSubmissions.push({
      ...submission,
      failedAt: new Date().toISOString(),
      error: firebaseError.message,
      errorType: 'firebase'
    });
    localStorage.setItem('failed-submissions', JSON.stringify(failedSubmissions));
    
    alert('⚠️ Your bet was saved locally but could not sync to our system. Please contact support with your ticket number: ' + submission.ticketNumber);
    return; // Don't proceed to Google Sheets if Firebase failed
  }
  
  // Step 2: Sync to Google Sheets (optional but important)
  try {
    console.log('📊 Attempting Google Sheets sync for:', submission.ticketNumber);
    console.log('📊 Google Sheets URL:', GOOGLE_SHEET_URL);
    console.log('📊 Submission data:', JSON.stringify(submission, null, 2));
    
    // Using mode: 'no-cors' to work around CORS issues with Google Apps Script
    // Trade-off: We can't verify the response, but this prevents CORS preflight errors
    // The Google Apps Script must be properly configured to handle the POST request
    await fetch(GOOGLE_SHEET_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(submission)
    });
    
    // Note: With mode: 'no-cors', response is opaque and we can't verify success
    // We assume success if no exception was thrown during the fetch
    console.log('📊 Google Sheets sync request attempted for:', submission.ticketNumber);
    console.log('ℹ️ Note: Cannot verify success due to no-cors mode. Check Google Sheets to confirm data was received.');
    
    const submissionWithStatus = {
      ...submission,
      syncedToSheets: true,
      syncedAt: new Date().toISOString()
    };
    
    localStorage.setItem(`submission-${submission.ticketNumber}`, JSON.stringify(submissionWithStatus));
    
  } catch (sheetsError) {
    console.error('❌ Google Sheets sync failed:', sheetsError);
    console.error('Error type:', sheetsError.name);
    console.error('Error message:', sheetsError.message);
    
    // Identify the type of error
    let errorType = 'unknown';
    if (sheetsError.message.includes('Failed to fetch')) {
      errorType = 'cors_or_network';
      console.error('🔍 DIAGNOSIS: This is likely a CORS error or network failure.');
      console.error('🔍 SOLUTION: Check that the Google Apps Script is deployed as a web app with access set to "Anyone".');
      console.error('🔍 SOLUTION: Verify the GOOGLE_SHEET_URL environment variable is set correctly in Vercel.');
    } else if (sheetsError.message.includes('NetworkError')) {
      errorType = 'network';
      console.error('🔍 DIAGNOSIS: Network connectivity issue.');
    }
    
    // Store failed Google Sheets sync for potential retry
    const failedSheetsSyncs = JSON.parse(localStorage.getItem('failed-sheets-syncs') || '[]');
    failedSheetsSyncs.push({
      submission: submission,
      failedAt: new Date().toISOString(),
      error: sheetsError.message,
      errorType: errorType
    });
    localStorage.setItem('failed-sheets-syncs', JSON.stringify(failedSheetsSyncs));
    
    console.warn('⚠️ Google Sheets sync failed, but submission is saved to Firebase');
    console.warn('⚠️ Failed sync stored in localStorage for potential retry');
  }
};

  const handleGridPickSelection = (gameId, pickType, value) => {
    if (pickType === 'winner') {
      setSelectedPicks(prev => {
        const prevPick = prev[gameId] || {};
        const newPick = {
          ...prevPick,
          winner: prevPick.winner === value ? undefined : value,
          spread: undefined
        };
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
      setSelectedPicks(prev => {
        const prevPick = prev[gameId] || {};
        const newPick = {
          ...prevPick,
          spread: prevPick.spread === value ? undefined : value,
          winner: undefined
        };
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
        if (!newPicks[gameId].winner && !newPicks[gameId].spread && !newPicks[gameId].total) {
          delete newPicks[gameId];
        }
      }
      return newPicks;
    });
  };

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
    if (betType === 'parlay' && (!contactInfo.betAmount || parseFloat(contactInfo.betAmount) <= 0)) {
        alert('Please enter a wager amount for your parlay.');
        return;
    }
    setTicketNumber(generateTicketNumber());
    setShowConfirmation(true);
  };

  const handleCheckoutSubmit = async () => {
    const getPickId = (gameId, pickType) => `${gameId}-${pickType}`;
    
    if (!contactInfo.name || !contactInfo.email) {
      alert('Please fill in all contact information');
      return;
    }
    
    const { totalStake } = checkoutCalculations;
    const picksFormatted = [];
    
    if (betType === 'straight') {
      let hasInvalidBet = false;
      let missingBetAmount = false;
      
      Object.keys(selectedPicks).forEach((gameId) => {
        const pickIdSpread = getPickId(gameId, 'spread');
        const pickIdWinner = getPickId(gameId, 'winner');
        const pickIdTotal = getPickId(gameId, 'total');

        const betAmountSpread = parseFloat(individualBetAmounts[pickIdSpread]);
        const betAmountWinner = parseFloat(individualBetAmounts[pickIdWinner]);
        const betAmountTotal = parseFloat(individualBetAmounts[pickIdTotal]);

        if (selectedPicks[gameId].spread) {
            if (!betAmountSpread || betAmountSpread <= 0) missingBetAmount = true;
            else if (betAmountSpread < MIN_BET || betAmountSpread > MAX_BET) hasInvalidBet = true;
        }
        if (selectedPicks[gameId].winner) {
            if (!betAmountWinner || betAmountWinner <= 0) missingBetAmount = true;
            else if (betAmountWinner < MIN_BET || betAmountWinner > MAX_BET) hasInvalidBet = true;
        }
        if (selectedPicks[gameId].total) {
            if (!betAmountTotal || betAmountTotal <= 0) missingBetAmount = true;
            else if (betAmountTotal < MIN_BET || betAmountTotal > MAX_BET) hasInvalidBet = true;
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
      const betAmount = parseFloat(contactInfo.betAmount);
      
      if (!betAmount || betAmount <= 0) {
        alert('Please enter a valid parlay wager amount');
        return;
      }
      
      if (betAmount < 1) {
        alert(`Minimum parlay bet is $1.00`);
        return;
      }
      
      if (betAmount > MAX_BET) {
        alert(`Maximum bet is $${MAX_BET}`);
        return;
      }
    }

    Object.entries(selectedPicks).forEach(([gameId, pickObj]) => {
      let game = games.find(g => g.id === gameId);
      if (!game) {
          for (const sport in allSportsGames) {
              game = allSportsGames[sport].find(g => g.id === gameId);
              if (game) break;
          }
      }
      if (!game) return;
      
      const gameName = `${game.awayTeam} @ ${game.homeTeam}`;
      const sportLabel = game.sport ? ` (${game.sport})` : '';
      
      if (pickObj.spread) {
        const team = pickObj.spread === 'away' ? game.awayTeam : game.homeTeam;
        const spread = pickObj.spread === 'away' ? game.awaySpread : game.homeSpread;
        
        const pick = {
          gameId: game.espnId,
          gameName: gameName + sportLabel,
          sport: game.sport,
          pickType: 'spread',
          team,
          spread,
          pickedTeamType: pickObj.spread
        };
        
        if (betType === 'straight') {
          pick.betAmount = parseFloat(individualBetAmounts[getPickId(gameId, 'spread')]);
        }
        
        picksFormatted.push(pick);
      }
       if (pickObj.winner) {
        const team = pickObj.winner === 'away' ? game.awayTeam : game.homeTeam;
        const moneyline = pickObj.winner === 'away' ? game.awayMoneyline : game.homeMoneyline;
        
        const pick = {
          gameId: game.espnId,
          gameName: gameName + sportLabel,
          sport: game.sport,
          pickType: 'winner',
          team,
          moneyline,
          pickedTeamType: pickObj.winner
        };
        
        if (betType === 'straight') {
          pick.betAmount = parseFloat(individualBetAmounts[getPickId(gameId, 'winner')]);
        }
        
        picksFormatted.push(pick);
      }
      if (pickObj.total) {
        const pick = {
          gameId: game.espnId,
          gameName: gameName + sportLabel,
          sport: game.sport,
          pickType: 'total',
          overUnder: pickObj.total,
          total: game.total
        };
        
        if (betType === 'straight') {
          pick.betAmount = parseFloat(individualBetAmounts[getPickId(gameId, 'total')]);
        }
        
        picksFormatted.push(pick);
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
      betAmount: totalStake,
      potentialPayout: checkoutCalculations.potentialPayout,
      freePlay: 0,
      picks: picksFormatted,
      paymentStatus: 'pending',
      sport: betType === 'parlay' ? 'Multi-Sport' : sport,
      betType: betType
    };
    saveSubmission(submission);
    
    try {
      await fetch('https://api.egtsports.ws/api/send-ticket-confirmation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketNumber: ticketNumber,
          contactInfo: {
            name: contactInfo.name,
            email: contactInfo.email,
          },
          picks: picksFormatted,
          betAmount: totalStake,
          potentialPayout: checkoutCalculations.potentialPayout,
          potentialProfit: checkoutCalculations.potentialProfit,
          sport: submission.sport,
          timestamp: submission.timestamp,
          betType: betType
        })
      });

    } catch (emailError) {
      console.error('❌ Email error:', emailError);
    }
    
    setHasSubmitted(true);
  };

  if (loading) {
    return (
      <div className="gradient-bg" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh'}}>
        <div className="text-white" style={{fontSize: '24px'}}>Loading games from ESPN...</div>
      </div>
    );
  }

  if (apiError) {
    return (
      <div className="gradient-bg">
        <div className="container" style={{maxWidth: '600px', paddingTop: '60px'}}>
          <div className="card text-center">
            <h2 style={{color: '#dc3545', marginBottom: '20px'}}>⚠️ Unable to Load Games</h2>
            <p style={{marginBottom: '20px'}}>{apiError}</p>
            <div style={{display: 'flex', gap: '12px', justifyContent: 'center'}}>
              <button className="btn btn-primary" onClick={onManualRefresh} disabled={isRefreshing}>
                {isRefreshing ? 'Refreshing...' : '🔄 Retry'}
              </button>
              <button className="btn btn-secondary" onClick={onBackToMenu}>← Back to Menu</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const displaySport = currentViewSport || sport;
  if (displaySport === 'Prop Bets') {
    return (
      <div className="gradient-bg main-layout-wrapper">
        <MobileSportsMenu
            currentSport={currentViewSport}
            onSelectSport={onChangeSport}
            allSportsGames={allSportsGames}
        />
        <SportsMenu
            currentSport={currentViewSport}
            onSelectSport={onChangeSport}
            allSportsGames={allSportsGames}
            onSignOut={onSignOut}
            onManualRefresh={onManualRefresh}
            isRefreshing={isRefreshing}
        />
        
        <div className="main-content with-sidebar">
          <PropBetsView
            propBets={propBets}
            loading={propBetsLoading}
            error={propBetsError}
            selectedPicks={selectedPicks}
            onSelectPropBet={handleGridPickSelection}
            betType={betType}
          />
        </div>
        
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
          parlayBetAmount={contactInfo.betAmount}
          onParlayBetAmountChange={(amount) => setContactInfo(c => ({...c, betAmount: amount}))}
          MIN_BET={MIN_BET}
          MAX_BET={MAX_BET}
        />
      </div>
    );
  }

  const hasGamesInAllSports = allSportsGames && allSportsGames[displaySport] && allSportsGames[displaySport].length > 0;
  
  if (games.length === 0 && !hasGamesInAllSports) {
    return (
      <div className="gradient-bg main-layout-wrapper">
        <MobileSportsMenu
            currentSport={currentViewSport}
            onSelectSport={onChangeSport}
            allSportsGames={allSportsGames}
        />
        <SportsMenu
            currentSport={currentViewSport}
            onSelectSport={onChangeSport}
            allSportsGames={allSportsGames}
            onSignOut={onSignOut}
            onManualRefresh={onManualRefresh}
            isRefreshing={isRefreshing}
        />
        
        <div className={`container main-content ${allSportsGames && Object.keys(allSportsGames).length > 0 ? 'with-sidebar' : ''}`}>
          <div className="card text-center">
            <h2 style={{marginBottom: '20px'}}>No {displaySport} Games Available</h2>
            <p style={{marginBottom: '20px', color: '#666'}}>
              There are currently no upcoming {displaySport} games. This could be due to the off-season or no scheduled games at this time.
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  if (games.length === 0 && hasGamesInAllSports) {
    return (
      <div className="gradient-bg main-layout-wrapper">
        <MobileSportsMenu
            currentSport={currentViewSport}
            onSelectSport={onChangeSport}
            allSportsGames={allSportsGames}
        />
        <SportsMenu
            currentSport={currentViewSport}
            onSelectSport={onChangeSport}
            allSportsGames={allSportsGames}
            onSignOut={onSignOut}
            onManualRefresh={onManualRefresh}
            isRefreshing={isRefreshing}
        />
        <div className={`container main-content ${allSportsGames && Object.keys(allSportsGames).length > 0 ? 'with-sidebar' : ''}`}>
          <div className="card text-center">
            <h2>Loading {displaySport} games...</h2>
          </div>
        </div>
      </div>
    );
  }

  let pickCount = 0;
  Object.values(selectedPicks).forEach(obj => {
    if (obj.winner) pickCount++;
    if (obj.spread) pickCount++;
    if (obj.total) pickCount++;
  });
  const minPicks = betType === 'straight' ? 1 : 3;

  if (hasSubmitted) {
    const getPickId = (gameId, pickType) => `${gameId}-${pickType}`;
    
    let pickCount = 0;
    const picksFormatted = [];
    
    Object.entries(selectedPicks).forEach(([gameId, pickObj]) => {
      let game = games.find(g => g.id === gameId);
      if (!game && allSportsGames) {
        for (const sportGames of Object.values(allSportsGames)) {
          game = sportGames.find(g => g.id === gameId);
          if (game) break;
        }
      }
      if (!game) return;
      
      const gameDetails = `${game.awayTeam} @ ${game.homeTeam}`;

      if (pickObj.winner) {
        pickCount++;
        const team = pickObj.winner === 'away' ? game.awayTeam : game.homeTeam;
        const moneyline = pickObj.winner === 'away' ? game.awayMoneyline : game.homeMoneyline;
        
        if (betType === 'straight') {
          const betAmount = parseFloat(individualBetAmounts[getPickId(gameId, 'winner')]) || 0;
          picksFormatted.push(`${team} ${moneyline || 'ML'} (${gameDetails}) - Bet: $${betAmount.toFixed(2)}`);
        } else {
          picksFormatted.push(`${team} ${moneyline || 'ML'} (${gameDetails})`);
        }
      }
      if (pickObj.spread) {
        pickCount++;
        const team = pickObj.spread === 'away' ? game.awayTeam : game.homeTeam;
        const spread = pickObj.spread === 'away' ? game.awaySpread : game.homeSpread;
        
        if (betType === 'straight') {
          const betAmount = parseFloat(individualBetAmounts[getPickId(gameId, 'spread')]) || 0;
          picksFormatted.push(`${team} ${spread} (${gameDetails}) - Bet: $${betAmount.toFixed(2)}`);
        } else {
          picksFormatted.push(`${team} ${spread} (${gameDetails})`);
        }
      }
      if (pickObj.total) {
        pickCount++;
        if (betType === 'straight') {
          const betAmount = parseFloat(individualBetAmounts[getPickId(gameId, 'total')]) || 0;
          picksFormatted.push(`[TOTAL] ${pickObj.total === 'over' ? 'OVER' : 'UNDER'} ${game.total} (${gameDetails}) - Bet: $${betAmount.toFixed(2)}`);
        } else {
          picksFormatted.push(`[TOTAL] ${pickObj.total === 'over' ? 'OVER' : 'UNDER'} ${game.total} total points (${gameDetails})`);
        }
      }
    });

    const timestamp = new Date().toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });

    const handleEmailTicket = () => {
      const subject = `EGT Sports Betting Ticket - ${ticketNumber}`;
      const body = `EGT SPORTS BETTING TICKET
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONFIRMATION NUMBER: ${ticketNumber}
SUBMITTED: ${timestamp}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BET DETAILS
Type: ${betType === 'straight' ? 'Straight Bets' : 'Parlay'}
Sport: ${sport}
Total Stake: $${checkoutCalculations.totalStake.toFixed(2)}
Potential Payout: $${checkoutCalculations.potentialPayout.toFixed(2)}
Potential Profit: $${checkoutCalculations.potentialProfit.toFixed(2)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR ${betType === 'straight' ? 'BETS' : 'PICKS'}
${picksFormatted.map((pick, idx) => `${idx + 1}. ${pick}`).join('\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PAYMENT INFO
Your ticket has been submitted. Payment must be received before games start for the ticket to be valid.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPORTANT: Save this email for your records. You will need your ticket number to claim winnings.
Contact: ${contactInfo.name}
Email: ${contactInfo.email}`;
      window.location.href = `mailto:${contactInfo.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    };

    return (
      <div className="gradient-bg">
        <div className="container" style={{maxWidth: '700px', paddingTop: '20px', paddingBottom: '40px'}}>
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

          <div className="ticket-card" style={{
            background: 'white',
            borderRadius: '16px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
            overflow: 'hidden',
            border: '3px dashed #e0e0e0'
          }}>
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

            <div style={{
              padding: '24px',
              background: '#f8f9fa',
              borderBottom: '2px solid #e0e0e0'
            }}>
              <h3 style={{fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: '#333'}}>
                📋 BET DETAILS
              </h3>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px'}}>
                <div style={{background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e0e0e0'}}>
                  <div style={{fontSize: '12px', color: '#666', marginBottom: '4px'}}>Bet Type</div>
                  <div style={{fontSize: '16px', fontWeight: 'bold', color: '#333'}}>{betType === 'straight' ? 'Straight Bets' : 'Parlay'}</div>
                </div>
                <div style={{background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e0e0e0'}}>
                  <div style={{fontSize: '12px', color: '#666', marginBottom: '4px'}}>Total Picks</div>
                  <div style={{fontSize: '16px', fontWeight: 'bold', color: '#333'}}>{pickCount}</div>
                </div>
                <div style={{background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e0e0e0'}}>
                    <div style={{fontSize: '12px', color: '#666', marginBottom: '4px'}}>Total Stake</div>
                    <div style={{fontSize: '16px', fontWeight: 'bold', color: '#dc3545'}}>${checkoutCalculations.totalStake.toFixed(2)}</div>
                </div>
                <div style={{background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e0e0e0'}}>
                  <div style={{fontSize: '12px', color: '#666', marginBottom: '4px'}}>Potential Payout</div>
                  <div style={{fontSize: '16px', fontWeight: 'bold', color: '#28a745'}}>${checkoutCalculations.potentialPayout.toFixed(2)}</div>
                </div>
                 <div style={{background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e0e0e0', gridColumn: 'span 2'}}>
                  <div style={{fontSize: '12px', color: '#666', marginBottom: '4px'}}>Potential Profit</div>
                  <div style={{fontSize: '16px', fontWeight: 'bold', color: '#007bff'}}>${checkoutCalculations.potentialProfit.toFixed(2)}</div>
                </div>
              </div>
            </div>

            <div style={{
              padding: '24px',
              background: 'white',
              borderBottom: '2px solid #e0e0e0',
              maxHeight: '400px',
              overflowY: 'auto'
            }}>
              <h3 style={{fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: '#333'}}>
                🎲 YOUR {betType === 'straight' ? 'BETS' : 'PICKS'}
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

            <div style={{
              padding: '24px',
              background: '#fff3cd',
              borderBottom: '3px dashed #e0e0e0'
            }}>
              <h3 style={{fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: '#856404'}}>
                ⚠️ ACTION REQUIRED
              </h3>
              <div style={{
                  background: 'white',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '2px solid #ffc107',
                  textAlign: 'center'
                }}>
                  <p style={{fontSize: '15px', color: '#333', margin: '0'}}>
                    Your ticket is submitted! <strong>Payment must be received before the first game starts</strong> for your ticket to be valid.
                  </p>
                </div>
            </div>

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
    const getPickId = (gameId, pickType) => `${gameId}-${pickType}`;
    
    const picksForCheckout = [];
    Object.entries(selectedPicks).forEach(([gameId, pickObj]) => {
      let game = games.find(g => g.id === gameId);
      if (!game && allSportsGames) {
        for (const sportGames of Object.values(allSportsGames)) {
          game = sportGames.find(g => g.id === gameId);
          if (game) break;
        }
      }
      if (!game) return;

      const gameDetails = `${game.awayTeam} @ ${game.homeTeam}`;

      if (pickObj.spread) {
        const team = pickObj.spread === 'away' ? game.awayTeam : game.homeTeam;
        const spread = pickObj.spread === 'away' ? game.awaySpread : game.homeSpread;
        const betAmount = betType === 'straight' ? parseFloat(individualBetAmounts[getPickId(gameId, 'spread')]) || 0 : undefined;
        picksForCheckout.push({
          id: getPickId(gameId, 'spread'),
          text: `[SPREAD] ${team} ${spread} (${gameDetails})`,
          betAmount
        });
      }
      if (pickObj.winner) {
        const team = pickObj.winner === 'away' ? game.awayTeam : game.homeTeam;
        const moneyline = pickObj.winner === 'away' ? game.awayMoneyline : game.homeMoneyline;
        const betAmount = betType === 'straight' ? parseFloat(individualBetAmounts[getPickId(gameId, 'winner')]) || 0 : undefined;
        picksForCheckout.push({
          id: getPickId(gameId, 'winner'),
          text: `[MONEYLINE] ${team} ${moneyline} (${gameDetails})`,
          betAmount
        });
      }
      if (pickObj.total) {
        const total = game.total;
        const overUnder = pickObj.total === 'over' ? 'Over' : 'Under';
        const betAmount = betType === 'straight' ? parseFloat(individualBetAmounts[getPickId(gameId, 'total')]) || 0 : undefined;
        picksForCheckout.push({
          id: getPickId(gameId, 'total'),
          text: `[TOTAL] ${overUnder} ${total} (${gameDetails})`,
          betAmount
        });
      }
    });

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
            
            <h3 className="mb-2">Your {betType === 'parlay' ? `Picks (${pickCount})` : `Bets (${pickCount})`}</h3>
            <div style={{maxHeight: '300px', overflowY: 'auto', padding: '10px', background: '#f8f9fa', borderRadius: '8px', marginBottom: '24px'}}>
              {picksForCheckout.map((pick, idx) => (
                <div key={pick.id} style={{padding: '12px', borderBottom: '1px solid #e0e0e0'}}>
                  <div style={{fontWeight: 'bold'}}>{idx + 1}. {pick.text}</div>
                  {pick.betAmount !== undefined && (
                    <div style={{color: '#28a745', fontWeight: 'bold', textAlign: 'right'}}>
                      Wager: ${pick.betAmount.toFixed(2)}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{marginTop: '24px', background: '#e7f3ff', padding: '16px', borderRadius: '8px'}}>
              <h3 className="mb-2" style={{color: '#004085'}}>Bet Summary</h3>
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                <strong>Total Stake:</strong>
                <span style={{fontWeight: 'bold', color: '#dc3545'}}>${checkoutCalculations.totalStake.toFixed(2)}</span>
              </div>
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                <strong>Potential Payout:</strong>
                <span style={{fontWeight: 'bold', color: '#28a745'}}>${checkoutCalculations.potentialPayout.toFixed(2)}</span>
              </div>
              <div style={{display: 'flex', justifyContent: 'space-between'}}>
                <strong>Potential Profit:</strong>
                <span style={{fontWeight: 'bold', color: '#007bff'}}>${checkoutCalculations.potentialProfit.toFixed(2)}</span>
              </div>
            </div>

            <h3 className="mb-2" style={{marginTop: '32px'}}>Contact Information</h3>
            <label>Full Name *</label>
            <input type="text" value={contactInfo.name} onChange={(e) => setContactInfo({...contactInfo, name: e.target.value})} />

            <label>Email *</label>
            <input type="email" value={contactInfo.email} onChange={(e) => setContactInfo({...contactInfo, email: e.target.value})} />

            <button className="btn btn-success" onClick={handleCheckoutSubmit} style={{width: '100%', fontSize: '18px', marginTop: '16px'}}>
              Send Me My Confirmation Ticket
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gradient-bg main-layout-wrapper">
        <MobileSportsMenu
            currentSport={currentViewSport}
            onSelectSport={onChangeSport}
            allSportsGames={allSportsGames}
        />
        <SportsMenu
            currentSport={currentViewSport}
            onSelectSport={onChangeSport}
            allSportsGames={allSportsGames}
            onSignOut={onSignOut}
            onManualRefresh={onManualRefresh}
            isRefreshing={isRefreshing}
        />
      
      <div className={`container main-content ${allSportsGames && Object.keys(allSportsGames).length > 0 ? 'with-sidebar' : ''}`}>
        <div className="text-center text-white mb-4">
          
          {betType === 'parlay' && (
            <div className="card">
              <h2 className="text-center mb-2" style={{color: '#000'}}>Payout Odds</h2>
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
                  <div key={item.picks} className="payout-item">
                    <div className="payout-text">{item.picks} for {item.picks} pays</div>
                    <div className="payout-value">{item.payout}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <GridBettingLayout
          games={games}
          selectedPicks={selectedPicks}
          onSelectPick={handleGridPickSelection}
          betType={betType}
        />
        
        <div className="card">
          <h3 className="mb-2">Important Rules</h3>
          <ul style={{marginLeft: '20px', lineHeight: '1.8'}}>
            <li><strong>Minimum {minPicks} pick{minPicks > 1 ? 's' : ''} required</strong></li>
            <li><strong>Minimum Bet = $5 (Straight) / $1 (Parlay)</strong></li>
             <li><strong>Maximum Bet = $100</strong></li>
            <li>Missing info = voided ticket</li>
            <li>Funds must be deposited into players pool prior to games starting or ticket is not valid</li>
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
        parlayBetAmount={contactInfo.betAmount}
        onParlayBetAmountChange={(amount) => setContactInfo(c => ({...c, betAmount: amount}))}
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

function App() {
  const [authState, setAuthState] = useState({
    loading: true,
    user: null,
    isAdmin: false,
    error: "",
  });
  const [userRole, setUserRole] = useState(null);
  const [showAdminUserManagement, setShowAdminUserManagement] = useState(false);
  const [betType, setBetType] = useState('parlay');
  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });
  const [games, setGames] = useState([]);
  const [allSportsGames, setAllSportsGames] = useState({});
  const [currentViewSport, setCurrentViewSport] = useState(null);
  const currentViewSportRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [recentlyUpdated, setRecentlyUpdated] = useState({});
  const [submissions, setSubmissions] = useState([]);
  const [selectedSport, setSelectedSport] = useState(null);
  const [lastRefreshTime, setLastRefreshTime] = useState(null);

  const [propBets, setPropBets] = useState({});
  const [propBetsLoading, setPropBetsLoading] = useState(false);
  const [propBetsError, setPropBetsError] = useState(null);
  const propBetsCache = useRef({});

  const hasCompleteOddsData = (game) => {
    const hasSpread = game.awaySpread && game.homeSpread && 
                      game.awaySpread !== '' && game.homeSpread !== '';
    const hasMoneyline = game.awayMoneyline && game.homeMoneyline && 
                         game.awayMoneyline !== '' && game.homeMoneyline !== '';
    return hasSpread || hasMoneyline;
  };
  
const fetchOddsFromTheOddsAPI = async (sport, forceRefresh = false) => {
  try {
    const sportKey = ODDS_API_SPORT_KEYS[sport];
    if (!sportKey) {
      return null;
    }
    
    if (!forceRefresh && oddsAPICache[sport]) {
      const cached = oddsAPICache[sport];
      if (Date.now() - cached.timestamp < ODDS_API_CACHE_DURATION) {
        return cached.data;
      }
    }
    
    const url = `${ODDS_API_BASE_URL}/sports/${sportKey}/odds/?apiKey=${ODDS_API_KEY}&regions=us&markets=spreads,totals,h2h&oddsFormat=american`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    const oddsMap = {};
    
    data.forEach(game => {
      const homeTeam = game.home_team;
      const awayTeam = game.away_team;
      
      const spreadMarket = game.bookmakers?.[0]?.markets?.find(m => m.key === 'spreads');
      const totalMarket = game.bookmakers?.[0]?.markets?.find(m => m.key === 'totals');
      const h2hMarket = game.bookmakers?.[0]?.markets?.find(m => m.key === 'h2h');
      
      let homeSpread = '';
      let awaySpread = '';
      let total = '';
      let homeMoneyline = '';
      let awayMoneyline = '';
      
      if (spreadMarket?.outcomes) {
        const homeOutcome = spreadMarket.outcomes.find(o => o.name === homeTeam);
        const awayOutcome = spreadMarket.outcomes.find(o => o.name === awayTeam);
        
        if (homeOutcome) homeSpread = homeOutcome.point > 0 ? `+${homeOutcome.point}` : String(homeOutcome.point);
        if (awayOutcome) awaySpread = awayOutcome.point > 0 ? `+${awayOutcome.point}` : String(awayOutcome.point);
      }
      
      if (totalMarket?.outcomes?.[0]) {
        total = `O/U ${totalMarket.outcomes[0].point}`;
      }
      
      if (h2hMarket?.outcomes) {
        const homeOutcome = h2hMarket.outcomes.find(o => o.name === homeTeam);
        const awayOutcome = h2hMarket.outcomes.find(o => o.name === awayTeam);
        
        if (homeOutcome) homeMoneyline = homeOutcome.price > 0 ? `+${homeOutcome.price}` : String(homeOutcome.price);
        if (awayOutcome) awayMoneyline = awayOutcome.price > 0 ? `+${awayOutcome.price}` : String(awayOutcome.price);
      }
      
      const gameKey = `${awayTeam}|${homeTeam}`;
      oddsMap[gameKey] = { awaySpread, homeSpread, total, awayMoneyline, homeMoneyline };
    });
    
    oddsAPICache[sport] = {
      data: oddsMap,
      timestamp: Date.now()
    };
    
    return oddsMap;
    
  } catch (error) {
    console.error(`❌ Error fetching ${sport} odds from The Odds API:`, error);
    return null;
  }
};

  const matchOddsToGame = (game, oddsMap) => {
    if (!oddsMap) return { awaySpread: '', homeSpread: '', total: '' };
    
    const gameKey = `${game.awayTeam}|${game.homeTeam}`;
    if (oddsMap[gameKey]) {
      return oddsMap[gameKey];
    }
    
    for (const [key, value] of Object.entries(oddsMap)) {
      const [oddsAway, oddsHome] = key.split('|');
      
      if (game.awayTeam.includes(oddsAway) || oddsAway.includes(game.awayTeam)) {
        if (game.homeTeam.includes(oddsHome) || oddsHome.includes(game.homeTeam)) {
          return value;
        }
      }
    }
    
    return { awaySpread: '', homeSpread: '', total: '' };
  };

  const fetchPropBets = async (sportName) => {
    const cacheKey = sportName;
    const cachedData = propBetsCache.current[cacheKey];
    if (cachedData && (Date.now() - cachedData.timestamp < PROP_BETS_CACHE_DURATION)) {
      return cachedData.data;
    }

    try {
      const response = await fetch(`/api/getPropBets?sport=${sportName}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error details: ${errorText}`);
        return [];
      }

      const data = await response.json();
      
      if (!data.success) {
        return [];
      }

      const propBets = data.propBets || [];

      propBetsCache.current[cacheKey] = {
        data: propBets,
        timestamp: Date.now()
      };

      return propBets;
    } catch (error) {
      console.error(`❌ Error fetching prop bets for ${sportName}:`, error);
      return [];
    }
  };

  const loadAllPropBets = async () => {
    setPropBetsLoading(true);
    setPropBetsError(null);

    try {
      const sports = ['NFL', 'NBA', 'College Football', 'College Basketball', 'NHL'];
      const allPropBetsData = {};

      for (const sport of sports) {
        const props = await fetchPropBets(sport);
        allPropBetsData[sport] = props;
      }

      setPropBets(allPropBetsData);
    } catch (error) {
      setPropBetsError('Failed to load prop bets. Please try again later.');
    } finally {
      setPropBetsLoading(false);
    }
  };

  const countMissingOdds = useCallback((games) => {
    return games.filter(game => !hasCompleteOddsData(game)).length;
  }, []);

  const parseESPNOdds = useCallback((competition, sport) => {
    let awaySpread = '';
    let homeSpread = '';
    let total = '';
    let awayMoneyline = '';
    let homeMoneyline = '';
    
    try {
      if (!competition.odds || competition.odds.length === 0) {
        return { awaySpread, homeSpread, total, awayMoneyline, homeMoneyline };
      }
      
      const odds = competition.odds[0];
      
      if (odds.spread !== undefined) {
        const spreadValue = parseFloat(odds.spread);
        if (!isNaN(spreadValue) && Math.abs(spreadValue) < 50) {
          homeSpread = spreadValue > 0 ? `+${spreadValue}` : String(spreadValue);
          awaySpread = spreadValue > 0 ? String(-spreadValue) : `+${-spreadValue}`;
        }
      }
      
      if (!homeSpread && !awaySpread && (odds.homeTeamOdds || odds.awayTeamOdds)) {
        const homeSpreadValue = odds.homeTeamOdds?.line || odds.homeTeamOdds?.point || odds.homeTeamOdds?.spread;
        const awaySpreadValue = odds.awayTeamOdds?.line || odds.awayTeamOdds?.point || odds.awayTeamOdds?.spread;
        
        if (homeSpreadValue !== undefined && Math.abs(homeSpreadValue) < 50) {
          homeSpread = homeSpreadValue > 0 ? `+${homeSpreadValue}` : String(homeSpreadValue);
        }
        
        if (awaySpreadValue !== undefined && Math.abs(awaySpreadValue) < 50) {
          awaySpread = awaySpreadValue > 0 ? `+${awaySpreadValue}` : String(awaySpreadValue);
        }
      }
      
      if (odds.overUnder !== undefined) {
        if (odds.overUnder > 30 && odds.overUnder < 300) {
          total = String(odds.overUnder);
        }
      } else if (odds.total !== undefined) {
        if (odds.total > 30 && odds.total < 300) {
          total = String(odds.total);
        }
      }
      
      if (odds.homeTeamOdds?.moneyLine !== undefined) {
        const ml = parseInt(odds.homeTeamOdds.moneyLine);
        if (!isNaN(ml) && ml >= -10000 && ml <= 10000) {
          homeMoneyline = ml > 0 ? `+${ml}` : String(ml);
        }
      }
      
      if (odds.awayTeamOdds?.moneyLine !== undefined) {
        const ml = parseInt(odds.awayTeamOdds.moneyLine);
        if (!isNaN(ml) && ml >= -10000 && ml <= 10000) {
          awayMoneyline = ml > 0 ? `+${ml}` : String(ml);
        }
      }
      
      if (!homeMoneyline && odds.homeTeamOdds?.price !== undefined) {
        const price = parseInt(odds.homeTeamOdds.price);
        if (!isNaN(price) && price >= -10000 && price <= 10000) {
          homeMoneyline = price > 0 ? `+${price}` : String(price);
        }
      }
      
      if (!awayMoneyline && odds.awayTeamOdds?.price !== undefined) {
        const price = parseInt(odds.awayTeamOdds.price);
        if (!isNaN(price) && price >= -10000 && price <= 10000) {
          awayMoneyline = price > 0 ? `+${price}` : String(price);
        }
      }
      
    } catch (error) {
      console.error('❌ Error parsing odds:', error);
    }
    
    return { awaySpread, homeSpread, total, awayMoneyline, homeMoneyline };
  }, []);

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
                const awayMoneylineChanged = game.awayMoneyline !== fbGame.awayMoneyline;
                const homeMoneylineChanged = game.homeMoneyline !== fbGame.homeMoneyline;
                const totalChanged = game.total !== fbGame.total;
                const changed = awaySpreadChanged || homeSpreadChanged || totalChanged || awayMoneylineChanged || homeMoneylineChanged;

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
                  awayMoneyline: fbGame.awayMoneyline || '',
                  homeMoneyline: fbGame.homeMoneyline || '',
                  total: fbGame.total || ''
                };
              }
              return game;
            });
            if (updated) {
              setIsSyncing(false);
            }
            
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

  const loadAllSports = useCallback(async (initialSport, forceRefresh = false) => {
    const allSports = ['NFL', 'NBA', 'College Football', 'College Basketball', 'Major League Baseball', 'NHL'];
    const sportsData = {};
    
    setLoading(true);
    setApiError(null);
    
    await Promise.all(allSports.map(async (sport) => {
      try {
        if (!forceRefresh) {
          const cached = gameCache[sport];
          const cacheExpiry = sport === 'College Basketball' 
            ? COLLEGE_BASKETBALL_CACHE_DURATION 
            : CACHE_DURATION;
          
          if (cached && Date.now() - cached.timestamp < cacheExpiry) {
            apiCallCount.cacheHits++;
            sportsData[sport] = cached.data;
            logAPIUsage(sport, true, true);
            return;
          }
        }
        
        const apiEndpoint = ESPN_API_ENDPOINTS[sport];
        const dateURLs = getESPNDateRangeURLs(apiEndpoint);
        
        apiCallCount.total += dateURLs.length;
        apiCallCount.byEndpoint[sport] = (apiCallCount.byEndpoint[sport] || 0) + dateURLs.length;
        
        const responses = await Promise.all(
          dateURLs.map(url => fetch(url).catch(err => null))
        );
        
        const validResponses = responses.filter(r => r !== null);
        
        if (validResponses.length === 0) {
          sportsData[sport] = [];
          return;
        }
        
        const rateLimited = validResponses.some(r => r.status === 429);
        if (rateLimited) {
          apiCallCount.errors++;
          const cached = gameCache[sport];
          if (cached) {
            sportsData[sport] = cached.data;
          } else {
            sportsData[sport] = [];
          }
          return;
        }
        
        const allData = await Promise.all(
          validResponses.map(r => r.ok ? r.json() : null)
        );
        
        const allEvents = [];
        allData.forEach(data => {
          if (data && data.events && data.events.length > 0) {
            allEvents.push(...data.events);
          }
        });
        
        if (allEvents.length === 0) {
          sportsData[sport] = [];
          gameCache[sport] = { data: [], timestamp: Date.now() };
          return;
        }
        
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
            id: `${sport}-${index + 1}`,
            espnId: event.id,
            sport: sport,
            date: new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
            time: new Date(event.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + ' ET',
            awayTeam: awayTeam.team.displayName,
            homeTeam: homeTeam.team.displayName,
            awayTeamId: awayTeam.id,
            homeTeamId: homeTeam.id,
            awayScore: awayTeam.score || '0',
            homeScore: homeTeam.score || '0',
            awaySpread,
            homeSpread,
            total,
            awayMoneyline,
            homeMoneyline,
            status: status,
            statusDetail: event.status.type.detail,
            isFinal: status === 'post'
          };
        });
        
        if (USE_ODDS_API_FALLBACK) {
          const missingCount = countMissingOdds(formattedGames);
          
          if (missingCount > 0) {
            const oddsMap = await fetchOddsFromTheOddsAPI(sport);
            
            if (oddsMap) {
              const finalFormattedGames = formattedGames.map(game => {
                if (hasCompleteOddsData(game)) return game;
                
                const odds = matchOddsToGame(game, oddsMap);
                return {
                  ...game,
                  awaySpread: odds.awaySpread || game.awaySpread,
                  homeSpread: odds.homeSpread || game.homeSpread,
                  total: odds.total || game.total,
                  awayMoneyline: odds.awayMoneyline || game.awayMoneyline,
                  homeMoneyline: odds.homeMoneyline || game.homeMoneyline
                };
              });
              
              sportsData[sport] = finalFormattedGames;
            } else {
              sportsData[sport] = formattedGames;
            }
          } else {
            sportsData[sport] = formattedGames;
          }
        } else {
          sportsData[sport] = formattedGames;
        }
        
        gameCache[sport] = { data: sportsData[sport], timestamp: Date.now() };
        logAPIUsage(sport, true, false);
        
      } catch (error) {
        apiCallCount.errors++;
        sportsData[sport] = [];
        logAPIUsage(sport, false, false);
      }
    }));
    
    setAllSportsGames(sportsData);
    const currentSport = currentViewSportRef.current;
    if (!currentSport || forceRefresh) {
      const sportToLoad = initialSport || currentSport || 'NFL';
      setCurrentViewSport(sportToLoad);
      currentViewSportRef.current = sportToLoad;
      setGames(sportsData[sportToLoad] || []);
    } else {
      if (sportsData[currentSport] && sportsData[currentSport].length > 0) {
        setGames(sportsData[currentSport]);
      }
    }
    setLoading(false);
    setLastRefreshTime(Date.now());
  }, [parseESPNOdds, countMissingOdds]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const tokenResult = await user.getIdTokenResult(true);
        const isAdmin = tokenResult.claims.admin === true;
        setAuthState({
          loading: false,
          user,
          isAdmin: isAdmin,
          error: "",
        });
        
        // Priority-based role routing: Admin role always takes precedence
        // If user has admin privileges, clear any non-admin role selection
        if (isAdmin) {
          // Ensure admin users don't get stuck in user mode
          if (userRole === 'user') {
            setUserRole('admin');
          }
        } else {
          // Non-admin users: load sports data
          loadAllSports('NFL', true);
        }

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
  }, [loadAllSports, userRole]);

  useEffect(() => {
    let intervalId = null;
    
    if (selectedSport) {
      setTimeout(() => {
        Object.keys(ESPN_API_ENDPOINTS).forEach(sport => {
          setupFirebaseListener(sport);
        });
      }, 500);
      
    intervalId = setInterval(() => {
      loadAllSports(selectedSport, true);
    }, 4 * 60 * 60 * 1000);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [selectedSport, loadAllSports, setupFirebaseListener]);

  useEffect(() => {
    if (authState.user && !selectedSport && !authState.loading && userRole !== 'admin') {
      setSelectedSport('NFL');
    }
  }, [authState.user, authState.loading, userRole, selectedSport]);

  useEffect(() => {
    const stored = localStorage.getItem('marcs-parlays-submissions');
    if (stored) setSubmissions(JSON.parse(stored));
  }, []);

  useEffect(() => {
    if (selectedSport === 'Prop Bets' && Object.keys(propBets).length === 0 && !propBetsLoading) {
      loadAllPropBets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSport, propBets, propBetsLoading]);

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

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    const sportToRefresh = currentViewSportRef.current || selectedSport;
    await loadAllSports(sportToRefresh, true);
    setIsRefreshing(false);
  };

  const handleSignOut = async () => {
    try {
      // Step 1: Sign out from Firebase
      await signOut(auth);
      
      // Step 2: Clear all client-side authentication state
      // Clear localStorage items related to authentication
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        // Clear any auth-related keys (but preserve submission data)
        if (key && (key.includes('firebase') || key.includes('auth') || key.includes('token'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Clear sessionStorage completely
      sessionStorage.clear();
      
      // Step 3: Reset all application state to initial values
      setUserRole(null);
      setBetType('parlay');
      setSelectedSport(null);
      setShowAdminUserManagement(false);
      setGames([]);
      setAllSportsGames({});
      setCurrentViewSport(null);
      currentViewSportRef.current = null;
      
      // Step 4: Reset auth state explicitly
      setAuthState({
        loading: false,
        user: null,
        isAdmin: false,
        error: "",
      });
      
    } catch (error) {
      console.error('Error during sign out:', error);
      // Even if there's an error, clear local state
      setUserRole(null);
      setAuthState({
        loading: false,
        user: null,
        isAdmin: false,
        error: "",
      });
    }
  };

  if (authState.loading) return (
    <div className="gradient-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="text-white" style={{ fontSize: '24px' }}>
        Loading...
      </div>
    </div>
  );

  // Priority-based routing: Admin users always get admin interface
  // This ensures users with both admin and user roles are always routed to admin dashboard
  if (authState.user && authState.isAdmin && showAdminUserManagement) {
    return <UserManagement onBack={() => setShowAdminUserManagement(false)} />;
  }

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
      onBackToMenu={() => {
        setSelectedSport(null);
        setCurrentViewSport(null);
      }}
    />;
  }

  if (authState.user && authState.isAdmin && !selectedSport) {
    return <AdminLandingPage 
      onSelectSport={(sport) => setSelectedSport(sport)}
      onManageUsers={() => setShowAdminUserManagement(true)}
      onSignOut={handleSignOut}
    />;
  }

  if (authState.user && !authState.isAdmin && !selectedSport) {
    return (
      <div className="gradient-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="text-white" style={{ fontSize: '24px' }}>
          Loading Sports Data...
        </div>
      </div>
    );
  }

  if (!userRole) {
    return <AuthLanding onSelectRole={(role) => setUserRole(role)} />;
  }

  if (userRole === 'user' && !authState.user) {
    return (
      <div className="gradient-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="card" style={{ maxWidth: '400px', width: '100%', margin: '0 auto', padding: 40 }}>
          <h2 className="text-center mb-4">User Login</h2>
          <form onSubmit={handleLogin} style={{ maxWidth: 300, margin: 'auto' }}>
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

  if (userRole === 'admin' && !authState.user) {
    return (
      <div className="gradient-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="card" style={{ maxWidth: '400px', width: '100%', margin: '0 auto', padding: 40 }}>
          <h2 className="text-center mb-4">Admin Login</h2>
          <form onSubmit={handleLogin} style={{ maxWidth: 300, margin: 'auto' }}>
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

  if (loading && !apiError) {
    return (
      <div className="gradient-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="text-white" style={{ fontSize: '24px' }}>
          Loading {selectedSport} games...
        </div>
      </div>
    );
  }

  return <LandingPage 
    games={games} 
    allSportsGames={allSportsGames}
    currentViewSport={currentViewSport}
    onChangeSport={(sport) => {
      if (sport === 'Prop Bets') {
        setCurrentViewSport('Prop Bets');
        currentViewSportRef.current = 'Prop Bets';
        setGames([]); 
        if (Object.keys(propBets).length === 0 && !propBetsLoading) {
            loadAllPropBets();
        }
        return;
      }
      
      const gamesForSport = allSportsGames[sport] || [];
      setCurrentViewSport(sport);
      currentViewSportRef.current = sport;
      setGames(gamesForSport);
    }}
    loading={loading} 
    onBackToMenu={handleSignOut} 
    sport={currentViewSport || selectedSport}
    betType={betType}
    onBetTypeChange={(type) => setBetType(type)}
    apiError={apiError}
    onManualRefresh={handleManualRefresh}
    lastRefreshTime={lastRefreshTime}
    onSignOut={handleSignOut}
    isRefreshing={isRefreshing}
    propBets={propBets}
    propBetsLoading={propBetsLoading}
    propBetsError={propBetsError}
  />;
}

function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

export default AppWithErrorBoundary;
