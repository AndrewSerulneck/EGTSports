// Serverless function to create users using Firebase Admin SDK
// This prevents the admin from being logged out when creating a new user

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://marcs-parlays-default-rtdb.firebaseio.com'
    });
  } catch (error) {
    console.error('Firebase admin initialization error:', error);
  }
}

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
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
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Check if the user has admin privileges
    if (!decodedToken.admin) {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin privileges required' });
    }

    const { email, password, displayName, creditLimit } = req.body;

    // Validate input
    if (!email || !password || !displayName) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }

    // Create the user using Admin SDK (doesn't affect current session)
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: displayName,
      emailVerified: false
    });

    // Store additional user data in Realtime Database
    await admin.database().ref(`users/${userRecord.uid}`).set({
      email: email,
      displayName: displayName,
      creditLimit: parseFloat(creditLimit) || 100,
      currentCredit: 0,
      role: 'user',
      createdAt: new Date().toISOString(),
      createdBy: decodedToken.uid
    });

    return res.status(200).json({
      success: true,
      message: `User ${displayName} created successfully`,
      uid: userRecord.uid
    });

  } catch (error) {
    console.error('Error creating user:', error);
    
    // Handle specific Firebase errors
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ success: false, error: 'Email already exists' });
    }
    
    if (error.code === 'auth/invalid-email') {
      return res.status(400).json({ success: false, error: 'Invalid email address' });
    }
    
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to create user' 
    });
  }
};
