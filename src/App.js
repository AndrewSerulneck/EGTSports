import './App.css';
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, set, onValue, push, get } from "firebase/database";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  browserSessionPersistence,
  setPersistence,
} from "firebase/auth";
import AuthLanding from './components/AuthLanding';
import UserManagement from './components/UserManagement';
import SubmissionsViewer from './components/SubmissionsViewer';
import GridBettingLayout from './components/GridBettingLayout';
import PropBetsView from './components/PropBetsView';
import BettingSlip from './components/BettingSlip';
import MemberContainer from './components/MemberContainer';

function SportsMenu({ currentSport, onSelectSport, allSportsGames, onSignOut, onManualRefresh, isRefreshing, onNavigateToDashboard }) {
    const sportOrder = ['NFL', 'College Football', 'NBA', 'College Basketball', 'Major League Baseball', 'NHL', 'World Cup', 'MLS', 'Boxing', 'UFC'];
    
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
                    <button
                        key="my-bets"
                        className={`menu-button ${currentSport === 'My Bets' ? 'active' : ''}`}
                        onClick={onNavigateToDashboard}
                        style={{ marginTop: '8px', borderTop: '1px solid #e0e0e0', paddingTop: '8px' }}
                    >
                        🎯 My Bets
                    </button>
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

// Mobile Sports Scroll Bar - Only shows sports (My Bets moved to bottom nav)
function MobileSportsMenu({ currentSport, onSelectSport, allSportsGames }) {
    const sportOrder = ['NFL', 'College Football', 'NBA', 'College Basketball', 'Major League Baseball', 'NHL', 'World Cup', 'MLS', 'Boxing', 'UFC'];
    const sortedSports = Object.keys(allSportsGames).filter(sport => sportOrder.includes(sport)).sort((a, b) => sportOrder.indexOf(a) - sportOrder.indexOf(b));
    const showPropBets = sortedSports.some(sport => ['NFL', 'NBA', 'College Football', 'College Basketball', 'NHL'].includes(sport));

    return (
        <div className="mobile-sports-menu-wrapper">
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
        </div>
    );
}

// Mobile Bottom Navigation Bar - Always visible with Home, My Bets, FAQs, Sign Out
// Updated: Removed Refresh, added FAQs as main tab
function MobileBottomNav({ onSignOut, onNavigateToDashboard, onNavigateHome, onNavigateToFAQs, currentView }) {
    return (
        <div className="mobile-bottom-nav">
            <button 
                onClick={onNavigateHome}
                className={`mobile-nav-btn ${currentView === 'home' ? 'mobile-nav-btn-active' : ''}`}
            >
                <span className="mobile-nav-icon">🏠</span>
                <span className="mobile-nav-label">Home</span>
            </button>
            <button 
                onClick={onNavigateToDashboard}
                className={`mobile-nav-btn ${currentView === 'mybets' ? 'mobile-nav-btn-active' : ''}`}
            >
                <span className="mobile-nav-icon">🎯</span>
                <span className="mobile-nav-label">My Bets</span>
            </button>
            <button 
                onClick={onNavigateToFAQs}
                className={`mobile-nav-btn ${currentView === 'faqs' ? 'mobile-nav-btn-active' : ''}`}
            >
                <span className="mobile-nav-icon">📖</span>
                <span className="mobile-nav-label">FAQs</span>
            </button>
            <button 
                onClick={onSignOut} 
                className="mobile-nav-btn"
            >
                <span className="mobile-nav-icon">🚪</span>
                <span className="mobile-nav-label">Sign Out</span>
            </button>
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
  'NHL': 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
  'World Cup': 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard',
  'MLS': 'https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard',
  'Boxing': 'https://site.api.espn.com/apis/site/v2/sports/boxing/scoreboard',
  'UFC': 'https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard'
};

// Helper function to get sport display name with emoji
const getSportDisplayName = (sport) => {
  const sportNames = {
    'NFL': 'NFL 🏈',
    'College Football': 'CFB 🏈',
    'NBA': 'NBA 🏀',
    'College Basketball': 'CBB 🏀',
    'Major League Baseball': 'MLB ⚾',
    'NHL': 'NHL 🏒',
    'World Cup': 'World Cup ⚽',
    'MLS': 'MLS ⚽',
    'Boxing': 'Boxing 🥊',
    'UFC': 'UFC 🥊'
  };
  return sportNames[sport] || sport;
};

// Helper function to get date range URLs for ESPN API
// Fetches events from today (0) to 7 days in the future
const getESPNDateRangeURLs = (baseURL) => {
  const urls = [];
  const today = new Date();
  
  for (let i = 0; i <= 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, ''); // Format: YYYYMMDD
    urls.push(`${baseURL}?dates=${dateStr}`);
  }
  
  return urls;
};

// The Odds API Configuration
// CRITICAL: Must match .env variable name exactly
const ODDS_API_KEY = process.env.REACT_APP_THE_ODDS_API_KEY;
const ODDS_API_BASE_URL = 'https://api.the-odds-api.com/v4';
const USE_ODDS_API_FALLBACK = true;

// Debug: Log API key status at startup (DO NOT log actual key)
console.log('🔑 The Odds API Key Status:', ODDS_API_KEY ? '✅ LOADED' : '❌ MISSING');
if (!ODDS_API_KEY) {
  console.error('❌ CRITICAL: REACT_APP_THE_ODDS_API_KEY is not defined in .env file');
  console.error('Please add: REACT_APP_THE_ODDS_API_KEY=your_api_key_here');
}

const ODDS_API_SPORT_KEYS = {
  'NFL': 'americanfootball_nfl',
  'NBA': 'basketball_nba',
  'College Football': 'americanfootball_ncaaf',
  'College Basketball': 'basketball_ncaab',
  'Major League Baseball': 'baseball_mlb',
  'NHL': 'icehockey_nhl',
  'World Cup': 'soccer_fifa_world_cup',
  'MLS': 'soccer_usa_mls',
  'Boxing': 'boxing_boxing',
  'UFC': 'mma_mixed_martial_arts'
};

const PROP_BETS_CACHE_DURATION = 2 * 60 * 60 * 1000;

const CACHE_DURATION = 6 * 60 * 60 * 1000;
const COLLEGE_BASKETBALL_CACHE_DURATION = 6 * 60 * 60 * 1000;
const ODDS_API_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours to minimize API usage
const DATA_REFRESH_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours
const FIREBASE_LISTENER_SETUP_DELAY = 500; // ms
const GLOBAL_FETCH_THROTTLE = 60 * 1000; // 60 seconds - prevent rapid-fire fetches

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

// Use existing Firebase app if already initialized, otherwise create new one
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const database = getDatabase(app);
const auth = getAuth(app);

// Set session-only persistence for enforced re-authentication
// This ensures users must re-login when browser is closed or tab is terminated
setPersistence(auth, browserSessionPersistence).catch((error) => {
  console.error('Error setting session persistence:', error);
});

const MIN_BET = parseInt(process.env.REACT_APP_MIN_BET) || 5;
const MAX_BET = parseInt(process.env.REACT_APP_MAX_BET) || 100;
const GOOGLE_SHEET_URL = process.env.REACT_APP_GOOGLE_SHEET_URL || 'https://script.google.com/macros/s/AKfycbzPastor8yKkWQxKx1z0p-0ZibwBJHkJCuVvHDqP9YX7Dv1-vwakdR9RU6Y6oNw4T2W2PA/exec';

// Optimistic UI: Delay before removing temporary wager (allows Firebase to populate)
const OPTIMISTIC_WAGER_CLEANUP_DELAY = 2000; // milliseconds

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

function AdminLandingPage({ onManageUsers, onViewSubmissions, onSignOut }) {
  const navigate = useNavigate();
  const sports = [
    { name: 'NFL', available: true },
    { name: 'NBA', available: true },
    { name: 'College Football', available: true },
    { name: 'College Basketball', available: true },
    { name: 'Major League Baseball', available: true },
    { name: 'NHL', available: true },
    { name: 'World Cup', available: true },
    { name: 'MLS', available: true },
    { name: 'Boxing', available: true },
    { name: 'UFC', available: true }
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
              className="btn btn-primary"
              onClick={onViewSubmissions}
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
              <span style={{ fontSize: '48px' }}>📋</span>
              <span>View Submissions</span>
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
                onClick={() => sport.available && navigate(`/admin/${sport.name}`)}
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

function LandingPage({ games, allSportsGames, currentViewSport, onChangeSport, loading, onBackToMenu, sport, betType, onBetTypeChange, apiError, onManualRefresh, lastRefreshTime, propBets, propBetsLoading, propBetsError, onSignOut, isRefreshing, onNavigateToDashboard, onNavigateToFAQs, userCredit, onRefreshCredit, collapseBettingSlip, optimisticWagers, setOptimisticWagers }) {
  const [selectedPicks, setSelectedPicks] = useState({});
  const [contactInfo, setContactInfo] = useState({ name: '', email: '', betAmount: '' });
  const [individualBetAmounts, setIndividualBetAmounts] = useState({});
  const [submissions, setSubmissions] = useState([]);
  const [submissionSuccess, setSubmissionSuccess] = useState(null); // Changed: Track success state instead of hasSubmitted
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
           // Spread bets typically use standard -110 odds
           processPick('spread', '-110');
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
    // getBetCalculations is defined in the same scope and doesn't need to be in deps
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
    // Note: With no-cors mode, the response is opaque and cannot be inspected
    // The fetch will only throw if there's a network error, not for HTTP errors
    await fetch(GOOGLE_SHEET_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(submission)
    });
    
    // The request was sent successfully (no exception thrown)
    // We cannot verify if Google Sheets received it due to no-cors mode
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
    // Remove the pick from selectedPicks
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
    
    // Also remove the corresponding bet amount from individualBetAmounts
    // This ensures totals are recalculated correctly from scratch
    const pickId = `${gameId}-${pickType}`;
    setIndividualBetAmounts(prev => {
      const newAmounts = { ...prev };
      delete newAmounts[pickId];
      return newAmounts;
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

  const submitPicks = async () => {
    // Validation: Check minimum picks
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

    // Validation: Parlay bet amount
    if (betType === 'parlay' && (!contactInfo.betAmount || parseFloat(contactInfo.betAmount) <= 0)) {
      alert('Please enter a wager amount for your parlay.');
      return;
    }

    // Generate ticket number
    const newTicketNumber = generateTicketNumber();

    // Proceed to immediate submission (no checkout page)
    await handleWagerSubmission(newTicketNumber);
  };

  const handleWagerSubmission = async (ticketNum) => {
    const getPickId = (gameId, pickType) => `${gameId}-${pickType}`;
    
    // Get authenticated user info from Firebase
    const currentUser = auth.currentUser;
    if (!currentUser) {
      alert('Authentication session expired. Please refresh the page and try again.');
      return;
    }
    
    // Use authenticated user's email and UID for tracking
    const userEmail = currentUser.email || 'member@egtsports.com';
    const userName = currentUser.displayName || userEmail.split('@')[0];
    
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

    // Check credit limit before submitting wager
    if (userCredit) {
      const remainingCredit = userCredit.creditLimit - userCredit.totalWagered;
      if (totalStake > remainingCredit) {
        alert(`⚠️ Wager exceeds your credit limit!\n\nYour wager: $${totalStake.toFixed(2)}\nRemaining credit: $${remainingCredit.toFixed(2)}\nCredit limit: $${userCredit.creditLimit.toFixed(2)}\n\nPlease reduce your wager amount or contact an administrator to increase your limit.`);
        return;
      }
    }

    // OPTIMISTIC UI PATTERN: Immediate UI Updates
    // 1. Show success notification immediately
    setSubmissionSuccess(ticketNum);
    
    // 2. Clear betting slip immediately
    setSelectedPicks({});
    setIndividualBetAmounts({});
    setContactInfo({ name: '', email: '', betAmount: '' });

    // For straight bets: create separate submissions for each pick
    // For parlays: create single submission with all picks
    const submissionsToCreate = [];
    
    if (betType === 'straight') {
      // Each pick becomes its own separate wager
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
        
        // Process spread pick
        if (pickObj.spread) {
          const team = pickObj.spread === 'away' ? game.awayTeam : game.homeTeam;
          const spread = pickObj.spread === 'away' ? game.awaySpread : game.homeSpread;
          const betAmount = parseFloat(individualBetAmounts[getPickId(gameId, 'spread')]) || 0;
          
          if (betAmount > 0) {
            const pick = {
              gameId: game.espnId,
              gameName: gameName + sportLabel,
              sport: game.sport,
              pickType: 'spread',
              team,
              spread,
              pickedTeamType: pickObj.spread,
              betAmount
            };
            
            // Calculate individual payout for this straight bet
            // Spread bets typically use standard -110 odds
            const odds = -110;
            const profit = calculateAmericanOddsPayout(betAmount, odds);
            const payout = betAmount + profit;
            
            submissionsToCreate.push({
              ticketNumber: `${ticketNum}-${submissionsToCreate.length + 1}`,
              timestamp: new Date().toISOString(),
              contactInfo: {
                name: userName,
                email: userEmail,
                confirmMethod: 'email'
              },
              betAmount: betAmount,
              potentialPayout: payout,
              freePlay: 0,
              picks: [pick],
              paymentStatus: 'pending',
              sport: game.sport,
              betType: 'straight'
            });
          }
        }
        
        // Process winner/moneyline pick
        if (pickObj.winner) {
          const team = pickObj.winner === 'away' ? game.awayTeam : game.homeTeam;
          const moneyline = pickObj.winner === 'away' ? game.awayMoneyline : game.homeMoneyline;
          const betAmount = parseFloat(individualBetAmounts[getPickId(gameId, 'winner')]) || 0;
          
          if (betAmount > 0) {
            const pick = {
              gameId: game.espnId,
              gameName: gameName + sportLabel,
              sport: game.sport,
              pickType: 'winner',
              team,
              moneyline,
              pickedTeamType: pickObj.winner,
              betAmount
            };
            
            const odds = parseInt(moneyline) || -110;
            const profit = calculateAmericanOddsPayout(betAmount, odds);
            const payout = betAmount + profit;
            
            submissionsToCreate.push({
              ticketNumber: `${ticketNum}-${submissionsToCreate.length + 1}`,
              timestamp: new Date().toISOString(),
              contactInfo: {
                name: userName,
                email: userEmail,
                confirmMethod: 'email'
              },
              betAmount: betAmount,
              potentialPayout: payout,
              freePlay: 0,
              picks: [pick],
              paymentStatus: 'pending',
              sport: game.sport,
              betType: 'straight'
            });
          }
        }
        
        // Process total pick
        if (pickObj.total) {
          const betAmount = parseFloat(individualBetAmounts[getPickId(gameId, 'total')]) || 0;
          
          if (betAmount > 0) {
            const pick = {
              gameId: game.espnId,
              gameName: gameName + sportLabel,
              sport: game.sport,
              pickType: 'total',
              overUnder: pickObj.total,
              total: game.total,
              betAmount
            };
            
            const odds = -110; // Standard odds for totals
            const profit = calculateAmericanOddsPayout(betAmount, odds);
            const payout = betAmount + profit;
            
            submissionsToCreate.push({
              ticketNumber: `${ticketNum}-${submissionsToCreate.length + 1}`,
              timestamp: new Date().toISOString(),
              contactInfo: {
                name: userName,
                email: userEmail,
                confirmMethod: 'email'
              },
              betAmount: betAmount,
              potentialPayout: payout,
              freePlay: 0,
              picks: [pick],
              paymentStatus: 'pending',
              sport: game.sport,
              betType: 'straight'
            });
          }
        }
      });
    } else {
      // Parlay: single submission with all picks
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
        
        if (pickObj.winner) {
          const team = pickObj.winner === 'away' ? game.awayTeam : game.homeTeam;
          const moneyline = pickObj.winner === 'away' ? game.awayMoneyline : game.homeMoneyline;
          
          picksFormatted.push({
            gameId: game.espnId,
            gameName: gameName + sportLabel,
            sport: game.sport,
            pickType: 'winner',
            team,
            moneyline,
            pickedTeamType: pickObj.winner
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

      submissionsToCreate.push({
        ticketNumber: ticketNum,
        timestamp: new Date().toISOString(),
        contactInfo: {
          name: userName,
          email: userEmail,
          confirmMethod: 'email'
        },
        betAmount: totalStake,
        potentialPayout: checkoutCalculations.potentialPayout,
        freePlay: 0,
        picks: picksFormatted,
        paymentStatus: 'pending',
        sport: 'Multi-Sport',
        betType: 'parlay'
      });
    }

    // Ensure we have at least one submission before creating optimistic wager
    if (submissionsToCreate.length === 0) {
      alert('❌ Error: No valid picks to submit.');
      return;
    }

    // 3. Create optimistic wager object for immediate display in "My Bets"
    const optimisticWager = {
      id: `optimistic-${ticketNum}`,
      ticketNumber: ticketNum,
      uid: currentUser.uid,
      createdAt: new Date().toISOString(),
      status: 'pending',
      wagerAmount: totalStake,
      wagerData: {
        ticketNumber: ticketNum,
        picks: betType === 'straight' ? submissionsToCreate.map(s => s.picks).flat() : submissionsToCreate[0].picks,
        betType,
        straightBetCount: betType === 'straight' ? submissionsToCreate.length : 1,
        potentialPayout: checkoutCalculations.potentialPayout
      },
      isOptimistic: true
    };
    
    // Add optimistic wager to state for instant display
    setOptimisticWagers(prev => [...prev, optimisticWager]);

    // Server-side credit limit enforcement via API (once for total stake)
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const idToken = await currentUser.getIdToken();
        const wagerResponse = await fetch('/api/wager-manager?action=submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            wagerAmount: totalStake,
            wagerData: {
              ticketNumber: ticketNum,
              picks: betType === 'straight' ? submissionsToCreate.map(s => s.picks).flat() : submissionsToCreate[0].picks,
              betType,
              straightBetCount: betType === 'straight' ? submissionsToCreate.length : 1
            }
          })
        });

        const wagerResult = await wagerResponse.json();

        if (!wagerResponse.ok || !wagerResult.success) {
          // FAILURE: Remove optimistic wager and show error
          setOptimisticWagers(prev => prev.filter(w => w.id !== optimisticWager.id));
          
          // Hide success notification
          setSubmissionSuccess(null);
          
          // Credit limit exceeded or other error
          if (wagerResult.error === 'Wager exceeds credit limit') {
            alert(`⚠️ Credit Limit Exceeded!\n\n${wagerResult.hint}\n\nPlease reduce your wager or contact an administrator.`);
          } else {
            const errorMsg = wagerResult.error || wagerResult.hint || 'Please check your funds or contact support.';
            alert(`❌ Error: Bet could not be submitted. Please try again.\n\n${errorMsg}`);
          }
          return;
        }

        // SUCCESS: Refresh credit info after successful wager
        if (onRefreshCredit) {
          onRefreshCredit();
        }
        
        // Remove optimistic wager after a short delay (real wager will appear from Firebase)
        setTimeout(() => {
          setOptimisticWagers(prev => prev.filter(w => w.id !== optimisticWager.id));
        }, OPTIMISTIC_WAGER_CLEANUP_DELAY);
      }
    } catch (wagerError) {
      console.error('❌ Wager submission error:', wagerError);
      
      // FAILURE: Remove optimistic wager and show error
      setOptimisticWagers(prev => prev.filter(w => w.id !== optimisticWager.id));
      
      // Hide success notification
      setSubmissionSuccess(null);
      
      alert('❌ Error: Bet could not be submitted. Please try again or contact support.');
      return;
    }

    // Save all submissions to Firebase
    for (const submission of submissionsToCreate) {
      saveSubmission(submission);
    }
    
    // Send confirmation email (with info about all submissions)
    try {
      const allPicks = submissionsToCreate.map(s => s.picks).flat();
      await fetch('https://api.egtsports.ws/api/send-ticket-confirmation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketNumber: ticketNum,
          contactInfo: {
            name: userName,
            email: userEmail,
          },
          picks: allPicks,
          betAmount: totalStake,
          potentialPayout: checkoutCalculations.potentialPayout,
          potentialProfit: checkoutCalculations.potentialProfit,
          sport: betType === 'parlay' ? 'Multi-Sport' : sport,
          timestamp: submissionsToCreate[0].timestamp,
          betType: betType,
          straightBetCount: betType === 'straight' ? submissionsToCreate.length : undefined
        })
      });
    } catch (emailError) {
      console.error('❌ Email error:', emailError);
    }
    
    // Clear success notification after 3 seconds
    setTimeout(() => {
      setSubmissionSuccess(null);
    }, 3000);
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
      <div className="gradient-bg main-layout-wrapper mobile-with-bottom-nav">
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
            onNavigateToDashboard={onNavigateToDashboard}
        />
        
        <div className="main-content with-sidebar">
          <PropBetsView
            allSportsGames={allSportsGames}
            selectedPicks={selectedPicks}
            onSelectPropBet={handleGridPickSelection}
            betType={betType}
            authToken={null}  // Token will be fetched inside component when needed
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
          userCredit={userCredit}
          shouldCollapse={collapseBettingSlip}
          submissionSuccess={submissionSuccess}
        />
        
        {/* Mobile Bottom Navigation - Always Visible - For No Games State */}
        <MobileBottomNav
          onSignOut={onSignOut}
          onNavigateToDashboard={onNavigateToDashboard}
          onNavigateToFAQs={onNavigateToFAQs}
          onNavigateHome={() => {
            // Navigate to home (betting grid) - already on this page, no action needed
          }}
          currentView="home"
        />
      </div>
    );
  }

  const hasGamesInAllSports = allSportsGames && allSportsGames[displaySport] && allSportsGames[displaySport].length > 0;
  
  if (games.length === 0 && !hasGamesInAllSports) {
    return (
      <div className="gradient-bg main-layout-wrapper mobile-with-bottom-nav">
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
            onNavigateToDashboard={onNavigateToDashboard}
        />
        
        <div className={`container main-content ${allSportsGames && Object.keys(allSportsGames).length > 0 ? 'with-sidebar' : ''}`}>
          <div className="card text-center">
            <h2 style={{marginBottom: '20px'}}>No {displaySport} Games Available</h2>
            <p style={{marginBottom: '20px', color: '#666'}}>
              There are currently no upcoming {displaySport} games. This could be due to the off-season or no scheduled games at this time.
            </p>
          </div>
        </div>
        
        {/* Mobile Bottom Navigation - Always Visible - For Prop Bets View */}
        <MobileBottomNav
          onSignOut={onSignOut}
          onNavigateToDashboard={onNavigateToDashboard}
          onNavigateToFAQs={onNavigateToFAQs}
          onNavigateHome={() => {
            // Navigate to home (betting grid) - already on this page, no action needed
          }}
          currentView="home"
        />
      </div>
    );
  }

  if (games.length === 0 && hasGamesInAllSports) {
    return (
      <div className="gradient-bg main-layout-wrapper mobile-with-bottom-nav">
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
            onNavigateToDashboard={onNavigateToDashboard}
        />
        <div className={`container main-content ${allSportsGames && Object.keys(allSportsGames).length > 0 ? 'with-sidebar' : ''}`}>
          <div className="card text-center">
            <h2>Loading {displaySport} games...</h2>
          </div>
        </div>
        
        {/* Mobile Bottom Navigation - Always Visible - For Loading State */}
        <MobileBottomNav
          onSignOut={onSignOut}
          onNavigateToDashboard={onNavigateToDashboard}
          onNavigateToFAQs={onNavigateToFAQs}
          onNavigateHome={() => {
            // Navigate to home (betting grid) - already on this page, no action needed
          }}
          currentView="home"
        />
      </div>
    );
  }


  // Show success message after submission (hasSubmitted state is managed in handleWagerSubmission)
  // REMOVED: No longer showing full-page confirmation screen - notification is inline in BettingSlip

  return (
    <div className="gradient-bg main-layout-wrapper mobile-with-bottom-nav">
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
            onNavigateToDashboard={onNavigateToDashboard}
        />
      
      <div className={`container main-content ${allSportsGames && Object.keys(allSportsGames).length > 0 ? 'with-sidebar' : ''}`}>
        <GridBettingLayout
          games={games}
          selectedPicks={selectedPicks}
          onSelectPick={handleGridPickSelection}
          betType={betType}
          sport={displaySport}
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
        userCredit={userCredit}
        shouldCollapse={collapseBettingSlip}
        submissionSuccess={submissionSuccess}
      />
      
      {/* Mobile Bottom Navigation - Always Visible */}
      <MobileBottomNav
        onSignOut={onSignOut}
        onNavigateToDashboard={onNavigateToDashboard}
        onNavigateToFAQs={onNavigateToFAQs}
        onNavigateHome={() => {
          // Navigate to home (betting grid) - this is the default view
          // Since we're already on this page, we just ensure the view is set correctly
        }}
        currentView="home"
      />
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

// Route wrapper components
function AdminSportRoute({ 
  authState, 
  games, 
  setGames, 
  isSyncing, 
  setIsSyncing, 
  recentlyUpdated, 
  setRecentlyUpdated, 
  submissions, 
  allSportsGames,
  loadAllSports 
}) {
  const navigate = useNavigate();
  const { sport } = useParams();
  
  // Load games for the selected sport
  useEffect(() => {
    if (sport && sport !== 'Prop Bets') {
      loadAllSports(sport, false);
    }
  }, [sport, loadAllSports]);
  
  const sportGames = allSportsGames[sport] || [];
  
  return (
    <AdminPanel
      user={authState.user}
      games={sportGames}
      setGames={setGames}
      isSyncing={isSyncing}
      setIsSyncing={setIsSyncing}
      recentlyUpdated={recentlyUpdated}
      setRecentlyUpdated={setRecentlyUpdated}
      submissions={submissions}
      sport={sport}
      onBackToMenu={() => navigate('/admin/dashboard')}
    />
  );
}

function App() {
  const navigate = useNavigate();
  const [authState, setAuthState] = useState({
    loading: true,
    user: null,
    isAdmin: false,
    error: "",
  });
  const [userRole, setUserRole] = useState(null);
  const [betType, setBetType] = useState('parlay');
  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });
  const [games, setGames] = useState([]);
  const [allSportsGames, setAllSportsGames] = useState({});
  // eslint-disable-next-line no-unused-vars
  const [currentViewSport, setCurrentViewSport] = useState(null);
  const currentViewSportRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [recentlyUpdated, setRecentlyUpdated] = useState({});
  const [submissions, setSubmissions] = useState([]);
  const [lastRefreshTime, setLastRefreshTime] = useState(null);

  const [propBets, setPropBets] = useState({});
  const [propBetsLoading, setPropBetsLoading] = useState(false);
  const [propBetsError, setPropBetsError] = useState(null);
  const propBetsCache = useRef({});
  
  // User credit limit tracking
  const [userCredit, setUserCredit] = useState(null);
  
  // Optimistic wagers for instant UI feedback
  const [optimisticWagers, setOptimisticWagers] = useState([]);
  
  // Track auth initialization to prevent navigation race conditions
  const authInitialized = useRef(false);
  const isNavigatingRef = useRef(false);
  const sportsDataLoadedRef = useRef(false);
  // Synchronous admin status ref to prevent route guard race conditions
  const isAdminRef = useRef(false);
  
  // Global fetch throttle to prevent infinite loops and API quota exhaustion
  const lastGlobalFetchTime = useRef(0);
  
  // API Quota monitoring and hard stop mechanism
  const [apiQuotaInfo, setApiQuotaInfo] = useState({
    remaining: null,
    used: null,
    hardStop: false
  });
  const apiQuotaRef = useRef({ remaining: null, used: null, hardStop: false });

  // Function to fetch user's credit info from Firebase
  const fetchUserCredit = useCallback(async (uid) => {
    try {
      const userRef = ref(database, `users/${uid}`);
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        const userData = snapshot.val();
        setUserCredit({
          creditLimit: parseFloat(userData.creditLimit) || 100,
          totalWagered: parseFloat(userData.totalWagered) || 0,
          displayName: userData.displayName || '',
          email: userData.email || ''
        });
        return userData;
      } else {
        setUserCredit(null);
        return null;
      }
    } catch (error) {
      console.error('Error fetching user credit:', error);
      return null;
    }
  }, []);

  const refreshUserCredit = useCallback(() => {
    if (authState.user && !authState.isAdmin) {
      fetchUserCredit(authState.user.uid);
    }
  }, [authState.user, authState.isAdmin, fetchUserCredit]);

  const hasCompleteOddsData = (game) => {
    const hasSpread = game.awaySpread && game.homeSpread && 
                      game.awaySpread !== '' && game.homeSpread !== '';
    const hasMoneyline = game.awayMoneyline && game.homeMoneyline && 
                         game.awayMoneyline !== '' && game.homeMoneyline !== '';
    return hasSpread || hasMoneyline;
  };
  
  // Helper function to extract mascot from team name (last word)
  const extractMascotFromName = (teamName) => {
    if (!teamName) return '';
    
    const cleaned = teamName
      .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special chars
      .replace(/\s+/g, ' ')            // Normalize spaces
      .trim()
      .toLowerCase();
    
    const words = cleaned.split(' ');
    const mascot = words[words.length - 1];
    
    return mascot;
  };
  
  // Helper function for robust team name matching (The "Mascot Rule")
  const teamsMatchHelper = (team1, team2) => {
    if (!team1 || !team2) return false;
    
    // Exact match (case-insensitive)
    if (team1.toLowerCase() === team2.toLowerCase()) {
      return true;
    }
    
    // Extract mascots (last word of team name)
    const mascot1 = extractMascotFromName(team1);
    const mascot2 = extractMascotFromName(team2);
    
    // Special cases: "Sox" (Red Sox, White Sox) - need city name too
    const specialCaseMascots = ['sox', 'knicks', 'bulls', 'heat', 'magic', 'jazz', 'thunder'];
    
    if (specialCaseMascots.includes(mascot1) || specialCaseMascots.includes(mascot2)) {
      // For special cases, check if both mascots match AND city is contained
      if (mascot1 === mascot2) {
        const clean1 = team1.toLowerCase();
        const clean2 = team2.toLowerCase();
        // Check if either contains the other (handles "LA" vs "Los Angeles")
        return clean1.includes(clean2) || clean2.includes(clean1);
      }
      return false;
    }
    
    // Standard mascot matching
    if (mascot1 === mascot2 && mascot1.length > 0) {
      return true;
    }
    
    // Fallback: Check if one name contains the other (handles "Lakers" vs "Los Angeles Lakers")
    const clean1 = team1.toLowerCase().replace(/[^a-z0-9]/g, '');
    const clean2 = team2.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    return clean1.includes(clean2) || clean2.includes(clean1);
  };
  
const fetchOddsFromTheOddsAPI = async (sport, forceRefresh = false) => {
  try {
    // CRITICAL: Check hard stop first - prevent any API calls if quota exhausted
    if (apiQuotaRef.current.hardStop) {
      console.error('🛑 HARD STOP: API quota exhausted. All API calls disabled.');
      return null;
    }
    
    const sportKey = ODDS_API_SPORT_KEYS[sport];
    if (!sportKey) {
      console.warn(`⚠️ No Odds API sport key for: ${sport}`);
      return null;
    }
    
    // CRITICAL: Validate environment variable
    if (!ODDS_API_KEY || ODDS_API_KEY === 'undefined') {
      console.error('❌ Error: REACT_APP_THE_ODDS_API_KEY is not defined in .env');
      console.error('Please add REACT_APP_THE_ODDS_API_KEY to your .env file');
      return null;
    }
    
    // Check cache first
    if (!forceRefresh && oddsAPICache[sport]) {
      const cached = oddsAPICache[sport];
      if (Date.now() - cached.timestamp < ODDS_API_CACHE_DURATION) {
        console.log(`✅ Using cached Odds API data for ${sport}`);
        return cached.data;
      }
    }
    
    // Build API URL with markets based on sport type
    // CRITICAL: Use correct market keys per copilot-instructions.md
    // MANDATE: h2h (moneyline) is ALWAYS included for all sports
    const isSoccer = sport === 'World Cup' || sport === 'MLS';
    const isCombat = sport === 'Boxing' || sport === 'UFC';
    
    let markets;
    if (isCombat) {
      // Combat Sports: h2h (moneyline), h2h_method (method of victory), h2h_round, h2h_go_distance
      markets = 'h2h,h2h_method,h2h_round,h2h_go_distance';
    } else if (isSoccer) {
      // Soccer: h2h (3-way including Draw), spreads (if available), totals
      markets = 'h2h,spreads,totals';
    } else {
      // US Sports: h2h (moneyline), spreads, totals
      markets = 'h2h,spreads,totals';
    }
    
    // CRITICAL: Explicitly request 'american' odds format
    const url = `${ODDS_API_BASE_URL}/sports/${sportKey}/odds/?apiKey=${ODDS_API_KEY}&regions=us&markets=${markets}&oddsFormat=american`;
    
    // DEBUG: Log URL with masked API key for security
    const maskedUrl = url.replace(ODDS_API_KEY, '***KEY_HIDDEN***');
    console.log(`🔥 Making Odds API call for ${sport}...`);
    console.log(`📡 URL: ${maskedUrl}`);
    console.log(`📋 Markets requested: ${markets}`);
    console.log(`📐 Odds format: american`);
    
    const response = await fetch(url);
    
    // CRITICAL: Extract and monitor quota headers
    const quotaRemaining = response.headers.get('x-requests-remaining');
    const quotaUsed = response.headers.get('x-requests-used');
    
    if (quotaRemaining !== null || quotaUsed !== null) {
      const remaining = parseInt(quotaRemaining) || 0;
      const used = parseInt(quotaUsed) || 0;
      
      // Update quota state
      const newQuotaInfo = {
        remaining,
        used,
        hardStop: remaining < 10
      };
      
      apiQuotaRef.current = newQuotaInfo;
      setApiQuotaInfo(newQuotaInfo);
      
      console.log(`📊 API Quota - Remaining: ${remaining} | Used: ${used}`);
      
      // CRITICAL: Activate hard stop if quota < 10
      if (remaining < 10) {
        console.error('🚨 CRITICAL: API quota below 10! Activating HARD STOP.');
        console.error('🛑 All future API calls will be blocked until quota resets.');
        return null;
      } else if (remaining < 50) {
        console.warn(`⚠️ WARNING: API quota low (${remaining} remaining)`);
      }
    }
    
    // DEBUG: Log response status
    console.log(`📊 Response Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      // Detailed error logging based on status code
      if (response.status === 401) {
        console.error(`❌ 401 UNAUTHORIZED: Invalid API key for The Odds API`);
        console.error('Check that REACT_APP_THE_ODDS_API_KEY is correct in .env');
      } else if (response.status === 429) {
        console.error(`❌ 429 RATE LIMIT: Too many requests to The Odds API`);
        console.error('You may have exceeded your monthly quota or requests per second');
        // Activate hard stop on rate limit
        apiQuotaRef.current.hardStop = true;
        setApiQuotaInfo(prev => ({ ...prev, hardStop: true }));
      } else if (response.status === 404) {
        console.error(`❌ 404 NOT FOUND: Sport key "${sportKey}" may be invalid`);
        console.log(`🔄 Attempting fallback to 'upcoming' sport key...`);
        
        // FALLBACK: Try 'upcoming' sport key if specific sport returns 404
        const fallbackUrl = `${ODDS_API_BASE_URL}/sports/upcoming/odds/?apiKey=${ODDS_API_KEY}&regions=us&markets=${markets}&oddsFormat=american`;
        const fallbackResponse = await fetch(fallbackUrl);
        
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          console.log(`✅ Fallback successful: Received ${fallbackData.length} games from 'upcoming'`);
          
          // Extract quota headers from fallback response
          const fallbackRemaining = fallbackResponse.headers.get('x-requests-remaining');
          if (fallbackRemaining !== null) {
            const remaining = parseInt(fallbackRemaining) || 0;
            apiQuotaRef.current.remaining = remaining;
            setApiQuotaInfo(prev => ({ ...prev, remaining }));
            console.log(`📊 API Quota after fallback - Remaining: ${remaining}`);
          }
          
          // Cache and return fallback data
          oddsAPICache[sport] = {
            data: fallbackData,
            timestamp: Date.now()
          };
          
          return fallbackData;
        } else {
          console.error(`❌ Fallback also failed: ${fallbackResponse.status}`);
        }
      } else {
        console.error(`❌ Odds API returned ${response.status}: ${response.statusText}`);
      }
      
      // Try to get error message from response body
      try {
        const errorBody = await response.text();
        console.error(`Response body: ${errorBody}`);
      } catch (e) {
        // Ignore if can't read body
      }
      
      return null;
    }
    
    console.log(`✅ Successfully fetched odds from Odds API for ${sport}`);
    const data = await response.json();
    
    // DEBUG: Log how many games returned
    console.log(`📈 Received ${data.length} games for ${sport}`);
    
    // If no games returned for specific sport, try 'upcoming' fallback
    if (data.length === 0) {
      console.warn(`⚠️ No games found for ${sport}. Trying 'upcoming' fallback...`);
      
      const fallbackUrl = `${ODDS_API_BASE_URL}/sports/upcoming/odds/?apiKey=${ODDS_API_KEY}&regions=us&markets=${markets}&oddsFormat=american`;
      const fallbackResponse = await fetch(fallbackUrl);
      
      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        console.log(`✅ Fallback successful: Received ${fallbackData.length} games from 'upcoming'`);
        
        // Extract quota headers
        const fallbackRemaining = fallbackResponse.headers.get('x-requests-remaining');
        if (fallbackRemaining !== null) {
          const remaining = parseInt(fallbackRemaining) || 0;
          apiQuotaRef.current.remaining = remaining;
          setApiQuotaInfo(prev => ({ ...prev, remaining }));
        }
        
        // Cache fallback data
        oddsAPICache[sport] = {
          data: fallbackData,
          timestamp: Date.now()
        };
        
        return fallbackData;
      }
    }
    
    // CRITICAL LOGGING: Show all teams from API response
    console.log(`📡 API Results for this league (${sport}):`);
    data.forEach((event, idx) => {
      console.log(`   ${idx + 1}. ${event.away_team} @ ${event.home_team}`);
    });
    console.log('');
    
    // VALIDATION LOG: Deep inspection of first event structure
    if (data.length > 0 && data[0].bookmakers && data[0].bookmakers.length > 0) {
      console.log('\n🔍 VALIDATION: Deep structure of first event bookmaker:');
      console.dir(data[0].bookmakers[0], { depth: null });
      console.log('\n');
    }
    
    // Sport types already defined at function start for market selection
    // isSoccer and isCombat variables reused here
    
    console.log(`🏷️ Sport type - Soccer: ${isSoccer}, Combat: ${isCombat}`);
    
    const oddsMap = {};
    
    data.forEach((game, gameIndex) => {
      const homeTeam = game.home_team;
      const awayTeam = game.away_team;
      
      console.log(`\n🎮 Game ${gameIndex + 1}: ${awayTeam} @ ${homeTeam}`);
      
      // THE ODDS API v4 DATA DRILL-DOWN PATH:
      // 1. Check if bookmakers array exists
      if (!game.bookmakers || game.bookmakers.length === 0) {
        console.warn(`  ⚠️ No bookmakers data available`);
        // Store empty odds with fallback values
        const gameKey = `${awayTeam}|${homeTeam}`;
        oddsMap[gameKey] = { 
          awaySpread: 'OFF', 
          homeSpread: 'OFF', 
          total: 'OFF', 
          awayMoneyline: 'OFF', 
          homeMoneyline: 'OFF',
          drawMoneyline: isSoccer ? 'OFF' : undefined
        };
        return;
      }
      
      // 2. Select bookmaker with h2h market, or fall back to first available
      // IMPROVED: Try to find a bookmaker that has the h2h market
      let bookmaker = game.bookmakers.find(bm => 
        bm.markets && bm.markets.some(m => m.key === 'h2h')
      );
      
      // Fallback to first bookmaker if none have h2h
      if (!bookmaker) {
        bookmaker = game.bookmakers[0];
        console.log(`  📊 No bookmaker with h2h market found, using: ${bookmaker.title}`);
      } else {
        console.log(`  📊 Using bookmaker with h2h market: ${bookmaker.title}`);
      }
      
      // 3. Get markets array from bookmaker
      if (!bookmaker.markets || bookmaker.markets.length === 0) {
        console.warn(`  ⚠️ No markets data in bookmaker`);
        const gameKey = `${awayTeam}|${homeTeam}`;
        oddsMap[gameKey] = { 
          awaySpread: 'OFF', 
          homeSpread: 'OFF', 
          total: 'OFF', 
          awayMoneyline: 'OFF', 
          homeMoneyline: 'OFF',
          drawMoneyline: isSoccer ? 'OFF' : undefined
        };
        return;
      }
      
      console.log(`  📋 Available markets: ${bookmaker.markets.map(m => m.key).join(', ')}`);
      
      // 4. Find specific markets by key
      const spreadMarket = bookmaker.markets.find(m => m.key === 'spreads');
      const totalMarket = bookmaker.markets.find(m => m.key === 'totals');
      const h2hMarket = bookmaker.markets.find(m => m.key === 'h2h');
      
      let homeSpread = '-';
      let awaySpread = '-';
      let total = '-';
      let homeMoneyline = '-';
      let awayMoneyline = '-';
      let drawMoneyline = isSoccer ? '-' : undefined;
      
      // 5. Extract spreads from outcomes array
      if (spreadMarket?.outcomes && spreadMarket.outcomes.length >= 2) {
        console.log(`  📐 Spreads market found with ${spreadMarket.outcomes.length} outcomes`);
        
        // MANDATORY: Match by team name, not by array index
        const homeOutcome = spreadMarket.outcomes.find(o => o.name === homeTeam);
        const awayOutcome = spreadMarket.outcomes.find(o => o.name === awayTeam);
        
        if (homeOutcome) {
          // Validate point exists and is a number
          if (homeOutcome.point !== undefined && homeOutcome.point !== null && !isNaN(homeOutcome.point)) {
            homeSpread = homeOutcome.point > 0 ? `+${homeOutcome.point}` : String(homeOutcome.point);
            console.log(`    ✓ ${homeTeam}: ${homeSpread} (price: ${homeOutcome.price})`);
          } else {
            console.warn(`    ⚠️ ${homeTeam} outcome missing valid 'point' field`);
          }
        } else {
          console.warn(`    ⚠️ No outcome found for home team: ${homeTeam}`);
        }
        
        if (awayOutcome) {
          if (awayOutcome.point !== undefined && awayOutcome.point !== null && !isNaN(awayOutcome.point)) {
            awaySpread = awayOutcome.point > 0 ? `+${awayOutcome.point}` : String(awayOutcome.point);
            console.log(`    ✓ ${awayTeam}: ${awaySpread} (price: ${awayOutcome.price})`);
          } else {
            console.warn(`    ⚠️ ${awayTeam} outcome missing valid 'point' field`);
          }
        } else {
          console.warn(`    ⚠️ No outcome found for away team: ${awayTeam}`);
        }
      } else {
        console.log(`  ❌ No spreads market found`);
      }
      
      // 6. Extract totals from outcomes array
      if (totalMarket?.outcomes && totalMarket.outcomes.length > 0) {
        console.log(`  🎯 Totals market found with ${totalMarket.outcomes.length} outcomes`);
        
        // Total market has Over/Under outcomes with same point value
        const overOutcome = totalMarket.outcomes.find(o => o.name === 'Over');
        const underOutcome = totalMarket.outcomes.find(o => o.name === 'Under');
        
        if (overOutcome) {
          if (overOutcome.point !== undefined && overOutcome.point !== null && !isNaN(overOutcome.point)) {
            total = String(overOutcome.point);
            console.log(`    ✓ Total: ${total} (Over: ${overOutcome.price}, Under: ${underOutcome?.price || '-'})`);
          } else {
            console.warn(`    ⚠️ Over outcome missing valid 'point' field`);
          }
        } else {
          console.warn(`    ⚠️ No 'Over' outcome found in totals market`);
        }
      } else {
        console.log(`  ❌ No totals market found`);
      }
      
      // 7. Extract moneylines (h2h) from outcomes array with DEEP DIAGNOSTICS
      // CRITICAL: Soccer has 3 outcomes (Home, Away, Draw), Combat/Traditional have 2
      const gameName = `${awayTeam} @ ${homeTeam}`;
      
      if (h2hMarket?.outcomes && h2hMarket.outcomes.length >= 2) {
        console.log(`  💰 Moneyline (h2h) market found with ${h2hMarket.outcomes.length} outcomes`);
        console.log(`    Raw outcomes:`, h2hMarket.outcomes.map(o => ({ name: o.name, price: o.price })));
        console.log(`    🔍 Attempting to match against:`);
        console.log(`       Home team from API: "${homeTeam}"`);
        console.log(`       Away team from API: "${awayTeam}"`);
        
        // IMPROVED: Use fuzzy matching with teamsMatchHelper for more robust name matching
        // This helps when API returns "LA Lakers" vs ESPN "Los Angeles Lakers"
        const homeOutcome = h2hMarket.outcomes.find(o => {
          // Try exact match first
          if (o.name === homeTeam) return true;
          // Fall back to mascot-based fuzzy matching
          return teamsMatchHelper(o.name, homeTeam);
        });
        
        const awayOutcome = h2hMarket.outcomes.find(o => {
          // Try exact match first
          if (o.name === awayTeam) return true;
          // Fall back to mascot-based fuzzy matching
          return teamsMatchHelper(o.name, awayTeam);
        });
        
        if (homeOutcome) {
          // Validate price exists and is a number
          if (homeOutcome.price !== undefined && homeOutcome.price !== null && !isNaN(homeOutcome.price)) {
            homeMoneyline = homeOutcome.price > 0 ? `+${homeOutcome.price}` : String(homeOutcome.price);
            const matchType = homeOutcome.name === homeTeam ? 'exact' : 'fuzzy';
            console.log(`    ✓ ${homeTeam} matched with "${homeOutcome.name}" (${matchType}): ${homeMoneyline}`);
            if (matchType === 'fuzzy') {
              console.log(`    ✅ Successfully matched API name '${homeOutcome.name}' to Local name '${homeTeam}'`);
            }
          } else {
            console.warn(`    ⚠️ ${homeTeam} outcome missing valid 'price' field: ${homeOutcome.price}`);
          }
        } else {
          console.error(`    🔍 REASON 3 (Matching Failure): [${gameName}]: h2h exists, but couldn't match home team outcome.`);
          console.error(`       API says outcomes: [${h2hMarket.outcomes.map(o => o.name).join(', ')}]`);
          console.error(`       Local says Home: "${homeTeam}"`);
        }
        
        if (awayOutcome) {
          if (awayOutcome.price !== undefined && awayOutcome.price !== null && !isNaN(awayOutcome.price)) {
            awayMoneyline = awayOutcome.price > 0 ? `+${awayOutcome.price}` : String(awayOutcome.price);
            const matchType = awayOutcome.name === awayTeam ? 'exact' : 'fuzzy';
            console.log(`    ✓ ${awayTeam} matched with "${awayOutcome.name}" (${matchType}): ${awayMoneyline}`);
            if (matchType === 'fuzzy') {
              console.log(`    ✅ Successfully matched API name '${awayOutcome.name}' to Local name '${awayTeam}'`);
            }
          } else {
            console.warn(`    ⚠️ ${awayTeam} outcome missing valid 'price' field: ${awayOutcome.price}`);
          }
        } else {
          console.error(`    🔍 REASON 3 (Matching Failure): [${gameName}]: h2h exists, but couldn't match away team outcome.`);
          console.error(`       API says outcomes: [${h2hMarket.outcomes.map(o => o.name).join(', ')}]`);
          console.error(`       Local says Away: "${awayTeam}"`);
        }
        
        // 8. SOCCER ONLY: Extract Draw outcome for 3-way market
        if (isSoccer) {
          const drawOutcome = h2hMarket.outcomes.find(o => o.name === 'Draw');
          if (drawOutcome) {
            if (drawOutcome.price !== undefined && drawOutcome.price !== null && !isNaN(drawOutcome.price)) {
              drawMoneyline = drawOutcome.price > 0 ? `+${drawOutcome.price}` : String(drawOutcome.price);
              console.log(`    ⚽ Draw: ${drawMoneyline}`);
            } else {
              console.warn(`    ⚠️ Draw outcome missing valid 'price' field: ${drawOutcome.price}`);
            }
          } else {
            console.warn(`    ⚠️ No Draw outcome found (expected for soccer)`);
          }
        }
        
        // 9. COMBAT SPORTS: Verify 2-way market structure
        if (isCombat) {
          console.log(`    🥊 Combat sport detected - verifying 2-way market structure`);
          if (h2hMarket.outcomes.length !== 2) {
            console.warn(`    ⚠️ Expected 2 outcomes for combat sport, got ${h2hMarket.outcomes.length}`);
          }
        }
      } else {
        // REASON 1: No h2h market found at all
        const availableMarkets = bookmaker.markets.map(m => m.key);
        console.error(`  ❌ REASON 1 (No Market): [${gameName}]: No 'h2h' key found in bookmaker "${bookmaker.title}".`);
        console.error(`     Available markets: [${availableMarkets.join(', ')}]`);
        
        // Check if other bookmakers have h2h market (REASON 2)
        const bookmakersWith_h2h = game.bookmakers.filter(bm => 
          bm.markets && bm.markets.some(m => m.key === 'h2h')
        );
        
        if (bookmakersWith_h2h.length > 0 && !bookmakersWith_h2h.includes(bookmaker)) {
          console.warn(`  ⚠️ REASON 2 (Bookmaker Gap): [${gameName}]: Found 'h2h' in ${bookmakersWith_h2h.length} other bookmaker(s), but not in the one checked first.`);
          console.warn(`     Bookmakers with h2h: [${bookmakersWith_h2h.map(bm => bm.title).join(', ')}]`);
          console.warn(`     Note: Smart selection already prioritizes h2h bookmakers, so this shouldn't happen often.`);
        }
      }
      
      // 9a. COMBAT SPORTS ONLY: Extract method of victory (h2h_method)
      let methodOfVictory = undefined;
      if (isCombat) {
        const methodMarket = bookmaker.markets.find(m => m.key === 'h2h_method');
        if (methodMarket?.outcomes && methodMarket.outcomes.length > 0) {
          console.log(`  🥊 Method of Victory market found with ${methodMarket.outcomes.length} outcomes`);
          methodOfVictory = {};
          methodMarket.outcomes.forEach(outcome => {
            // outcome.name format examples: "Fighter Name - KO/TKO", "Fighter Name - Decision"
            const methodPrice = outcome.price > 0 ? `+${outcome.price}` : String(outcome.price);
            methodOfVictory[outcome.name] = methodPrice;
            console.log(`    ✓ ${outcome.name}: ${methodPrice}`);
          });
        } else {
          console.log(`  ℹ️ No h2h_method market available for this fight`);
        }
      }
      
      // 9b. COMBAT SPORTS ONLY: Extract round betting (h2h_round)
      let roundBetting = undefined;
      if (isCombat) {
        const roundMarket = bookmaker.markets.find(m => m.key === 'h2h_round');
        if (roundMarket?.outcomes && roundMarket.outcomes.length > 0) {
          console.log(`  🥊 Round Betting market found with ${roundMarket.outcomes.length} outcomes`);
          roundBetting = {};
          roundMarket.outcomes.forEach(outcome => {
            const roundPrice = outcome.price > 0 ? `+${outcome.price}` : String(outcome.price);
            roundBetting[outcome.name] = roundPrice;
            console.log(`    ✓ ${outcome.name}: ${roundPrice}`);
          });
        } else {
          console.log(`  ℹ️ No h2h_round market available for this fight`);
        }
      }
      
      // 9c. COMBAT SPORTS ONLY: Extract go distance (h2h_go_distance)
      let goDistance = undefined;
      if (isCombat) {
        const distanceMarket = bookmaker.markets.find(m => m.key === 'h2h_go_distance');
        if (distanceMarket?.outcomes && distanceMarket.outcomes.length >= 2) {
          console.log(`  🥊 Go Distance market found with ${distanceMarket.outcomes.length} outcomes`);
          const yesOutcome = distanceMarket.outcomes.find(o => o.name === 'Yes');
          const noOutcome = distanceMarket.outcomes.find(o => o.name === 'No');
          goDistance = {};
          if (yesOutcome) {
            goDistance.Yes = yesOutcome.price > 0 ? `+${yesOutcome.price}` : String(yesOutcome.price);
            console.log(`    ✓ Yes (Goes Distance): ${goDistance.Yes}`);
          }
          if (noOutcome) {
            goDistance.No = noOutcome.price > 0 ? `+${noOutcome.price}` : String(noOutcome.price);
            console.log(`    ✓ No (Ends Early): ${goDistance.No}`);
          }
        } else {
          console.log(`  ℹ️ No h2h_go_distance market available for this fight`);
        }
      }
      
      // 10. Assemble final odds object for this game
      const gameKey = `${awayTeam}|${homeTeam}`;
      const oddsData = { 
        awaySpread, 
        homeSpread, 
        total, 
        awayMoneyline, 
        homeMoneyline,
        oddsApiEventId: game.id // Store The Odds API event ID for prop betting
      };
      
      // Add draw moneyline only for soccer
      if (isSoccer) {
        oddsData.drawMoneyline = drawMoneyline;
      }
      
      // Add combat sports markets
      if (isCombat) {
        if (methodOfVictory) oddsData.methodOfVictory = methodOfVictory;
        if (roundBetting) oddsData.roundBetting = roundBetting;
        if (goDistance) oddsData.goDistance = goDistance;
      }
      
      oddsMap[gameKey] = oddsData;
      
      // Summary log with value validation
      console.log(`  ✅ Final odds stored with key: "${gameKey}"`);
      console.log(`     Away Spread: ${awaySpread === '-' ? '❌ Missing' : '✓ ' + awaySpread}`);
      console.log(`     Home Spread: ${homeSpread === '-' ? '❌ Missing' : '✓ ' + homeSpread}`);
      console.log(`     Total: ${total === '-' ? '❌ Missing' : '✓ ' + total}`);
      console.log(`     Away ML: ${awayMoneyline === '-' ? '❌ Missing' : '✓ ' + awayMoneyline}`);
      console.log(`     Home ML: ${homeMoneyline === '-' ? '❌ Missing' : '✓ ' + homeMoneyline}`);
      if (isSoccer) {
        console.log(`     Draw ML: ${drawMoneyline === '-' ? '❌ Missing' : '✓ ' + drawMoneyline}`);
      }
      if (isCombat) {
        console.log(`     🥊 Method of Victory: ${methodOfVictory ? '✓ Available' : '-'}`);
        console.log(`     🥊 Round Betting: ${roundBetting ? '✓ Available' : '-'}`);
        console.log(`     🥊 Go Distance: ${goDistance ? '✓ Available' : '-'}`);
      }
    });
    
    console.log(`\n🎉 Successfully parsed ${Object.keys(oddsMap).length} games for ${sport}`);
    console.log(`📋 All game keys in oddsMap:`);
    Object.keys(oddsMap).forEach(key => {
      console.log(`   "${key}"`);
    });
    
    oddsAPICache[sport] = {
      data: oddsMap,
      timestamp: Date.now()
    };
    
    return oddsMap;
    
  } catch (error) {
    console.error(`\n❌ EXCEPTION in fetchOddsFromTheOddsAPI for ${sport}:`);
    console.error(`Error type: ${error.name}`);
    console.error(`Error message: ${error.message}`);
    console.error('Stack trace:', error.stack);
    return null;
  }
};

  // Helper function to extract mascot from team name (last word)
  const extractMascot = useCallback((teamName) => {
    if (!teamName) return '';
    
    // Remove special characters and extra spaces
    const cleaned = teamName
      .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special chars
      .replace(/\s+/g, ' ')            // Normalize spaces
      .trim()
      .toLowerCase();
    
    // Split into words and get last word (mascot)
    const words = cleaned.split(' ');
    const mascot = words[words.length - 1];
    
    return mascot;
  }, []);

  // Helper function for robust team name matching (The "Mascot Rule")
  const teamsMatch = useCallback((team1, team2) => {
    if (!team1 || !team2) return false;
    
    // Exact match (case-insensitive)
    if (team1.toLowerCase() === team2.toLowerCase()) {
      return true;
    }
    
    // Extract mascots (last word of team name)
    const mascot1 = extractMascot(team1);
    const mascot2 = extractMascot(team2);
    
    // Special cases: "Sox" (Red Sox, White Sox) - need city name too
    const specialCaseMascots = ['sox', 'knicks', 'bulls', 'heat', 'magic', 'jazz', 'thunder'];
    
    if (specialCaseMascots.includes(mascot1) || specialCaseMascots.includes(mascot2)) {
      // For special cases, check if both mascots match AND city is contained
      if (mascot1 === mascot2) {
        const clean1 = team1.toLowerCase();
        const clean2 = team2.toLowerCase();
        // Check if either contains the other (handles "LA" vs "Los Angeles")
        return clean1.includes(clean2) || clean2.includes(clean1);
      }
      return false;
    }
    
    // Standard mascot matching
    if (mascot1 === mascot2 && mascot1.length > 0) {
      return true;
    }
    
    // Fallback: Check if one name contains the other (handles "Lakers" vs "Los Angeles Lakers")
    const clean1 = team1.toLowerCase().replace(/[^a-z0-9]/g, '');
    const clean2 = team2.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    return clean1.includes(clean2) || clean2.includes(clean1);
  }, [extractMascot]);

  const matchOddsToGame = useCallback((game, oddsMap) => {
    // Default fallback with dash for missing odds
    const defaultOdds = { 
      awaySpread: '-', 
      homeSpread: '-', 
      total: '-', 
      awayMoneyline: '-', 
      homeMoneyline: '-',
      drawMoneyline: undefined // Will be set for soccer
    };
    
    if (!oddsMap) {
      console.warn(`⚠️ matchOddsToGame: No oddsMap provided for ${game.awayTeam} @ ${game.homeTeam}`);
      return defaultOdds;
    }
    
    // Debug logging
    console.log(`🔍 Attempting to match game: ${game.homeTeam} vs ${game.awayTeam}`);
    console.log(`   Home mascot: "${extractMascot(game.homeTeam)}"`);
    console.log(`   Away mascot: "${extractMascot(game.awayTeam)}"`);
    
    // Try exact match first
    const gameKey = `${game.awayTeam}|${game.homeTeam}`;
    
    if (oddsMap[gameKey]) {
      console.log(`✅ Exact match found for: "${gameKey}"`);
      return oddsMap[gameKey];
    }
    
    console.log(`❌ No exact match for: "${gameKey}"`);
    console.log(`   Available API teams:`);
    Object.keys(oddsMap).forEach(key => {
      const [away, home] = key.split('|');
      console.log(`     "${away}" vs "${home}"`);
    });
    
    // Try mascot-based fuzzy matching
    console.log(`🔍 Attempting mascot-based matching...`);
    for (const [key, value] of Object.entries(oddsMap)) {
      const [oddsAway, oddsHome] = key.split('|');
      
      // Use robust team matcher (mascot rule)
      const awayMatch = teamsMatch(game.awayTeam, oddsAway);
      const homeMatch = teamsMatch(game.homeTeam, oddsHome);
      
      if (awayMatch && homeMatch) {
        console.log(`✅ Mascot match found!`);
        console.log(`   Game: "${game.awayTeam}" @ "${game.homeTeam}"`);
        console.log(`   API:  "${oddsAway}" @ "${oddsHome}"`);
        return value;
      }
    }
    
    // No match found - return defaults
    console.warn(`❌ No match found for: "${game.awayTeam}" @ "${game.homeTeam}"`);
    return defaultOdds;
  }, [extractMascot, teamsMatch]);

  const fetchPropBets = useCallback(async (sportName) => {
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
  }, []);

  const loadAllPropBets = useCallback(async () => {
    // TEMPORARY: Disable prop bets to preserve API quota
    // This function is now stable and won't cause infinite loops
    console.warn('⚠️ Prop bets temporarily disabled due to API quota limits');
    setPropBetsLoading(false);
    setPropBetsError('Prop bets are temporarily disabled to preserve API quota. Contact admin for details.');
    return;
    
    /* eslint-disable no-unreachable */
    // Original code below (keep for future re-enable)
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
    /* eslint-enable no-unreachable */
  }, [fetchPropBets]);

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
    // CRITICAL: Global fetch throttle to prevent infinite loops and API exhaustion
    // Only allow global refresh once every 60 seconds
    const now = Date.now();
    const timeSinceLastFetch = now - lastGlobalFetchTime.current;
    
    if (!forceRefresh && timeSinceLastFetch < GLOBAL_FETCH_THROTTLE) {
      console.log(`🛑 Fetch throttled. Last fetch was ${Math.round(timeSinceLastFetch / 1000)}s ago. Minimum: 60s`);
      return;
    }
    
    lastGlobalFetchTime.current = now;
    console.log(`✅ Fetch allowed. Last fetch was ${Math.round(timeSinceLastFetch / 1000)}s ago.`);
    
    const allSports = ['NFL', 'NBA', 'College Football', 'College Basketball', 'Major League Baseball', 'NHL', 'World Cup', 'MLS', 'Boxing', 'UFC'];
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
                
                // Log when ESPN is missing moneyline data
                if (!game.awayMoneyline || !game.homeMoneyline) {
                  console.log(`📞 ESPN missing moneyline for ${game.awayTeam} @ ${game.homeTeam}, fetching from Odds API...`);
                }
                
                const odds = matchOddsToGame(game, oddsMap);
                
                // Log when Odds API data is applied for moneyline
                if (odds.awayMoneyline && !game.awayMoneyline) {
                  console.log(`✅ Applied Odds API moneyline: ${game.awayTeam} ${odds.awayMoneyline}`);
                }
                if (odds.homeMoneyline && !game.homeMoneyline) {
                  console.log(`✅ Applied Odds API moneyline: ${game.homeTeam} ${odds.homeMoneyline}`);
                }
                
                // Build updated game object with all odds data
                const updatedGame = {
                  ...game,
                  awaySpread: odds.awaySpread || game.awaySpread,
                  homeSpread: odds.homeSpread || game.homeSpread,
                  total: odds.total || game.total,
                  awayMoneyline: odds.awayMoneyline || game.awayMoneyline,
                  homeMoneyline: odds.homeMoneyline || game.homeMoneyline,
                  oddsApiEventId: odds.oddsApiEventId // Add Odds API event ID for prop betting
                };
                
                // Add drawMoneyline for soccer sports
                if (odds.drawMoneyline !== undefined) {
                  updatedGame.drawMoneyline = odds.drawMoneyline;
                  console.log(`⚽ Added draw odds for ${game.awayTeam} @ ${game.homeTeam}: ${odds.drawMoneyline}`);
                }
                
                return updatedGame;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parseESPNOdds, countMissingOdds, matchOddsToGame]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Remove forced token refresh (true parameter) to reduce latency impact
        // Only force refresh on explicit login, not on auth state changes
        const tokenResult = await user.getIdTokenResult();
        const isAdmin = tokenResult.claims.admin === true;
        
        // Update synchronous ref BEFORE async state to prevent race conditions
        isAdminRef.current = isAdmin;
        
        setAuthState({
          loading: false,
          user,
          isAdmin: isAdmin,
          error: "",
        });
        
        // Mark auth as initialized after first successful auth check
        authInitialized.current = true;
        
        // Non-admin users: load sports data and fetch credit info
        if (!isAdmin) {
          // Fetch user credit info for betting limit enforcement
          fetchUserCredit(user.uid).catch(err => {
            console.warn('Could not fetch user credit info:', err);
          });

          if (!sportsDataLoadedRef.current) {
            sportsDataLoadedRef.current = true;
            loadAllSports('NFL', true).catch(() => {
              // Reset flag on error to allow retry
              sportsDataLoadedRef.current = false;
            });
          }
        }

      } else {
        // Clear admin status on logout
        isAdminRef.current = false;
        
        // Clear user credit on logout
        setUserCredit(null);
        
        setAuthState({
          loading: false,
          user: null,
          isAdmin: false,
          error: "",
        });
        authInitialized.current = true;
        sportsDataLoadedRef.current = false;
      }
    });
    return unsub;
  }, [loadAllSports, fetchUserCredit]);

  useEffect(() => {
    // Setup Firebase listeners for all sports after a short delay
    // to ensure Firebase is fully initialized
    const timeoutId = setTimeout(() => {
      Object.keys(ESPN_API_ENDPOINTS).forEach(sport => {
        setupFirebaseListener(sport);
      });
    }, FIREBASE_LISTENER_SETUP_DELAY);
    
    // Refresh data periodically
    const intervalId = setInterval(() => {
      const currentSport = currentViewSportRef.current;
      if (currentSport) {
        loadAllSports(currentSport, true);
      }
    }, DATA_REFRESH_INTERVAL);
    
    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [loadAllSports, setupFirebaseListener]);

  useEffect(() => {
    // Load initial data for non-admin users, but only once
    // This prevents duplicate calls with the onAuthStateChanged effect above
    const shouldLoadSportsData = authState.user && 
                                 !authState.loading && 
                                 !authState.isAdmin && 
                                 !sportsDataLoadedRef.current;
    
    if (shouldLoadSportsData) {
      sportsDataLoadedRef.current = true;
      loadAllSports('NFL', true).catch(() => {
        // Reset flag on error to allow retry
        sportsDataLoadedRef.current = false;
      });
    }
  }, [authState.user, authState.loading, authState.isAdmin, loadAllSports]);

  useEffect(() => {
    const stored = localStorage.getItem('marcs-parlays-submissions');
    if (stored) setSubmissions(JSON.parse(stored));
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    
    // Prevent multiple concurrent login attempts
    if (isNavigatingRef.current) {
      return;
    }
    
    setAuthState((a) => ({ ...a, loading: true, error: "" }));
    try {
      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(
        auth,
        loginForm.email,
        loginForm.password
      );
      
      // Force token refresh only during explicit login (not on auth state changes)
      // This ensures we get the latest claims without causing repeated refreshes
      const tokenResult = await userCredential.user.getIdTokenResult(true);
      const isActuallyAdmin = tokenResult?.claims?.admin === true;
      
      // Enforce role-based access control
      if (userRole === 'admin' && !isActuallyAdmin) {
        // User clicked "Admin Login" but doesn't have admin role
        await signOut(auth);
        isAdminRef.current = false;
        setAuthState((a) => ({
          ...a,
          loading: false,
          error: "Access Denied: You do not have administrator privileges.",
        }));
        return;
      }
      
      if (userRole === 'user' && isActuallyAdmin) {
        // User clicked "Member Login" but has admin role
        await signOut(auth);
        isAdminRef.current = false;
        setAuthState((a) => ({
          ...a,
          loading: false,
          error: "Access Denied: Please use the appropriate login method for your account type.",
        }));
        return;
      }
      
      // CRITICAL: Update synchronous ref FIRST to prevent route guard race conditions
      // This ensures route guards see the correct admin status immediately
      isAdminRef.current = isActuallyAdmin;
      authInitialized.current = true;
      
      // Update auth state with explicit admin status to prevent race conditions
      setAuthState({
        loading: false,
        user: userCredential.user,
        isAdmin: isActuallyAdmin,
        error: "",
      });
      
      // Set navigation guard to prevent duplicate navigation
      isNavigatingRef.current = true;
      
      // Login successful with correct role - navigate to appropriate dashboard
      // Use requestAnimationFrame to ensure state update completes before navigation
      // This is more reliable than setTimeout and doesn't rely on hardcoded delays
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (isActuallyAdmin) {
            navigate('/admin/dashboard', { replace: true });
          } else {
            navigate('/member/NFL', { replace: true });
          }
          // Reset navigation guard after a brief delay
          requestAnimationFrame(() => {
            isNavigatingRef.current = false;
          });
        });
      });
      
    } catch (err) {
      setAuthState((a) => ({
        ...a,
        loading: false,
        error: "Login failed: " + err.message,
      }));
      isNavigatingRef.current = false;
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    const sportToRefresh = currentViewSportRef.current;
    if (sportToRefresh) {
      await loadAllSports(sportToRefresh, true);
    }
    setIsRefreshing(false);
  };

  const handleSignOut = async () => {
    const forceReloadToLogin = () => {
      setTimeout(() => {
        window.location.href = window.location.origin;
      }, 100);
    };

    try {
      // Step 1: Sign out from Firebase
      await signOut(auth);
      
      // Step 2: Clear all client-side authentication state
      // Clear ALL localStorage (complete wipe for security)
      localStorage.clear();
      
      // Clear sessionStorage completely
      sessionStorage.clear();
      
      // Step 3: Clear IndexedDB (Firebase persistence) - with browser compatibility check
      if (window.indexedDB && typeof window.indexedDB.databases === 'function') {
        try {
          const databases = await window.indexedDB.databases();
          databases.forEach(db => {
            if (db.name) {
              window.indexedDB.deleteDatabase(db.name);
            }
          });
        } catch (idbError) {
          // Some browsers may not support this, but we can continue
          console.warn('Could not clear IndexedDB:', idbError);
        }
      }
      
      // Step 4: Reset all application state to initial values
      setUserRole(null);
      setBetType('parlay');
      setGames([]);
      setAllSportsGames({});
      setCurrentViewSport(null);
      currentViewSportRef.current = null;
      
      // Step 5: Reset auth state and refs explicitly
      isAdminRef.current = false;
      authInitialized.current = false;
      isNavigatingRef.current = false;
      sportsDataLoadedRef.current = false;
      
      setAuthState({
        loading: false,
        user: null,
        isAdmin: false,
        error: "",
      });
      
      // Step 6: Force reload to ensure clean slate (mandatory re-login)
      forceReloadToLogin();
      
    } catch (error) {
      console.error('Error during sign out:', error);
      // Even if there's an error, clear local state and force reload
      localStorage.clear();
      sessionStorage.clear();
      setUserRole(null);
      isAdminRef.current = false;
      authInitialized.current = false;
      isNavigatingRef.current = false;
      sportsDataLoadedRef.current = false;
      setAuthState({
        loading: false,
        user: null,
        isAdmin: false,
        error: "",
      });
      
      // Force reload even on error to ensure clean state
      forceReloadToLogin();
    }
  };

  if (authState.loading) {
    return (
      <div className="gradient-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="text-white" style={{ fontSize: '24px' }}>
          Loading...
        </div>
      </div>
    );
  }

  // CRITICAL: Check for API quota hard stop - show maintenance mode
  if (apiQuotaInfo.hardStop) {
    return (
      <div className="gradient-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
        <div className="card" style={{ maxWidth: '600px', width: '100%', padding: '40px', textAlign: 'center' }}>
          <h1 style={{ color: '#ff6b6b', marginBottom: '20px', fontSize: '32px' }}>
            🛑 Maintenance Mode
          </h1>
          <h2 style={{ color: '#333', marginBottom: '20px' }}>
            API Quota Reached
          </h2>
          <p style={{ fontSize: '18px', color: '#666', marginBottom: '20px', lineHeight: '1.6' }}>
            Our application has reached its API request limit to protect your account quota.
          </p>
          <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
            <p style={{ fontSize: '16px', color: '#444', marginBottom: '10px' }}>
              <strong>Quota Status:</strong>
            </p>
            <p style={{ fontSize: '16px', color: '#666' }}>
              Remaining Requests: <strong style={{ color: apiQuotaInfo.remaining < 10 ? '#ff6b6b' : '#ffa500' }}>
                {apiQuotaInfo.remaining !== null ? apiQuotaInfo.remaining : 'Unknown'}
              </strong>
            </p>
            <p style={{ fontSize: '16px', color: '#666' }}>
              Used Requests: <strong>{apiQuotaInfo.used !== null ? apiQuotaInfo.used : 'Unknown'}</strong>
            </p>
          </div>
          <p style={{ fontSize: '16px', color: '#666', marginBottom: '30px' }}>
            This safety feature prevents infinite loops from exhausting your monthly API quota.
            The application will automatically resume when your quota resets.
          </p>
          <button 
            className="btn btn-secondary" 
            onClick={() => {
              // Reset hard stop and try to reload
              apiQuotaRef.current.hardStop = false;
              setApiQuotaInfo(prev => ({ ...prev, hardStop: false }));
              window.location.reload();
            }}
            style={{ padding: '12px 30px', fontSize: '16px' }}
          >
            Reset and Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Root - Role selection or redirect */}
      <Route path="/" element={
        !userRole ? (
          <AuthLanding onSelectRole={(role) => {
            setUserRole(role);
            // Prevent navigation during auth initialization
            if (!authInitialized.current) {
              return;
            }
            navigate(role === 'admin' ? '/login/admin' : '/login/user');
          }} />
        ) : authState.user && authInitialized.current && !isNavigatingRef.current ? (
          // Use synchronous ref for routing decision to prevent race conditions
          <Navigate to={isAdminRef.current ? '/admin/dashboard' : '/member/NFL'} replace />
        ) : (
          <Navigate to={userRole === 'admin' ? '/login/admin' : '/login/user'} replace />
        )
      } />

      {/* Login routes */}
      <Route path="/login/user" element={
        // Check synchronous ref as primary source of truth to prevent race conditions
        // isAdminRef is updated before async authState, ensuring correct routing
        authState.user && authInitialized.current && !isAdminRef.current && !isNavigatingRef.current ? (
          <Navigate to="/member/NFL" replace />
        ) : (
          <div className="gradient-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
            <div className="card" style={{ maxWidth: '400px', width: '100%', margin: '0 auto', padding: 40 }}>
              <h2 className="text-center mb-4">User Login</h2>
              <form onSubmit={handleLogin} style={{ maxWidth: 300, margin: 'auto' }}>
                <input
                  type="email"
                  placeholder="Email"
                  required
                  value={loginForm.email}
                  onChange={(e) => setLoginForm((f) => ({ ...f, email: e.target.value }))}
                />
                <input
                  type="password"
                  placeholder="Password"
                  required
                  value={loginForm.password}
                  onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
                />
                <button className="btn btn-primary" type="submit" style={{ width: '100%', marginBottom: '12px' }}>Login</button>
                <button 
                  className="btn btn-secondary" 
                  type="button" 
                  onClick={() => { setUserRole(null); navigate('/'); }} 
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
        )
      } />

      <Route path="/login/admin" element={
        // Check synchronous ref as primary source of truth to prevent race conditions
        // isAdminRef is updated before async authState, ensuring correct routing
        authState.user && authInitialized.current && isAdminRef.current && !isNavigatingRef.current ? (
          <Navigate to="/admin/dashboard" replace />
        ) : (
          <div className="gradient-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
            <div className="card" style={{ maxWidth: '400px', width: '100%', margin: '0 auto', padding: 40 }}>
              <h2 className="text-center mb-4">Admin Login</h2>
              <form onSubmit={handleLogin} style={{ maxWidth: 300, margin: 'auto' }}>
                <input
                  type="email"
                  placeholder="Admin Email"
                  required
                  value={loginForm.email}
                  onChange={(e) => setLoginForm((f) => ({ ...f, email: e.target.value }))}
                />
                <input
                  type="password"
                  placeholder="Password"
                  required
                  value={loginForm.password}
                  onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
                />
                <button className="btn btn-primary" type="submit" style={{ width: '100%', marginBottom: '12px' }}>Login</button>
                <button 
                  className="btn btn-secondary" 
                  type="button" 
                  onClick={() => { setUserRole(null); navigate('/'); }} 
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
        )
      } />

      {/* Admin routes - require authentication */}
      <Route path="/admin/dashboard" element={
        !authState.user || (!authState.isAdmin && !isAdminRef.current) ? (
          <Navigate to="/login/admin" replace />
        ) : (
          <AdminLandingPage
            onManageUsers={() => navigate('/admin/users')}
            onViewSubmissions={() => navigate('/admin/submissions')}
            onSignOut={handleSignOut}
          />
        )
      } />

      <Route path="/admin/users" element={
        !authState.user || (!authState.isAdmin && !isAdminRef.current) ? (
          <Navigate to="/login/admin" replace />
        ) : (
          <UserManagement onBack={() => navigate('/admin/dashboard')} />
        )
      } />

      <Route path="/admin/submissions" element={
        !authState.user || (!authState.isAdmin && !isAdminRef.current) ? (
          <Navigate to="/login/admin" replace />
        ) : (
          <SubmissionsViewer
            onBack={() => navigate('/admin/dashboard')}
          />
        )
      } />

      <Route path="/admin/:sport" element={
        !authState.user || (!authState.isAdmin && !isAdminRef.current) ? (
          <Navigate to="/login/admin" replace />
        ) : (
          <AdminSportRoute
            authState={authState}
            games={games}
            setGames={setGames}
            isSyncing={isSyncing}
            setIsSyncing={setIsSyncing}
            recentlyUpdated={recentlyUpdated}
            setRecentlyUpdated={setRecentlyUpdated}
            submissions={submissions}
            allSportsGames={allSportsGames}
            loadAllSports={loadAllSports}
          />
        )
      } />

      {/* Member routes - unified container for seamless tab switching */}
      {/* Home (/member/:sport), My Bets (/member/dashboard), and FAQs (/member/faqs) use the same container */}
      {/* This keeps all views mounted, eliminating loading delays */}
      <Route path="/member/faqs" element={
        !authState.user || authState.isAdmin ? (
          <Navigate to="/login/user" replace />
        ) : (
          <MemberContainer
            games={games}
            allSportsGames={allSportsGames}
            betType={betType}
            onBetTypeChange={setBetType}
            loading={loading}
            apiError={apiError}
            onManualRefresh={handleManualRefresh}
            lastRefreshTime={lastRefreshTime}
            onSignOut={handleSignOut}
            isRefreshing={isRefreshing}
            propBets={propBets}
            propBetsLoading={propBetsLoading}
            propBetsError={propBetsError}
            setCurrentViewSport={setCurrentViewSport}
            currentViewSportRef={currentViewSportRef}
            setGames={setGames}
            loadAllPropBets={loadAllPropBets}
            userCredit={userCredit}
            onRefreshCredit={refreshUserCredit}
            optimisticWagers={optimisticWagers}
            setOptimisticWagers={setOptimisticWagers}
            LandingPage={LandingPage}
          />
        )
      } />
      
      <Route path="/member/dashboard" element={
        !authState.user || authState.isAdmin ? (
          <Navigate to="/login/user" replace />
        ) : loading && !apiError ? (
          <div className="gradient-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
            <div className="text-white" style={{ fontSize: '24px' }}>
              Loading games...
            </div>
          </div>
        ) : (
          <MemberContainer
            games={games}
            allSportsGames={allSportsGames}
            betType={betType}
            onBetTypeChange={setBetType}
            loading={loading}
            apiError={apiError}
            onManualRefresh={handleManualRefresh}
            lastRefreshTime={lastRefreshTime}
            onSignOut={handleSignOut}
            isRefreshing={isRefreshing}
            propBets={propBets}
            propBetsLoading={propBetsLoading}
            propBetsError={propBetsError}
            setCurrentViewSport={setCurrentViewSport}
            currentViewSportRef={currentViewSportRef}
            setGames={setGames}
            loadAllPropBets={loadAllPropBets}
            userCredit={userCredit}
            onRefreshCredit={refreshUserCredit}
            optimisticWagers={optimisticWagers}
            setOptimisticWagers={setOptimisticWagers}
            LandingPage={LandingPage}
          />
        )
      } />

      <Route path="/member/:sport" element={
        !authState.user || authState.isAdmin ? (
          <Navigate to="/login/user" replace />
        ) : loading && !apiError ? (
          <div className="gradient-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
            <div className="text-white" style={{ fontSize: '24px' }}>
              Loading games...
            </div>
          </div>
        ) : (
          <MemberContainer
            games={games}
            allSportsGames={allSportsGames}
            betType={betType}
            onBetTypeChange={setBetType}
            loading={loading}
            apiError={apiError}
            onManualRefresh={handleManualRefresh}
            lastRefreshTime={lastRefreshTime}
            onSignOut={handleSignOut}
            isRefreshing={isRefreshing}
            propBets={propBets}
            propBetsLoading={propBetsLoading}
            propBetsError={propBetsError}
            setCurrentViewSport={setCurrentViewSport}
            currentViewSportRef={currentViewSportRef}
            setGames={setGames}
            loadAllPropBets={loadAllPropBets}
            userCredit={userCredit}
            onRefreshCredit={refreshUserCredit}
            optimisticWagers={optimisticWagers}
            setOptimisticWagers={setOptimisticWagers}
            LandingPage={LandingPage}
          />
        )
      } />

      {/* Catch all - redirect to root */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

export default AppWithErrorBoundary;
