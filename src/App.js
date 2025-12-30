import './App.css';
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, set, update, onValue, push, get } from "firebase/database";
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
import { getStandardId } from './utils/normalization';
import { findBestMoneylinePrices, formatMoneylineForDisplay } from './utils/priceFinder';
import { findTeamByName } from './utils/teamMapper';

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

// Debug flag for diagnostic logging - ENABLED for production moneyline diagnostics
const DEBUG_JSONODDS_FLOW = true;

// ESPN API Endpoints for all sports
const ESPN_API_ENDPOINTS = {
  'NFL': 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  'NBA': 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  'College Football': 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
  'College Basketball': 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?limit=400', // All Division 1 games
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

// JsonOdds API Configuration for Moneyline Odds
const JSON_ODDS_API_KEY = process.env.REACT_APP_JSON_ODDS_API_KEY;

// Debug: Log JsonOdds API key status
console.log('🔑 JsonOdds API Key Status:', JSON_ODDS_API_KEY ? '✅ LOADED' : '❌ MISSING');
if (!JSON_ODDS_API_KEY) {
  console.error('❌ CRITICAL: REACT_APP_JSON_ODDS_API_KEY is not defined in .env file');
  console.error('Please add: REACT_APP_JSON_ODDS_API_KEY=your_api_key_here');
}

// JsonOdds sport keys mapping (from JsonOdds_Documentation.html)
const JSON_ODDS_SPORT_KEYS = {
  'NFL': 'NFL',
  'NBA': 'NBA',
  'College Football': 'NCAAF',
  'College Basketball': 'NCAAB',
  'Major League Baseball': 'MLB',
  'NHL': 'NHL',
  'World Cup': 'Soccer',
  'MLS': 'MLS',
  'Boxing': 'Boxing',
  'UFC': 'MMA'
};

// JsonOdds cache with same structure as Odds API cache
const jsonOddsCache = {};
const JSON_ODDS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Standardize team name for consistent key matching between JsonOdds API and UI
 * Strips mascots, normalizes abbreviations, and lowercases for reliable matching
 * This replaces the old getGameKey function for better team name matching
 * @param {string} away - Away team name
 * @param {string} home - Home team name
 * @returns {string} - Standardized key in format "away|home"
 */
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

// BOOKMAKER PRIORITY LIST for odds selection
// Priority order: DraftKings > FanDuel > BetMGM > Pinnacle > WilliamHill
const BOOKMAKER_PRIORITY = ['draftkings', 'fanduel', 'betmgm', 'pinnacle', 'williamhill_us'];

// Period market configuration for parsing quarter/halftime odds
const PERIOD_MARKET_CONFIG = [
  { key: 'h2h_q1', type: 'moneyline', period: 'Q1' },
  { key: 'spreads_q1', type: 'spread', period: 'Q1' },
  { key: 'totals_q1', type: 'total', period: 'Q1' },
  { key: 'h2h_q2', type: 'moneyline', period: 'Q2' },
  { key: 'spreads_q2', type: 'spread', period: 'Q2' },
  { key: 'totals_q2', type: 'total', period: 'Q2' },
  { key: 'h2h_q3', type: 'moneyline', period: 'Q3' },
  { key: 'spreads_q3', type: 'spread', period: 'Q3' },
  { key: 'totals_q3', type: 'total', period: 'Q3' },
  { key: 'h2h_q4', type: 'moneyline', period: 'Q4' },
  { key: 'spreads_q4', type: 'spread', period: 'Q4' },
  { key: 'totals_q4', type: 'total', period: 'Q4' },
  { key: 'h2h_h1', type: 'moneyline', period: 'H1' },
  { key: 'spreads_h1', type: 'spread', period: 'H1' },
  { key: 'totals_h1', type: 'total', period: 'H1' },
  { key: 'h2h_h2', type: 'moneyline', period: 'H2' },
  { key: 'spreads_h2', type: 'spread', period: 'H2' },
  { key: 'totals_h2', type: 'total', period: 'H2' }
];

const PROP_BETS_CACHE_DURATION = 2 * 60 * 60 * 1000;

const CACHE_DURATION = 6 * 60 * 60 * 1000;
const COLLEGE_BASKETBALL_CACHE_DURATION = 6 * 60 * 60 * 1000;
const ODDS_API_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for better data freshness
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
      
      // Filter out games with invalid sport names
      const validGames = games.filter(game => game.sport && typeof game.sport === 'string' && game.sport.trim() !== '');
      
      if (validGames.length === 0) {
        alert('⚠️ No valid games to save');
        setIsSyncing(false);
        return;
      }
      
      const spreadsData = {};
      validGames.forEach(game => {
        const gameData = {
          timestamp: new Date().toISOString(),
          // MANUAL OVERRIDE FLAG: Mark data as manually edited by admin
          // This prevents API from overwriting these odds automatically
          isManual: true
        };
        
        // Only add fields if they have valid values (not empty strings or null)
        if (game.awaySpread && game.awaySpread !== '' && game.awaySpread !== '-') {
          gameData.awaySpread = game.awaySpread;
        }
        if (game.homeSpread && game.homeSpread !== '' && game.homeSpread !== '-') {
          gameData.homeSpread = game.homeSpread;
        }
        if (game.awayMoneyline && game.awayMoneyline !== '' && game.awayMoneyline !== '-') {
          gameData.awayMoneyline = game.awayMoneyline;
        }
        if (game.homeMoneyline && game.homeMoneyline !== '' && game.homeMoneyline !== '-') {
          gameData.homeMoneyline = game.homeMoneyline;
        }
        if (game.total && game.total !== '' && game.total !== '-') {
          gameData.total = game.total;
        }
        
        // Add quarter/halftime fields if present and valid
        const quarterHalfKeys = [
          'Q1_homeMoneyline', 'Q1_awayMoneyline', 'Q1_homeSpread', 'Q1_awaySpread', 'Q1_total',
          'Q2_homeMoneyline', 'Q2_awayMoneyline', 'Q2_homeSpread', 'Q2_awaySpread', 'Q2_total',
          'Q3_homeMoneyline', 'Q3_awayMoneyline', 'Q3_homeSpread', 'Q3_awaySpread', 'Q3_total',
          'Q4_homeMoneyline', 'Q4_awayMoneyline', 'Q4_homeSpread', 'Q4_awaySpread', 'Q4_total',
          'H1_homeMoneyline', 'H1_awayMoneyline', 'H1_homeSpread', 'H1_awaySpread', 'H1_total',
          'H2_homeMoneyline', 'H2_awayMoneyline', 'H2_homeSpread', 'H2_awaySpread', 'H2_total'
        ];
        
        quarterHalfKeys.forEach(key => {
          if (game[key] && game[key] !== '' && game[key] !== '-') {
            gameData[key] = game[key];
          }
        });
        
        spreadsData[game.espnId] = gameData;
      });
      
      console.log(`💾 Saving ${Object.keys(spreadsData).length} games to Firebase path: spreads/${sport} with isManual=true`);
      
      // CRITICAL FIX: Use update() instead of set() to preserve existing data
      // This allows full game and quarter/half odds to coexist in same Firebase entry
      for (const [espnId, gameData] of Object.entries(spreadsData)) {
        const path = `spreads/${sport}/${espnId}`;
        console.log(`  → Updating ${path}`, gameData);
        await update(ref(database, path), gameData);
      }
      
      alert('✅ Spreads saved! All devices will update in real-time. Manual override flag set.');
      setIsSyncing(false);
    } catch (error) {
      console.error('❌ Error saving spreads:', error);
      alert('❌ Error saving spreads:\n' + error.message);
      setIsSyncing(false);
    }
  };

  const updateSpread = (gameId, team, value) => {
    setGames(prevGames =>
      prevGames.map(game =>
        game.espnId === gameId
          ? { ...game, [team === 'away' ? 'awaySpread' : 'homeSpread']: value }
          : game
      )
    );
  };

  const updateMoneyline = (gameId, team, value) => {
    setGames(prevGames =>
      prevGames.map(game =>
        game.espnId === gameId
          ? { ...game, [team === 'away' ? 'awayMoneyline' : 'homeMoneyline']: value }
          : game
      )
    );
  };

  const updateTotal = (gameId, value) => {
    setGames(prevGames =>
      prevGames.map(game =>
        game.espnId === gameId
          ? { ...game, total: value }
          : game
      )
    );
  };

  const updateQuarterHalf = (gameId, fieldName, value) => {
    setGames(prevGames =>
      prevGames.map(game =>
        game.espnId === gameId
          ? { ...game, [fieldName]: value }
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
              <input type="text" value={game.awaySpread} onChange={(e) => updateSpread(game.espnId, 'away', e.target.value)} placeholder="Spread, e.g. +3.5" />
            </div>
            <div>
              <label><strong>{game.homeTeam} (Home)</strong></label>
              <input type="text" value={game.homeSpread} onChange={(e) => updateSpread(game.espnId, 'home', e.target.value)} placeholder="Spread, e.g. -3.5" />
            </div>
            <div>
              <label><strong>Moneyline</strong></label>
              <input type="text" value={game.awayMoneyline} onChange={(e) => updateMoneyline(game.espnId, 'away', e.target.value)} placeholder={`${game.awayTeam} ML, e.g. +150`} />
              <input type="text" value={game.homeMoneyline} onChange={(e) => updateMoneyline(game.espnId, 'home', e.target.value)} placeholder={`${game.homeTeam} ML, e.g. -180`} />
            </div>
            <div>
              <label><strong>Total (O/U)</strong></label>
              <input
                type="text"
                value={game.total}
                onChange={(e) => updateTotal(game.espnId, e.target.value)}
                placeholder="42.5"
              />
            </div>
            
            {/* Quarter and Halftime Odds Section */}
            {sport !== 'Boxing' && sport !== 'UFC' && sport !== 'World Cup' && sport !== 'MLS' && (
              <details style={{ marginTop: '16px' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold', padding: '8px', background: '#f0f0f0', borderRadius: '4px' }}>
                  📊 Quarter & Halftime Odds (Optional)
                </summary>
                <div style={{ marginTop: '12px', paddingLeft: '16px' }}>
                  {/* 1st Quarter */}
                  <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #e0e0e0' }}>
                    <h4 style={{ fontSize: '14px', marginBottom: '8px', color: '#555' }}>1st Quarter</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <input type="text" value={game.Q1_awaySpread || ''} onChange={(e) => updateQuarterHalf(game.espnId, 'Q1_awaySpread', e.target.value)} placeholder={`${game.awayTeam} Q1 Spread`} />
                      <input type="text" value={game.Q1_homeSpread || ''} onChange={(e) => updateQuarterHalf(game.espnId, 'Q1_homeSpread', e.target.value)} placeholder={`${game.homeTeam} Q1 Spread`} />
                      <input type="text" value={game.Q1_awayMoneyline || ''} onChange={(e) => updateQuarterHalf(game.espnId, 'Q1_awayMoneyline', e.target.value)} placeholder={`${game.awayTeam} Q1 ML`} />
                      <input type="text" value={game.Q1_homeMoneyline || ''} onChange={(e) => updateQuarterHalf(game.espnId, 'Q1_homeMoneyline', e.target.value)} placeholder={`${game.homeTeam} Q1 ML`} />
                      <input type="text" value={game.Q1_total || ''} onChange={(e) => updateQuarterHalf(game.espnId, 'Q1_total', e.target.value)} placeholder="Q1 Total" style={{ gridColumn: '1 / -1' }} />
                    </div>
                  </div>
                  
                  {/* 2nd Quarter */}
                  <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #e0e0e0' }}>
                    <h4 style={{ fontSize: '14px', marginBottom: '8px', color: '#555' }}>2nd Quarter</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <input type="text" value={game.Q2_awaySpread || ''} onChange={(e) => updateQuarterHalf(game.espnId, 'Q2_awaySpread', e.target.value)} placeholder={`${game.awayTeam} Q2 Spread`} />
                      <input type="text" value={game.Q2_homeSpread || ''} onChange={(e) => updateQuarterHalf(game.espnId, 'Q2_homeSpread', e.target.value)} placeholder={`${game.homeTeam} Q2 Spread`} />
                      <input type="text" value={game.Q2_awayMoneyline || ''} onChange={(e) => updateQuarterHalf(game.espnId, 'Q2_awayMoneyline', e.target.value)} placeholder={`${game.awayTeam} Q2 ML`} />
                      <input type="text" value={game.Q2_homeMoneyline || ''} onChange={(e) => updateQuarterHalf(game.espnId, 'Q2_homeMoneyline', e.target.value)} placeholder={`${game.homeTeam} Q2 ML`} />
                      <input type="text" value={game.Q2_total || ''} onChange={(e) => updateQuarterHalf(game.espnId, 'Q2_total', e.target.value)} placeholder="Q2 Total" style={{ gridColumn: '1 / -1' }} />
                    </div>
                  </div>
                  
                  {/* 3rd Quarter */}
                  <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #e0e0e0' }}>
                    <h4 style={{ fontSize: '14px', marginBottom: '8px', color: '#555' }}>3rd Quarter</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <input type="text" value={game.Q3_awaySpread || ''} onChange={(e) => updateQuarterHalf(game.espnId, 'Q3_awaySpread', e.target.value)} placeholder={`${game.awayTeam} Q3 Spread`} />
                      <input type="text" value={game.Q3_homeSpread || ''} onChange={(e) => updateQuarterHalf(game.espnId, 'Q3_homeSpread', e.target.value)} placeholder={`${game.homeTeam} Q3 Spread`} />
                      <input type="text" value={game.Q3_awayMoneyline || ''} onChange={(e) => updateQuarterHalf(game.espnId, 'Q3_awayMoneyline', e.target.value)} placeholder={`${game.awayTeam} Q3 ML`} />
                      <input type="text" value={game.Q3_homeMoneyline || ''} onChange={(e) => updateQuarterHalf(game.espnId, 'Q3_homeMoneyline', e.target.value)} placeholder={`${game.homeTeam} Q3 ML`} />
                      <input type="text" value={game.Q3_total || ''} onChange={(e) => updateQuarterHalf(game.espnId, 'Q3_total', e.target.value)} placeholder="Q3 Total" style={{ gridColumn: '1 / -1' }} />
                    </div>
                  </div>
                  
                  {/* 4th Quarter */}
                  <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #e0e0e0' }}>
                    <h4 style={{ fontSize: '14px', marginBottom: '8px', color: '#555' }}>4th Quarter</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <input type="text" value={game.Q4_awaySpread || ''} onChange={(e) => updateQuarterHalf(game.espnId, 'Q4_awaySpread', e.target.value)} placeholder={`${game.awayTeam} Q4 Spread`} />
                      <input type="text" value={game.Q4_homeSpread || ''} onChange={(e) => updateQuarterHalf(game.espnId, 'Q4_homeSpread', e.target.value)} placeholder={`${game.homeTeam} Q4 Spread`} />
                      <input type="text" value={game.Q4_awayMoneyline || ''} onChange={(e) => updateQuarterHalf(game.espnId, 'Q4_awayMoneyline', e.target.value)} placeholder={`${game.awayTeam} Q4 ML`} />
                      <input type="text" value={game.Q4_homeMoneyline || ''} onChange={(e) => updateQuarterHalf(game.espnId, 'Q4_homeMoneyline', e.target.value)} placeholder={`${game.homeTeam} Q4 ML`} />
                      <input type="text" value={game.Q4_total || ''} onChange={(e) => updateQuarterHalf(game.espnId, 'Q4_total', e.target.value)} placeholder="Q4 Total" style={{ gridColumn: '1 / -1' }} />
                    </div>
                  </div>
                  
                  {/* 1st Half */}
                  <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #e0e0e0' }}>
                    <h4 style={{ fontSize: '14px', marginBottom: '8px', color: '#555' }}>1st Half</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <input type="text" value={game.H1_awaySpread || ''} onChange={(e) => updateQuarterHalf(game.espnId, 'H1_awaySpread', e.target.value)} placeholder={`${game.awayTeam} H1 Spread`} />
                      <input type="text" value={game.H1_homeSpread || ''} onChange={(e) => updateQuarterHalf(game.espnId, 'H1_homeSpread', e.target.value)} placeholder={`${game.homeTeam} H1 Spread`} />
                      <input type="text" value={game.H1_awayMoneyline || ''} onChange={(e) => updateQuarterHalf(game.espnId, 'H1_awayMoneyline', e.target.value)} placeholder={`${game.awayTeam} H1 ML`} />
                      <input type="text" value={game.H1_homeMoneyline || ''} onChange={(e) => updateQuarterHalf(game.espnId, 'H1_homeMoneyline', e.target.value)} placeholder={`${game.homeTeam} H1 ML`} />
                      <input type="text" value={game.H1_total || ''} onChange={(e) => updateQuarterHalf(game.espnId, 'H1_total', e.target.value)} placeholder="H1 Total" style={{ gridColumn: '1 / -1' }} />
                    </div>
                  </div>
                  
                  {/* 2nd Half */}
                  <div style={{ marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '14px', marginBottom: '8px', color: '#555' }}>2nd Half</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <input type="text" value={game.H2_awaySpread || ''} onChange={(e) => updateQuarterHalf(game.espnId, 'H2_awaySpread', e.target.value)} placeholder={`${game.awayTeam} H2 Spread`} />
                      <input type="text" value={game.H2_homeSpread || ''} onChange={(e) => updateQuarterHalf(game.espnId, 'H2_homeSpread', e.target.value)} placeholder={`${game.homeTeam} H2 Spread`} />
                      <input type="text" value={game.H2_awayMoneyline || ''} onChange={(e) => updateQuarterHalf(game.espnId, 'H2_awayMoneyline', e.target.value)} placeholder={`${game.awayTeam} H2 ML`} />
                      <input type="text" value={game.H2_homeMoneyline || ''} onChange={(e) => updateQuarterHalf(game.espnId, 'H2_homeMoneyline', e.target.value)} placeholder={`${game.homeTeam} H2 ML`} />
                      <input type="text" value={game.H2_total || ''} onChange={(e) => updateQuarterHalf(game.espnId, 'H2_total', e.target.value)} placeholder="H2 Total" style={{ gridColumn: '1 / -1' }} />
                    </div>
                  </div>
                </div>
              </details>
            )}
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
          games={allSportsGames[displaySport] || []}
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

// ============================================================================
// BOOKMAKER SELECTION HELPER FUNCTIONS
// ============================================================================

/**
 * Normalizes bookmaker name for consistent matching
 * Removes spaces, converts to lowercase, strips special characters
 */
const normalizeBookmakerName = (title) => {
  if (!title) return '';
  return title.toLowerCase().replace(/[^a-z0-9]/g, '');
};

/**
 * Validates that a market has required data based on market type
 * @param {Object} market - The market object to validate
 * @param {string} marketKey - Market type (h2h, spreads, totals, etc.)
 * @param {string} homeTeam - Home team name for validation
 * @param {string} awayTeam - Away team name for validation
 * @returns {boolean} True if market has valid data
 */
const validateMarket = (market, marketKey, homeTeam, awayTeam) => {
  if (!market || !market.outcomes || market.outcomes.length < 2) {
    return false;
  }
  
  if (marketKey === 'h2h' || marketKey === 'spreads') {
    // For h2h and spreads, verify we can match both teams
    const hasHomeTeam = market.outcomes.some(o => 
      o.name === homeTeam || o.name.toLowerCase().includes(homeTeam.toLowerCase())
    );
    const hasAwayTeam = market.outcomes.some(o => 
      o.name === awayTeam || o.name.toLowerCase().includes(awayTeam.toLowerCase())
    );
    return hasHomeTeam && hasAwayTeam;
  } else if (marketKey === 'totals') {
    // For totals, verify we have Over/Under outcomes
    const hasOver = market.outcomes.some(o => o.name === 'Over');
    const hasUnder = market.outcomes.some(o => o.name === 'Under');
    return hasOver && hasUnder;
  } else if (marketKey === 'h2h_go_distance') {
    // For go distance, verify we have Yes/No outcomes
    const hasYes = market.outcomes.some(o => o.name === 'Yes');
    const hasNo = market.outcomes.some(o => o.name === 'No');
    return hasYes && hasNo;
  } else {
    // For other markets (h2h_method, h2h_round), just verify outcomes exist
    return true;
  }
};

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

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
    // A game should be displayed if at least ONE market (ML, Spread, or Total) has valid data
    const hasSpread = game.awaySpread && game.homeSpread && 
                      game.awaySpread !== '' && game.homeSpread !== '' &&
                      game.awaySpread !== '-' && game.homeSpread !== '-' &&
                      game.awaySpread !== 'OFF' && game.homeSpread !== 'OFF';
    const hasMoneyline = game.awayMoneyline && game.homeMoneyline && 
                         game.awayMoneyline !== '' && game.homeMoneyline !== '' &&
                         game.awayMoneyline !== '-' && game.homeMoneyline !== '-' &&
                         game.awayMoneyline !== 'OFF' && game.homeMoneyline !== 'OFF';
    const hasTotal = game.total && game.total !== '' && 
                     game.total !== '-' && game.total !== 'OFF';
    
    // Return true if ANY market has data (not all three required)
    return hasSpread || hasMoneyline || hasTotal;
  };
  
  // Helper function to extract mascot from team name (last word)
  const extractMascotFromName = useCallback((teamName) => {
    if (!teamName) return '';
    
    // Remove special chars and normalize spaces
    let cleaned = teamName
      .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special chars like apostrophes
      .replace(/\s+/g, ' ')            // Normalize spaces
      .trim()
      .toLowerCase();
    
    // Remove common college suffixes that aren't part of the mascot
    // This handles "St. Mary's Gaels" -> "marys gaels" -> "gaels"
    const suffixesToRemove = ['st', 'saint', 'state', 'university', 'college', 'tech', 'a&m'];
    const words = cleaned.split(' ');
    
    // Filter out suffix words, but keep at least the last word (mascot)
    const filteredWords = words.filter((word, index) => {
      // Always keep the last word (the mascot)
      if (index === words.length - 1) return true;
      // Remove if it's a suffix word
      return !suffixesToRemove.includes(word);
    });
    
    // Return the last word from the filtered list (the mascot)
    const mascot = filteredWords[filteredWords.length - 1];
    
    return mascot;
  }, []);
  
  // Helper function to extract city (first word) from team name
  const extractCityFromName = useCallback((teamName) => {
    if (!teamName) return '';
    
    const cleaned = teamName
      .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special chars
      .replace(/\s+/g, ' ')            // Normalize spaces
      .trim()
      .toLowerCase();
    
    const words = cleaned.split(' ');
    const city = words[0];
    
    return city;
  }, []);
  
  // Helper function for robust team name matching (The "Mascot Rule") with method tracking
  const teamsMatchHelper = useCallback((team1, team2) => {
    if (!team1 || !team2) return { match: false, method: null };
    
    // Normalize both team names for comparison
    const normalize = (str) => str.toLowerCase().trim();
    const t1 = normalize(team1);
    const t2 = normalize(team2);
    
    // Exact match (case-insensitive)
    if (t1 === t2) {
      return { match: true, method: 'Exact' };
    }
    
    // Extract mascots (last word of team name) and cities (first word)
    const mascot1 = extractMascotFromName(team1);
    const mascot2 = extractMascotFromName(team2);
    const city1 = extractCityFromName(team1);
    const city2 = extractCityFromName(team2);
    
    // AGGRESSIVE KEYWORD MATCHING: If any significant word appears in both, it's likely a match
    // Split into words, filter out common words, check for overlaps
    const words1 = t1.split(/\s+/).filter(w => w.length > 2 && !['the', 'of', 'and'].includes(w));
    const words2 = t2.split(/\s+/).filter(w => w.length > 2 && !['the', 'of', 'and'].includes(w));
    
    // Check if any significant word from team1 exists in team2
    for (const word of words1) {
      if (t2.includes(word) && word.length >= 4) {
        return { match: true, method: 'Keyword' };
      }
    }
    
    // Check if any significant word from team2 exists in team1
    for (const word of words2) {
      if (t1.includes(word) && word.length >= 4) {
        return { match: true, method: 'Keyword' };
      }
    }
    
    // Special cases: "Sox" (Red Sox, White Sox) - need city name too
    const specialCaseMascots = ['sox', 'knicks', 'bulls', 'heat', 'magic', 'jazz', 'thunder'];
    
    if (specialCaseMascots.includes(mascot1) || specialCaseMascots.includes(mascot2)) {
      // For special cases, check if both mascots match AND city is contained
      if (mascot1 === mascot2) {
        // Check if either contains the other (handles "LA" vs "Los Angeles")
        if (t1.includes(t2) || t2.includes(t1)) {
          return { match: true, method: 'Mascot' };
        }
      }
      return { match: false, method: null };
    }
    
    // Standard mascot matching with .includes() for more flexibility
    if (mascot1 && mascot2 && mascot1.length > 2 && mascot2.length > 2) {
      // First try exact match
      if (mascot1 === mascot2) {
        return { match: true, method: 'Mascot' };
      }
      // Then try if one mascot is contained in the full name of the other team
      if (t1.includes(mascot2) || t2.includes(mascot1)) {
        return { match: true, method: 'Mascot' };
      }
    }
    
    // ENHANCED CITY MATCH: Check if first word of either team name exists within the other
    if (city1.length >= 3 && city2.length >= 3) {
      // Check if city1 is contained in team2 or city2 is contained in team1
      if (t1.includes(city2) || t2.includes(city1)) {
        return { match: true, method: 'City' };
      }
    }
    
    // ENHANCED: Partial name matching for multi-word cities
    const clean1 = t1.replace(/[^a-z0-9\s]/g, '');
    const clean2 = t2.replace(/[^a-z0-9\s]/g, '');
    
    if (clean1.length >= 5 && clean2.length >= 5) {
      if (clean1.includes(clean2) || clean2.includes(clean1)) {
        return { match: true, method: 'Partial' };
      }
    }
    
    // Last resort: Check if cleaned names are substrings (no spaces)
    const cleanNoSpace1 = t1.replace(/[^a-z0-9]/g, '');
    const cleanNoSpace2 = t2.replace(/[^a-z0-9]/g, '');
    
    if (cleanNoSpace1.includes(cleanNoSpace2) || cleanNoSpace2.includes(cleanNoSpace1)) {
      return { match: true, method: 'Substring' };
    }
    
    return { match: false, method: null };
  }, [extractMascotFromName, extractCityFromName]);
  
  // Helper function to find bookmaker with a specific market using priority order
  // Uses global BOOKMAKER_PRIORITY constant and helper functions
  const findBookmakerWithMarket = (bookmakers, marketKey, homeTeam, awayTeam) => {
    if (!bookmakers || bookmakers.length === 0) {
      return null;
    }
    
    // PRIORITY SEARCH: Loop through priority list first
    for (const priorityBook of BOOKMAKER_PRIORITY) {
      for (let i = 0; i < bookmakers.length; i++) {
        const bookmaker = bookmakers[i];
        const normalizedName = normalizeBookmakerName(bookmaker.title || bookmaker.key);
        
        // Check if this bookmaker matches the current priority
        if (normalizedName.includes(priorityBook) || priorityBook.includes(normalizedName)) {
          if (!bookmaker.markets || bookmaker.markets.length === 0) {
            continue;
          }
          
          // Check if this bookmaker has the requested market
          const market = bookmaker.markets.find(m => m.key === marketKey);
          
          if (validateMarket(market, marketKey, homeTeam, awayTeam)) {
            console.log(`  ✅ Found ${marketKey} market in priority bookmaker: ${bookmaker.title}`);
            return { bookmaker, market };
          }
        }
      }
    }
    
    // FALLBACK: If no priority bookmaker has the market, check remaining bookmakers
    for (let i = 0; i < bookmakers.length; i++) {
      const bookmaker = bookmakers[i];
      const normalizedName = normalizeBookmakerName(bookmaker.title || bookmaker.key);
      
      // Skip if already checked in priority search
      const isPriorityBook = BOOKMAKER_PRIORITY.some(pb => 
        normalizedName.includes(pb) || pb.includes(normalizedName)
      );
      if (isPriorityBook) {
        continue;
      }
      
      if (!bookmaker.markets || bookmaker.markets.length === 0) {
        continue;
      }
      
      // Check if this bookmaker has the requested market
      const market = bookmaker.markets.find(m => m.key === marketKey);
      
      if (validateMarket(market, marketKey, homeTeam, awayTeam)) {
        console.log(`  ✓ Found ${marketKey} market in fallback bookmaker: ${bookmaker.title}`);
        return { bookmaker, market };
      }
    }
    
    console.log(`  ❌ No bookmaker found with valid ${marketKey} market (checked all ${bookmakers.length} bookmakers)`);
    return null;
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
      // US Sports: ONLY h2h (moneyline), spreads, totals for bulk endpoint
      // Period-specific markets (quarters/halves) must use per-event endpoint via fetchDetailedOdds
      // This prevents 422 'Invalid Market' errors from the bulk API
      markets = 'h2h,spreads,totals';
    }
    
    // V4 API: Add time parameters to include future games (next 14 days)
    // commenceTimeFrom: Current time (now)
    // commenceTimeTo: 14 days from now (extended for better coverage)
    // CRITICAL: Strip milliseconds from timestamps to avoid 422 errors from The Odds API
    // Format must be YYYY-MM-DDTHH:MM:SSZ (whole seconds only, no .milliseconds)
    const now = new Date();
    const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const commenceTimeFrom = now.toISOString().split('.')[0] + 'Z';
    const commenceTimeTo = fourteenDaysFromNow.toISOString().split('.')[0] + 'Z';
    
    // CRITICAL: Request 'american' odds format (no conversion needed)
    // Also include source IDs (includeSids=true) for better team matching
    const url = `${ODDS_API_BASE_URL}/sports/${sportKey}/odds/?apiKey=${ODDS_API_KEY}&regions=us&markets=${markets}&oddsFormat=american&includeSids=true&commenceTimeFrom=${commenceTimeFrom}&commenceTimeTo=${commenceTimeTo}`;
    
    // DEBUG: Log URL with masked API key for security
    const maskedUrl = url.replace(ODDS_API_KEY, '***KEY_HIDDEN***');
    console.log(`🔥 Making Odds API call for ${sport}...`);
    console.log(`📡 URL: ${maskedUrl}`);
    console.log(`📋 Markets requested: ${markets}`);
    console.log(`📐 Odds format: american (no conversion needed)`);
    console.log(`🆔 Source IDs: enabled (includeSids=true)`);
    console.log(`📅 Time window: ${commenceTimeFrom} to ${commenceTimeTo} (14 days)`);
    
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
        const fallbackUrl = `${ODDS_API_BASE_URL}/sports/upcoming/odds/?apiKey=${ODDS_API_KEY}&regions=us&markets=${markets}&oddsFormat=american&includeSids=true`;
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
    
    // ENHANCED: If fewer than expected games returned for specific sport, try 'upcoming' fallback
    // This helps capture games that might be missing from the sport-specific endpoint
    if (data.length === 0 || (data.length < 5 && !isCombat)) {
      console.warn(`⚠️ Limited/no games found for ${sport} (got ${data.length}). Trying 'upcoming' fallback for additional games...`);
      
      const fallbackUrl = `${ODDS_API_BASE_URL}/sports/upcoming/odds/?apiKey=${ODDS_API_KEY}&regions=us&markets=${markets}&oddsFormat=american&includeSids=true`;
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
        
        // MERGE: Combine specific sport data with upcoming data, removing duplicates
        const mergedData = [...data];
        const existingIds = new Set(data.map(g => g.id));
        
        // Filter upcoming games by sport and add if not already present
        const sportKey = ODDS_API_SPORT_KEYS[sport];
        fallbackData.forEach(game => {
          // Check if this game belongs to our sport
          if (game.sport_key === sportKey && !existingIds.has(game.id)) {
            mergedData.push(game);
          }
        });
        
        console.log(`📊 Merged ${mergedData.length - data.length} additional games from 'upcoming'`);
        
        // Cache merged data
        oddsAPICache[sport] = {
          data: mergedData,
          timestamp: Date.now()
        };
        
        return mergedData;
      }
    }
    
    // CRITICAL LOGGING: Show all teams from API response
    console.log(`📡 API Results for this league (${sport}):`);
    data.forEach((event, idx) => {
      console.log(`   ${idx + 1}. ${event.away_team} @ ${event.home_team}`);
    });
    console.log('');
    
    // LOG: Confirm we're processing ALL games without time filtering
    console.log(`✅ Processing all ${data.length} games (no time filtering applied)`);
    console.log(`⚠️ CRITICAL: Future games will be processed - no commence_time filtering\n`);
    
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
    
    // MARKET AVAILABILITY CACHING: Track which bookmakers have which markets
    // This prevents redundant array loops and optimizes bookmaker selection
    const availabilityCache = new Map(); // Key: gameId, Value: { marketKey: [bookmakerNames] }
    
    // Pre-scan all games to build availability cache
    console.log('🔍 Pre-scanning bookmaker availability for all games...');
    data.forEach((game) => {
      if (!game.bookmakers || game.bookmakers.length === 0) return;
      
      const gameAvailability = {
        h2h: [],
        spreads: [],
        totals: [],
        h2h_go_distance: [],
        h2h_method: [],
        h2h_round: []
      };
      
      game.bookmakers.forEach((bookmaker) => {
        if (!bookmaker.markets || bookmaker.markets.length === 0) return;
        
        bookmaker.markets.forEach((market) => {
          if (gameAvailability[market.key]) {
            gameAvailability[market.key].push(bookmaker.title || bookmaker.key);
          }
        });
      });
      
      availabilityCache.set(game.id, gameAvailability);
      
      // Log availability summary
      const availableParts = [];
      if (gameAvailability.h2h.length > 0) availableParts.push(`ML:${gameAvailability.h2h.length}`);
      if (gameAvailability.spreads.length > 0) availableParts.push(`Spread:${gameAvailability.spreads.length}`);
      if (gameAvailability.totals.length > 0) availableParts.push(`Total:${gameAvailability.totals.length}`);
      
      if (availableParts.length > 0) {
        console.log(`  📋 ${game.away_team} @ ${game.home_team}: ${availableParts.join(', ')} bookmakers`);
      }
    });
    console.log(`✅ Availability cache built for ${availabilityCache.size} games\n`);
    
    data.forEach((game, gameIndex) => {
      const homeTeam = game.home_team;
      const awayTeam = game.away_team;
      
      // Normalize team names to ESPN IDs for consistent keying
      const homeTeamId = getStandardId(homeTeam);
      const awayTeamId = getStandardId(awayTeam);
      
      // Calculate time until game starts for diagnostic logging
      const commenceTime = new Date(game.commence_time);
      const hoursUntilGame = (commenceTime - now) / (1000 * 60 * 60);
      
      console.log(`\n🎮 Game ${gameIndex + 1}: ${awayTeam} @ ${homeTeam}`);
      console.log(`   ⏰ Starts in: ${hoursUntilGame.toFixed(1)} hours (${game.commence_time})`);
      
      // Check if we can normalize both teams to IDs
      if (!homeTeamId || !awayTeamId) {
        console.warn(`  ⚠️ Cannot normalize team names to IDs: Away="${awayTeam}" (ID: ${awayTeamId}), Home="${homeTeam}" (ID: ${homeTeamId})`);
        return; // Skip this game if we can't normalize
      }
      
      console.log(`   🆔 Normalized IDs: Away=${awayTeamId}, Home=${homeTeamId}`);
      
      // THE ODDS API v4 DATA DRILL-DOWN PATH:
      // 1. Check if bookmakers array exists
      if (!game.bookmakers || game.bookmakers.length === 0) {
        console.warn(`  ⚠️ No bookmakers data available`);
        // Store empty odds with fallback values using ID-based key
        const gameKey = `${homeTeamId}|${awayTeamId}`;
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
      
      console.log(`  📊 Found ${game.bookmakers.length} bookmaker(s) for this game`);
      
      // FIX: Instead of selecting ONE bookmaker, we'll search through ALL bookmakers
      // for EACH market type independently. This solves the "Bookmaker 0 trap" where
      // FanDuel might have taken moneyline off the board but DraftKings still has it.
      
      let homeSpread = '-';
      let awaySpread = '-';
      let total = '-';
      let homeMoneyline = '-';
      let awayMoneyline = '-';
      let drawMoneyline = isSoccer ? '-' : undefined;
      
      // 2. Find bookmaker with spreads market
      const spreadResult = findBookmakerWithMarket(game.bookmakers, 'spreads', homeTeam, awayTeam);
      if (spreadResult) {
        const { market: spreadMarket } = spreadResult;
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
        console.log(`  ❌ No spreads market found in any bookmaker`);
      }
      
      // 3. Find bookmaker with totals market (independent search)
      const totalResult = findBookmakerWithMarket(game.bookmakers, 'totals', homeTeam, awayTeam);
      if (totalResult) {
        const { market: totalMarket } = totalResult;
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
        console.log(`  ❌ No totals market found in any bookmaker`);
      }
      
      // 4. Find bookmaker with moneyline (h2h) market using new Price Finder utility
      // CRITICAL: Soccer has 3 outcomes (Home, Away, Draw), Combat/Traditional have 2
      const gameName = `${awayTeam} @ ${homeTeam}`;
      const sportKey = ODDS_API_SPORT_KEYS[sport];
      
      // CRITICAL: Look up team IDs from local JSON files to enable SID matching
      // The sid from API outcomes matches the id field in our src/data/*.json files
      // This provides reliable team identification without name-based guessing
      let localHomeTeamId = null;
      let localAwayTeamId = null;
      
      if (sportKey) {
        const homeTeamData = findTeamByName(homeTeam, sportKey);
        const awayTeamData = findTeamByName(awayTeam, sportKey);
        
        localHomeTeamId = homeTeamData?.id || null;
        localAwayTeamId = awayTeamData?.id || null;
        
        if (localHomeTeamId && localAwayTeamId) {
          console.log(`  🆔 Local team IDs found: Home=${localHomeTeamId}, Away=${localAwayTeamId}`);
        } else {
          console.warn(`  ⚠️ Could not find local team IDs: Home=${localHomeTeamId || 'NOT_FOUND'}, Away=${localAwayTeamId || 'NOT_FOUND'}`);
        }
      }
      
      // Use new Price Finder utility for robust moneyline extraction
      // Now passing local team IDs for SID-based matching (most reliable method)
      const moneylineResult = findBestMoneylinePrices(
        game.bookmakers,
        homeTeam,
        awayTeam,
        sportKey,
        localHomeTeamId,  // homeTeamId - used for SID matching with API outcomes
        localAwayTeamId   // awayTeamId - used for SID matching with API outcomes
      );
      
      if (moneylineResult) {
        // Format prices to American odds
        const formatted = formatMoneylineForDisplay(moneylineResult);
        homeMoneyline = formatted.homeMoneyline;
        awayMoneyline = formatted.awayMoneyline;
        if (isSoccer && formatted.drawMoneyline !== undefined) {
          drawMoneyline = formatted.drawMoneyline;
        }
        
        console.log(`  ✅ Moneyline prices found via ${moneylineResult.bookmakerName}`);
        console.log(`     Away: ${awayMoneyline}, Home: ${homeMoneyline}${drawMoneyline !== undefined ? `, Draw: ${drawMoneyline}` : ''}`);
      } else {
        // No moneyline found - log for troubleshooting
        console.error(`  ❌ No moneyline prices found for [${gameName}]`);
        console.error(`     Checked ${game.bookmakers?.length || 0} bookmakers`);
        // Values remain as '-' from initialization above
      }
      
      // 7. COMBAT SPORTS ONLY: Extract method of victory (h2h_method)
      let methodOfVictory = undefined;
      if (isCombat) {
        const methodResult = findBookmakerWithMarket(game.bookmakers, 'h2h_method', homeTeam, awayTeam);
        if (methodResult) {
          const { market: methodMarket } = methodResult;
          if (methodMarket.outcomes && methodMarket.outcomes.length > 0) {
            console.log(`  🥊 Method of Victory market found with ${methodMarket.outcomes.length} outcomes`);
            methodOfVictory = {};
            methodMarket.outcomes.forEach(outcome => {
              // outcome.name format examples: "Fighter Name - KO/TKO", "Fighter Name - Decision"
              const methodPrice = outcome.price > 0 ? `+${outcome.price}` : String(outcome.price);
              methodOfVictory[outcome.name] = methodPrice;
              console.log(`    ✓ ${outcome.name}: ${methodPrice}`);
            });
          }
        } else {
          console.log(`  ℹ️ No h2h_method market available for this fight`);
        }
      }
      
      // 8. COMBAT SPORTS ONLY: Extract round betting (h2h_round)
      let roundBetting = undefined;
      if (isCombat) {
        const roundResult = findBookmakerWithMarket(game.bookmakers, 'h2h_round', homeTeam, awayTeam);
        if (roundResult) {
          const { market: roundMarket } = roundResult;
          if (roundMarket.outcomes && roundMarket.outcomes.length > 0) {
            console.log(`  🥊 Round Betting market found with ${roundMarket.outcomes.length} outcomes`);
            roundBetting = {};
            roundMarket.outcomes.forEach(outcome => {
              const roundPrice = outcome.price > 0 ? `+${outcome.price}` : String(outcome.price);
              roundBetting[outcome.name] = roundPrice;
              console.log(`    ✓ ${outcome.name}: ${roundPrice}`);
            });
          }
        } else {
          console.log(`  ℹ️ No h2h_round market available for this fight`);
        }
      }
      
      // 9. COMBAT SPORTS ONLY: Extract go distance (h2h_go_distance)
      let goDistance = undefined;
      if (isCombat) {
        const distanceResult = findBookmakerWithMarket(game.bookmakers, 'h2h_go_distance', homeTeam, awayTeam);
        if (distanceResult) {
          const { market: distanceMarket } = distanceResult;
          if (distanceMarket.outcomes && distanceMarket.outcomes.length >= 2) {
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
          }
        } else {
          console.log(`  ℹ️ No h2h_go_distance market available for this fight`);
        }
      }
      
      // 10. US SPORTS: Extract Quarter and Halftime markets
      let quarterHalfMarkets = {};
      if (!isCombat && !isSoccer) {
        console.log(`  🔍 Searching for quarter/halftime markets...`);
        
        PERIOD_MARKET_CONFIG.forEach(({ key, type, period }) => {
          const result = findBookmakerWithMarket(game.bookmakers, key, homeTeam, awayTeam);
          
          if (result) {
            const { market } = result;
            
            if (type === 'moneyline') {
              // Parse moneyline (h2h) - extract price for each team
              const homeOutcome = market.outcomes.find(o => {
                if (o.name === homeTeam) return true;
                return teamsMatchHelper(o.name, homeTeam);
              });
              
              const awayOutcome = market.outcomes.find(o => {
                if (o.name === awayTeam) return true;
                return teamsMatchHelper(o.name, awayTeam);
              });
              
              if (homeOutcome && homeOutcome.price !== undefined && !isNaN(homeOutcome.price)) {
                const homeML = homeOutcome.price > 0 ? `+${homeOutcome.price}` : String(homeOutcome.price);
                quarterHalfMarkets[`${period}_homeMoneyline`] = homeML;
              }
              
              if (awayOutcome && awayOutcome.price !== undefined && !isNaN(awayOutcome.price)) {
                const awayML = awayOutcome.price > 0 ? `+${awayOutcome.price}` : String(awayOutcome.price);
                quarterHalfMarkets[`${period}_awayMoneyline`] = awayML;
              }
              
              if (homeOutcome || awayOutcome) {
                console.log(`    ✓ ${period} Moneyline: Away ${quarterHalfMarkets[`${period}_awayMoneyline`] || '-'}, Home ${quarterHalfMarkets[`${period}_homeMoneyline`] || '-'}`);
              }
            } else if (type === 'spread') {
              // Parse spread - extract point for each team
              const homeOutcome = market.outcomes.find(o => o.name === homeTeam);
              const awayOutcome = market.outcomes.find(o => o.name === awayTeam);
              
              if (homeOutcome && homeOutcome.point !== undefined && !isNaN(homeOutcome.point)) {
                const homeSpreadVal = homeOutcome.point > 0 ? `+${homeOutcome.point}` : String(homeOutcome.point);
                quarterHalfMarkets[`${period}_homeSpread`] = homeSpreadVal;
              }
              
              if (awayOutcome && awayOutcome.point !== undefined && !isNaN(awayOutcome.point)) {
                const awaySpreadVal = awayOutcome.point > 0 ? `+${awayOutcome.point}` : String(awayOutcome.point);
                quarterHalfMarkets[`${period}_awaySpread`] = awaySpreadVal;
              }
              
              if (homeOutcome || awayOutcome) {
                console.log(`    ✓ ${period} Spread: Away ${quarterHalfMarkets[`${period}_awaySpread`] || '-'}, Home ${quarterHalfMarkets[`${period}_homeSpread`] || '-'}`);
              }
            } else if (type === 'total') {
              // Parse total - extract point from Over outcome
              const overOutcome = market.outcomes.find(o => o.name === 'Over');
              
              if (overOutcome && overOutcome.point !== undefined && !isNaN(overOutcome.point)) {
                quarterHalfMarkets[`${period}_total`] = String(overOutcome.point);
                console.log(`    ✓ ${period} Total: ${quarterHalfMarkets[`${period}_total`]}`);
              }
            }
          }
        });
        
        const foundCount = Object.keys(quarterHalfMarkets).length;
        if (foundCount > 0) {
          console.log(`  ✅ Found ${foundCount} quarter/halftime market values`);
        } else {
          console.log(`  ℹ️ No quarter/halftime markets available for this game`);
        }
      }
      
      // 11. Assemble final odds object for this game
      // Use ID-based key for consistent lookups
      const gameKey = `${homeTeamId}|${awayTeamId}`;
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
      
      // Add quarter/halftime markets for US sports
      if (!isCombat && !isSoccer && Object.keys(quarterHalfMarkets).length > 0) {
        Object.assign(oddsData, quarterHalfMarkets);
      }
      
      oddsMap[gameKey] = oddsData;
      
      // ENHANCED DIAGNOSTIC LOGGING: Show which bookmaker provided each market
      const spreadBookmaker = spreadResult ? spreadResult.bookmaker.title : 'None';
      const totalBookmaker = totalResult ? totalResult.bookmaker.title : 'None';
      const h2hBookmaker = moneylineResult ? moneylineResult.bookmakerName : 'None';
      
      // Check if we have at least one valid market
      const hasAnyMarket = (awaySpread !== '-' && homeSpread !== '-') || 
                           total !== '-' || 
                           (awayMoneyline !== '-' && homeMoneyline !== '-');
      
      if (hasAnyMarket) {
        console.log(`  ✅ ${gameName}: ML via ${h2hBookmaker}, Spread via ${spreadBookmaker}, Total via ${totalBookmaker}`);
      } else {
        console.log(`  ❌ ${gameName}: No Odds API match found - checking for naming discrepancies.`);
      }
      
      // Summary log with value validation (keep existing detailed logging)
      console.log(`  📊 Final odds stored with key: "${gameKey}"`);
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

/**
 * Fetch moneyline odds from JsonOdds API
 * According to JsonOdds documentation:
 * - Endpoint: https://jsonodds.com/api/odds/{sport}
 * - Authentication: x-api-key header
 * - Data structure: matches array, each with Odds array
 * - Moneyline fields: MoneyLineHome, MoneyLineAway (directly on odds object)
 * 
 * @param {string} sport - Sport name (e.g., 'NFL', 'NBA')
 * @param {boolean} forceRefresh - Skip cache if true
 * @returns {object} - Map of game keys to moneyline data { awayMoneyline, homeMoneyline }
 */
const fetchMoneylineFromJsonOdds = async (sport, forceRefresh = false, oddType = null) => {
  try {
    // CRITICAL: Check hard stop first - prevent any API calls if quota exhausted
    if (apiQuotaRef.current.hardStop) {
      console.error('🛑 HARD STOP: API quota exhausted. Skipping JsonOdds call.');
      return null;
    }
    
    const sportKey = JSON_ODDS_SPORT_KEYS[sport];
    if (!sportKey) {
      console.warn(`⚠️ No JsonOdds sport key for: ${sport}`);
      return null;
    }
    
    // Validate API key
    if (!JSON_ODDS_API_KEY || JSON_ODDS_API_KEY === 'undefined') {
      console.error('❌ Error: REACT_APP_JSON_ODDS_API_KEY is not defined in .env');
      return null;
    }
    
    // Check cache first (cache key includes oddType if specified)
    const cacheKey = oddType ? `${sport}_${oddType}` : sport;
    if (!forceRefresh && jsonOddsCache[cacheKey]) {
      const cached = jsonOddsCache[cacheKey];
      if (Date.now() - cached.timestamp < JSON_ODDS_CACHE_DURATION) {
        console.log(`✅ Using cached JsonOdds data for ${sport}${oddType ? ` (${oddType})` : ''}`);
        return cached.data;
      }
    }
    
    // Build JsonOdds API URL using Vercel proxy
    // Proxy rewrites /api/jsonodds/* to https://jsonodds.com/api/*
    let url = `/api/jsonodds/odds/${sportKey}`;
    if (oddType) {
      url += `?oddType=${oddType}`;
    }
    
    console.log(`🎰 Fetching moneylines from JsonOdds for ${sport}${oddType ? ` (${oddType})` : ''}...`);
    console.log(`📡 URL: ${url} (via proxy)`);
    
    const response = await fetch(url, {
      headers: {
        'x-api-key': JSON_ODDS_API_KEY
      }
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        console.error(`❌ 401 UNAUTHORIZED: Invalid JsonOdds API key`);
      } else if (response.status === 429) {
        console.error(`❌ 429 RATE LIMIT: Too many requests to JsonOdds`);
      } else if (response.status === 404) {
        console.error(`❌ 404 NOT FOUND: Sport key "${sportKey}" may not be valid`);
      } else {
        console.error(`❌ JsonOdds returned ${response.status}: ${response.statusText}`);
      }
      return null;
    }
    
    const data = await response.json();
    console.log(`✅ JsonOdds response received for ${sport}`);
    
    // Validate response structure
    if (!data || typeof data !== 'object') {
      console.error('❌ JsonOdds returned invalid data structure');
      return null;
    }
    
    // Extract matches array - handle both direct array and wrapped object
    let matches = [];
    if (Array.isArray(data)) {
      matches = data;
    } else if (data.matches && Array.isArray(data.matches)) {
      matches = data.matches;
    } else {
      console.error('❌ JsonOdds response missing matches array');
      console.log('Response structure:', Object.keys(data));
      return null;
    }
    
    console.log(`📊 JsonOdds returned ${matches.length} matches for ${sport}`);
    
    // Build moneyline map using same key format as Odds API
    const moneylineMap = {};
    
    matches.forEach((match, idx) => {
      const homeTeam = match.HomeTeam;
      const awayTeam = match.AwayTeam;
      
      if (!homeTeam || !awayTeam) {
        console.warn(`  ⚠️ Match ${idx + 1} missing team names`);
        return;
      }
      
      console.log(`\n🎮 JsonOdds Match ${idx + 1}: ${awayTeam} @ ${homeTeam}`);
      
      // Normalize team names to ESPN IDs for consistent keying
      const homeTeamId = getStandardId(homeTeam);
      const awayTeamId = getStandardId(awayTeam);
      
      // Check if we can normalize both teams to IDs
      if (!homeTeamId || !awayTeamId) {
        console.warn(`  ⚠️ Cannot normalize team names to IDs: Away="${awayTeam}" (ID: ${awayTeamId}), Home="${homeTeam}" (ID: ${homeTeamId})`);
        return; // Skip this game if we can't normalize
      }
      
      console.log(`   🆔 Normalized IDs: Away=${awayTeamId}, Home=${homeTeamId}`);
      
      // Check if Odds array exists
      if (!match.Odds || !Array.isArray(match.Odds) || match.Odds.length === 0) {
        console.warn(`  ⚠️ No odds data available`);
        return;
      }
      
      console.log(`  📊 Found ${match.Odds.length} odds provider(s)`);
      
      // Extract moneyline from first available odds provider
      // Loop through all providers to find valid moneyline data
      let homeMoneyline = null;
      let awayMoneyline = null;
      
      for (let i = 0; i < match.Odds.length; i++) {
        const odd = match.Odds[i];
        
        // CRITICAL: Convert to string as per user instruction
        // JsonOdds returns numeric values, we need strings for consistency
        if (odd.MoneyLineHome !== undefined && odd.MoneyLineHome !== null) {
          const mlHome = parseInt(odd.MoneyLineHome);
          if (!isNaN(mlHome) && mlHome >= -10000 && mlHome <= 10000) {
            homeMoneyline = String(odd.MoneyLineHome);
            if (mlHome > 0 && !homeMoneyline.startsWith('+')) {
              homeMoneyline = '+' + homeMoneyline;
            }
          }
        }
        
        if (odd.MoneyLineAway !== undefined && odd.MoneyLineAway !== null) {
          const mlAway = parseInt(odd.MoneyLineAway);
          if (!isNaN(mlAway) && mlAway >= -10000 && mlAway <= 10000) {
            awayMoneyline = String(odd.MoneyLineAway);
            if (mlAway > 0 && !awayMoneyline.startsWith('+')) {
              awayMoneyline = '+' + awayMoneyline;
            }
          }
        }
        
        // If we found both moneylines, stop searching
        if (homeMoneyline && awayMoneyline) {
          console.log(`  ✅ Moneylines from provider ${i + 1}: Away ${awayMoneyline}, Home ${homeMoneyline}`);
          break;
        }
      }
      
      // Store moneyline data using ID-based key for consistent matching
      const gameKey = `${homeTeamId}|${awayTeamId}`;
      moneylineMap[gameKey] = {
        awayMoneyline: awayMoneyline || '-',
        homeMoneyline: homeMoneyline || '-'
      };
      
      console.log(`  📋 Stored with ID-based key: "${gameKey}"`);
      console.log(`     Original teams: ${awayTeam} @ ${homeTeam}`);
      console.log(`     Normalized IDs: Away=${awayTeamId}, Home=${homeTeamId}`);
      console.log(`     Away ML: ${moneylineMap[gameKey].awayMoneyline}`);
      console.log(`     Home ML: ${moneylineMap[gameKey].homeMoneyline}`);
    });
    
    console.log(`\n🎉 JsonOdds parsing complete: ${Object.keys(moneylineMap).length} games with moneyline data`);
    
    if (DEBUG_JSONODDS_FLOW) {
      console.log(`📦 RETURNING MONEYLINE MAP with keys:`, Object.keys(moneylineMap));
    }
    
    // Cache the results using the cacheKey variable defined at the beginning of the function
    jsonOddsCache[cacheKey] = {
      data: moneylineMap,
      timestamp: Date.now()
    };
    
    return moneylineMap;
    
  } catch (error) {
    console.error(`\n❌ EXCEPTION in fetchMoneylineFromJsonOdds for ${sport}:`);
    console.error(`Error type: ${error.name}`);
    console.error(`Error message: ${error.message}`);
    console.error('Stack trace:', error.stack);
    return null;
  }
};

/**
 * fetchAllPeriodOdds - Fetch moneylines for all period types in parallel
 * Fetches Game, FirstHalf, and FirstQuarter odds from JsonOdds API
 * 
 * Used by the game enrichment logic to fetch period-specific odds.
 * 
 * @param {string} sport - Sport name (e.g., 'NFL', 'NBA')
 * @returns {object} - Object with period keys: { Game: {...}, FirstHalf: {...}, FirstQuarter: {...} }
 */
const fetchAllPeriodOdds = async (sport) => {
  try {
    // Only fetch period odds for US sports that have quarters/halves
    const isSoccer = sport === 'World Cup' || sport === 'MLS';
    const isCombat = sport === 'Boxing' || sport === 'UFC';
    
    if (isSoccer || isCombat) {
      // For soccer and combat, only fetch Game odds
      const gameOdds = await fetchMoneylineFromJsonOdds(sport, false, null);
      return gameOdds ? { Game: gameOdds } : {};
    }
    
    // For other sports, fetch all period types in parallel
    const periods = ['Game', 'FirstHalf', 'FirstQuarter'];
    const results = {};
    
    const fetchPromises = periods.map(async (oddType) => {
      const data = await fetchMoneylineFromJsonOdds(sport, false, oddType === 'Game' ? null : oddType);
      return { oddType, data };
    });
    
    const responses = await Promise.all(fetchPromises);
    
    responses.forEach(({ oddType, data }) => {
      if (data && Object.keys(data).length > 0) {
        results[oddType] = data;
        console.log(`✅ Period odds fetched for ${oddType}: ${Object.keys(data).length} games`);
      }
    });
    
    return results;
  } catch (error) {
    console.error(`❌ Error fetching period odds for ${sport}:`, error);
    return {};
  }
};

/**
 * fetchDetailedOdds - Fetch period-specific odds for a single event
 * Uses The Odds API per-event endpoint to get quarter/half odds
 * 
 * TODO: Wire this up as a fallback mechanism when the bulk endpoint doesn't
 * return quarter/half odds for specific events. The bulk endpoint already
 * requests these markets, but this per-event fetcher can provide more reliable
 * results on a game-by-game basis. Potential use cases:
 * - Refresh button for individual game's quarter/half odds
 * - Fallback when bulk endpoint returns incomplete period data
 * - On-demand fetching when user selects a period filter
 * 
 * @param {string} sport - Sport name (e.g., 'NFL', 'NBA')
 * @param {string} eventId - The Odds API event ID
 * @returns {object} - Quarter/half odds fields (Q1_homeMoneyline, H1_total, etc.)
 */
// eslint-disable-next-line no-unused-vars
const fetchDetailedOdds = async (sport, eventId) => {
  try {
    // CRITICAL: Check hard stop first
    if (apiQuotaRef.current.hardStop) {
      console.error('🛑 HARD STOP: API quota exhausted. Cannot fetch detailed odds.');
      return null;
    }
    
    const sportKey = ODDS_API_SPORT_KEYS[sport];
    if (!sportKey) {
      console.warn(`⚠️ No Odds API sport key for: ${sport}`);
      return null;
    }
    
    // Only fetch period odds for US sports (not soccer, not combat)
    const isSoccer = sport === 'World Cup' || sport === 'MLS';
    const isCombat = sport === 'Boxing' || sport === 'UFC';
    
    if (isSoccer || isCombat) {
      console.log(`ℹ️ Skipping detailed odds for ${sport} (not applicable)`);
      return null;
    }
    
    // CRITICAL: Validate API key
    if (!ODDS_API_KEY || ODDS_API_KEY === 'undefined') {
      console.error('❌ Error: REACT_APP_THE_ODDS_API_KEY is not defined');
      return null;
    }
    
    // Request quarter and halftime markets
    const markets = 'h2h_q1,h2h_q2,h2h_q3,h2h_q4,h2h_h1,h2h_h2,spreads_q1,spreads_q2,spreads_q3,spreads_q4,spreads_h1,spreads_h2,totals_q1,totals_q2,totals_q3,totals_q4,totals_h1,totals_h2';
    
    // Use per-event endpoint with american format and source IDs
    const url = `${ODDS_API_BASE_URL}/sports/${sportKey}/events/${eventId}/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=${markets}&oddsFormat=american&includeSids=true`;
    
    console.log(`🔍 Fetching detailed odds for event ${eventId}...`);
    const response = await fetch(url);
    
    // Monitor quota
    const quotaRemaining = response.headers.get('x-requests-remaining');
    if (quotaRemaining !== null) {
      const remaining = parseInt(quotaRemaining) || 0;
      apiQuotaRef.current.remaining = remaining;
      setApiQuotaInfo(prev => ({ ...prev, remaining }));
      
      if (remaining < 10) {
        console.error('🚨 API quota below 10! Activating HARD STOP.');
        apiQuotaRef.current.hardStop = true;
        setApiQuotaInfo(prev => ({ ...prev, hardStop: true }));
        return null;
      }
    }
    
    if (!response.ok) {
      console.error(`❌ Detailed odds fetch failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.bookmakers || data.bookmakers.length === 0) {
      console.log(`ℹ️ No bookmakers found for event ${eventId}`);
      return null;
    }
    
    const quarterHalfOdds = {};
    
    // Find priority bookmaker
    const bookmaker = findBookmakerWithMarket(data.bookmakers, 'h2h_q1', data.home_team, data.away_team)?.bookmaker || data.bookmakers[0];
    
    if (!bookmaker || !bookmaker.markets) {
      console.log(`ℹ️ No markets in bookmaker for event ${eventId}`);
      return null;
    }
    
    console.log(`📊 Processing ${bookmaker.markets.length} period markets for ${data.away_team} @ ${data.home_team}`);
    
    // Parse each period market
    PERIOD_MARKET_CONFIG.forEach(({ key, type, period }) => {
      const market = bookmaker.markets.find(m => m.key === key);
      
      if (!market || !market.outcomes) return;
      
      if (type === 'moneyline') {
        // Parse h2h (moneyline) - use price field
        const homeOutcome = market.outcomes.find(o => teamsMatchHelper(o.name, data.home_team).match);
        const awayOutcome = market.outcomes.find(o => teamsMatchHelper(o.name, data.away_team).match);
        
        if (homeOutcome && homeOutcome.price !== undefined) {
          quarterHalfOdds[`${period}_homeMoneyline`] = homeOutcome.price > 0 ? `+${homeOutcome.price}` : String(homeOutcome.price);
        }
        
        if (awayOutcome && awayOutcome.price !== undefined) {
          quarterHalfOdds[`${period}_awayMoneyline`] = awayOutcome.price > 0 ? `+${awayOutcome.price}` : String(awayOutcome.price);
        }
      } else if (type === 'spread') {
        // Parse spreads - use point field
        const homeOutcome = market.outcomes.find(o => teamsMatchHelper(o.name, data.home_team).match);
        const awayOutcome = market.outcomes.find(o => teamsMatchHelper(o.name, data.away_team).match);
        
        if (homeOutcome && homeOutcome.point !== undefined) {
          quarterHalfOdds[`${period}_homeSpread`] = homeOutcome.point > 0 ? `+${homeOutcome.point}` : String(homeOutcome.point);
        }
        
        if (awayOutcome && awayOutcome.point !== undefined) {
          quarterHalfOdds[`${period}_awaySpread`] = awayOutcome.point > 0 ? `+${awayOutcome.point}` : String(awayOutcome.point);
        }
      } else if (type === 'total') {
        // Parse totals - use point field from Over outcome
        const overOutcome = market.outcomes.find(o => o.name === 'Over');
        
        if (overOutcome && overOutcome.point !== undefined) {
          quarterHalfOdds[`${period}_total`] = String(overOutcome.point);
        }
      }
    });
    
    const foundCount = Object.keys(quarterHalfOdds).length;
    if (foundCount > 0) {
      console.log(`✅ Fetched ${foundCount} quarter/half odds for event ${eventId}`);
    } else {
      console.log(`ℹ️ No quarter/half odds available for event ${eventId}`);
    }
    
    return quarterHalfOdds;
    
  } catch (error) {
    console.error(`❌ Error fetching detailed odds for event ${eventId}:`, error);
    return null;
  }
};

  // Helper function for ID-based odds matching
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
      return defaultOdds;
    }
    
    // Use ID-based lookup for consistent matching
    // Game object already has awayTeamId and homeTeamId from ESPN data
    if (!game.homeTeamId || !game.awayTeamId) {
      console.log(`[${game.awayTeam} @ ${game.homeTeam}] -> ML: No | Spread: No | Total: No | Match Method: Missing Team IDs`);
      return defaultOdds;
    }
    
    const gameKey = `${game.homeTeamId}|${game.awayTeamId}`;
    
    if (oddsMap[gameKey]) {
      const odds = oddsMap[gameKey];
      // Concise diagnostic log
      console.log(`[${game.awayTeam} @ ${game.homeTeam}] (IDs: ${game.awayTeamId}|${game.homeTeamId}) -> ML: ${odds.awayMoneyline !== '-' ? 'Yes' : 'No'} | Spread: ${odds.awaySpread !== '-' ? 'Yes' : 'No'} | Total: ${odds.total !== '-' ? 'Yes' : 'No'} | Match Method: ID-Based`);
      return odds;
    }
    
    // No match found - return defaults with diagnostic log
    console.log(`[${game.awayTeam} @ ${game.homeTeam}] (IDs: ${game.awayTeamId}|${game.homeTeamId}) -> ML: No | Spread: No | Total: No | Match Method: None (No API data for these IDs)`);
    return defaultOdds;
  }, []);

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
      
      // FIX: Loop through ALL odds providers in ESPN data, not just the first one
      // This ensures we find moneyline data even if the first provider has taken it off the board
      console.log(`🔍 ESPN odds: Found ${competition.odds.length} odds provider(s)`);
      
      for (let i = 0; i < competition.odds.length; i++) {
        const odds = competition.odds[i];
        const providerName = odds.provider?.name || `Provider ${i}`;
        
        // Extract spreads if not already found
        if (!homeSpread && !awaySpread) {
          if (odds.spread !== undefined) {
            const spreadValue = parseFloat(odds.spread);
            if (!isNaN(spreadValue) && Math.abs(spreadValue) < 50) {
              homeSpread = spreadValue > 0 ? `+${spreadValue}` : String(spreadValue);
              awaySpread = spreadValue > 0 ? String(-spreadValue) : `+${-spreadValue}`;
              console.log(`  ✓ Spreads from ${providerName}: ${awaySpread}/${homeSpread}`);
            }
          }
          
          if (!homeSpread && !awaySpread && (odds.homeTeamOdds || odds.awayTeamOdds)) {
            const homeSpreadValue = odds.homeTeamOdds?.line || odds.homeTeamOdds?.point || odds.homeTeamOdds?.spread;
            const awaySpreadValue = odds.awayTeamOdds?.line || odds.awayTeamOdds?.point || odds.awayTeamOdds?.spread;
            
            if (homeSpreadValue !== undefined && Math.abs(homeSpreadValue) < 50) {
              homeSpread = homeSpreadValue > 0 ? `+${homeSpreadValue}` : String(homeSpreadValue);
              console.log(`  ✓ Home spread from ${providerName}: ${homeSpread}`);
            }
            
            if (awaySpreadValue !== undefined && Math.abs(awaySpreadValue) < 50) {
              awaySpread = awaySpreadValue > 0 ? `+${awaySpreadValue}` : String(awaySpreadValue);
              console.log(`  ✓ Away spread from ${providerName}: ${awaySpread}`);
            }
          }
        }
        
        // Extract total if not already found
        if (!total) {
          if (odds.overUnder !== undefined) {
            if (odds.overUnder > 30 && odds.overUnder < 300) {
              total = String(odds.overUnder);
              console.log(`  ✓ Total from ${providerName}: ${total}`);
            }
          } else if (odds.total !== undefined) {
            if (odds.total > 30 && odds.total < 300) {
              total = String(odds.total);
              console.log(`  ✓ Total from ${providerName}: ${total}`);
            }
          }
        }
        
        // Extract moneylines if not already found - PRIORITY FIX
        if (!homeMoneyline && odds.homeTeamOdds?.moneyLine !== undefined) {
          const ml = parseInt(odds.homeTeamOdds.moneyLine);
          if (!isNaN(ml) && ml >= -10000 && ml <= 10000) {
            homeMoneyline = ml > 0 ? `+${ml}` : String(ml);
            console.log(`  ✅ Home moneyline from ${providerName}: ${homeMoneyline}`);
          }
        }
        
        if (!awayMoneyline && odds.awayTeamOdds?.moneyLine !== undefined) {
          const ml = parseInt(odds.awayTeamOdds.moneyLine);
          if (!isNaN(ml) && ml >= -10000 && ml <= 10000) {
            awayMoneyline = ml > 0 ? `+${ml}` : String(ml);
            console.log(`  ✅ Away moneyline from ${providerName}: ${awayMoneyline}`);
          }
        }
        
        // Fallback to price field for moneylines
        if (!homeMoneyline && odds.homeTeamOdds?.price !== undefined) {
          const price = parseInt(odds.homeTeamOdds.price);
          if (!isNaN(price) && price >= -10000 && price <= 10000) {
            homeMoneyline = price > 0 ? `+${price}` : String(price);
            console.log(`  ✅ Home moneyline (price) from ${providerName}: ${homeMoneyline}`);
          }
        }
        
        if (!awayMoneyline && odds.awayTeamOdds?.price !== undefined) {
          const price = parseInt(odds.awayTeamOdds.price);
          if (!isNaN(price) && price >= -10000 && price <= 10000) {
            awayMoneyline = price > 0 ? `+${price}` : String(price);
            console.log(`  ✅ Away moneyline (price) from ${providerName}: ${awayMoneyline}`);
          }
        }
        
        // If we've found all odds data, no need to check more providers
        if (awaySpread && homeSpread && total && awayMoneyline && homeMoneyline) {
          console.log(`  ✓ All odds found from ESPN providers, stopping search`);
          break;
        }
      }
      
    } catch (error) {
      console.error('❌ Error parsing odds:', error);
    }
    
    return { awaySpread, homeSpread, total, awayMoneyline, homeMoneyline };
  }, []);

  const setupFirebaseListener = useCallback((sport) => {
    try {
      const firebasePath = `spreads/${sport}`;
      console.log(`🔥 Firebase Listener Path: ${firebasePath}`);
      
      const spreadsRef = ref(database, firebasePath);
      onValue(spreadsRef, (snapshot) => {
        if (snapshot.exists()) {
          const firebaseData = snapshot.val();
          console.log(`📥 Firebase data received for ${sport}:`, Object.keys(firebaseData).length, 'games');
          
          setGames(prevGames => {
            let updated = false;
            const newGames = prevGames.map(game => {
              const espnId = game.espnId;
              let fbGame = firebaseData[espnId];
              
              // NFL FALLBACK: Check root path if not found in sport-specific path
              // This supports backward compatibility with orphaned data
              if (!fbGame && sport === 'NFL') {
                console.log(`  🔍 NFL game ${espnId} not found at ${firebasePath}/${espnId}, checking root fallback...`);
                // Note: We can't directly read from root in this listener, but the migration
                // script should handle moving data. This is just a log for debugging.
              }
              
              if (fbGame) {
                // Log what we're receiving from Firebase
                console.log(`  🔍 Syncing game ${espnId}:`, {
                  awayML: fbGame.awayMoneyline,
                  homeML: fbGame.homeMoneyline,
                  Q1_homeML: fbGame.Q1_homeMoneyline,
                  H1_homeML: fbGame.H1_homeMoneyline
                });
                
                const awaySpreadChanged = game.awaySpread !== fbGame.awaySpread;
                const homeSpreadChanged = game.homeSpread !== fbGame.homeSpread;
                const awayMoneylineChanged = game.awayMoneyline !== fbGame.awayMoneyline;
                const homeMoneylineChanged = game.homeMoneyline !== fbGame.homeMoneyline;
                const totalChanged = game.total !== fbGame.total;
                const changed = awaySpreadChanged || homeSpreadChanged || totalChanged || awayMoneylineChanged || homeMoneylineChanged;

                if (changed) {
                  updated = true;
                  console.log(`  ✅ Game ${espnId} updated from Firebase`);
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
                
                // Build updated game object with all fields from Firebase
                // CRITICAL: Use spread operator to trigger React re-render
                const updatedGame = {
                  ...game,
                  awaySpread: fbGame.awaySpread || game.awaySpread || '',
                  homeSpread: fbGame.homeSpread || game.homeSpread || '',
                  awayMoneyline: fbGame.awayMoneyline || game.awayMoneyline || '',
                  homeMoneyline: fbGame.homeMoneyline || game.homeMoneyline || '',
                  total: fbGame.total || game.total || '',
                  isManual: fbGame.isManual || false // Preserve manual override flag
                };
                
                // Add quarter/halftime fields if present in Firebase
                const quarterHalfKeys = [
                  'Q1_homeMoneyline', 'Q1_awayMoneyline', 'Q1_homeSpread', 'Q1_awaySpread', 'Q1_total',
                  'Q2_homeMoneyline', 'Q2_awayMoneyline', 'Q2_homeSpread', 'Q2_awaySpread', 'Q2_total',
                  'Q3_homeMoneyline', 'Q3_awayMoneyline', 'Q3_homeSpread', 'Q3_awaySpread', 'Q3_total',
                  'Q4_homeMoneyline', 'Q4_awayMoneyline', 'Q4_homeSpread', 'Q4_awaySpread', 'Q4_total',
                  'H1_homeMoneyline', 'H1_awayMoneyline', 'H1_homeSpread', 'H1_awaySpread', 'H1_total',
                  'H2_homeMoneyline', 'H2_awayMoneyline', 'H2_homeSpread', 'H2_awaySpread', 'H2_total'
                ];
                
                quarterHalfKeys.forEach(key => {
                  if (fbGame[key] !== undefined && fbGame[key] !== null && fbGame[key] !== '') {
                    updatedGame[key] = fbGame[key];
                  }
                });
                
                return updatedGame;
              }
              return game;
            });
            
            if (updated) {
              setIsSyncing(false);
              console.log(`  ✅ State updated with new Firebase data`);
            }
            
            // Update cache
            if (gameCache[sport]) {
              gameCache[sport].data = newGames;
            }
            
            return newGames;
          });
        } else {
          console.log(`ℹ️ No Firebase data found at path: ${firebasePath}`);
          
          // NFL FALLBACK: If no data at sport path, check root for orphaned data
          // This is a one-time operation that runs when listener finds no data at /spreads/NFL
          // The migration script will move orphaned data to proper location, making this temporary
          if (sport === 'NFL') {
            console.log(`  🔍 Checking for orphaned NFL data at root...`);
            const rootRef = ref(database, 'spreads');
            get(rootRef).then(rootSnapshot => {
              if (rootSnapshot.exists()) {
                const rootData = rootSnapshot.val();
                const orphanedGames = {};
                
                // Find numeric IDs at root (orphaned games)
                Object.keys(rootData).forEach(key => {
                  if (/^\d+$/.test(key)) {
                    orphanedGames[key] = rootData[key];
                  }
                });
                
                if (Object.keys(orphanedGames).length > 0) {
                  console.log(`  ⚠️ Found ${Object.keys(orphanedGames).length} orphaned NFL games at root`);
                  console.log(`  ℹ️ Migration script should move these to ${firebasePath}`);
                  
                  // Apply orphaned data to games temporarily (one-time operation)
                  // This setGames call only happens once per app load when orphaned data exists
                  setGames(prevGames => {
                    return prevGames.map(game => {
                      if (orphanedGames[game.espnId]) {
                        const fbGame = orphanedGames[game.espnId];
                        console.log(`  📥 Applying orphaned data for game ${game.espnId}`);
                        return {
                          ...game,
                          awaySpread: fbGame.awaySpread || game.awaySpread || '',
                          homeSpread: fbGame.homeSpread || game.homeSpread || '',
                          awayMoneyline: fbGame.awayMoneyline || game.awayMoneyline || '',
                          homeMoneyline: fbGame.homeMoneyline || game.homeMoneyline || '',
                          total: fbGame.total || game.total || ''
                        };
                      }
                      return game;
                    });
                  });
                }
              }
            }).catch(error => {
              console.error('  ❌ Error checking for orphaned NFL data:', error);
            });
          }
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
        
        // CORS FIX: Use server-side proxy for Boxing/UFC to avoid CORS errors
        const isCombatSport = sport === 'Boxing' || sport === 'UFC';
        let responses;
        
        if (isCombatSport) {
          // Use server-side proxy for combat sports
          const dates = [0, 1, 2, 3, 4, 5, 6, 7].join(',');
          const proxyUrl = `/api/wager-manager?action=getESPN&sport=${sport}&dates=${dates}`;
          
          console.log(`🥊 Using server proxy for ${sport} to avoid CORS`);
          
          try {
            const proxyResponse = await fetch(proxyUrl);
            if (proxyResponse.ok) {
              const proxyData = await proxyResponse.json();
              if (proxyData.success && proxyData.events) {
                // Convert to ESPN scoreboard format
                responses = [{
                  ok: true,
                  json: async () => ({ events: proxyData.events })
                }];
              } else {
                responses = [];
              }
            } else {
              responses = [];
            }
          } catch (err) {
            console.error(`Error fetching ${sport} via proxy:`, err);
            responses = [];
          }
        } else {
          // Direct ESPN API calls for non-combat sports
          const dateURLs = getESPNDateRangeURLs(apiEndpoint);
          
          apiCallCount.total += dateURLs.length;
          apiCallCount.byEndpoint[sport] = (apiCallCount.byEndpoint[sport] || 0) + dateURLs.length;
          
          responses = await Promise.all(
            dateURLs.map(url => fetch(url).catch(err => null))
          );
        }
        
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
            awayTeamId: awayTeam.team.id,
            homeTeamId: homeTeam.team.id,
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
            // STEP 1: Fetch spreads and totals from The Odds API
            const oddsMap = await fetchOddsFromTheOddsAPI(sport);
            
            // STEP 2: Fetch moneylines from JsonOdds (PRIMARY SOURCE for ML)
            // Now fetching Game, FirstHalf, and FirstQuarter odds
            const jsonOddsPeriodData = await fetchAllPeriodOdds(sport);
            const jsonOddsMoneylines = jsonOddsPeriodData?.Game || null;
            const jsonOddsFirstHalf = jsonOddsPeriodData?.FirstHalf || null;
            const jsonOddsFirstQuarter = jsonOddsPeriodData?.FirstQuarter || null;
            
            if (DEBUG_JSONODDS_FLOW) {
              console.log(`\n📦 JsonOdds data received for ${sport}:`, {
                hasGameOdds: !!jsonOddsMoneylines,
                gameCount: jsonOddsMoneylines ? Object.keys(jsonOddsMoneylines).length : 0,
                gameKeys: jsonOddsMoneylines ? Object.keys(jsonOddsMoneylines) : []
              });
            }
            
            if (oddsMap || jsonOddsMoneylines) {
              const finalFormattedGames = formattedGames.map(game => {
                if (hasCompleteOddsData(game)) return game;
                
                // Log when ESPN is missing moneyline data
                if (!game.awayMoneyline || !game.homeMoneyline) {
                  console.log(`📞 ESPN missing moneyline for ${game.awayTeam} @ ${game.homeTeam}`);
                }
                
                // First, get spreads and totals from The Odds API
                const odds = oddsMap ? matchOddsToGame(game, oddsMap) : {};
                
                // Then, overlay JsonOdds moneylines (PRIORITY OVERRIDE)
                let jsonOddsML = null;
                if (jsonOddsMoneylines) {
                  // Use ID-based lookup for consistent matching
                  if (game.homeTeamId && game.awayTeamId) {
                    const gameKey = `${game.homeTeamId}|${game.awayTeamId}`;
                    jsonOddsML = jsonOddsMoneylines[gameKey];
                    
                    if (DEBUG_JSONODDS_FLOW) {
                      console.log(`🔍 Looking up JsonOdds for ID-based key: "${gameKey}"`, {
                        originalTeams: `${game.awayTeam} @ ${game.homeTeam}`,
                        teamIds: `Away=${game.awayTeamId}, Home=${game.homeTeamId}`,
                        found: !!jsonOddsML,
                        data: jsonOddsML || 'NOT FOUND'
                      });
                    }
                  } else {
                    if (DEBUG_JSONODDS_FLOW) {
                      console.log(`⚠️ Missing team IDs for ${game.awayTeam} @ ${game.homeTeam}, cannot lookup JsonOdds`);
                    }
                  }
                }
                
                // Build updated game object with layered data:
                // 1. Base game data (ESPN)
                // 2. The Odds API (spreads, totals, fallback moneyline)
                // 3. JsonOdds (moneyline OVERRIDE)
                const updatedGame = {
                  ...game,
                  // Spreads and totals from The Odds API
                  awaySpread: odds.awaySpread || game.awaySpread,
                  homeSpread: odds.homeSpread || game.homeSpread,
                  total: odds.total || game.total,
                  // Moneyline PRIORITY: JsonOdds > The Odds API > ESPN
                  awayMoneyline: (jsonOddsML && jsonOddsML.awayMoneyline !== '-') ? jsonOddsML.awayMoneyline : (odds.awayMoneyline || game.awayMoneyline),
                  homeMoneyline: (jsonOddsML && jsonOddsML.homeMoneyline !== '-') ? jsonOddsML.homeMoneyline : (odds.homeMoneyline || game.homeMoneyline),
                  oddsApiEventId: odds.oddsApiEventId
                };
                
                if (DEBUG_JSONODDS_FLOW) {
                  const source = jsonOddsML ? 'JsonOdds' : (odds.awayMoneyline ? 'OddsAPI' : 'ESPN');
                  console.log(`📋 Final game object for ${game.awayTeam} @ ${game.homeTeam}:`, {
                    awayMoneyline: updatedGame.awayMoneyline,
                    homeMoneyline: updatedGame.homeMoneyline,
                    source: source
                  });
                  
                  // Log fallback chain
                  if (!jsonOddsML && !odds.awayMoneyline && !game.awayMoneyline) {
                    console.warn(`    ⚠️ No moneyline data found from any source (will display as "-")`);
                  } else if (!jsonOddsML && odds.awayMoneyline) {
                    console.log(`    ℹ️ Using The Odds API moneyline as fallback (JsonOdds not available)`);
                  } else if (!jsonOddsML && !odds.awayMoneyline && game.awayMoneyline) {
                    console.log(`    ℹ️ Using ESPN moneyline as fallback (JsonOdds and Odds API not available)`);
                  }
                }
                
                // Log source of moneyline data
                if (jsonOddsML && jsonOddsML.awayMoneyline !== '-') {
                  console.log(`✅ Applied JsonOdds moneyline: ${game.awayTeam} ${updatedGame.awayMoneyline}, ${game.homeTeam} ${updatedGame.homeMoneyline}`);
                } else if (odds.awayMoneyline && !game.awayMoneyline) {
                  console.log(`✅ Applied Odds API moneyline fallback: ${game.awayTeam} ${odds.awayMoneyline}`);
                }
                
                // Add draw moneyline for soccer sports
                if (odds.drawMoneyline !== undefined) {
                  updatedGame.drawMoneyline = odds.drawMoneyline;
                }
                
                // Add quarter/halftime markets if available
                const quarterHalfKeys = [
                  'Q1_homeMoneyline', 'Q1_awayMoneyline', 'Q1_homeSpread', 'Q1_awaySpread', 'Q1_total',
                  'Q2_homeMoneyline', 'Q2_awayMoneyline', 'Q2_homeSpread', 'Q2_awaySpread', 'Q2_total',
                  'Q3_homeMoneyline', 'Q3_awayMoneyline', 'Q3_homeSpread', 'Q3_awaySpread', 'Q3_total',
                  'Q4_homeMoneyline', 'Q4_awayMoneyline', 'Q4_homeSpread', 'Q4_awaySpread', 'Q4_total',
                  'H1_homeMoneyline', 'H1_awayMoneyline', 'H1_homeSpread', 'H1_awaySpread', 'H1_total',
                  'H2_homeMoneyline', 'H2_awayMoneyline', 'H2_homeSpread', 'H2_awaySpread', 'H2_total'
                ];
                
                quarterHalfKeys.forEach(key => {
                  if (odds[key] !== undefined) {
                    updatedGame[key] = odds[key];
                  }
                });
                
                // Apply JsonOdds FirstHalf and FirstQuarter moneylines (OVERRIDE)
                // Use ID-based lookup for consistent matching
                
                // Apply FirstHalf odds (H1_)
                if (jsonOddsFirstHalf && game.homeTeamId && game.awayTeamId) {
                  const gameKey = `${game.homeTeamId}|${game.awayTeamId}`;
                  const firstHalfOdds = jsonOddsFirstHalf[gameKey];
                  if (firstHalfOdds) {
                    if (firstHalfOdds.awayMoneyline && firstHalfOdds.awayMoneyline !== '-') {
                      updatedGame.H1_awayMoneyline = firstHalfOdds.awayMoneyline;
                    }
                    if (firstHalfOdds.homeMoneyline && firstHalfOdds.homeMoneyline !== '-') {
                      updatedGame.H1_homeMoneyline = firstHalfOdds.homeMoneyline;
                    }
                  }
                }
                
                // Apply FirstQuarter odds (Q1_)
                if (jsonOddsFirstQuarter && game.homeTeamId && game.awayTeamId) {
                  const gameKey = `${game.homeTeamId}|${game.awayTeamId}`;
                  const firstQuarterOdds = jsonOddsFirstQuarter[gameKey];
                  if (firstQuarterOdds) {
                    if (firstQuarterOdds.awayMoneyline && firstQuarterOdds.awayMoneyline !== '-') {
                      updatedGame.Q1_awayMoneyline = firstQuarterOdds.awayMoneyline;
                    }
                    if (firstQuarterOdds.homeMoneyline && firstQuarterOdds.homeMoneyline !== '-') {
                      updatedGame.Q1_homeMoneyline = firstQuarterOdds.homeMoneyline;
                    }
                  }
                }
                
                return updatedGame;
              });
              
              console.log(`\n✅ Processed ${finalFormattedGames.length} games for ${sport} with JsonOdds/OddsAPI data`);
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
    
    if (DEBUG_JSONODDS_FLOW) {
      console.log(`\n🏁 Setting allSportsGames state with data for ${Object.keys(sportsData).length} sports`);
      Object.keys(sportsData).forEach(sport => {
        console.log(`  ${sport}: ${sportsData[sport].length} games`);
      });
    }
    
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

  // AUTO-MIGRATION: One-time check for orphaned data at /spreads root
  // Move any numeric IDs (orphaned games) into proper sport subfolders
  useEffect(() => {
    const migrateOrphanedData = async () => {
      try {
        console.log('🔍 Checking for orphaned data in Firebase /spreads root...');
        
        const spreadsRootRef = ref(database, 'spreads');
        const snapshot = await get(spreadsRootRef);
        
        if (!snapshot.exists()) {
          console.log('✅ No data at /spreads root');
          return;
        }
        
        const rootData = snapshot.val();
        const orphanedIds = [];
        
        // Find numeric IDs at root level (these are orphaned games)
        Object.keys(rootData).forEach(key => {
          // Check if key is a numeric ID (not a sport name like "NFL", "NBA")
          if (/^\d+$/.test(key)) {
            orphanedIds.push(key);
          }
        });
        
        if (orphanedIds.length === 0) {
          console.log('✅ No orphaned data found at /spreads root');
          return;
        }
        
        console.log(`⚠️ Found ${orphanedIds.length} orphaned game IDs at root:`, orphanedIds);
        
        // Migrate orphaned data to /spreads/NFL/ (default assumption)
        // In a real app, you might want to detect the sport from the game data
        const targetSport = 'NFL';
        
        for (const espnId of orphanedIds) {
          try {
            const gameData = rootData[espnId];
            
            // CRITICAL: Add timestamp to satisfy Firebase rules validation
            // Rules require either existing data or newData.hasChild('timestamp')
            if (!gameData.timestamp) {
              gameData.timestamp = new Date().toISOString();
              console.log(`  ⏰ Added timestamp to game ${espnId}`);
            }
            
            // Move to proper location
            const newPath = `spreads/${targetSport}/${espnId}`;
            console.log(`  → Migrating ${espnId} to ${newPath}`);
            
            await update(ref(database, newPath), gameData);
            
            // Delete old root entry
            await set(ref(database, `spreads/${espnId}`), null);
            
            console.log(`  ✅ Migrated ${espnId}`);
          } catch (error) {
            console.error(`  ❌ Failed to migrate ${espnId}:`, error);
          }
        }
        
        console.log(`✅ Migration complete: ${orphanedIds.length} games moved to ${targetSport}`);
      } catch (error) {
        console.error('❌ Error during Firebase migration:', error);
      }
    };
    
    // Run migration once on component mount
    migrateOrphanedData();
  }, []); // Empty dependency array - run once

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
    // Auto-populate data for ANY authenticated user if Firebase data is stale (> 5 minutes)
    // This ensures members can trigger updates and see fresh odds
    const shouldCheckForUpdate = authState.user && 
                                 !authState.loading && 
                                 !sportsDataLoadedRef.current;
    
    if (shouldCheckForUpdate) {
      sportsDataLoadedRef.current = true;
      
      // Check Firebase timestamp to determine if refresh is needed
      const checkFirebaseTimestamp = async () => {
        try {
          const spreadsRef = ref(database, 'spreads/NFL');
          const snapshot = await get(spreadsRef);
          
          if (snapshot.exists()) {
            const data = snapshot.val();
            const gameIds = Object.keys(data);
            
            if (gameIds.length > 0) {
              // Check the first game's timestamp
              const firstGame = data[gameIds[0]];
              if (firstGame.timestamp) {
                const lastUpdate = new Date(firstGame.timestamp);
                const now = new Date();
                const minutesSinceUpdate = (now - lastUpdate) / (1000 * 60);
                
                console.log(`⏰ Last Firebase update: ${minutesSinceUpdate.toFixed(1)} minutes ago`);
                
                // Only fetch if data is older than 5 minutes
                if (minutesSinceUpdate > 5) {
                  console.log('🔄 Data is stale (> 5 min), fetching fresh odds...');
                  loadAllSports('NFL', true).catch(() => {
                    sportsDataLoadedRef.current = false;
                  });
                } else {
                  console.log('✅ Data is fresh (< 5 min), using existing Firebase data');
                  loadAllSports('NFL', false).catch(() => {
                    sportsDataLoadedRef.current = false;
                  });
                }
                return;
              }
            }
          }
          
          // No data or no timestamp found, fetch fresh
          console.log('📭 No existing Firebase data found, fetching fresh odds...');
          loadAllSports('NFL', true).catch(() => {
            sportsDataLoadedRef.current = false;
          });
        } catch (error) {
          console.error('Error checking Firebase timestamp:', error);
          // Fallback: load without forcing refresh
          loadAllSports('NFL', false).catch(() => {
            sportsDataLoadedRef.current = false;
          });
        }
      };
      
      checkFirebaseTimestamp();
    }
  }, [authState.user, authState.loading, loadAllSports]);

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
