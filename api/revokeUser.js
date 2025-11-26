// Serverless function to revoke user access using Firebase Admin SDK
// Supports both soft revocation (invalidate sessions) and hard revocation (delete user)

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  try {
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
      throw new Error('Missing required Firebase Admin SDK environment variables. Visit /api/checkEnv for diagnostics.');
    }

    const databaseURL = process.env.FIREBASE_DATABASE_URL;
    if (!databaseURL) {
      throw new Error('Missing required FIREBASE_DATABASE_URL environment variable.');
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
      databaseURL: databaseURL
    });
  } catch (error) {
    console.error('Firebase admin initialization error:', error);
    throw error;
  }
}

module.exports = async (req, res) => {
  // Get allowed origin from environment or use the request origin for development
  const allowedOrigin = process.env.ALLOWED_ORIGIN || req.headers.origin;
  
  // Set CORS headers with specific origin
  res.setHeader('Access-Control-Allow-Credentials', true);
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

  try {
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

    // Get user info before any changes
    let userEmail = 'Unknown';
    try {
      const userRecord = await admin.auth().getUser(uid);
      userEmail = userRecord.email || 'Unknown';
    } catch (getUserError) {
      console.warn('Could not fetch user info:', getUserError.message);
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
    console.error('Error revoking user access:', error);
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
