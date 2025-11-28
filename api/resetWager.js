// Serverless function to reset a user's total wagered amount
// Only admins can use this endpoint

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
        error: 'Server configuration error: Firebase Admin module failed to load'
      });
    }

    // Check if Firebase Admin SDK initialization failed
    if (initializationError || !admin.apps || !admin.apps.length) {
      if (!initializeFirebaseAdmin()) {
        return res.status(500).json({ 
          success: false, 
          error: 'Server configuration error: Firebase Admin SDK failed to initialize'
        });
      }
    }

    try {
      // Verify the admin making the request
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      const idToken = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      
      // Check if the user has admin privileges
      if (!decodedToken.admin) {
        return res.status(403).json({ success: false, error: 'Forbidden: Admin privileges required' });
      }

      const { uid, resetAmount } = req.body;

      // Validate input
      if (!uid) {
        return res.status(400).json({ success: false, error: 'Missing user ID (uid)' });
      }

      // Get the user's current data
      const userSnapshot = await admin.database().ref(`users/${uid}`).once('value');
      
      if (!userSnapshot.exists()) {
        return res.status(404).json({ 
          success: false, 
          error: 'User not found'
        });
      }

      const userData = userSnapshot.val();
      const previousTotalWagered = parseFloat(userData.totalWagered) || 0;
      const newTotalWagered = parseFloat(resetAmount) || 0;

      // Update the user's total wagered amount
      await admin.database().ref(`users/${uid}`).update({
        totalWagered: newTotalWagered,
        lastResetAt: new Date().toISOString(),
        lastResetBy: decodedToken.uid
      });

      console.log(`Wagered amount reset: User ${uid} changed from $${previousTotalWagered} to $${newTotalWagered}`);

      return res.status(200).json({
        success: true,
        message: `Wagered amount reset for ${userData.displayName}`,
        details: {
          previousTotalWagered: previousTotalWagered,
          newTotalWagered: newTotalWagered,
          creditLimit: userData.creditLimit
        }
      });

    } catch (error) {
      console.error('Error resetting wagered amount:', error);
      
      return res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to reset wagered amount'
      });
    }
  } catch (outerError) {
    console.error('Unexpected error in resetWager:', outerError);
    return res.status(500).json({
      success: false,
      error: 'An unexpected server error occurred',
      message: outerError.message || 'Unknown error'
    });
  }
};
