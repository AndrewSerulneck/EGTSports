// Serverless function to cancel a wager and return credit to the user
// This performs atomic operations: update wager status and return credit

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

      // Get the user's current totalWagered
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
      const currentTotalWagered = parseFloat(userData.totalWagered) || 0;
      
      // Calculate new totalWagered (subtract the wager amount)
      const newTotalWagered = Math.max(0, currentTotalWagered - wagerAmount);

      // Perform atomic updates
      const updates = {};
      updates[`${wagerPath}/status`] = 'CANCELED';
      updates[`${wagerPath}/canceledAt`] = new Date().toISOString();
      updates[`${wagerPath}/canceledBy`] = decodedToken.uid;
      updates[`${wagerPath}/previousStatus`] = wagerData.status || 'pending';
      updates[`users/${userId}/totalWagered`] = newTotalWagered;

      await db.ref().update(updates);

      console.log(`Wager canceled: ${targetId} from ${wagerSource}. User ${userId} credit returned: $${wagerAmount}. New totalWagered: $${newTotalWagered}`);

      return res.status(200).json({
        success: true,
        message: 'Wager canceled and credit returned successfully',
        details: {
          wagerId: targetId,
          source: wagerSource,
          userId: userId,
          wagerAmount: wagerAmount,
          previousTotalWagered: currentTotalWagered,
          newTotalWagered: newTotalWagered,
          creditReturned: wagerAmount
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
  } catch (outerError) {
    console.error('Unexpected error in cancelWager:', outerError);
    return res.status(500).json({
      success: false,
      error: 'An unexpected server error occurred',
      message: outerError.message || 'Unknown error'
    });
  }
};
