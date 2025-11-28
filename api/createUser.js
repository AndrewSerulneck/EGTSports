// Serverless function to create users using Firebase Admin SDK
// This prevents the admin from being logged out when creating a new user

let admin;
let initializationError = null;

// Safely require firebase-admin
try {
  admin = require('firebase-admin');
} catch (error) {
  initializationError = `Failed to load firebase-admin module: ${error.message}`;
  console.error(initializationError);
}

// Helper function to validate environment variables
const validateEnvironment = () => {
  const errors = [];
  const warnings = [];

  const projectId = process.env.FIREBASE_PROJECT_ID || '';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || '';
  const privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
  const databaseUrl = process.env.FIREBASE_DATABASE_URL || '';

  if (!projectId) {
    errors.push('FIREBASE_PROJECT_ID is missing');
  }

  if (!clientEmail) {
    errors.push('FIREBASE_CLIENT_EMAIL is missing');
  } else if (!/^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.iam\.gserviceaccount\.com$/.test(clientEmail)) {
    warnings.push('FIREBASE_CLIENT_EMAIL format may be incorrect');
  }

  if (!privateKey) {
    errors.push('FIREBASE_PRIVATE_KEY is missing');
  } else {
    if (!privateKey.includes('-----BEGIN PRIVATE KEY-----') && !privateKey.includes('-----BEGIN RSA PRIVATE KEY-----')) {
      errors.push('FIREBASE_PRIVATE_KEY is missing BEGIN marker - key may be malformed');
    }
    if (!privateKey.includes('-----END PRIVATE KEY-----') && !privateKey.includes('-----END RSA PRIVATE KEY-----')) {
      errors.push('FIREBASE_PRIVATE_KEY is missing END marker - key may be malformed');
    }
  }

  if (!databaseUrl) {
    errors.push('FIREBASE_DATABASE_URL is missing');
  }

  return { errors, warnings, isValid: errors.length === 0 };
};

// Initialize Firebase Admin SDK - store errors instead of throwing
const initializeFirebaseAdmin = () => {
  if (!admin) {
    return false;
  }
  
  if (admin.apps && admin.apps.length) {
    return true; // Already initialized
  }

  try {
    const envValidation = validateEnvironment();
    
    if (!envValidation.isValid) {
      console.error('Firebase Admin SDK configuration errors:', envValidation.errors);
      if (envValidation.warnings.length > 0) {
        console.warn('Firebase Admin SDK configuration warnings:', envValidation.warnings);
      }
      initializationError = `Missing or invalid Firebase Admin SDK environment variables: ${envValidation.errors.join(', ')}. Visit /api/checkEnv for detailed diagnostics.`;
      return false;
    }

    if (envValidation.warnings.length > 0) {
      console.warn('Firebase Admin SDK configuration warnings:', envValidation.warnings);
    }

    const privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
    const databaseURL = process.env.FIREBASE_DATABASE_URL || '';

    console.log('Initializing Firebase Admin SDK...');
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
      databaseURL: databaseURL
    });
    console.log('Firebase Admin SDK initialized successfully');
    return true;
  } catch (error) {
    console.error('Firebase admin initialization error:', error.message);
    console.error('Troubleshooting tips:');
    console.error('1. Ensure all environment variables are set in Vercel project settings');
    console.error('2. Check that FIREBASE_PRIVATE_KEY includes proper newline characters (\\n)');
    console.error('3. Verify the service account has the required permissions');
    console.error('4. Visit /api/checkEnv endpoint for detailed diagnostics');
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
          hint: 'Ensure all Firebase environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIREBASE_DATABASE_URL) are properly configured in Vercel.'
      });
    }
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
  } catch (outerError) {
    // Catch any unexpected errors at the top level to prevent FUNCTION_INVOCATION_FAILED
    console.error('Unexpected error in createUser:', outerError);
    return res.status(500).json({
      success: false,
      error: 'An unexpected server error occurred',
      message: outerError.message || 'Unknown error',
      troubleshooting: 'This is an unexpected error. Check Vercel function logs for details. Visit /api/checkEnv to verify environment configuration.'
    });
  }
};
