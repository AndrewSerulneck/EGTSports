import './App.css';
import React, { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue } from "firebase/database";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

// ==== REPLACE THIS WITH YOUR FIREBASE CONFIG FROM THE CONSOLE ====
const firebaseConfig = {
  apiKey: "AIzaSyA9FsWV7hA4ow2Xaq0Krx9kCCMfMibkVOQ",
  authDomain: "marcs-parlays.firebaseapp.com",
  databaseURL: "https://marcs-parlays-default-rtdb.firebaseio.com",
  projectId: "marcs-parlays",
  storageBucket: "marcs-parlays.firebasestorage.app",
  messagingSenderId: "631281528889",
  appId: "1:631281528889:web:e3befe34907902387c1de8"
};
// ==================================================================

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

const VENMO_USERNAME = 'Marc-Serulneck';
const MAX_BET = 100;
const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbwUU7CtC2OY-jHq3P5W5ytDm02WSuGQ8R8bSmYvsE20sYb7HZHBKJQIcG8n6Z_K6SlW/exec';

function AdminPanel({ user, games, setGames, isSyncing, setIsSyncing, recentlyUpdated, setRecentlyUpdated }) {
  // Allow admin to edit and broadcast spreads
  const saveSpreadToFirebase = async () => {
    try {
      setIsSyncing(true);
      const spreadsData = {};
      games.forEach(game => {
        spreadsData[game.espnId] = {
          awaySpread: game.awaySpread || '',
          homeSpread: game.homeSpread || '',
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

  return (
    <div className="gradient-bg">
      <div className="container">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <h1>Admin Panel <span className={`sync-indicator ${isSyncing ? 'syncing' : ''}`}></span></h1>
            <div>
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

  // App states from your old code
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [recentlyUpdated, setRecentlyUpdated] = useState({});

  // Load games from ESPN and set up Firebase listener
  useEffect(() => {
    loadGames();
    // Set up Firebase listener
    setTimeout(() => {
      setupFirebaseListener();
    }, 500);
    const interval = setInterval(loadGames, 300000);
    return () => {
      clearInterval(interval);
    };
    // eslint-disable-next-line
  }, []);

  // Firebase listener to update spreads in real time
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
                const changed = awaySpreadChanged || homeSpreadChanged;
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
                  homeSpread: fbGame.homeSpread || ''
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

  // Load games from ESPN API
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

  // Firebase Auth state changes
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
    return <AdminPanel user={authState.user} games={games} setGames={setGames} isSyncing={isSyncing} setIsSyncing={setIsSyncing} recentlyUpdated={recentlyUpdated} setRecentlyUpdated={setRecentlyUpdated} />;

  if (authState.user && !authState.isAdmin)
    return (
      <div>
        <h2>Not authorized (not an admin)</h2>
        <button onClick={() => signOut(auth)}>Sign Out</button>
      </div>
    );

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
          <br />
          <input
            type="password"
            placeholder="Password"
            required
            value={loginForm.password}
            onChange={(e) =>
              setLoginForm((f) => ({ ...f, password: e.target.value }))
            }
          />
          <br />
          <button className="btn btn-primary" type="submit">Login</button>
          {authState.error && (
            <div style={{ color: "red", marginTop: 10 }}>{authState.error}</div>
          )}
        </form>
      </div>
    </div>
  );
}

export default App;