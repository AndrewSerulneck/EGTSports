// Serverless function to submit a wager with credit limit enforcement
// This tracks the user's total wagered amount and enforces their credit limit

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
      // Verify the user making the request
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      const idToken = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const uid = decodedToken.uid;

      const { wagerAmount, wagerData } = req.body;

      // Validate input
      if (wagerAmount === undefined || wagerAmount === null) {
        return res.status(400).json({ success: false, error: 'Missing wager amount' });
      }

      const amount = parseFloat(wagerAmount);
      if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ success: false, error: 'Wager amount must be a positive number' });
      }

      // Get the user's current data from the database
      const userSnapshot = await admin.database().ref(`users/${uid}`).once('value');
      
      if (!userSnapshot.exists()) {
        return res.status(404).json({ 
          success: false, 
          error: 'User not found',
          hint: 'User account may not be properly registered'
        });
      }

      const userData = userSnapshot.val();
      const currentTotalWagered = parseFloat(userData.totalWagered) || 0;
      const creditLimit = parseFloat(userData.creditLimit) || 100;
      const userStatus = userData.status;

      // Check if user is revoked
      if (userStatus === 'revoked') {
        return res.status(403).json({ 
          success: false, 
          error: 'Account has been revoked',
          hint: 'Contact an administrator to reactivate your account'
        });
      }

      // Enforce credit limit: newWager + totalWagered <= creditLimit
      const newTotalWagered = currentTotalWagered + amount;
      const remainingCredit = creditLimit - currentTotalWagered;

      if (newTotalWagered > creditLimit) {
        return res.status(400).json({ 
          success: false, 
          error: 'Wager exceeds credit limit',
          details: {
            wagerAmount: amount,
            currentTotalWagered: currentTotalWagered,
            creditLimit: creditLimit,
            remainingCredit: remainingCredit
          },
          hint: `You have $${remainingCredit.toFixed(2)} remaining credit. Your wager of $${amount.toFixed(2)} exceeds this limit.`
        });
      }

      // Update the user's total wagered amount
      await admin.database().ref(`users/${uid}/totalWagered`).set(newTotalWagered);

      // Optionally store the wager details in a wagers collection
      if (wagerData) {
        const wagerRef = admin.database().ref('wagers').push();
        await wagerRef.set({
          uid: uid,
          email: userData.email,
          displayName: userData.displayName,
          amount: amount,
          wagerData: wagerData,
          createdAt: new Date().toISOString(),
          status: 'pending'
        });
      }

      console.log(`Wager submitted: User ${uid} wagered $${amount}. New total: $${newTotalWagered}/${creditLimit}`);

      return res.status(200).json({
        success: true,
        message: 'Wager submitted successfully',
        details: {
          wagerAmount: amount,
          previousTotalWagered: currentTotalWagered,
          newTotalWagered: newTotalWagered,
          creditLimit: creditLimit,
          remainingCredit: creditLimit - newTotalWagered
        }
      });

    } catch (error) {
      console.error('Error submitting wager:', error);
      
      if (error.code === 'auth/id-token-expired') {
        return res.status(401).json({ 
          success: false, 
          error: 'Session expired',
          hint: 'Please log in again'
        });
      }

      return res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to submit wager'
      });
    }
  } catch (outerError) {
    console.error('Unexpected error in submitWager:', outerError);
    return res.status(500).json({
      success: false,
      error: 'An unexpected server error occurred',
      message: outerError.message || 'Unknown error'
    });
  }
};
