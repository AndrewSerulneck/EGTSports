// Serverless function to create users using Firebase Admin SDK
// This prevents the admin from being logged out when creating a new user

const admin = require('firebase-admin');

// Helper function to validate environment variables
const validateEnvironment = () => {
  const errors = [];
  const warnings = [];

  if (!process.env.FIREBASE_PROJECT_ID) {
    errors.push('FIREBASE_PROJECT_ID is missing');
  }

  if (!process.env.FIREBASE_CLIENT_EMAIL) {
    errors.push('FIREBASE_CLIENT_EMAIL is missing');
  } else if (!/^[a-zA-Z0-9-]+@[a-zA-Z0-9-]+\.iam\.gserviceaccount\.com$/.test(process.env.FIREBASE_CLIENT_EMAIL)) {
    warnings.push('FIREBASE_CLIENT_EMAIL format may be incorrect');
  }

  if (!process.env.FIREBASE_PRIVATE_KEY) {
    errors.push('FIREBASE_PRIVATE_KEY is missing');
  } else {
    const key = process.env.FIREBASE_PRIVATE_KEY;
    if (!key.includes('-----BEGIN PRIVATE KEY-----') && !key.includes('-----BEGIN RSA PRIVATE KEY-----')) {
      errors.push('FIREBASE_PRIVATE_KEY is missing BEGIN marker - key may be malformed');
    }
    if (!key.includes('-----END PRIVATE KEY-----') && !key.includes('-----END RSA PRIVATE KEY-----')) {
      errors.push('FIREBASE_PRIVATE_KEY is missing END marker - key may be malformed');
    }
  }

  if (!process.env.FIREBASE_DATABASE_URL) {
    errors.push('FIREBASE_DATABASE_URL is missing');
  }

  return { errors, warnings, isValid: errors.length === 0 };
};

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    const envValidation = validateEnvironment();
    
    if (!envValidation.isValid) {
      console.error('Firebase Admin SDK configuration errors:', envValidation.errors);
      if (envValidation.warnings.length > 0) {
        console.warn('Firebase Admin SDK configuration warnings:', envValidation.warnings);
      }
      throw new Error(`Missing or invalid Firebase Admin SDK environment variables: ${envValidation.errors.join(', ')}. Visit /api/checkEnv for detailed diagnostics.`);
    }

    if (envValidation.warnings.length > 0) {
      console.warn('Firebase Admin SDK configuration warnings:', envValidation.warnings);
    }

    const databaseURL = process.env.FIREBASE_DATABASE_URL;

    console.log('Initializing Firebase Admin SDK...');
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
      databaseURL: databaseURL
    });
    console.log('Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('Firebase admin initialization error:', error.message);
    console.error('Troubleshooting tips:');
    console.error('1. Ensure all environment variables are set in Vercel project settings');
    console.error('2. Check that FIREBASE_PRIVATE_KEY includes proper newline characters (\\n)');
    console.error('3. Verify the service account has the required permissions');
    console.error('4. Visit /api/checkEnv endpoint for detailed diagnostics');
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

    console.log(`Creating user: ${email} (${displayName})`);

    // Create the user using Admin SDK (doesn't affect current session)
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: displayName,
      emailVerified: false
    });

    console.log(`User created with UID: ${userRecord.uid}`);

    // Set custom claims to designate the user as a "Member"
    // This allows for role-based access control and easy revocation
    await admin.auth().setCustomUserClaims(userRecord.uid, { role: 'member' });
    console.log(`Custom claims set for user: ${userRecord.uid} (role: member)`);

    // Store additional user data in Realtime Database
    await admin.database().ref(`users/${userRecord.uid}`).set({
      email: email,
      displayName: displayName,
      creditLimit: parseFloat(creditLimit) || 100,
      currentCredit: 0,
      role: 'member',
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: decodedToken.uid
    });

    console.log(`User data stored in database for: ${userRecord.uid}`);

    return res.status(200).json({
      success: true,
      message: `User ${displayName} created successfully with member role`,
      uid: userRecord.uid
    });

  } catch (error) {
    console.error('Error creating user:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    // Handle specific Firebase errors with detailed messages
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ 
        success: false, 
        error: 'Email already exists',
        troubleshooting: 'An account with this email address already exists. Use a different email or delete the existing account first.'
      });
    }
    
    if (error.code === 'auth/invalid-email') {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid email address',
        troubleshooting: 'Please provide a valid email address format (e.g., user@example.com).'
      });
    }

    if (error.code === 'auth/weak-password') {
      return res.status(400).json({ 
        success: false, 
        error: 'Password is too weak',
        troubleshooting: 'Password must be at least 6 characters long.'
      });
    }

    if (error.message && error.message.includes('secretOrPrivateKey')) {
      return res.status(500).json({ 
        success: false, 
        error: 'Server configuration error',
        troubleshooting: 'The Firebase private key is misconfigured. Visit /api/checkEnv for diagnostics. Ensure FIREBASE_PRIVATE_KEY is properly formatted with correct newline characters.'
      });
    }

    if (error.code === 'auth/insufficient-permission') {
      return res.status(500).json({ 
        success: false, 
        error: 'Insufficient permissions',
        troubleshooting: 'The Firebase service account does not have sufficient permissions. Check that the service account has the "Firebase Admin SDK Administrator Service Agent" role.'
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to create user',
      troubleshooting: 'An unexpected error occurred. Check the server logs for more details. Visit /api/checkEnv to verify environment configuration.'
    });
  }
};
