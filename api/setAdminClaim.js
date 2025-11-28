// Endpoint to set admin custom claims for a user
// This allows making a user an admin so they can create other users
//
// SECURITY: This endpoint requires a secret key (ADMIN_SETUP_SECRET) to prevent unauthorized access
// Set ADMIN_SETUP_SECRET in your Vercel environment variables to a random string

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
    return true;
  }

  try {
    const projectId = process.env.FIREBASE_PROJECT_ID || '';
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || '';
    const privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
    const databaseURL = process.env.FIREBASE_DATABASE_URL || '';

    if (!projectId || !clientEmail || !privateKey || !databaseURL) {
      initializationError = 'Missing Firebase environment variables';
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

// Try to initialize on module load
if (admin) {
  initializeFirebaseAdmin();
}

module.exports = async (req, res) => {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    // For GET requests, show instructions
    if (req.method === 'GET') {
      return res.status(200).json({
        success: true,
        message: 'Set Admin Claim Endpoint',
        instructions: {
          step1: 'First, set ADMIN_SETUP_SECRET in your Vercel Environment Variables to any secret password you choose',
          step2: 'Redeploy your app after setting the environment variable',
          step3: 'Send a POST request to this endpoint with the following JSON body:',
          body: {
            email: 'your-admin-email@example.com',
            secret: 'your-ADMIN_SETUP_SECRET-value'
          },
          step4: 'After success, sign out and sign back in to your app',
          step5: 'You should now be able to create new users from the Admin dashboard'
        },
        note: 'You can use a tool like Postman, or the browser console with fetch(), or any REST client'
      });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed. Use GET for instructions or POST to set admin claim.' });
    }

    // Check if Firebase is initialized
    if (!admin || initializationError || !admin.apps || !admin.apps.length) {
      if (!initializeFirebaseAdmin()) {
        return res.status(500).json({ 
          success: false, 
          error: 'Firebase Admin SDK failed to initialize',
          troubleshooting: initializationError || 'Check environment variables at /api/checkEnv'
        });
      }
    }

    const { email, uid, secret } = req.body;

    // Verify the setup secret
    const setupSecret = process.env.ADMIN_SETUP_SECRET;
    if (!setupSecret) {
      return res.status(500).json({ 
        success: false, 
        error: 'ADMIN_SETUP_SECRET environment variable is not set',
        instructions: {
          step1: 'Go to Vercel → Your Project → Settings → Environment Variables',
          step2: 'Add a new variable called ADMIN_SETUP_SECRET',
          step3: 'Set its value to any secret password you choose (e.g., "MySecretPassword123")',
          step4: 'Click Save and then Redeploy your app',
          step5: 'Try this request again with the secret in the body'
        }
      });
    }

    if (!secret || secret !== setupSecret) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid or missing secret',
        hint: 'Include "secret" in your request body matching your ADMIN_SETUP_SECRET environment variable'
      });
    }

    if (!email && !uid) {
      return res.status(400).json({ 
        success: false, 
        error: 'Either email or uid is required',
        example: { email: 'admin@example.com', secret: 'your-secret' }
      });
    }

    let targetUid = uid;
    let targetEmail = email;

    // If email provided, look up the user
    if (email && !uid) {
      try {
        const userRecord = await admin.auth().getUserByEmail(email);
        targetUid = userRecord.uid;
        targetEmail = userRecord.email;
      } catch (error) {
        return res.status(404).json({ 
          success: false, 
          error: `User with email "${email}" not found`,
          hint: 'Make sure the user has already signed up/logged in at least once'
        });
      }
    }

    // Set custom admin claim
    await admin.auth().setCustomUserClaims(targetUid, { admin: true });

    // Get user info to confirm
    const user = await admin.auth().getUser(targetUid);

    return res.status(200).json({ 
      success: true, 
      message: `✅ Admin privileges granted successfully!`,
      user: {
        email: user.email,
        uid: targetUid,
        displayName: user.displayName
      },
      nextSteps: [
        '1. Sign out of the app completely',
        '2. Sign back in with this account',
        '3. You should now be able to access admin features and create new users'
      ]
    });

  } catch (error) {
    console.error('Error setting admin claim:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message,
      troubleshooting: 'Check the Vercel function logs for more details'
    });
  }
};
