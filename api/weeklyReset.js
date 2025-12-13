// Serverless function to reset weekly credit limits for all members
// This runs every Tuesday at 12:00 AM to reset totalWagered to 0
// Designed to run on a schedule via Vercel cron

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
        
        // Skip revoked or admin users (optional - you can reset admins too)
        if (userData.status === 'revoked') {
          results.skipped++;
          console.log(`Skipping revoked user: ${uid}`);
          continue;
        }

        // Reset totalWagered to 0
        const previousTotalWagered = parseFloat(userData.totalWagered) || 0;
        
        // Prepare batch update
        updates[`${uid}/totalWagered`] = 0;
        updates[`${uid}/lastWeeklyReset`] = resetTimestamp;
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
  } catch (outerError) {
    console.error('Unexpected error in weeklyReset:', outerError);
    return res.status(500).json({
      success: false,
      error: 'An unexpected server error occurred',
      message: outerError.message || 'Unknown error'
    });
  }
};
