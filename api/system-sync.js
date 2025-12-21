// Consolidated System Sync - Master API Route
// Handles: weeklyReset, sheetsSync, checkEnv, checkReset (on-demand)
// Route pattern: /api/system-sync?action=<action>

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
        hint: 'Use ?action=<action> where action is: weeklyReset, sheetsSync, checkEnv, checkReset'
      });
    }

    // Route to appropriate handler based on action
    switch (action) {
      case 'weeklyReset':
        return await handleWeeklyReset(req, res);
      case 'sheetsSync':
        return await handleSheetsSync(req, res);
      case 'checkEnv':
        return await handleCheckEnv(req, res);
      case 'checkReset':
        return await handleCheckReset(req, res);
      default:
        return res.status(400).json({
          success: false,
          error: `Unknown action: ${action}`,
          availableActions: ['weeklyReset', 'sheetsSync', 'checkEnv', 'checkReset']
        });
    }
  } catch (error) {
    console.error('System Sync error:', error);
    return res.status(500).json({
      success: false,
      error: 'An unexpected server error occurred',
      message: error.message || 'Unknown error'
    });
  }
};

// ============================================================================
// Handler: Weekly Reset
// ============================================================================
async function handleWeeklyReset(req, res) {
  try {
    // For cron jobs, verify the request is from Vercel
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    
    // If invoked manually with auth token, verify admin
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      
      if (!decodedToken.admin) {
        return res.status(403).json({ 
          success: false, 
          error: 'Admin privileges required'
        });
      }
    } else if (cronSecret) {
      // Verify cron secret for scheduled invocations
      const providedSecret = req.headers['x-vercel-cron-secret'] || req.query.secret;
      if (providedSecret !== cronSecret) {
        return res.status(401).json({ 
          success: false, 
          error: 'Unauthorized: Invalid cron secret'
        });
      }
    }

    const db = admin.database();
    const usersRef = db.ref('users');

    // User status constants
    const USER_STATUS_REVOKED = 'revoked';

    // Get all users
    const usersSnapshot = await usersRef.once('value');
    
    if (!usersSnapshot.exists()) {
      return res.status(200).json({
        success: true,
        message: 'No users to reset',
        usersReset: 0
      });
    }

    const users = usersSnapshot.val();
    const resetTimestamp = new Date().toISOString();
    const results = {
      total: 0,
      reset: 0,
      skipped: 0,
      errors: []
    };

    // Process each user
    const updates = {};
    for (const [uid, userData] of Object.entries(users)) {
      results.total++;
      
      // Skip revoked users
      if (userData.status === USER_STATUS_REVOKED) {
        results.skipped++;
        console.log(`Skipping revoked user: ${uid}`);
        continue;
      }

      // Reset totalWagered to 0 and current_balance to base_credit_limit
      const previousTotalWagered = parseFloat(userData.totalWagered) || 0;
      const baseCreditLimit = parseFloat(userData.base_credit_limit) || parseFloat(userData.creditLimit) || 100;
      
      // Prepare batch update
      updates[`${uid}/totalWagered`] = 0;
      updates[`${uid}/current_balance`] = baseCreditLimit;
      updates[`${uid}/last_reset_timestamp`] = resetTimestamp;
      updates[`${uid}/previousWeekTotalWagered`] = previousTotalWagered;
      
      results.reset++;
      console.log(`Reset scheduled for user ${uid} (${userData.displayName}): ${previousTotalWagered} -> 0`);
    }

    // Perform batch update for efficiency
    if (Object.keys(updates).length > 0) {
      await usersRef.update(updates);
      console.log(`✅ Batch update complete: ${results.reset} users reset`);
    }

    // Log the reset event for audit trail
    const auditRef = db.ref('auditLog/weeklyResets').push();
    await auditRef.set({
      timestamp: resetTimestamp,
      usersReset: results.reset,
      usersSkipped: results.skipped,
      totalUsers: results.total,
      errors: results.errors
    });

    console.log(`Weekly credit reset complete: ${JSON.stringify(results)}`);

    return res.status(200).json({
      success: true,
      message: 'Weekly credit reset complete',
      results: {
        totalUsers: results.total,
        usersReset: results.reset,
        usersSkipped: results.skipped,
        timestamp: resetTimestamp
      }
    });

  } catch (error) {
    console.error('Error in weekly reset:', error);
    
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to perform weekly reset'
    });
  }
}

// ============================================================================
// Handler: Sheets Sync (Placeholder)
// ============================================================================
async function handleSheetsSync(req, res) {
  try {
    // This is a placeholder - implement actual sheets sync logic as needed
    return res.status(200).json({
      success: true,
      message: 'Sheets sync not implemented yet',
      hint: 'Add Google Sheets API integration here'
    });
  } catch (error) {
    console.error('Error in sheets sync:', error);
    
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to sync sheets'
    });
  }
}

// ============================================================================
// Handler: Check Environment
// ============================================================================
async function handleCheckEnv(req, res) {
  try {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      environment: {},
      firebase: {},
      status: 'checking'
    };

    // Check environment variables
    const requiredVars = [
      'FIREBASE_PROJECT_ID',
      'FIREBASE_CLIENT_EMAIL',
      'FIREBASE_PRIVATE_KEY',
      'FIREBASE_DATABASE_URL'
    ];

    for (const varName of requiredVars) {
      const value = process.env[varName];
      diagnostics.environment[varName] = {
        exists: !!value,
        length: value ? value.length : 0,
        preview: value ? `${value.substring(0, 20)}...` : 'NOT SET'
      };
    }

    // Check Firebase initialization
    diagnostics.firebase.adminModuleLoaded = !!admin;
    diagnostics.firebase.initialized = admin && admin.apps && admin.apps.length > 0;
    diagnostics.firebase.initializationError = initializationError || null;

    // Determine overall status
    const allVarsPresent = requiredVars.every(v => !!process.env[v]);
    const firebaseOk = diagnostics.firebase.initialized && !initializationError;

    if (allVarsPresent && firebaseOk) {
      diagnostics.status = 'ok';
    } else {
      diagnostics.status = 'error';
    }

    return res.status(200).json({
      success: diagnostics.status === 'ok',
      diagnostics: diagnostics
    });

  } catch (error) {
    console.error('Error checking environment:', error);
    
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to check environment'
    });
  }
}

// ============================================================================
// Handler: Check Reset (On-Demand Wednesday Reset)
// ============================================================================
async function handleCheckReset(req, res) {
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
    const requestingUserId = decodedToken.uid;
    
    // Get userId from request body (for admin viewing other users) or use requesting user
    const { userId } = req.body;
    const targetUserId = userId || requestingUserId;
    
    // If admin is checking another user's reset, verify admin privileges
    if (targetUserId !== requestingUserId) {
      if (!decodedToken.admin) {
        return res.status(403).json({ 
          success: false, 
          error: 'Admin privileges required to check other users'
        });
      }
    }

    const db = admin.database();
    const userRef = db.ref(`users/${targetUserId}`);
    
    // Get user data
    const userSnapshot = await userRef.once('value');
    if (!userSnapshot.exists()) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found'
      });
    }

    const userData = userSnapshot.val();
    const lastResetTimestamp = userData.last_reset_timestamp || null;
    const currentBalance = parseFloat(userData.current_balance) || 0;
    const baseCreditLimit = parseFloat(userData.base_credit_limit) || parseFloat(userData.creditLimit) || 100;
    
    // Calculate most recent Wednesday at 12:01 AM EST
    const mostRecentWednesday = getMostRecentWednesdayReset();
    
    // Check if reset is needed
    let resetNeeded = false;
    if (!lastResetTimestamp) {
      // Never reset before - initialize the field
      resetNeeded = true;
    } else {
      const lastResetDate = new Date(lastResetTimestamp);
      if (lastResetDate < mostRecentWednesday) {
        // Last reset was before the most recent Wednesday
        resetNeeded = true;
      }
    }

    if (resetNeeded) {
      // Perform the reset
      const resetTimestamp = new Date().toISOString();
      const updates = {
        current_balance: baseCreditLimit,
        last_reset_timestamp: resetTimestamp,
        previous_balance: currentBalance
      };
      
      await userRef.update(updates);
      
      // Create a transaction record for the reset
      await createResetTransaction(db, targetUserId, currentBalance, baseCreditLimit, resetTimestamp);
      
      console.log(`✅ Reset performed for user ${targetUserId}: ${currentBalance} -> ${baseCreditLimit}`);
      
      return res.status(200).json({
        success: true,
        resetPerformed: true,
        message: 'Weekly balance reset completed',
        details: {
          previousBalance: currentBalance,
          newBalance: baseCreditLimit,
          resetTimestamp: resetTimestamp,
          mostRecentWednesday: mostRecentWednesday.toISOString()
        }
      });
    } else {
      // No reset needed
      console.log(`No reset needed for user ${targetUserId} (last reset: ${lastResetTimestamp})`);
      
      return res.status(200).json({
        success: true,
        resetPerformed: false,
        message: 'No reset needed - balance is current',
        details: {
          currentBalance: currentBalance,
          lastResetTimestamp: lastResetTimestamp,
          mostRecentWednesday: mostRecentWednesday.toISOString()
        }
      });
    }

  } catch (error) {
    console.error('Error in checkReset:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ 
        success: false, 
        error: 'Session expired',
        hint: 'Please log in again'
      });
    }

    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to check/perform reset'
    });
  }
}

// Helper: Calculate most recent Wednesday at 12:01 AM EST
function getMostRecentWednesdayReset() {
  const now = new Date();
  
  // Simple DST detection for US Eastern Time
  const year = now.getUTCFullYear();
  const marchSecondSunday = new Date(Date.UTC(year, 2, 1, 7, 0, 0));
  marchSecondSunday.setUTCDate(1 + (7 - marchSecondSunday.getUTCDay()) + 7);
  const novemberFirstSunday = new Date(Date.UTC(year, 10, 1, 6, 0, 0));
  novemberFirstSunday.setUTCDate(1 + (7 - novemberFirstSunday.getUTCDay()));
  
  const isDST = now >= marchSecondSunday && now < novemberFirstSunday;
  const estOffset = isDST ? -4 : -5;
  
  const estNow = new Date(now.getTime() + (estOffset * 60 * 60 * 1000));
  
  const currentDay = estNow.getUTCDay();
  
  let daysSinceWednesday;
  if (currentDay >= 3) {
    daysSinceWednesday = currentDay - 3;
  } else {
    daysSinceWednesday = currentDay + 4;
  }
  
  const currentHour = estNow.getUTCHours();
  const currentMinute = estNow.getUTCMinutes();
  if (currentDay === 3 && (currentHour === 0 && currentMinute < 1)) {
    daysSinceWednesday += 7;
  }
  
  const wednesdayDate = new Date(estNow);
  wednesdayDate.setUTCDate(estNow.getUTCDate() - daysSinceWednesday);
  wednesdayDate.setUTCHours(0, 1, 0, 0);
  
  const resetDate = new Date(wednesdayDate.getTime() - (estOffset * 60 * 60 * 1000));
  
  return resetDate;
}

// Helper: Create transaction record for reset
async function createResetTransaction(db, userId, previousBalance, newBalance, resetTimestamp) {
  try {
    const transactionRef = db.ref(`transactions/${userId}`).push();
    await transactionRef.set({
      timestamp: resetTimestamp,
      description: 'Weekly Balance Reset',
      amount: newBalance - previousBalance,
      balanceBefore: previousBalance,
      balanceAfter: newBalance,
      type: 'reset',
      createdAt: new Date().toISOString()
    });
    console.log(`Created reset transaction for user ${userId}`);
  } catch (error) {
    console.error(`Error creating reset transaction for user ${userId}:`, error);
  }
}
