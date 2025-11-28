// Serverless function to revoke user access using Firebase Admin SDK
// Supports both soft revocation (invalidate sessions) and hard revocation (delete user)

let admin;
let initializationError = null;

// Safely require firebase-admin
try {
  admin = require('firebase-admin');
} catch (error) {
  initializationError = `Failed to load firebase-admin module: ${error.message}`;
  console.error(initializationError);
}

// Initialize Firebase Admin SDK - store errors instead of throwing
const initializeFirebaseAdmin = () => {
  if (!admin) {
    return false;
  }
  
  if (admin.apps && admin.apps.length) {
    return true; // Already initialized
  }

  try {
    const projectId = process.env.FIREBASE_PROJECT_ID || '';
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || '';
    const privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
    const databaseURL = process.env.FIREBASE_DATABASE_URL || '';

    if (!projectId || !clientEmail || !privateKey) {
      initializationError = 'Missing required Firebase Admin SDK environment variables. Visit /api/checkEnv for diagnostics.';
      return false;
    }

    if (!databaseURL) {
      initializationError = 'Missing required FIREBASE_DATABASE_URL environment variable.';
      return false;
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: projectId,
        clientEmail: clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
      databaseURL: databaseURL
    });
    return true;
  } catch (error) {
    console.error('Firebase admin initialization error:', error);
    initializationError = error.message;
    return false;
  }
};

// Try to initialize on module load, but don't throw
if (admin) {
  initializeFirebaseAdmin();
}

module.exports = async (req, res) => {
  try {
    // Set CORS headers - be permissive to ensure we always respond
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
        troubleshooting: initializationError || 'The firebase-admin package may not be installed correctly.',
        hint: 'Check Vercel function logs for more details. Try redeploying.'
      });
    }

    // Check if Firebase Admin SDK initialization failed
    if (initializationError || !admin.apps || !admin.apps.length) {
      // Try to initialize again in case environment changed
      if (!initializeFirebaseAdmin()) {
        return res.status(500).json({ 
          success: false, 
          error: 'Server configuration error: Firebase Admin SDK failed to initialize',
          troubleshooting: initializationError || 'Unknown initialization error. Visit /api/checkEnv for detailed diagnostics.',
          hint: 'Ensure all Firebase environment variables are properly configured in Vercel.'
        });
      }
    }

    // Verify the admin user making the request
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Missing or invalid authorization header' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Check if the user has admin privileges
    if (!decodedToken.admin) {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin privileges required' });
    }

    const { uid, method } = req.body;

    // Validate input
    if (!uid) {
      return res.status(400).json({ success: false, error: 'User UID is required' });
    }

    if (!method || !['soft', 'hard'].includes(method)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid revocation method. Use "soft" to invalidate sessions or "hard" to delete the user.'
      });
    }

    // Prevent admin from revoking their own access
    if (uid === decodedToken.uid) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot revoke your own access'
      });
    }

    // Get user info before any changes and check if target is an admin
    let userEmail = 'Unknown';
    let isTargetAdmin = false;
    try {
      const userRecord = await admin.auth().getUser(uid);
      userEmail = userRecord.email || 'Unknown';
      // Check if the target user has admin privileges
      isTargetAdmin = userRecord.customClaims?.admin === true;
    } catch (getUserError) {
      console.warn('Could not fetch user info:', getUserError.message);
    }

    // Prevent revoking another admin's access
    if (isTargetAdmin) {
      return res.status(403).json({ 
        success: false, 
        error: 'Cannot revoke access for another admin. Remove their admin privileges first.'
      });
    }

    console.log(`Revoking access for user: ${uid} (${userEmail}) using method: ${method}`);

    if (method === 'soft') {
      // Soft revocation: Invalidate all refresh tokens
      // This forces the user to re-authenticate
      await admin.auth().revokeRefreshTokens(uid);
      
      // Update custom claims to mark user as revoked
      await admin.auth().setCustomUserClaims(uid, { role: 'member', revoked: true });
      
      // Update user status in database
      await admin.database().ref(`users/${uid}`).update({
        status: 'revoked',
        revokedAt: new Date().toISOString(),
        revokedBy: decodedToken.uid
      });

      console.log(`Soft revocation completed for user: ${uid}`);

      return res.status(200).json({
        success: true,
        message: `Access revoked for user ${userEmail}. All sessions have been invalidated.`,
        method: 'soft',
        uid: uid
      });

    } else if (method === 'hard') {
      // Hard revocation: Delete the user entirely
      
      // First, delete user data from Realtime Database
      await admin.database().ref(`users/${uid}`).remove();
      
      // Then, delete the Firebase Auth user
      await admin.auth().deleteUser(uid);

      console.log(`Hard revocation (deletion) completed for user: ${uid}`);

      return res.status(200).json({
        success: true,
        message: `User ${userEmail} has been permanently deleted.`,
        method: 'hard',
        uid: uid
      });
    }

  } catch (error) {
    console.error('Error in revokeUser:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    // Handle specific Firebase errors
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found',
        troubleshooting: 'The specified user does not exist in Firebase Authentication.'
      });
    }

    if (error.code === 'auth/invalid-uid') {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid user ID',
        troubleshooting: 'The provided UID format is invalid.'
      });
    }

    if (error.code === 'auth/insufficient-permission') {
      return res.status(500).json({ 
        success: false, 
        error: 'Insufficient permissions',
        troubleshooting: 'The Firebase service account does not have sufficient permissions to perform this action.'
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to revoke user access',
      troubleshooting: 'An unexpected error occurred. Check the server logs for more details.'
    });
  }
};
