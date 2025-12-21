// Consolidated User Admin - Master API Route
// Handles: create, revoke, setAdmin
// Route pattern: /api/user-admin?action=<action>

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

// Initialize Firebase Admin SDK
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
        hint: 'Use ?action=<action> where action is: create, revoke, setAdmin'
      });
    }

    // Route to appropriate handler based on action
    switch (action) {
      case 'create':
        return await handleCreateUser(req, res);
      case 'revoke':
        return await handleRevokeUser(req, res);
      case 'setAdmin':
        return await handleSetAdminClaim(req, res);
      default:
        return res.status(400).json({
          success: false,
          error: `Unknown action: ${action}`,
          availableActions: ['create', 'revoke', 'setAdmin']
        });
    }
  } catch (error) {
    console.error('User Admin error:', error);
    return res.status(500).json({
      success: false,
      error: 'An unexpected server error occurred',
      message: error.message || 'Unknown error'
    });
  }
};

// ============================================================================
// Handler: Create User
// ============================================================================
async function handleCreateUser(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    // Verify the user making the request is an admin
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    if (!decodedToken.admin) {
      return res.status(403).json({ 
        success: false, 
        error: 'Admin privileges required to create users'
      });
    }

    const { email, password, displayName, creditLimit } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields',
        hint: 'email and password are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid email format'
      });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password must be at least 6 characters long'
      });
    }

    // Create the user
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: displayName || email,
      emailVerified: false,
      disabled: false
    });

    // Create database record for the user
    const db = admin.database();
    const userCreditLimit = parseFloat(creditLimit) || 100;
    
    await db.ref(`users/${userRecord.uid}`).set({
      email: email,
      displayName: displayName || email,
      creditLimit: userCreditLimit,
      base_credit_limit: userCreditLimit,
      current_balance: userCreditLimit,
      totalWagered: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: decodedToken.uid
    });

    console.log(`User created: ${userRecord.uid} (${email}) by admin ${decodedToken.uid}`);

    return res.status(200).json({
      success: true,
      message: 'User created successfully',
      user: {
        uid: userRecord.uid,
        email: email,
        displayName: displayName || email,
        creditLimit: userCreditLimit
      }
    });

  } catch (error) {
    console.error('Error creating user:', error);
    
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ 
        success: false, 
        error: 'Email already in use'
      });
    }

    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ 
        success: false, 
        error: 'Session expired',
        hint: 'Please log in again'
      });
    }

    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to create user'
    });
  }
}

// ============================================================================
// Handler: Revoke User
// ============================================================================
async function handleRevokeUser(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    // Verify the user making the request is an admin
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    if (!decodedToken.admin) {
      return res.status(403).json({ 
        success: false, 
        error: 'Admin privileges required to revoke users'
      });
    }

    const { userId, email } = req.body;

    // Validate input - accept either userId or email
    if (!userId && !email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing userId or email'
      });
    }

    let targetUserId = userId;

    // If email provided, look up the user
    if (!targetUserId && email) {
      try {
        const userRecord = await admin.auth().getUserByEmail(email);
        targetUserId = userRecord.uid;
      } catch (error) {
        return res.status(404).json({ 
          success: false, 
          error: 'User not found with that email'
        });
      }
    }

    // Disable the user in Firebase Auth
    await admin.auth().updateUser(targetUserId, {
      disabled: true
    });

    // Update database record
    const db = admin.database();
    await db.ref(`users/${targetUserId}`).update({
      status: 'revoked',
      revokedAt: new Date().toISOString(),
      revokedBy: decodedToken.uid
    });

    console.log(`User ${targetUserId} revoked by admin ${decodedToken.uid}`);

    return res.status(200).json({
      success: true,
      message: 'User revoked successfully',
      userId: targetUserId
    });

  } catch (error) {
    console.error('Error revoking user:', error);
    
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found'
      });
    }

    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ 
        success: false, 
        error: 'Session expired',
        hint: 'Please log in again'
      });
    }

    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to revoke user'
    });
  }
}

// ============================================================================
// Handler: Set Admin Claim
// ============================================================================
async function handleSetAdminClaim(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    // Verify the user making the request is an admin
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    if (!decodedToken.admin) {
      return res.status(403).json({ 
        success: false, 
        error: 'Admin privileges required to set admin claims'
      });
    }

    const { userId, email, isAdmin } = req.body;

    // Validate input
    if (!userId && !email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing userId or email'
      });
    }

    if (isAdmin === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing isAdmin boolean parameter'
      });
    }

    let targetUserId = userId;

    // If email provided, look up the user
    if (!targetUserId && email) {
      try {
        const userRecord = await admin.auth().getUserByEmail(email);
        targetUserId = userRecord.uid;
      } catch (error) {
        return res.status(404).json({ 
          success: false, 
          error: 'User not found with that email'
        });
      }
    }

    // Set the admin custom claim
    await admin.auth().setCustomUserClaims(targetUserId, {
      admin: Boolean(isAdmin)
    });

    // Update database record
    const db = admin.database();
    await db.ref(`users/${targetUserId}`).update({
      isAdmin: Boolean(isAdmin),
      adminSetAt: new Date().toISOString(),
      adminSetBy: decodedToken.uid
    });

    console.log(`User ${targetUserId} admin claim set to ${isAdmin} by admin ${decodedToken.uid}`);

    return res.status(200).json({
      success: true,
      message: `Admin claim ${isAdmin ? 'granted' : 'revoked'} successfully`,
      userId: targetUserId,
      isAdmin: Boolean(isAdmin)
    });

  } catch (error) {
    console.error('Error setting admin claim:', error);
    
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found'
      });
    }

    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ 
        success: false, 
        error: 'Session expired',
        hint: 'Please log in again'
      });
    }

    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to set admin claim'
    });
  }
}
