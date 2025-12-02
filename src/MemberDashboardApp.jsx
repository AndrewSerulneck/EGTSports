import React, { useState, useEffect, useCallback } from "react";
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  getDocs,
} from "firebase/firestore";
import {
  getAuth,
  signInWithCustomToken,
  signInAnonymously,
  onAuthStateChanged,
} from "firebase/auth";

/* =============================================================================
   Member Dashboard and Wager Tracker - Single File React Application
   
   This application provides:
   - Simulated wager placement for authenticated users
   - Real-time current and past wager views
   - Real-time notification system with unread badge
   - Admin simulation tool for testing wager settlements
   
   Technology Stack:
   - React (JSX), functional components, hooks
   - Tailwind CSS (utility-first styling)
   - Firebase Auth and Cloud Firestore
   
   ============================================================================= */

// Global variables for Firebase configuration (provided by the host environment)
// eslint-disable-next-line no-undef
const appId = typeof __app_id !== "undefined" ? __app_id : "member-dashboard-dev";
// eslint-disable-next-line no-undef
const firebaseConfig = typeof __firebase_config !== "undefined" ? __firebase_config : {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyA9FsWV7hA4ow2Xaq0Krx9kCCMfMibkVOQ",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "marcs-parlays.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "marcs-parlays",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "marcs-parlays.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "631281528889",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:631281528889:web:e3befe34907902387c1de8",
};
// eslint-disable-next-line no-undef
const initialAuthToken = typeof __initial_auth_token !== "undefined" ? __initial_auth_token : null;

// ============================================================================
// Firebase Configuration Validation
// ============================================================================
const validateFirebaseConfig = (config) => {
  const requiredKeys = ['apiKey', 'authDomain', 'projectId'];
  const missingKeys = [];
  
  if (!config || typeof config !== 'object') {
    return { isValid: false, error: 'Firebase configuration is missing or invalid.' };
  }
  
  for (const key of requiredKeys) {
    if (!config[key] || config[key].trim() === '') {
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
const configValidation = validateFirebaseConfig(firebaseConfig);

// ============================================================================
// Firebase Initialization
// ============================================================================
let app = null;
let db = null;
let auth = null;
let firebaseInitError = null;

if (configValidation.isValid) {
  try {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    db = getFirestore(app);
    auth = getAuth(app);
  } catch (error) {
    console.error("Firebase initialization error:", error);
    firebaseInitError = `Firebase initialization failed: ${error.message}`;
  }
} else {
  firebaseInitError = configValidation.error;
}

// ============================================================================
// Firestore Collection Paths
// ============================================================================
const getWagersCollectionPath = (userId) =>
  `/artifacts/${appId}/users/${userId}/wagers`;

const getNotificationsCollectionPath = (userId) =>
  `/artifacts/${appId}/users/${userId}/notifications`;

// ============================================================================
// Wager Input Component
// ============================================================================
function WagerInput({ userId, db }) {
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!amount || parseFloat(amount) <= 0) {
      setFeedback({ type: "error", message: "Please enter a valid amount." });
      return;
    }
    if (!details.trim()) {
      setFeedback({ type: "error", message: "Please enter wager details." });
      return;
    }

    setIsSubmitting(true);
    setFeedback({ type: "", message: "" });

    try {
      const wagersRef = collection(db, getWagersCollectionPath(userId));
      await addDoc(wagersRef, {
        userId,
        amount: parseFloat(amount),
        details: details.trim(),
        status: "pending",
        datePlaced: serverTimestamp(),
        dateSettled: null,
        payout: null,
      });

      setFeedback({ type: "success", message: "Wager placed successfully!" });
      setAmount("");
      setDetails("");
    } catch (error) {
      console.error("Error placing wager:", error);
      setFeedback({
        type: "error",
        message: "Failed to place wager. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <h2 className="text-lg font-bold text-gray-800 mb-3">Place a Wager</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label
            htmlFor="amount"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Amount ($)
          </label>
          <input
            type="number"
            id="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
            min="0.01"
            step="0.01"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
          />
        </div>
        <div>
          <label
            htmlFor="details"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Wager Details
          </label>
          <input
            type="text"
            id="details"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="e.g., Team A to win"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full py-3 px-4 rounded-md font-semibold text-white transition-colors ${
            isSubmitting
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
          }`}
        >
          {isSubmitting ? "Placing Wager..." : "Place Wager"}
        </button>
      </form>
      {feedback.message && (
        <div
          className={`mt-3 p-3 rounded-md text-sm ${
            feedback.type === "success"
              ? "bg-green-100 text-green-700 border border-green-200"
              : "bg-red-100 text-red-700 border border-red-200"
          }`}
        >
          {feedback.message}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Current Wagers Component (Pending Wagers)
// ============================================================================
function CurrentWagers({ userId, db }) {
  const [wagers, setWagers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const wagersRef = collection(db, getWagersCollectionPath(userId));
    const q = query(
      wagersRef,
      where("status", "==", "pending"),
      orderBy("datePlaced", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const wagersData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setWagers(wagersData);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching current wagers:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId, db]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <h2 className="text-lg font-bold text-gray-800 mb-3">Current Wagers</h2>
        <div className="flex justify-center items-center h-20">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <h2 className="text-lg font-bold text-gray-800 mb-3">
        Current Wagers ({wagers.length})
      </h2>
      {wagers.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">
          No pending wagers
        </p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {wagers.map((wager) => (
            <div
              key={wager.id}
              className="bg-yellow-50 border border-yellow-200 rounded-md p-3"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {wager.details}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {wager.datePlaced?.toDate
                      ? wager.datePlaced.toDate().toLocaleString()
                      : "Just now"}
                  </p>
                </div>
                <div className="text-right ml-2">
                  <p className="text-sm font-bold text-gray-800">
                    ${wager.amount?.toFixed(2)}
                  </p>
                  <span className="inline-block px-2 py-0.5 text-xs font-medium bg-yellow-200 text-yellow-800 rounded-full">
                    Pending
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Past Wagers Component (Won/Lost Wagers)
// ============================================================================
function PastWagers({ userId, db }) {
  const [wagers, setWagers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const wagersRef = collection(db, getWagersCollectionPath(userId));
    const q = query(
      wagersRef,
      where("status", "in", ["won", "lost"]),
      orderBy("dateSettled", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const wagersData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setWagers(wagersData);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching past wagers:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId, db]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <h2 className="text-lg font-bold text-gray-800 mb-3">Past Wagers</h2>
        <div className="flex justify-center items-center h-20">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <h2 className="text-lg font-bold text-gray-800 mb-3">
        Past Wagers ({wagers.length})
      </h2>
      {wagers.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">
          No past wagers
        </p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {wagers.map((wager) => (
            <div
              key={wager.id}
              className={`rounded-md p-3 border ${
                wager.status === "won"
                  ? "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {wager.details}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Settled:{" "}
                    {wager.dateSettled?.toDate
                      ? wager.dateSettled.toDate().toLocaleString()
                      : "Unknown"}
                  </p>
                </div>
                <div className="text-right ml-2">
                  <p className="text-sm font-bold text-gray-800">
                    ${wager.amount?.toFixed(2)}
                  </p>
                  <span
                    className={`inline-block px-2 py-0.5 text-xs font-bold rounded-full ${
                      wager.status === "won"
                        ? "bg-green-500 text-white"
                        : "bg-red-500 text-white"
                    }`}
                  >
                    {wager.status === "won" ? "WON" : "LOST"}
                  </span>
                  {wager.status === "won" && wager.payout && (
                    <p className="text-xs font-semibold text-green-600 mt-1">
                      +${wager.payout.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Notification Bell Component
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
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-white"
        aria-label="Notifications"
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
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-lg shadow-xl z-50 max-h-96 overflow-hidden">
          <div className="p-3 bg-gray-100 border-b border-gray-200">
            <h3 className="font-semibold text-gray-800">Notifications</h3>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-4 text-gray-500 text-sm text-center">
                No notifications
              </p>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full text-left p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    !notification.isRead ? "bg-blue-50" : ""
                  }`}
                >
                  <p className="text-sm text-gray-800">{notification.message}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {notification.timestamp?.toDate
                      ? notification.timestamp.toDate().toLocaleString()
                      : "Just now"}
                  </p>
                  {!notification.isRead && (
                    <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-blue-500 text-white rounded-full">
                      New
                    </span>
                  )}
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
// Simulate Result Button (Admin/Testing Tool)
// ============================================================================
function SimulateResultButton({ userId, db }) {
  const [isSimulating, setIsSimulating] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  const simulateResult = useCallback(async () => {
    if (isSimulating) return;

    setIsSimulating(true);
    setFeedback({ type: "", message: "" });

    try {
      // Fetch the oldest pending wager
      const wagersRef = collection(db, getWagersCollectionPath(userId));
      const q = query(
        wagersRef,
        where("status", "==", "pending"),
        orderBy("datePlaced", "asc"),
        limit(1)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setFeedback({
          type: "info",
          message: "No pending wagers to settle.",
        });
        setIsSimulating(false);
        return;
      }

      const wagerDoc = snapshot.docs[0];
      const wagerData = wagerDoc.data();

      // Randomly determine win (70%) or loss (30%)
      const isWin = Math.random() < 0.7;
      const status = isWin ? "won" : "lost";

      // Calculate random payout if won (1.5x to 3x the bet)
      const payout = isWin
        ? wagerData.amount * (1.5 + Math.random() * 1.5)
        : 0;

      // Create batch for atomic operations
      const batch = writeBatch(db);

      // Update wager
      const wagerRef = doc(db, getWagersCollectionPath(userId), wagerDoc.id);
      batch.update(wagerRef, {
        status,
        dateSettled: serverTimestamp(),
        payout: isWin ? payout : null,
      });

      // Create notification
      const notificationsRef = collection(
        db,
        getNotificationsCollectionPath(userId)
      );
      const notificationRef = doc(notificationsRef);
      const message = isWin
        ? `🎉 Wager "${wagerData.details}" WON! Payout: $${payout.toFixed(2)}`
        : `❌ Wager "${wagerData.details}" LOST.`;

      batch.set(notificationRef, {
        wagerId: wagerDoc.id,
        message,
        isRead: false,
        timestamp: serverTimestamp(),
      });

      // Commit batch
      await batch.commit();

      setFeedback({
        type: isWin ? "success" : "error",
        message: isWin
          ? `Wager won! Payout: $${payout.toFixed(2)}`
          : "Wager lost.",
      });
    } catch (error) {
      console.error("Error simulating result:", error);
      setFeedback({
        type: "error",
        message: "Failed to simulate result. Please try again.",
      });
    } finally {
      setIsSimulating(false);

      // Clear feedback after 3 seconds
      setTimeout(() => {
        setFeedback({ type: "", message: "" });
      }, 3000);
    }
  }, [userId, db, isSimulating]);

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={simulateResult}
        disabled={isSimulating}
        className={`px-4 py-2 rounded-md font-semibold text-sm transition-colors ${
          isSimulating
            ? "bg-gray-400 cursor-not-allowed text-gray-200"
            : "bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white"
        }`}
      >
        {isSimulating ? "Simulating..." : "🎲 Simulate Next Result"}
      </button>
      <span className="text-xs text-gray-500">Test Only</span>
      {feedback.message && (
        <span
          className={`text-xs ${
            feedback.type === "success"
              ? "text-green-600"
              : feedback.type === "error"
              ? "text-red-600"
              : "text-gray-600"
          }`}
        >
          {feedback.message}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Dashboard Component
// ============================================================================
function Dashboard({ userId, db }) {
  return (
    <div className="space-y-4">
      <CurrentWagers userId={userId} db={db} />
      <PastWagers userId={userId} db={db} />
    </div>
  );
}

// ============================================================================
// Header Component
// ============================================================================
function Header({ userId, db }) {
  return (
    <header className="bg-blue-600 shadow-lg sticky top-0 z-30">
      <div className="max-w-3xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Member Dashboard</h1>
            <p className="text-xs text-blue-200">Wager Tracker</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Desktop simulate button */}
            <div className="hidden sm:block">
              <SimulateResultButton userId={userId} db={db} />
            </div>
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
function MemberDashboardApp() {
  const [userId, setUserId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingError, setLoadingError] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

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
    return <LoadingScreen message="Loading and Authenticating..." />;
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

  // Render main application
  return (
    <div className="min-h-screen bg-gray-100">
      <Header userId={userId} db={db} />

      <main className="max-w-3xl mx-auto px-4 py-4 pb-24 sm:pb-4">
        {/* Wager Input */}
        <WagerInput userId={userId} db={db} />

        {/* Dashboard with Current and Past Wagers */}
        <Dashboard userId={userId} db={db} />
      </main>

      {/* Mobile-only floating simulate button */}
      <div className="fixed bottom-4 left-4 right-4 sm:hidden">
        <div className="bg-white rounded-lg shadow-lg p-3 flex justify-center">
          <SimulateResultButton userId={userId} db={db} />
        </div>
      </div>
    </div>
  );
}

export default MemberDashboardApp;

/*
=============================================================================
FIRESTORE SECURITY RULES
=============================================================================
The following Firestore Security Rules must be added to secure the Wagers
and Notifications collections. Merge this with your existing ruleset:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Member Dashboard: Secure private user data
    match /artifacts/{appId}/users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Add your other existing rules below...
    
  }
}
=============================================================================
*/
