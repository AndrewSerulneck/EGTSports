// Consolidated Wager Manager - Master API Route
// Handles: submit, cancel, reset, resolve, updateScores, getPropBets, getHistory
// Route pattern: /api/wager-manager?action=<action>

let admin;
let initializationError = null;

// Safely require firebase-admin
try {
  admin = require('firebase-admin');
} catch (error) {
  initializationError = `Failed to load firebase-admin module: ${error.message}`;
  console.error(initializationError);
}

// Initialize Firebase Admin SDK
const initializeFirebaseAdmin = () => {
  if (!admin) {
    return false;
  }
  
  if (admin.apps && admin.apps.length) {
    return true; // Already initialized
  }

  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const databaseUrl = process.env.FIREBASE_DATABASE_URL;

    if (!projectId || !clientEmail || !privateKey || !databaseUrl) {
      initializationError = 'Missing required Firebase environment variables';
      return false;
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: projectId,
        clientEmail: clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
      databaseURL: databaseUrl
    });
    return true;
  } catch (error) {
    console.error('Firebase admin initialization error:', error.message);
    initializationError = error.message;
    return false;
  }
};

// Try to initialize on module load
if (admin) {
  initializeFirebaseAdmin();
}

// Set CORS headers helper
const setCorsHeaders = (res, req) => {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
};

// Check Firebase initialization
const checkFirebaseInit = (res) => {
  if (!admin) {
    res.status(500).json({ 
      success: false, 
      error: 'Server configuration error: Firebase Admin module failed to load',
      troubleshooting: initializationError
    });
    return false;
  }

  if (initializationError || !admin.apps || !admin.apps.length) {
    if (!initializeFirebaseAdmin()) {
      res.status(500).json({ 
        success: false, 
        error: 'Server configuration error: Firebase Admin SDK failed to initialize',
        troubleshooting: initializationError
      });
      return false;
    }
  }
  return true;
};

// ESPN API endpoints for checking game status
const ESPN_API_ENDPOINTS = {
  'NFL': 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  'NBA': 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  'College Football': 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
  'College Basketball': 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard',
  'Major League Baseball': 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
  'NHL': 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard'
};

// Parlay multipliers
const PARLAY_MULTIPLIERS = {
  3: 8,
  4: 15,
  5: 25,
  6: 50,
  7: 100,
  8: 150,
  9: 200,
  10: 250
};

// Rate limiting for public endpoints
let lastPublicResolutionTime = 0;
const PUBLIC_RESOLUTION_COOLDOWN = 30000; // 30 seconds

// Main router
module.exports = async (req, res) => {
  try {
    setCorsHeaders(res, req);

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    if (!checkFirebaseInit(res)) {
      return;
    }

    const action = req.query.action || req.body.action;

    if (!action) {
      return res.status(400).json({
        success: false,
        error: 'Missing action parameter',
        hint: 'Use ?action=<action> where action is: submit, cancel, reset, resolve, updateScores, getPropBets, getHistory'
      });
    }

    // Route to appropriate handler based on action
    switch (action) {
      case 'submit':
        return await handleSubmitWager(req, res);
      case 'cancel':
        return await handleCancelWager(req, res);
      case 'reset':
        return await handleResetWager(req, res);
      case 'resolve':
        return await handleResolveWagers(req, res);
      case 'updateScores':
        return await handleUpdateGameScores(req, res);
      case 'getPropBets':
        return await handleGetPropBets(req, res);
      case 'getHistory':
        return await handleGetHistory(req, res);
      default:
        return res.status(400).json({
          success: false,
          error: `Unknown action: ${action}`,
          availableActions: ['submit', 'cancel', 'reset', 'resolve', 'updateScores', 'getPropBets', 'getHistory']
        });
    }
  } catch (error) {
    console.error('Wager Manager error:', error);
    return res.status(500).json({
      success: false,
      error: 'An unexpected server error occurred',
      message: error.message || 'Unknown error'
    });
  }
};

// ============================================================================
// Handler: Submit Wager
// ============================================================================
async function handleSubmitWager(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    // Verify the user making the request
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const { wagerAmount, wagerData } = req.body;

    // Validate input
    if (wagerAmount === undefined || wagerAmount === null) {
      return res.status(400).json({ success: false, error: 'Missing wager amount' });
    }

    const amount = parseFloat(wagerAmount);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Wager amount must be a positive number' });
    }

    // Get the user's current data from the database
    const userSnapshot = await admin.database().ref(`users/${uid}`).once('value');
    
    if (!userSnapshot.exists()) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found',
        hint: 'User account may not be properly registered'
      });
    }

    const userData = userSnapshot.val();
    
    // New dynamic balance system
    const baseCreditLimit = parseFloat(userData.base_credit_limit) || parseFloat(userData.creditLimit) || 100;
    const currentBalance = userData.current_balance !== undefined 
      ? parseFloat(userData.current_balance) 
      : baseCreditLimit; // Fallback for legacy users
    const currentTotalWagered = parseFloat(userData.totalWagered) || 0;
    const userStatus = userData.status;

    // Check if user is revoked
    if (userStatus === 'revoked') {
      return res.status(403).json({ 
        success: false, 
        error: 'Account has been revoked',
        hint: 'Contact an administrator to reactivate your account'
      });
    }

    // Check if wager amount exceeds current_balance
    if (amount > currentBalance) {
      return res.status(400).json({ 
        success: false, 
        error: 'Insufficient balance',
        details: {
          wagerAmount: amount,
          currentBalance: currentBalance,
          baseCreditLimit: baseCreditLimit
        },
        hint: `Your current balance is $${currentBalance.toFixed(2)}. Your wager of $${amount.toFixed(2)} exceeds this amount.`
      });
    }

    // Calculate new balance
    const newBalance = currentBalance - amount;
    const newTotalWagered = currentTotalWagered + amount;

    // Update the user's balance and total wagered
    await admin.database().ref(`users/${uid}`).update({
      current_balance: newBalance,
      totalWagered: newTotalWagered
    });

    // Store the wager details in wagers collection
    if (wagerData) {
      const wagerRef = admin.database().ref('wagers').push();
      const wagerId = wagerRef.key;
      await wagerRef.set({
        uid: uid,
        email: userData.email,
        displayName: userData.displayName,
        amount: amount,
        wagerData: wagerData,
        createdAt: new Date().toISOString(),
        status: 'pending'
      });
      
      // Create a transaction record
      const transactionRef = admin.database().ref(`transactions/${uid}`).push();
      await transactionRef.set({
        timestamp: new Date().toISOString(),
        description: `Wager Placed - ${wagerData.betType || 'Bet'} ($${amount.toFixed(2)})`,
        amount: -amount,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        type: 'wager',
        wagerId: wagerId,
        createdAt: new Date().toISOString()
      });
    }

    console.log(`Wager submitted: User ${uid} wagered $${amount}. New balance: $${newBalance.toFixed(2)}`);

    return res.status(200).json({
      success: true,
      message: 'Wager submitted successfully',
      details: {
        wagerAmount: amount,
        previousBalance: currentBalance,
        newBalance: newBalance,
        baseCreditLimit: baseCreditLimit
      }
    });

  } catch (error) {
    console.error('Error submitting wager:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ 
        success: false, 
        error: 'Session expired',
        hint: 'Please log in again'
      });
    }

    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to submit wager'
    });
  }
}

// ============================================================================
// Handler: Cancel Wager  
// ============================================================================
async function handleCancelWager(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    // Verify the user making the request is an admin
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Check if user is admin
    if (!decodedToken.admin) {
      return res.status(403).json({ 
        success: false, 
        error: 'Admin privileges required to cancel wagers'
      });
    }

    const { wagerId, submissionId } = req.body;

    // Validate input - accept either wagerId or submissionId
    const targetId = wagerId || submissionId;
    if (!targetId) {
      return res.status(400).json({ success: false, error: 'Missing wagerId or submissionId' });
    }

    const db = admin.database();

    // Try to find the wager in the wagers collection first
    let wagerSnapshot = await db.ref(`wagers/${targetId}`).once('value');
    let wagerData = wagerSnapshot.val();
    let wagerPath = `wagers/${targetId}`;
    let wagerSource = 'wagers';

    // If not found in wagers, check submissions
    if (!wagerData) {
      wagerSnapshot = await db.ref(`submissions/${targetId}`).once('value');
      wagerData = wagerSnapshot.val();
      wagerPath = `submissions/${targetId}`;
      wagerSource = 'submissions';
    }

    if (!wagerData) {
      return res.status(404).json({ 
        success: false, 
        error: 'Wager/Submission not found'
      });
    }

    // Check if already canceled
    if (wagerData.status === 'CANCELED' || wagerData.status === 'canceled') {
      return res.status(400).json({ 
        success: false, 
        error: 'This wager has already been canceled'
      });
    }

    // Get the wager amount and user ID
    const wagerAmount = parseFloat(wagerData.amount || wagerData.betAmount) || 0;
    const userId = wagerData.uid || wagerData.userId;

    if (!userId) {
      // If no userId, we can still cancel but won't return credit
      await db.ref(wagerPath).update({
        status: 'CANCELED',
        canceledAt: new Date().toISOString(),
        canceledBy: decodedToken.uid
      });

      return res.status(200).json({
        success: true,
        message: 'Wager canceled (no user ID found, credit not returned)',
        details: {
          wagerId: targetId,
          source: wagerSource,
          creditReturned: 0
        }
      });
    }

    // Get the user's current balance
    const userSnapshot = await db.ref(`users/${userId}`).once('value');
    
    if (!userSnapshot.exists()) {
      // Cancel the wager but note user not found
      await db.ref(wagerPath).update({
        status: 'CANCELED',
        canceledAt: new Date().toISOString(),
        canceledBy: decodedToken.uid
      });

      return res.status(200).json({
        success: true,
        message: 'Wager canceled (user not found in database, credit not returned)',
        details: {
          wagerId: targetId,
          source: wagerSource,
          userId: userId,
          creditReturned: 0
        }
      });
    }

    const userData = userSnapshot.val();
    const currentBalance = parseFloat(userData.current_balance) || 0;
    const currentTotalWagered = parseFloat(userData.totalWagered) || 0;

    // Return credit to user
    const newBalance = currentBalance + wagerAmount;
    const newTotalWagered = Math.max(0, currentTotalWagered - wagerAmount);

    // Update user's balance and totalWagered atomically
    await db.ref(`users/${userId}`).update({
      current_balance: newBalance,
      totalWagered: newTotalWagered
    });

    // Update wager status
    await db.ref(wagerPath).update({
      status: 'CANCELED',
      canceledAt: new Date().toISOString(),
      canceledBy: decodedToken.uid,
      creditReturned: wagerAmount
    });

    // Create transaction record
    const transactionRef = db.ref(`transactions/${userId}`).push();
    await transactionRef.set({
      timestamp: new Date().toISOString(),
      description: `Wager Canceled - Stake Returned (+$${wagerAmount.toFixed(2)})`,
      amount: wagerAmount,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      type: 'cancel',
      wagerId: targetId,
      createdAt: new Date().toISOString()
    });

    console.log(`Wager ${targetId} canceled by admin ${decodedToken.uid}. Credit ${wagerAmount} returned to user ${userId}.`);

    return res.status(200).json({
      success: true,
      message: 'Wager canceled and credit returned successfully',
      details: {
        wagerId: targetId,
        source: wagerSource,
        userId: userId,
        creditReturned: wagerAmount,
        previousBalance: currentBalance,
        newBalance: newBalance
      }
    });

  } catch (error) {
    console.error('Error canceling wager:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ 
        success: false, 
        error: 'Session expired',
        hint: 'Please log in again'
      });
    }

    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to cancel wager'
    });
  }
}

// ============================================================================
// Handler: Reset Wager (Admin only)
// ============================================================================
async function handleResetWager(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    // Verify admin privileges
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    if (!decodedToken.admin) {
      return res.status(403).json({ 
        success: false, 
        error: 'Admin privileges required'
      });
    }

    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'Missing userId' });
    }

    const db = admin.database();
    const userRef = db.ref(`users/${userId}`);
    
    const userSnapshot = await userRef.once('value');
    if (!userSnapshot.exists()) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found'
      });
    }

    const userData = userSnapshot.val();
    const previousTotalWagered = parseFloat(userData.totalWagered) || 0;
    const creditLimit = parseFloat(userData.creditLimit) || 100;

    // Reset totalWagered to 0
    await userRef.update({
      totalWagered: 0,
      lastManualReset: new Date().toISOString(),
      lastManualResetBy: decodedToken.uid
    });

    console.log(`Admin ${decodedToken.uid} reset totalWagered for user ${userId} from ${previousTotalWagered} to 0`);

    return res.status(200).json({
      success: true,
      message: 'User wager total reset successfully',
      details: {
        userId: userId,
        previousTotalWagered: previousTotalWagered,
        newTotalWagered: 0,
        creditLimit: creditLimit,
        resetBy: decodedToken.uid
      }
    });

  } catch (error) {
    console.error('Error resetting wager:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ 
        success: false, 
        error: 'Session expired',
        hint: 'Please log in again'
      });
    }

    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to reset wager'
    });
  }
}

// ============================================================================
// Handler: Resolve Wagers
// ============================================================================
async function handleResolveWagers(req, res) {
  try {
    // Authentication logic
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    const providedCronSecret = req.headers['x-vercel-cron-secret'] || req.query.secret;
    
    let isAuthenticated = false;
    
    // If invoked manually with auth token, verify admin
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split('Bearer ')[1];
      try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        
        if (!decodedToken.admin) {
          return res.status(403).json({ 
            success: false, 
            error: 'Admin privileges required'
          });
        }
        isAuthenticated = true;
      } catch (authError) {
        return res.status(401).json({
          success: false,
          error: 'Invalid authentication token'
        });
      }
    } else if (providedCronSecret) {
      // If a cron secret is provided, verify it
      if (!cronSecret) {
        return res.status(500).json({
          success: false,
          error: 'Server configuration error: CRON_SECRET not configured'
        });
      }
      if (providedCronSecret !== cronSecret) {
        return res.status(401).json({ 
          success: false, 
          error: 'Unauthorized: Invalid cron secret'
        });
      }
      isAuthenticated = true;
    }
    
    // If not authenticated, apply rate limiting
    if (!isAuthenticated) {
      const now = Date.now();
      if (now - lastPublicResolutionTime < PUBLIC_RESOLUTION_COOLDOWN) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((PUBLIC_RESOLUTION_COOLDOWN - (now - lastPublicResolutionTime)) / 1000)
        });
      }
      lastPublicResolutionTime = now;
    }

    const db = admin.database();

    // Get all pending wagers
    const wagersSnapshot = await db.ref('wagers').orderByChild('status').equalTo('pending').once('value');
    
    if (!wagersSnapshot.exists()) {
      return res.status(200).json({
        success: true,
        message: 'No pending wagers to resolve',
        resolved: 0
      });
    }

    const wagers = wagersSnapshot.val();
    const results = {
      total: 0,
      resolved: 0,
      won: 0,
      lost: 0,
      push: 0,
      errors: 0,
      skipped: 0
    };

    // Process each wager
    for (const [wagerId, wagerData] of Object.entries(wagers)) {
      results.total++;
      
      const result = await resolveWager(wagerId, wagerData, db);
      
      if (result.success) {
        results.resolved++;
        if (result.status === 'won') {
          results.won++;
        } else if (result.status === 'lost') {
          results.lost++;
        } else if (result.status === 'push') {
          results.push++;
        }
      } else if (result.reason === 'error') {
        results.errors++;
      } else {
        results.skipped++;
      }
    }

    console.log(`Wager resolution complete: ${JSON.stringify(results)}`);

    return res.status(200).json({
      success: true,
      message: 'Wager resolution complete',
      results: results
    });

  } catch (error) {
    console.error('Error in wager resolution:', error);
    
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to resolve wagers'
    });
  }
}

// Helper function to resolve a single wager
async function resolveWager(wagerId, wagerData, db) {
  try {
    const picks = wagerData.wagerData?.picks || wagerData.picks;
    if (!picks || !Array.isArray(picks) || picks.length === 0) {
      console.log(`Wager ${wagerId} has no picks, skipping`);
      return { success: false, reason: 'no_picks' };
    }

    // Check all picks and fetch game data
    const pickResults = [];
    let allGamesComplete = true;

    for (const pick of picks) {
      const gameData = await fetchGameData(pick.gameId, pick.sport, db);
      
      if (!gameData) {
        console.log(`Game data not available for ${pick.gameId}`);
        allGamesComplete = false;
        break;
      }

      if (!gameData.isFinal) {
        allGamesComplete = false;
        break;
      }

      const outcome = calculatePickOutcome(pick, gameData);
      pickResults.push({
        pick: pick,
        gameData: gameData,
        outcome: outcome
      });
    }

    // If not all games are complete, don't resolve yet
    if (!allGamesComplete) {
      return { success: false, reason: 'games_not_complete' };
    }

    // Calculate overall wager outcome
    let wins = 0;
    let losses = 0;
    let pushes = 0;

    pickResults.forEach(result => {
      if (result.outcome === 'win') {
        wins++;
      } else if (result.outcome === 'loss') {
        losses++;
      } else if (result.outcome === 'push') {
        pushes++;
      }
    });

    let wagerStatus;
    let payout = 0;
    const betType = wagerData.wagerData?.betType || wagerData.betType || 'parlay';
    const wagerAmount = parseFloat(wagerData.amount) || 0;

    if (betType === 'parlay') {
      if (losses > 0 || pushes > 0) {
        wagerStatus = 'lost';
      } else if (wins === picks.length) {
        wagerStatus = 'won';
        const multiplier = PARLAY_MULTIPLIERS[picks.length] || 0;
        payout = wagerAmount * multiplier;
      } else {
        wagerStatus = 'lost';
      }
    } else {
      if (wins > 0) {
        wagerStatus = 'won';
        payout = wagerAmount * 1.91;
      } else if (pushes > 0) {
        wagerStatus = 'push';
        payout = wagerAmount;
      } else {
        wagerStatus = 'lost';
      }
    }

    // Update wager in database
    const updates = {
      status: wagerStatus,
      settledAt: new Date().toISOString(),
      payout: payout,
      pickResults: pickResults.map(r => ({
        gameId: r.pick.gameId,
        team: r.pick.team,
        outcome: r.outcome,
        finalScore: `${r.gameData.awayTeam} ${r.gameData.awayScore} - ${r.gameData.homeScore} ${r.gameData.homeTeam}`
      }))
    };

    await db.ref(`wagers/${wagerId}`).update(updates);

    // Update user's current_balance if wager won or pushed
    if (payout > 0 && wagerData.uid) {
      const userId = wagerData.uid;
      const userRef = db.ref(`users/${userId}`);
      const userSnapshot = await userRef.once('value');
      
      if (userSnapshot.exists()) {
        const userData = userSnapshot.val();
        const currentBalance = parseFloat(userData.current_balance) || 0;
        const newBalance = currentBalance + payout;
        
        // Update balance
        await userRef.update({
          current_balance: newBalance
        });
        
        // Create transaction record
        const transactionRef = db.ref(`transactions/${userId}`).push();
        let description = '';
        if (wagerStatus === 'won') {
          description = `Wager Won - ${betType} (+$${payout.toFixed(2)})`;
        } else if (wagerStatus === 'push') {
          description = `Wager Pushed - Stake Returned (+$${payout.toFixed(2)})`;
        }
        
        await transactionRef.set({
          timestamp: new Date().toISOString(),
          description: description,
          amount: payout,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          type: wagerStatus === 'won' ? 'win' : 'push',
          wagerId: wagerId,
          createdAt: new Date().toISOString()
        });
        
        console.log(`✅ User ${userId} balance updated: ${currentBalance} -> ${newBalance}`);
      }
    }

    console.log(`✅ Wager ${wagerId} resolved as ${wagerStatus}`);
    return { success: true, status: wagerStatus, payout: payout };

  } catch (error) {
    console.error(`Error resolving wager ${wagerId}:`, error);
    return { success: false, reason: 'error', error: error.message };
  }
}

// Helper function to fetch game data
async function fetchGameData(gameId, sport, db) {
  try {
    // Try cached results first
    if (db) {
      try {
        const cachedResult = await db.ref(`gameResults/${sport}/${gameId}`).once('value');
        if (cachedResult.exists()) {
          const data = cachedResult.val();
          console.log(`Using cached game result for ${gameId}`);
          return {
            id: gameId,
            status: data.status,
            isFinal: data.isFinal,
            awayScore: data.awayScore,
            homeScore: data.homeScore,
            awayTeam: data.awayTeam,
            homeTeam: data.homeTeam
          };
        }
      } catch (dbError) {
        console.warn(`Database lookup failed for ${gameId}, falling back to API:`, dbError);
      }
    }
    
    // Fall back to ESPN API
    const baseUrl = ESPN_API_ENDPOINTS[sport];
    if (!baseUrl) {
      console.error(`Unknown sport: ${sport}`);
      return null;
    }

    const response = await fetch(baseUrl);
    if (!response.ok) {
      console.error(`ESPN API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (!data.events || !Array.isArray(data.events)) {
      return null;
    }

    const event = data.events.find(e => e.id === gameId);
    if (!event) {
      return null;
    }

    const competition = event.competitions[0];
    const awayTeam = competition.competitors[1];
    const homeTeam = competition.competitors[0];
    const status = event.status.type.state;

    return {
      id: event.id,
      status: status,
      isFinal: status === 'post',
      awayScore: parseInt(awayTeam.score) || 0,
      homeScore: parseInt(homeTeam.score) || 0,
      awayTeam: awayTeam.team.displayName,
      homeTeam: homeTeam.team.displayName
    };
  } catch (error) {
    console.error(`Error fetching game data for ${gameId}:`, error);
    return null;
  }
}

// Helper function to calculate pick outcome
function calculatePickOutcome(pick, gameData) {
  if (pick.pickType === 'spread') {
    const spread = parseFloat(pick.spread);
    if (isNaN(spread)) {
      return 'unknown';
    }

    if (pick.pickedTeamType === 'away') {
      const adjustedScore = gameData.awayScore + spread;
      if (adjustedScore > gameData.homeScore) {
        return 'win';
      } else if (adjustedScore === gameData.homeScore) {
        return 'push';
      } else {
        return 'loss';
      }
    } else {
      const adjustedScore = gameData.homeScore + spread;
      if (adjustedScore > gameData.awayScore) {
        return 'win';
      } else if (adjustedScore === gameData.awayScore) {
        return 'push';
      } else {
        return 'loss';
      }
    }
  } else if (pick.pickType === 'winner' || pick.pickType === 'moneyline') {
    if (pick.pickedTeamType === 'away') {
      return gameData.awayScore > gameData.homeScore ? 'win' : 'loss';
    } else {
      return gameData.homeScore > gameData.awayScore ? 'win' : 'loss';
    }
  } else if (pick.pickType === 'total') {
    const total = parseFloat(pick.total);
    if (isNaN(total)) {
      return 'unknown';
    }

    const totalScore = gameData.awayScore + gameData.homeScore;
    if (pick.overUnder === 'over') {
      if (totalScore > total) {
        return 'win';
      } else if (totalScore === total) {
        return 'push';
      } else {
        return 'loss';
      }
    } else {
      if (totalScore < total) {
        return 'win';
      } else if (totalScore === total) {
        return 'push';
      } else {
        return 'loss';
      }
    }
  }

  return 'unknown';
}

// ============================================================================
// Handler: Update Game Scores
// ============================================================================
async function handleUpdateGameScores(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const db = admin.database();
    const results = {
      total: 0,
      updated: 0,
      errors: []
    };

    // Fetch scores for all sports
    for (const [sport, apiUrl] of Object.entries(ESPN_API_ENDPOINTS)) {
      try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
          results.errors.push(`${sport}: API returned ${response.status}`);
          continue;
        }

        const data = await response.json();
        
        if (!data.events || !Array.isArray(data.events)) {
          results.errors.push(`${sport}: No events data`);
          continue;
        }

        for (const event of data.events) {
          results.total++;
          const competition = event.competitions[0];
          const awayTeam = competition.competitors[1];
          const homeTeam = competition.competitors[0];
          const status = event.status.type.state;

          const gameResult = {
            sport: sport,
            gameId: event.id,
            status: status,
            isFinal: status === 'post',
            awayTeam: awayTeam.team.displayName,
            homeTeam: homeTeam.team.displayName,
            awayScore: parseInt(awayTeam.score) || 0,
            homeScore: parseInt(homeTeam.score) || 0,
            lastUpdated: new Date().toISOString()
          };

          await db.ref(`gameResults/${sport}/${event.id}`).set(gameResult);
          results.updated++;
        }
      } catch (error) {
        results.errors.push(`${sport}: ${error.message}`);
      }
    }

    console.log(`Game scores update complete: ${JSON.stringify(results)}`);

    return res.status(200).json({
      success: true,
      message: 'Game scores updated',
      results: results
    });

  } catch (error) {
    console.error('Error updating game scores:', error);
    
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to update game scores'
    });
  }
}

// ============================================================================
// Handler: Get Prop Bets
// ============================================================================
async function handleGetPropBets(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const sport = req.query.sport || 'NFL';
    
    const db = admin.database();
    const propBetsSnapshot = await db.ref(`propBets/${sport}`).once('value');
    
    if (!propBetsSnapshot.exists()) {
      return res.status(200).json({
        success: true,
        sport: sport,
        propBets: [],
        message: 'No prop bets available for this sport'
      });
    }

    const propBets = propBetsSnapshot.val();
    
    return res.status(200).json({
      success: true,
      sport: sport,
      propBets: propBets
    });

  } catch (error) {
    console.error('Error getting prop bets:', error);
    
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to get prop bets'
    });
  }
}

// ============================================================================
// Handler: Get History (NEW - for dashboard)
// ============================================================================
async function handleGetHistory(req, res) {
  try {
    // Verify the user making the request
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const { type, period } = req.query;

    const db = admin.database();

    // Handle different types of history requests
    if (type === 'transactions') {
      // Get user's transaction history
      const transactionsSnapshot = await db.ref(`transactions/${uid}`).once('value');
      const transactions = [];
      
      if (transactionsSnapshot.exists()) {
        transactionsSnapshot.forEach((childSnapshot) => {
          transactions.push({
            id: childSnapshot.key,
            ...childSnapshot.val()
          });
        });
      }
      
      // Sort by timestamp descending
      transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      return res.status(200).json({
        success: true,
        type: 'transactions',
        data: transactions
      });
    } else if (type === 'figures' || type === 'wagers') {
      // Get user's wager history
      const wagersSnapshot = await db.ref('wagers').orderByChild('uid').equalTo(uid).once('value');
      const wagers = [];
      
      if (wagersSnapshot.exists()) {
        wagersSnapshot.forEach((childSnapshot) => {
          wagers.push({
            id: childSnapshot.key,
            ...childSnapshot.val()
          });
        });
      }
      
      // Sort by createdAt descending
      wagers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      // Filter by period if specified
      let filteredWagers = wagers;
      if (period) {
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

        if (start && end) {
          filteredWagers = wagers.filter(w => {
            const date = new Date(w.settledAt || w.createdAt);
            return date >= start && date <= end;
          });
        }
      }
      
      return res.status(200).json({
        success: true,
        type: type || 'wagers',
        period: period || 'all',
        data: filteredWagers
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid type parameter',
        hint: 'Use ?type=transactions, ?type=figures, or ?type=wagers'
      });
    }

  } catch (error) {
    console.error('Error getting history:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ 
        success: false, 
        error: 'Session expired',
        hint: 'Please log in again'
      });
    }

    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to get history'
    });
  }
}
