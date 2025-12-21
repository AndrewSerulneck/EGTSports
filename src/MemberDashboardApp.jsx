import React, { useState, useEffect } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, onValue } from "firebase/database";
import {
  getFirestore,
  collection,
  doc,
  updateDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import {
  getAuth,
  signInWithCustomToken,
  signInAnonymously,
  onAuthStateChanged,
} from "firebase/auth";

/* =============================================================================
   My Bets - Member Dashboard for Wager Tracking
   
   This application provides:
   - Real-time current pending wager views
   - Real-time past settled wager views (won/lost)
   - Real-time notification system with unread badge
   
   Note: Wager placement happens on the main betting page, not here.
   This dashboard only displays the member's wager history.
   
   Technology Stack:
   - React (JSX), functional components, hooks
   - Tailwind CSS (utility-first styling, MOBILE-FIRST)
   - Firebase Auth and Cloud Firestore
   
   Navigation Note:
   - This component is rendered standalone on the /member/dashboard route
   - It does not have access to React Router context from App.js
   - Navigation uses window.location for compatibility with standalone rendering
   - This is intentional to allow the dashboard to be embedded or rendered independently
   
   ============================================================================= */

// ============================================================================
// Constants for betting slip state management (Issue #1)
// ============================================================================
const COLLAPSE_FLAG_KEY = 'collapseBettingSlipOnReturn'; // sessionStorage key

// ============================================================================
// Global Variables Access with Safe Fallbacks
// ============================================================================
let appId = "member-dashboard-dev";
let firebaseConfig = null;
let initialAuthToken = null;
let globalAccessError = null;

try {
  // Safely access global variables
  // eslint-disable-next-line no-undef
  appId = typeof __app_id !== "undefined" && __app_id ? __app_id : "member-dashboard-dev";
  
  // eslint-disable-next-line no-undef
  if (typeof __firebase_config !== "undefined" && __firebase_config) {
    // eslint-disable-next-line no-undef
    firebaseConfig = __firebase_config;
  } else {
    // Fallback to environment variables or hardcoded defaults
    // NOTE: databaseURL must match App.js config to avoid duplicate-app error
    firebaseConfig = {
      apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyA9FsWV7hA4ow2Xaq0Krx9kCCMfMibkVOQ",
      authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "marcs-parlays.firebaseapp.com",
      databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL || "https://marcs-parlays-default-rtdb.firebaseio.com",
      projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "marcs-parlays",
      storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "marcs-parlays.firebasestorage.app",
      messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "631281528889",
      appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:631281528889:web:e3befe34907902387c1de8",
    };
  }
  
  // eslint-disable-next-line no-undef
  initialAuthToken = typeof __initial_auth_token !== "undefined" ? __initial_auth_token : null;
} catch (error) {
  console.error("Error accessing global variables:", error);
  globalAccessError = `Failed to access configuration: ${error.message}`;
}

// ============================================================================
// Firebase Configuration Validation
// ============================================================================
const validateFirebaseConfig = (config) => {
  const requiredKeys = ['apiKey', 'authDomain', 'projectId'];
  const missingKeys = [];
  
  if (!config || typeof config !== 'object') {
    return { isValid: false, error: 'Firebase configuration is missing or invalid. Check environment variables.' };
  }
  
  for (const key of requiredKeys) {
    const value = config[key];
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      missingKeys.push(key);
    }
  }
  
  if (missingKeys.length > 0) {
    return { 
      isValid: false, 
      error: `Firebase configuration is missing required keys: ${missingKeys.join(', ')}. Please check your environment variables.` 
    };
  }
  
  return { isValid: true, error: null };
};

// Validate config before initialization
const configValidation = globalAccessError 
  ? { isValid: false, error: globalAccessError }
  : validateFirebaseConfig(firebaseConfig);

// ============================================================================
// Firebase Initialization (with robust error handling)
// ============================================================================
let app = null;
let db = null;
let rtdb = null;  // Realtime Database for wagers
let auth = null;
let firebaseInitError = null;

try {
  // ALWAYS check for existing apps first to avoid duplicate-app error
  const existingApps = getApps();
  
  if (existingApps.length > 0) {
    // Use the existing Firebase app (already initialized by App.js)
    app = existingApps[0];
    console.log("MemberDashboard: Using existing Firebase app");
  } else if (configValidation.isValid) {
    // Only initialize if no app exists and config is valid
    app = initializeApp(firebaseConfig);
    console.log("MemberDashboard: Initialized new Firebase app");
  } else {
    firebaseInitError = configValidation.error;
  }
  
  // Initialize Firestore if app is available (for notifications)
  if (app && !firebaseInitError) {
    try {
      db = getFirestore(app);
    } catch (firestoreError) {
      console.error("Firestore initialization error:", firestoreError);
      firebaseInitError = `Firestore initialization failed: ${firestoreError.message}`;
    }
  }
  
  // Initialize Realtime Database if app is available (for wagers)
  if (app && !firebaseInitError) {
    try {
      rtdb = getDatabase(app);
      console.log("MemberDashboard: Realtime Database initialized");
    } catch (rtdbError) {
      console.error("Realtime Database initialization error:", rtdbError);
      firebaseInitError = `Realtime Database initialization failed: ${rtdbError.message}`;
    }
  }
  
  // Initialize Auth if app is available
  if (app && !firebaseInitError) {
    try {
      auth = getAuth(app);
    } catch (authError) {
      console.error("Auth initialization error:", authError);
      firebaseInitError = `Auth initialization failed: ${authError.message}`;
    }
  }
} catch (error) {
  console.error("Firebase initialization error:", error);
  firebaseInitError = `Firebase initialization failed: ${error.message}`;
}

// Log initialization status for debugging
console.log("Firebase Init Status:", {
  configValid: configValidation.isValid,
  appInitialized: !!app,
  dbInitialized: !!db,
  rtdbInitialized: !!rtdb,
  authInitialized: !!auth,
  error: firebaseInitError
});

// ============================================================================
// Firestore Collection Paths (for notifications only)
// ============================================================================
const getNotificationsCollectionPath = (userId) =>
  `/artifacts/${appId}/users/${userId}/notifications`;

// ============================================================================
// Balance Status Component - Mobile-First Design with Dynamic Balance
// Updated to show current_balance instead of remainingCredit
// ============================================================================
function BalanceStatus({ userId, rtdb, auth }) {
  const [balanceData, setBalanceData] = useState({
    currentBalance: 0,
    baseCreditLimit: 0
  });
  const [loading, setLoading] = useState(true);
  const [resetCheckLoading, setResetCheckLoading] = useState(false);

  // Check for on-demand reset when component mounts
  useEffect(() => {
    if (!userId || !auth) return;

    const checkReset = async () => {
      setResetCheckLoading(true);
      try {
        const user = auth.currentUser;
        if (!user) return;

        const idToken = await user.getIdToken();
        const response = await fetch('/api/system-sync?action=checkReset', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({ userId })
        });

        if (response.ok) {
          const result = await response.json();
          if (result.resetPerformed) {
            console.log('Balance reset performed:', result.details);
          }
        }
      } catch (error) {
        console.error('Error checking reset:', error);
      } finally {
        setResetCheckLoading(false);
      }
    };

    checkReset();
  }, [userId, auth]);

  useEffect(() => {
    if (!userId || !rtdb) return;

    const userRef = ref(rtdb, `users/${userId}`);
    const unsubscribe = onValue(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const userData = snapshot.val();
        const baseCreditLimit = parseFloat(userData.base_credit_limit) || parseFloat(userData.creditLimit) || 100;
        const currentBalance = userData.current_balance !== undefined 
          ? parseFloat(userData.current_balance)
          : baseCreditLimit; // Default to base limit for new users
        
        setBalanceData({
          currentBalance,
          baseCreditLimit
        });
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching balance data:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId, rtdb]);

  if (loading || resetCheckLoading) {
    return (
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-6 mb-4">
        <div className="flex justify-center items-center h-20">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-white border-t-transparent"></div>
        </div>
      </div>
    );
  }

  const balancePercentage = balanceData.baseCreditLimit > 0 
    ? (balanceData.currentBalance / balanceData.baseCreditLimit) * 100 
    : 0;
  const isLow = balancePercentage < 25;
  const isMedium = balancePercentage >= 25 && balancePercentage < 50;
  
  // Determine if user is "up on the week" (above base limit) or "down on the week" (below base limit)
  const isUpOnWeek = balanceData.currentBalance > balanceData.baseCreditLimit;
  const isDownOnWeek = balanceData.currentBalance < balanceData.baseCreditLimit;

  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-6 mb-4 text-white">
      <h2 className="text-2xl font-bold mb-4">💰 Current Balance</h2>
      
      {/* Colloquial Performance-Based Feedback */}
      {isUpOnWeek && (
        <div className="bg-green-500 bg-opacity-40 border-2 border-green-300 rounded-lg p-4 mb-4 text-center">
          <p className="text-lg font-bold text-white">
            Congratulations! You're up on the week! 💰
          </p>
        </div>
      )}
      {isDownOnWeek && (
        <div className="bg-blue-800 bg-opacity-40 border-2 border-blue-300 rounded-lg p-4 mb-4 text-center">
          <p className="text-lg font-bold text-white">
            Tough week, but the board is wide open. Let's get it back! 🎯
          </p>
        </div>
      )}
      
      {/* Large Balance Display */}
      <div className="text-center mb-4">
        <div className="text-5xl font-extrabold tracking-tight mb-2">
          ${balanceData.currentBalance.toFixed(2)}
        </div>
        <div className="text-sm text-blue-100">
          Base Limit: ${balanceData.baseCreditLimit.toFixed(2)}
        </div>
      </div>
      
      {/* Progress Bar - only show if balance is within base limit */}
      {balanceData.currentBalance <= balanceData.baseCreditLimit && (
        <div className="relative h-3 bg-blue-800 bg-opacity-50 rounded-full overflow-hidden mb-4">
          <div 
            className={`h-full transition-all duration-500 ${
              isLow ? 'bg-red-400' : isMedium ? 'bg-yellow-400' : 'bg-green-400'
            }`}
            style={{ width: `${Math.max(0, Math.min(100, balancePercentage))}%` }}
          />
        </div>
      )}
      
      {/* Warning Messages */}
      {isLow && balanceData.currentBalance > 0 && balanceData.currentBalance <= balanceData.baseCreditLimit && (
        <div className="bg-red-500 bg-opacity-30 border-2 border-red-300 rounded-lg p-2">
          <p className="text-xs font-medium">⚠️ Low balance remaining</p>
        </div>
      )}
      {balanceData.currentBalance <= 0 && (
        <div className="bg-red-600 border-2 border-red-400 rounded-lg p-3">
          <p className="text-sm font-bold">🚫 Insufficient balance - Wait for weekly reset or contact admin</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Credit Status Component - Mobile-First Design (LEGACY - Kept for reference)
// NOTE: This component is replaced by BalanceStatus but kept for backward compatibility
// ============================================================================
// eslint-disable-next-line no-unused-vars
function CreditStatus({ userId, rtdb }) {
  const [creditData, setCreditData] = useState({
    creditLimit: 0,
    totalWagered: 0,
    remainingCredit: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !rtdb) return;

    const userRef = ref(rtdb, `users/${userId}`);
    const unsubscribe = onValue(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const userData = snapshot.val();
        const creditLimit = parseFloat(userData.creditLimit) || 100;
        const totalWagered = parseFloat(userData.totalWagered) || 0;
        setCreditData({
          creditLimit,
          totalWagered,
          remainingCredit: creditLimit - totalWagered
        });
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching credit data:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId, rtdb]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <div className="flex justify-center items-center h-16">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  const creditPercentage = creditData.creditLimit > 0 
    ? (creditData.remainingCredit / creditData.creditLimit) * 100 
    : 0;
  const isLow = creditPercentage < 25;
  const isMedium = creditPercentage >= 25 && creditPercentage < 50;

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <h2 className="text-lg font-bold text-gray-800 mb-3">💰 Credit Status</h2>
      <div className="space-y-3">
        {/* Credit Progress Bar */}
        <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ${
              isLow ? 'bg-red-500' : isMedium ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.max(0, Math.min(100, creditPercentage))}%` }}
          />
        </div>
        
        {/* Credit Details Grid - Mobile-friendly */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-blue-50 rounded-lg p-2">
            <p className="text-xs text-gray-500">Credit Limit</p>
            <p className="text-sm font-bold text-blue-600">${creditData.creditLimit.toFixed(2)}</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-2">
            <p className="text-xs text-gray-500">Total Wagered</p>
            <p className="text-sm font-bold text-orange-600">${creditData.totalWagered.toFixed(2)}</p>
          </div>
          <div className={`rounded-lg p-2 ${
            isLow ? 'bg-red-50' : isMedium ? 'bg-yellow-50' : 'bg-green-50'
          }`}>
            <p className="text-xs text-gray-500">Remaining</p>
            <p className={`text-sm font-bold ${
              isLow ? 'text-red-600' : isMedium ? 'text-yellow-600' : 'text-green-600'
            }`}>${creditData.remainingCredit.toFixed(2)}</p>
          </div>
        </div>
        
        {/* Low Credit Warning */}
        {isLow && creditData.remainingCredit > 0 && (
          <div className="bg-red-50 border-l-4 border-red-500 p-2 rounded-r">
            <p className="text-xs text-red-700">⚠️ Low credit remaining</p>
          </div>
        )}
        {creditData.remainingCredit <= 0 && (
          <div className="bg-red-100 border-l-4 border-red-600 p-2 rounded-r">
            <p className="text-xs text-red-800 font-bold">🚫 No credit remaining - Contact admin</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Current Wagers Component (Pending Wagers) - Mobile-First Design
// Reads from Firebase Realtime Database /wagers collection
// Auto-displays all wagers (no collapsible behavior)
// Updated to support optimistic wagers for instant feedback
// ============================================================================
function CurrentWagers({ userId, rtdb, optimisticWagers = [] }) {
  const [wagers, setWagers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !rtdb) return;

    // Query wagers collection in Realtime Database, filtered by uid
    const wagersRef = ref(rtdb, 'wagers');
    const unsubscribe = onValue(wagersRef, (snapshot) => {
      const wagersData = [];
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const wager = childSnapshot.val();
          // Filter by user ID and pending status (case-insensitive)
          const status = wager.status?.toLowerCase();
          if (wager.uid === userId && status === 'pending') {
            wagersData.push({
              id: childSnapshot.key,
              ...wager,
              // Format pick details for display
              details: formatWagerDetails(wager.wagerData)
            });
          }
        });
      }
      // Sort by createdAt descending
      wagersData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setWagers(wagersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching current wagers:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId, rtdb]);

  // Merge optimistic wagers with Firebase wagers
  const allWagers = React.useMemo(() => {
    // Filter out optimistic wagers that match user ID
    const userOptimisticWagers = (optimisticWagers || [])
      .filter(w => w.uid === userId)
      .map(w => ({
        ...w,
        details: formatWagerDetails(w.wagerData)
      }));
    
    // Combine and sort by createdAt
    const combined = [...userOptimisticWagers, ...wagers];
    combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return combined;
  }, [optimisticWagers, wagers, userId]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <h2 className="text-lg font-bold text-gray-800 mb-3">⏳ Current Wagers</h2>
        <div className="flex justify-center items-center h-20">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      {/* Header - Always visible, no collapse */}
      <h2 className="text-lg font-bold text-gray-800 mb-3">
        ⏳ Current Wagers <span className="text-blue-600">({allWagers.length})</span>
      </h2>
      
      {/* Wagers List - Always displayed */}
      {allWagers.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-gray-400 text-sm">No pending wagers</p>
          <p className="text-gray-300 text-xs mt-1">Your active bets will appear here</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">{allWagers.map((wager) => {
            const details = wager.details || { summary: `Ticket #${wager.wagerData?.ticketNumber || 'Unknown'}`, picks: [] };
            const isOptimistic = wager.isOptimistic === true;
            return (
              <div
                key={wager.id}
                className={`rounded-r-lg p-3 shadow-sm ${
                  isOptimistic 
                    ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500' 
                    : 'bg-gradient-to-r from-yellow-50 to-amber-50 border-l-4 border-yellow-400'
                }`}
              >
                {/* Mobile-first: Stack vertically */}
                <div className="flex flex-col space-y-2">
                  {/* Optimistic Badge - if applicable */}
                  {isOptimistic && (
                    <div className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                      <span className="animate-pulse">⚡</span>
                      <span>Submitting...</span>
                    </div>
                  )}
                  
                  {/* Wager Summary - Prominent */}
                  <p className="text-sm font-semibold text-gray-800 leading-tight">
                    {details.summary}
                  </p>
                  
                  {/* Full Pick Details */}
                  {details.picks && details.picks.length > 0 && (
                    <div className="bg-white bg-opacity-60 rounded p-2 space-y-1">
                      {details.picks.map((pick, idx) => (
                        <div key={idx} className="text-xs">
                          <div className="font-medium text-gray-900">{pick.description}</div>
                          <div className="text-gray-600">{pick.gameName}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Bet Type Badge */}
                  {wager.wagerData?.betType && (
                    <span className="inline-block w-fit px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                      {wager.wagerData.betType === 'parlay' ? '🎯 Parlay' : '📊 Straight'}
                    </span>
                  )}
                  
                  {/* Financial Details */}
                  {wager.wagerData && (
                    <div className="bg-blue-50 rounded p-2 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Stake:</span>
                        <span className="font-bold text-gray-900">${(wager.amount || wager.wagerData.betAmount || 0).toFixed(2)}</span>
                      </div>
                      {wager.wagerData.potentialPayout && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Potential Payout:</span>
                            <span className="font-bold text-green-700">${wager.wagerData.potentialPayout.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Potential Profit:</span>
                            <span className="font-bold text-blue-700">${(wager.wagerData.potentialPayout - (wager.amount || wager.wagerData.betAmount || 0)).toFixed(2)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  
                  {/* Status Row - Simplified since financial details are shown above */}
                  <div className="flex items-center justify-end">
                    <span className="inline-flex items-center px-2.5 py-1 text-xs font-bold bg-yellow-400 text-yellow-900 rounded-full shadow-sm">
                      ⏳ PENDING
                    </span>
                  </div>
                  
                  {/* Date - Smaller */}
                  <p className="text-xs text-gray-500">
                    {wager.createdAt
                      ? new Date(wager.createdAt).toLocaleString()
                      : "Just now"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Helper function to format wager details for display
function formatWagerDetails(wagerData) {
  if (!wagerData) return { summary: 'Wager details unavailable', picks: [] };
  
  if (wagerData.picks && Array.isArray(wagerData.picks)) {
    const pickCount = wagerData.picks.length;
    const formattedPicks = wagerData.picks.map(pick => {
      let pickDescription = '';
      
      if (pick.pickType === 'spread') {
        // Format spread pick: "Team A -5.5"
        pickDescription = `${pick.team} ${pick.spread}`;
      } else if (pick.pickType === 'winner' || pick.pickType === 'moneyline') {
        // Format moneyline pick: "Team A ML +150"
        pickDescription = `${pick.team} ML ${pick.moneyline || ''}`;
      } else if (pick.pickType === 'total') {
        // Format total pick: "Over 42.5" or "Under 42.5"
        const overUnder = pick.overUnder === 'over' ? 'Over' : 'Under';
        const totalValue = pick.total || '';
        pickDescription = totalValue ? `${overUnder} ${totalValue}` : `${overUnder}`;
      } else {
        // Fallback for any other pick type
        pickDescription = `${pick.team || 'Selection'} ${pick.spread || pick.moneyline || pick.odds || ''}`;
      }
      
      return {
        description: pickDescription.trim(),
        gameName: pick.gameName || `${pick.team} game`,
        sport: pick.sport || ''
      };
    });
    
    // Update summary based on bet type and pick count
    let summary;
    if (wagerData.betType === 'straight' && pickCount === 1) {
      // Single straight bet - show the pick description
      summary = formattedPicks[0].description;
    } else if (wagerData.betType === 'straight' && pickCount > 1) {
      // Multiple straight bets shouldn't happen in the new system, but handle legacy data
      summary = `${pickCount} Straight Bets`;
    } else if (wagerData.betType === 'parlay') {
      // Parlay bet - show leg count
      summary = `${pickCount}-leg Parlay`;
    } else {
      // Fallback for unknown bet types
      summary = pickCount === 1 
        ? formattedPicks[0].description 
        : `${pickCount}-leg ${wagerData.betType || 'bet'}`;
    }
    
    return { summary, picks: formattedPicks };
  }
  
  return { 
    summary: wagerData.ticketNumber ? `Ticket #${wagerData.ticketNumber}` : 'Wager',
    picks: []
  };
}

// ============================================================================
// Past Wagers Component (Won/Lost/Canceled Wagers) - Mobile-First Design with Collapsible
// Reads from Firebase Realtime Database /wagers collection
// Default: Collapsed on mobile for optimal viewport usage
// NOTE: This component is now integrated into FiguresTab but kept for backward compatibility
// ============================================================================
// eslint-disable-next-line no-unused-vars
function PastWagers({ userId, rtdb }) {
  const [wagers, setWagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false); // Default collapsed for mobile-first

  useEffect(() => {
    if (!userId || !rtdb) return;

    // Query wagers collection in Realtime Database, filtered by uid
    const wagersRef = ref(rtdb, 'wagers');
    const unsubscribe = onValue(wagersRef, (snapshot) => {
      const wagersData = [];
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const wager = childSnapshot.val();
          // Filter by user ID and settled status (won/lost/canceled)
          const status = wager.status?.toLowerCase();
          if (wager.uid === userId && (status === 'won' || status === 'lost' || status === 'canceled')) {
            wagersData.push({
              id: childSnapshot.key,
              ...wager,
              details: formatWagerDetails(wager.wagerData)
            });
          }
        });
      }
      // Sort by settledAt or canceledAt or createdAt descending
      wagersData.sort((a, b) => {
        const dateA = new Date(a.settledAt || a.canceledAt || a.createdAt);
        const dateB = new Date(b.settledAt || b.canceledAt || b.createdAt);
        return dateB - dateA;
      });
      setWagers(wagersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching past wagers:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId, rtdb]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <h2 className="text-lg font-bold text-gray-800 mb-3">📜 Past Wagers</h2>
        <div className="flex justify-center items-center h-20">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  // Helper to get status display info
  const getStatusInfo = (status) => {
    const normalizedStatus = status?.toLowerCase();
    switch (normalizedStatus) {
      case 'won':
        return { 
          label: '✓ WON', 
          bgClass: 'bg-green-500 text-white',
          cardClass: 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-500'
        };
      case 'lost':
        return { 
          label: '✗ LOST', 
          bgClass: 'bg-red-500 text-white',
          cardClass: 'bg-gradient-to-r from-red-50 to-rose-50 border-red-500'
        };
      case 'canceled':
        return { 
          label: '🚫 CANCELED BY ADMIN', 
          bgClass: 'bg-gray-500 text-white',
          cardClass: 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-400'
        };
      default:
        return { 
          label: status?.toUpperCase() || 'UNKNOWN', 
          bgClass: 'bg-gray-400 text-white',
          cardClass: 'bg-gray-50 border-gray-300'
        };
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      {/* Collapsible Header - Click to expand/collapse */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left hover:bg-gray-50 active:bg-gray-100 rounded p-2 transition-colors"
      >
        <h2 className="text-lg font-bold text-gray-800">
          📜 Past Wagers <span className="text-gray-500">({wagers.length})</span>
        </h2>
        <span className="text-2xl text-gray-600">
          {isExpanded ? '▼' : '▶'}
        </span>
      </button>
      
      {/* Collapsible Content */}
      {isExpanded && (
        <>
          {wagers.length === 0 ? (
            <div className="text-center py-6 mt-2">
              <p className="text-gray-400 text-sm">No settled wagers yet</p>
              <p className="text-gray-300 text-xs mt-1">Results will appear here once bets are settled</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto mt-3">
              {wagers.map((wager) => {
                const statusInfo = getStatusInfo(wager.status);
                const details = wager.details || { summary: `Ticket #${wager.wagerData?.ticketNumber || 'Unknown'}`, picks: [] };
                const isCanceled = wager.status?.toLowerCase() === 'canceled';
                return (
                  <div
                    key={wager.id}
                    className={`rounded-r-lg p-3 shadow-sm border-l-4 ${statusInfo.cardClass}`}
                  >
                    {/* Mobile-first: Stack vertically */}
                    <div className="flex flex-col space-y-2">
                      {/* Wager Summary - Prominent */}
                      <p className="text-sm font-semibold text-gray-800 leading-tight">
                        {details.summary}
                      </p>
                      
                      {/* Full Pick Details */}
                      {details.picks && details.picks.length > 0 && (
                        <div className="bg-white bg-opacity-60 rounded p-2 space-y-1">
                          {details.picks.map((pick, idx) => (
                            <div key={idx} className="text-xs">
                              <div className="font-medium text-gray-900">{pick.description}</div>
                              <div className="text-gray-600">{pick.gameName}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Bet Type Badge */}
                      {wager.wagerData?.betType && (
                        <span className="inline-block w-fit px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                          {wager.wagerData.betType === 'parlay' ? '🎯 Parlay' : '📊 Straight'}
                        </span>
                      )}
                      
                      {/* Financial Details - Show for all wagers */}
                      {wager.wagerData && (
                        <div className="bg-blue-50 rounded p-2 space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Total Stake:</span>
                            <span className={`font-bold ${isCanceled ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                              ${(wager.amount || wager.wagerData.betAmount || 0).toFixed(2)}
                            </span>
                          </div>
                          {wager.wagerData.potentialPayout && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Potential Payout:</span>
                                <span className="font-bold text-green-700">${wager.wagerData.potentialPayout.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Potential Profit:</span>
                                <span className="font-bold text-blue-700">${(wager.wagerData.potentialPayout - (wager.amount || wager.wagerData.betAmount || 0)).toFixed(2)}</span>
                              </div>
                            </>
                          )}
                          {wager.status?.toLowerCase() === 'won' && wager.payout && (
                            <div className="flex justify-between border-t border-gray-300 pt-1 mt-1">
                              <span className="text-gray-700 font-medium">Actual Payout:</span>
                              <span className="font-bold text-green-700">${wager.payout.toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Status and Result Row - Simplified since financial details are shown above */}
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-full shadow-sm ${statusInfo.bgClass}`}
                          >
                            {statusInfo.label}
                          </span>
                          {isCanceled && wager.creditReturned && (
                            <span className="text-sm font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                              Stake Returned: +${wager.creditReturned.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Date - Smaller */}
                      <p className="text-xs text-gray-500">
                        {isCanceled
                          ? `Canceled: ${wager.canceledAt ? new Date(wager.canceledAt).toLocaleString() : 'Unknown'}`
                          : wager.settledAt
                          ? `Settled: ${new Date(wager.settledAt).toLocaleString()}`
                          : wager.createdAt
                          ? `Placed: ${new Date(wager.createdAt).toLocaleString()}`
                          : "Unknown date"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// Notification Bell Component - Enhanced for Mobile
// ============================================================================
function NotificationBell({ userId, db }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const notificationsRef = collection(
      db,
      getNotificationsCollectionPath(userId)
    );
    const q = query(
      notificationsRef,
      orderBy("timestamp", "desc"),
      limit(10)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notificationsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setNotifications(notificationsData);
        setUnreadCount(
          notificationsData.filter((n) => !n.isRead).length
        );
      },
      (error) => {
        console.error("Error fetching notifications:", error);
      }
    );

    return () => unsubscribe();
  }, [userId, db]);

  const markAsRead = async (notificationId) => {
    try {
      const notificationRef = doc(
        db,
        getNotificationsCollectionPath(userId),
        notificationId
      );
      await updateDoc(notificationRef, { isRead: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const handleNotificationClick = (notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* Enhanced notification bell - larger touch target for mobile */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-3 rounded-full bg-blue-500 hover:bg-blue-400 active:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-white shadow-lg"
        aria-label="Notifications"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-7 w-7 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center border-2 border-white animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl z-50 max-h-96 overflow-hidden border border-gray-200">
          <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 border-b border-gray-200">
            <h3 className="font-bold text-white text-lg">🔔 Notifications</h3>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-gray-400 text-sm">No notifications yet</p>
                <p className="text-gray-300 text-xs mt-1">Updates will appear here</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 active:bg-gray-100 transition-colors ${
                    !notification.isRead ? "bg-blue-50 border-l-4 border-l-blue-500" : ""
                  }`}
                >
                  <p className="text-sm text-gray-800 leading-relaxed">{notification.message}</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-gray-500">
                      {notification.timestamp?.toDate
                        ? notification.timestamp.toDate().toLocaleString()
                        : "Just now"}
                    </p>
                    {!notification.isRead && (
                      <span className="px-2 py-0.5 text-xs font-bold bg-blue-500 text-white rounded-full">
                        NEW
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Overlay to close dropdown when clicking outside */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        ></div>
      )}
    </div>
  );
}

// ============================================================================
// Figures Tab Component - Weekly Performance Summary
// ============================================================================
function FiguresTab({ userId, rtdb }) {
  const [periodFilter, setPeriodFilter] = useState('this_week');
  const [wagers, setWagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weeklyNet, setWeeklyNet] = useState(0);

  useEffect(() => {
    if (!userId || !rtdb) return;

    const wagersRef = ref(rtdb, 'wagers');
    const unsubscribe = onValue(wagersRef, (snapshot) => {
      const wagersData = [];
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const wager = childSnapshot.val();
          const status = wager.status?.toLowerCase();
          if (wager.uid === userId && (status === 'won' || status === 'lost')) {
            wagersData.push({
              id: childSnapshot.key,
              ...wager
            });
          }
        });
      }
      
      // Filter by selected period
      const filteredWagers = filterWagersByPeriod(wagersData, periodFilter);
      setWagers(filteredWagers);
      
      // Calculate weekly net
      const totalWon = filteredWagers
        .filter(w => w.status?.toLowerCase() === 'won')
        .reduce((sum, w) => sum + (parseFloat(w.payout) || 0), 0);
      const totalLost = filteredWagers
        .filter(w => w.status?.toLowerCase() === 'lost')
        .reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0);
      setWeeklyNet(totalWon - totalLost);
      
      setLoading(false);
    }, (error) => {
      console.error("Error fetching figures data:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId, rtdb, periodFilter]);

  const filterWagersByPeriod = (wagers, period) => {
    const now = new Date();
    const startOfWeek = (weekOffset = 0) => {
      const date = new Date(now);
      date.setDate(date.getDate() - (date.getDay() || 7) + 1 - (weekOffset * 7));
      date.setHours(0, 0, 0, 0);
      return date;
    };
    const endOfWeek = (weekOffset = 0) => {
      const date = new Date(startOfWeek(weekOffset));
      date.setDate(date.getDate() + 6);
      date.setHours(23, 59, 59, 999);
      return date;
    };

    let start, end;
    if (period === 'this_week') {
      start = startOfWeek(0);
      end = endOfWeek(0);
    } else if (period === 'last_week') {
      start = startOfWeek(1);
      end = endOfWeek(1);
    } else if (period === 'two_weeks_ago') {
      start = startOfWeek(2);
      end = endOfWeek(2);
    }

    return wagers.filter(w => {
      const settledDate = new Date(w.settledAt || w.createdAt);
      return settledDate >= start && settledDate <= end;
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const wonWagers = wagers.filter(w => w.status?.toLowerCase() === 'won');
  const lostWagers = wagers.filter(w => w.status?.toLowerCase() === 'lost');
  const totalWon = wonWagers.reduce((sum, w) => sum + (parseFloat(w.payout) || 0), 0);
  const totalLost = lostWagers.reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0);

  return (
    <div className="space-y-4">
      {/* Period Filter Dropdown */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Period
        </label>
        <select
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="this_week">This Week</option>
          <option value="last_week">Last Week</option>
          <option value="two_weeks_ago">2 Weeks Ago</option>
        </select>
      </div>

      {/* Performance Summary */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <h3 className="text-lg font-bold text-gray-800 mb-3">Performance Summary</h3>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-600">Won Wagers</p>
            <p className="text-2xl font-bold text-green-600">{wonWagers.length}</p>
            <p className="text-sm text-green-700">${totalWon.toFixed(2)}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-600">Lost Wagers</p>
            <p className="text-2xl font-bold text-red-600">{lostWagers.length}</p>
            <p className="text-sm text-red-700">-${totalLost.toFixed(2)}</p>
          </div>
        </div>
        
        {/* Weekly Net - Large and Prominent */}
        <div className={`rounded-lg p-4 text-center ${
          weeklyNet >= 0 ? 'bg-green-100 border-2 border-green-400' : 'bg-red-100 border-2 border-red-400'
        }`}>
          <p className="text-sm font-medium text-gray-700 mb-1">Weekly Net</p>
          <p className={`text-4xl font-extrabold ${
            weeklyNet >= 0 ? 'text-green-700' : 'text-red-700'
          }`}>
            {weeklyNet >= 0 ? '+' : ''}${weeklyNet.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Wagers List */}
      {wagers.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <p className="text-gray-400">No wagers for this period</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Wagers ({wagers.length})</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {wagers.map((wager) => (
              <div
                key={wager.id}
                className={`rounded-lg p-3 border-l-4 ${
                  wager.status?.toLowerCase() === 'won' 
                    ? 'bg-green-50 border-green-500' 
                    : 'bg-red-50 border-red-500'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-xs text-gray-600">
                      {new Date(wager.settledAt || wager.createdAt).toLocaleDateString()}
                    </p>
                    <p className="text-sm font-medium text-gray-900">
                      {wager.wagerData?.betType || 'Bet'} - ${(wager.amount || 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-bold ${
                      wager.status?.toLowerCase() === 'won' ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {wager.status?.toLowerCase() === 'won' 
                        ? `+$${(wager.payout || 0).toFixed(2)}` 
                        : `-$${(wager.amount || 0).toFixed(2)}`}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Transactions Tab Component - Running Account Ledger
// ============================================================================
function TransactionsTab({ userId, rtdb }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !rtdb) return;

    const transactionsRef = ref(rtdb, `transactions/${userId}`);
    const unsubscribe = onValue(transactionsRef, (snapshot) => {
      const transactionsData = [];
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          transactionsData.push({
            id: childSnapshot.key,
            ...childSnapshot.val()
          });
        });
      }
      // Sort by timestamp descending (newest first)
      transactionsData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setTransactions(transactionsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching transactions:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId, rtdb]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 text-center">
        <p className="text-gray-400">No transactions yet</p>
        <p className="text-gray-300 text-xs mt-1">Your transaction history will appear here</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                Date/Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                Description
              </th>
              <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                Balance
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                  {new Date(tx.timestamp).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {tx.description}
                </td>
                <td className={`px-4 py-3 text-sm font-bold text-right whitespace-nowrap ${
                  tx.amount >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {tx.amount >= 0 ? '+' : ''}${tx.amount.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right whitespace-nowrap">
                  ${tx.balanceAfter.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// FAQs/Member Guide Component - Accordion-style guide with Important Rules and Parlay Payouts
// ============================================================================
function FAQsGuideTab() {
  const [expandedSection, setExpandedSection] = useState(null);

  const toggleSection = (sectionId) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId);
  };

  // Parlay payout multipliers
  const parlayPayouts = [
    { legs: 3, payout: '8 to 1' },
    { legs: 4, payout: '15 to 1' },
    { legs: 5, payout: '25 to 1' },
    { legs: 6, payout: '50 to 1' },
    { legs: 7, payout: '100 to 1' },
    { legs: 8, payout: '150 to 1' },
    { legs: 9, payout: '200 to 1' },
    { legs: 10, payout: '250 to 1' }
  ];

  return (
    <div className="space-y-3">
      {/* Section 1: Important Rules */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <button
          onClick={() => toggleSection('rules')}
          className="w-full px-4 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
        >
          <span className="font-bold text-gray-800 text-lg">
            📋 Important Rules
          </span>
          <span className="text-2xl text-gray-600">
            {expandedSection === 'rules' ? '▼' : '▶'}
          </span>
        </button>
        {expandedSection === 'rules' && (
          <div className="px-4 pb-4 text-sm text-gray-700 space-y-3 border-t border-gray-200 pt-4">
            <div className="space-y-2">
              <h3 className="font-bold text-gray-900">General Betting Rules:</h3>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>All wagers must be placed before the game starts</li>
                <li>Minimum bet: $5.00 per wager</li>
                <li>Maximum bet: $100.00 per wager</li>
                <li>All bets are action once submitted</li>
                <li>Balances reset every Wednesday at midnight</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="font-bold text-gray-900">Parlay Rules:</h3>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Minimum 3 legs required for parlay bets</li>
                <li>Maximum 10 legs allowed per parlay</li>
                <li>ALL picks must win for parlay to pay out</li>
                <li>If any pick loses, entire parlay loses</li>
                <li>No teasers or alternate lines allowed</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="font-bold text-gray-900">Straight Bet Rules:</h3>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>One pick per straight bet</li>
                <li>Payouts based on American odds</li>
                <li>Each straight bet is independent</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="font-bold text-gray-900">Settlement:</h3>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Bets are settled after game completion</li>
                <li>Check "Current Wagers" tab for wager status</li>
                <li>Winnings are automatically added to your balance</li>
                <li>Contact admin for any discrepancies</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Parlay Payout Odds */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <button
          onClick={() => toggleSection('payouts')}
          className="w-full px-4 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
        >
          <span className="font-bold text-gray-800 text-lg">
            💰 Parlay Payout Odds
          </span>
          <span className="text-2xl text-gray-600">
            {expandedSection === 'payouts' ? '▼' : '▶'}
          </span>
        </button>
        {expandedSection === 'payouts' && (
          <div className="px-4 pb-4 border-t border-gray-200 pt-4">
            <p className="text-sm text-gray-600 mb-4">
              Parlay payouts multiply your stake based on the number of legs. All picks must win for payout.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="px-4 py-3 text-left font-bold text-sm">Number of Legs</th>
                    <th className="px-4 py-3 text-left font-bold text-sm">Payout</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {parlayPayouts.map((item) => (
                    <tr key={item.legs} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {item.legs} Legs
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-green-600">
                        {item.payout}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 bg-blue-50 rounded-lg p-3">
              <p className="text-xs text-gray-700">
                <strong>Example:</strong> A $10 bet on a 5-leg parlay pays $250 if all picks win (25 × $10).
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Sub-Navigation Tabs Component - Mobile-First with Red Underline
// ============================================================================
function SubNavigationTabs({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'figures', label: 'Figures', icon: '📊' },
    { id: 'pending', label: 'Current Wagers', icon: '⏳' },
    { id: 'transactions', label: 'Transactions', icon: '📋' },
    { id: 'faqs', label: 'FAQs', icon: '📖' }
  ];

  return (
    <div className="bg-white shadow-md mb-4 sticky top-0 z-20">
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-max px-4 py-3 text-sm font-semibold transition-colors relative ${
              activeTab === tab.id
                ? 'text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </span>
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: '#ff3131' }}></div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Dashboard Component - Updated to use both Firestore and Realtime Database
// Triggers on-demand wager resolution when page loads
// ============================================================================

// Configuration constants
const WAGER_RESOLUTION_DELAY = 1000; // Delay before triggering resolution (ms)
const RESOLUTION_COOLDOWN = 60000; // Minimum time between resolution attempts (ms)

// Module-level state to prevent excessive resolution calls
// NOTE: This is shared across component instances which is intentional
// to prevent multiple users triggering resolution simultaneously
// For production with high concurrency, consider sessionStorage or React Context
let lastResolutionTime = 0;

function Dashboard({ userId, db, rtdb, auth, optimisticWagers = [], initialTab = 'pending', onTabChange }) {
  const [isResolvingWagers, setIsResolvingWagers] = useState(false);
  const [resolutionStatus, setResolutionStatus] = useState('');
  const [activeTab, setActiveTab] = useState(initialTab); // Use initialTab prop
  
  // Call parent callback when tab changes
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (onTabChange) {
      onTabChange(tabId);
    }
  };

  useEffect(() => {
    // Trigger on-demand wager resolution when dashboard loads
    // Sequential execution as per problem statement:
    // Step A: Update game scores from external APIs
    // Step B: Resolve wagers based on updated scores
    // Step C: Display results (automatic via Firebase real-time listeners)
    const resolveOnDemand = async () => {
      // Check if resolution was recently triggered (cooldown period)
      const now = Date.now();
      if (now - lastResolutionTime < RESOLUTION_COOLDOWN) {
        console.log('Wager resolution skipped (cooldown period)');
        return;
      }

      try {
        setIsResolvingWagers(true);
        lastResolutionTime = now;
        
        // Step A: Update game scores from external sports APIs
        setResolutionStatus('Updating game scores...');
        console.log('Step A: Calling updateGameScores API');
        const scoresResponse = await fetch('/api/wager-manager?action=updateScores', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (scoresResponse.ok) {
          const scoresResult = await scoresResponse.json();
          console.log('✅ Step A complete - Game scores updated:', scoresResult);
        } else {
          console.warn('⚠️ Step A warning - Game scores update had issues:', scoresResponse.status);
          // Continue to Step B even if Step A has issues (non-blocking)
        }

        // Step B: Resolve wagers based on completed games
        setResolutionStatus('Resolving wagers...');
        console.log('Step B: Calling resolveWagers API');
        const wagersResponse = await fetch('/api/wager-manager?action=resolve', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (wagersResponse.ok) {
          const wagersResult = await wagersResponse.json();
          console.log('✅ Step B complete - Wagers resolved:', wagersResult);
        } else {
          console.warn('⚠️ Step B warning - Wager resolution had issues:', wagersResponse.status);
        }

        // Step C: Display results - handled automatically by Firebase real-time listeners
        console.log('✅ Step C - Display will update automatically via real-time listeners');
        setResolutionStatus('');
        
      } catch (error) {
        // Non-blocking error - just log it
        console.error('Wager resolution error (non-critical):', error.message);
        setResolutionStatus('');
      } finally {
        setIsResolvingWagers(false);
      }
    };

    // Trigger resolution after a short delay to allow page to render
    const timeoutId = setTimeout(resolveOnDemand, WAGER_RESOLUTION_DELAY);
    
    return () => clearTimeout(timeoutId);
  }, []); // Empty dependency array - only trigger on initial mount

  return (
    <div className="space-y-4">
      {/* Show status indicator when resolving wagers */}
      {isResolvingWagers && (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded-r-lg">
          <p className="text-xs text-blue-700">
            ⚡ {resolutionStatus || 'Checking for completed games...'}
          </p>
        </div>
      )}
      
      {/* Current Balance - Prominent at Top */}
      <BalanceStatus userId={userId} rtdb={rtdb} auth={auth} />
      
      {/* Sub-Navigation Tabs */}
      <SubNavigationTabs activeTab={activeTab} setActiveTab={handleTabChange} />
      
      {/* Tab Content */}
      {activeTab === 'figures' && <FiguresTab userId={userId} rtdb={rtdb} />}
      {activeTab === 'pending' && <CurrentWagers userId={userId} rtdb={rtdb} optimisticWagers={optimisticWagers} />}
      {activeTab === 'transactions' && <TransactionsTab userId={userId} rtdb={rtdb} />}
      {activeTab === 'faqs' && <FAQsGuideTab />}
    </div>
  );
}

// ============================================================================
// Header Component - Mobile-First: Back button only shows on desktop
// ============================================================================
function Header({ userId, db, onBack, onNavigateHome }) {
  return (
    <header className="bg-blue-600 shadow-lg sticky top-0 z-30">
      <div className="max-w-3xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Back button only visible on desktop (hidden on mobile) */}
            {(onBack || onNavigateHome) && (
              <button
                onClick={onBack || onNavigateHome}
                className="hidden md:block p-2 rounded-lg bg-blue-500 hover:bg-blue-400 active:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-white shadow-md"
                aria-label="Back to Betting"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
              </button>
            )}
            <div>
              <h1 className="text-xl font-bold text-white">🎯 My Bets</h1>
              <p className="text-xs text-blue-200">View your wagers & credit</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell userId={userId} db={db} />
          </div>
        </div>
      </div>
    </header>
  );
}

// ============================================================================
// Loading Screen Component
// ============================================================================
function LoadingScreen({ message = "Loading and Authenticating..." }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-white border-t-transparent mx-auto mb-6"></div>
        <p className="text-white text-xl font-medium">{message}</p>
        <p className="text-blue-200 text-sm mt-2">Please wait...</p>
      </div>
    </div>
  );
}

// ============================================================================
// Fatal Error Screen Component
// ============================================================================
function FatalErrorScreen({ title, message, onRetry }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-12 h-12 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-3">
          {title}
        </h2>
        <p className="text-gray-600 mb-6 leading-relaxed">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
          >
            Try Again
          </button>
        )}
        <p className="text-gray-400 text-xs mt-6">
          If this issue persists, please contact support.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Main App Component
// ============================================================================
function MemberDashboardApp({ onNavigateToHome, optimisticWagers = [] }) {
  const [userId, setUserId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingError, setLoadingError] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [currentTab, setCurrentTab] = useState('pending'); // Track current tab for bottom nav

  // Check for Firebase initialization errors on mount
  useEffect(() => {
    // If Firebase failed to initialize, set error immediately
    if (firebaseInitError) {
      console.error("Firebase initialization error:", firebaseInitError);
      setLoadingError(firebaseInitError);
      setIsLoading(false);
      setIsAuthReady(true);
      return;
    }

    // If auth is not available, set error
    if (!auth) {
      setLoadingError("Firebase authentication is not available. Please check your configuration.");
      setIsLoading(false);
      setIsAuthReady(true);
      return;
    }

    let unsubscribe = null;
    let authTimeout = null;

    const handleAuth = async () => {
      try {
        if (initialAuthToken) {
          // Sign in with custom token if provided
          await signInWithCustomToken(auth, initialAuthToken);
        } else {
          // Fall back to anonymous sign-in
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Authentication error:", error);
        const errorMessage = error.code === 'auth/network-request-failed'
          ? "Network error. Please check your internet connection and try again."
          : `Authentication failed: ${error.message}`;
        setLoadingError(errorMessage);
        setIsLoading(false);
        setIsAuthReady(true);
      }
    };

    // Set a timeout to prevent infinite loading
    authTimeout = setTimeout(() => {
      if (!isAuthReady) {
        console.error("Authentication timeout - took too long to resolve");
        setLoadingError("Authentication is taking too long. Please check your network connection and try again.");
        setIsLoading(false);
        setIsAuthReady(true);
      }
    }, 30000); // 30 second timeout

    // Listen for auth state changes
    try {
      unsubscribe = onAuthStateChanged(auth, (user) => {
        // Clear the timeout since auth state resolved
        if (authTimeout) {
          clearTimeout(authTimeout);
          authTimeout = null;
        }

        if (user) {
          setUserId(user.uid);
          setLoadingError(null);
          setIsLoading(false);
          setIsAuthReady(true);
        } else {
          // No user, attempt authentication
          handleAuth();
        }
      }, (error) => {
        // Error callback for onAuthStateChanged
        console.error("Auth state change error:", error);
        setLoadingError(`Authentication error: ${error.message}`);
        setIsLoading(false);
        setIsAuthReady(true);
        
        if (authTimeout) {
          clearTimeout(authTimeout);
          authTimeout = null;
        }
      });
    } catch (error) {
      console.error("Failed to set up auth listener:", error);
      setLoadingError(`Failed to initialize authentication: ${error.message}`);
      setIsLoading(false);
      setIsAuthReady(true);
      
      if (authTimeout) {
        clearTimeout(authTimeout);
        authTimeout = null;
      }
    }

    return () => {
      if (authTimeout) {
        clearTimeout(authTimeout);
      }
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [isAuthReady]);

  // Show loading screen until authentication is complete
  if (isLoading && !loadingError) {
    return <LoadingScreen message="Loading your bets..." />;
  }

  // Show fatal error screen if there's a loading/initialization error
  if (loadingError) {
    return (
      <FatalErrorScreen 
        title="Initialization Error"
        message={loadingError}
        onRetry={() => window.location.reload()}
      />
    );
  }

  // If no user ID after auth is ready, show error
  if (!userId) {
    return (
      <FatalErrorScreen 
        title="Authentication Required"
        message="Unable to authenticate. Please try again."
        onRetry={() => window.location.reload()}
      />
    );
  }

  // Render main application - My Bets view (wager history only)
  return (
    <div className="min-h-screen bg-gray-100">
      <Header 
        userId={userId} 
        db={db} 
        onNavigateHome={onNavigateToHome}
        onBack={() => {
          // Fallback: Use prop if provided, otherwise use default navigation
          if (onNavigateToHome) {
            onNavigateToHome();
          } else {
            // Navigate back to the main betting page
            // Use window.history to go back or navigate to a specific page
            // Issue #1: Set flag to collapse betting slip when returning to Home
            sessionStorage.setItem(COLLAPSE_FLAG_KEY, 'true');
            if (window.history.length > 1) {
              window.history.back();
            } else {
              // Fallback: redirect to NFL betting page
              window.location.href = '/member/NFL';
            }
          }
        }}
      />

      <main className="max-w-3xl mx-auto px-4 py-4 pb-mobile-nav-safe">
        {/* Dashboard with Balance Status, Sub-Navigation, and Tabs */}
        <Dashboard 
          userId={userId} 
          db={db} 
          rtdb={rtdb} 
          auth={auth} 
          optimisticWagers={optimisticWagers}
          initialTab={currentTab}
          onTabChange={setCurrentTab}
        />
      </main>

      {/* Mobile Bottom Navigation - Always Visible */}
      <div className="mobile-bottom-nav">
        <button 
          onClick={() => setCurrentTab('faqs')}
          className={`mobile-nav-btn ${currentTab === 'faqs' ? 'mobile-nav-btn-active' : ''}`}
          title="View FAQs and Member Guide"
        >
          <span className="mobile-nav-icon">📖</span>
          <span className="mobile-nav-label">FAQs</span>
        </button>
        <button 
          onClick={() => {
            // Use prop if provided, otherwise use default navigation
            if (onNavigateToHome) {
              onNavigateToHome();
            } else {
              // NOTE: Using window.location.href is intentional here
              // This component doesn't have access to React Router context
              // See documentation at top of file for details
              // Issue #1: Set flag to collapse betting slip when returning to Home
              sessionStorage.setItem(COLLAPSE_FLAG_KEY, 'true');
              window.location.href = '/member/NFL';
            }
          }}
          className="mobile-nav-btn"
          title="Go to betting page"
        >
          <span className="mobile-nav-icon">🏠</span>
          <span className="mobile-nav-label">Home</span>
        </button>
        <button 
          className={`mobile-nav-btn ${currentTab === 'pending' ? 'mobile-nav-btn-active' : ''}`}
          title="My Bets - Current page"
          onClick={() => setCurrentTab('pending')}
        >
          <span className="mobile-nav-icon">🎯</span>
          <span className="mobile-nav-label">My Bets</span>
        </button>
        <button 
          onClick={async () => {
            // NOTE: Sign out should be handled by the parent App component
            // which has proper auth context and state management
            // For now, redirecting to root will trigger the auth check
            // and the user will be sent to login if not authenticated
            // TODO: If this component ever gains access to auth context,
            // call auth.signOut() before redirecting
            window.location.href = '/';
          }}
          className="mobile-nav-btn"
          title="Sign out"
        >
          <span className="mobile-nav-icon">🚪</span>
          <span className="mobile-nav-label">Sign Out</span>
        </button>
      </div>
    </div>
  );
}

export default MemberDashboardApp;

/*
=============================================================================
COMPLETE FIREBASE SECURITY RULES
=============================================================================

These are the COMPLETE and FINALIZED security rules for BOTH Firebase services.
Copy and paste these into their respective Firebase Console sections.

=============================================================================
1. FIREBASE REALTIME DATABASE RULES
=============================================================================
Go to: Firebase Console → Realtime Database → Rules

{
  "rules": {
    "spreads": {
      "$sport": {
        ".read": true,
        ".write": "auth != null && auth.token.admin === true",
        "$gameId": {
          ".validate": "newData.hasChildren(['awaySpread', 'homeSpread', 'total', 'timestamp'])",
          "awaySpread": { ".validate": "newData.isString()" },
          "homeSpread": { ".validate": "newData.isString()" },
          "total": { ".validate": "newData.isString()" },
          "timestamp": { ".validate": "newData.isString()" }
        }
      }
    },
    "admins": {
      ".read": "auth != null",
      ".write": false
    },
    "submissions": {
      ".read": true,
      "$ticketNumber": { ".write": true }
    },
    "analytics": {
      ".read": "auth != null && auth.token.admin === true",
      "$entry": { ".write": true }
    },
    "users": {
      ".read": "auth != null",
      ".write": "auth != null && auth.token.admin === true"
    },
    "artifacts": {
      "$appId": {
        "users": {
          "$userId": {
            ".read": "auth != null && auth.uid === $userId",
            ".write": "auth != null && auth.uid === $userId"
          }
        }
      }
    }
  }
}

=============================================================================
2. CLOUD FIRESTORE SECURITY RULES
=============================================================================
Go to: Firebase Console → Firestore Database → Rules

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Member Dashboard: Secure private user data (wagers and notifications)
    // Allows authenticated users to read/write only their own data
    match /artifacts/{appId}/users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
  }
}

=============================================================================
SECURITY SUMMARY
=============================================================================

✅ Realtime Database Rules:
   - spreads: Public read, admin-only write
   - admins: Authenticated read, no write
   - submissions: Public read, anyone can write
   - analytics: Admin-only read, anyone can write
   - users: Authenticated read, admin-only write
   - artifacts: User-specific read/write (NEW - Member Dashboard)

✅ Cloud Firestore Rules:
   - /artifacts/{appId}/users/{userId}/*: User-specific read/write
   - Covers wagers and notifications collections
   - Each user can ONLY access their own data

=============================================================================
*/
