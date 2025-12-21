// Serverless function to check and perform on-demand Wednesday credit reset
// This runs whenever a user loads the My Bets page or an Admin views a member account
// Implements the "On-Demand" reset logic without CRON jobs

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

/**
 * Calculate the most recent Wednesday at 12:01 AM EST
 * @returns {Date} The most recent Wednesday 12:01 AM EST
 */
function getMostRecentWednesdayReset() {
  // Get current time in EST (UTC-5 or UTC-4 depending on DST)
  const now = new Date();
  
  // Convert to EST/EDT - using America/New_York timezone
  // We'll calculate in UTC and adjust
  const estOffset = -5; // Standard EST offset (adjust for EDT if needed)
  const estNow = new Date(now.getTime() + (estOffset * 60 * 60 * 1000));
  
  // Get current day of week (0 = Sunday, 3 = Wednesday)
  const currentDay = estNow.getUTCDay();
  
  // Calculate days since last Wednesday
  let daysSinceWednesday;
  if (currentDay >= 3) {
    // Current week's Wednesday or after
    daysSinceWednesday = currentDay - 3;
  } else {
    // Before Wednesday, go back to last week's Wednesday
    daysSinceWednesday = currentDay + 4; // e.g., Monday (1) -> 5 days back
  }
  
  // If today is Wednesday but before 12:01 AM, use last week's Wednesday
  const currentHour = estNow.getUTCHours();
  const currentMinute = estNow.getUTCMinutes();
  if (currentDay === 3 && (currentHour < 0 || (currentHour === 0 && currentMinute < 1))) {
    daysSinceWednesday += 7;
  }
  
  // Calculate the Wednesday date
  const wednesdayDate = new Date(estNow);
  wednesdayDate.setUTCDate(estNow.getUTCDate() - daysSinceWednesday);
  wednesdayDate.setUTCHours(0, 1, 0, 0); // Set to 12:01 AM
  
  // Convert back to actual UTC time
  const resetDate = new Date(wednesdayDate.getTime() - (estOffset * 60 * 60 * 1000));
  
  return resetDate;
}

/**
 * Create a transaction record for a balance reset
 */
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
    // Non-blocking error - continue with reset
  }
}

module.exports = async (req, res) => {
  try {
    // Set CORS headers
    const allowedOrigin = process.env.ALLOWED_ORIGIN || req.headers.origin || '*';
    
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    // Check if firebase-admin module loaded properly
    if (!admin) {
      return res.status(500).json({ 
        success: false, 
        error: 'Server configuration error: Firebase Admin module failed to load',
        troubleshooting: initializationError
      });
    }

    // Check if Firebase Admin SDK initialization failed
    if (initializationError || !admin.apps || !admin.apps.length) {
      if (!initializeFirebaseAdmin()) {
        return res.status(500).json({ 
          success: false, 
          error: 'Server configuration error: Firebase Admin SDK failed to initialize',
          troubleshooting: initializationError
        });
      }
    }

    try {
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
  } catch (outerError) {
    console.error('Unexpected error in checkReset:', outerError);
    return res.status(500).json({
      success: false,
      error: 'An unexpected server error occurred',
      message: outerError.message || 'Unknown error'
    });
  }
};
