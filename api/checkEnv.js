// Diagnostic endpoint for environment variable validation
// This helps troubleshoot Firebase Admin SDK configuration issues

module.exports = async (req, res) => {
  // Get allowed origin from environment or use the request origin for development
  const allowedOrigin = process.env.ALLOWED_ORIGIN || req.headers.origin;
  
  // Set CORS headers with specific origin
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const envChecks = {
    FIREBASE_PROJECT_ID: {
      present: !!process.env.FIREBASE_PROJECT_ID,
      hint: 'Should be your Firebase project ID (e.g., "my-project-12345")'
    },
    FIREBASE_CLIENT_EMAIL: {
      present: !!process.env.FIREBASE_CLIENT_EMAIL,
      format: process.env.FIREBASE_CLIENT_EMAIL 
        ? /^[a-zA-Z0-9-]+@[a-zA-Z0-9-]+\.iam\.gserviceaccount\.com$/.test(process.env.FIREBASE_CLIENT_EMAIL)
        : false,
      hint: 'Should be a service account email (e.g., "firebase-adminsdk-xxxxx@project-id.iam.gserviceaccount.com")'
    },
    FIREBASE_PRIVATE_KEY: {
      present: !!process.env.FIREBASE_PRIVATE_KEY,
      format: false,
      hint: 'Should be a PEM-formatted RSA private key starting with "-----BEGIN PRIVATE KEY-----"'
    },
    FIREBASE_DATABASE_URL: {
      present: !!process.env.FIREBASE_DATABASE_URL,
      format: process.env.FIREBASE_DATABASE_URL 
        ? /^https:\/\/[a-zA-Z0-9-]+\.firebaseio\.com$/.test(process.env.FIREBASE_DATABASE_URL)
        : false,
      hint: 'Should be your Firebase Realtime Database URL (e.g., "https://my-project-default-rtdb.firebaseio.com")'
    }
  };

  // Check FIREBASE_PRIVATE_KEY format without exposing the actual value
  if (process.env.FIREBASE_PRIVATE_KEY) {
    const key = process.env.FIREBASE_PRIVATE_KEY;
    const hasHeader = key.includes('-----BEGIN PRIVATE KEY-----') || key.includes('-----BEGIN RSA PRIVATE KEY-----');
    const hasFooter = key.includes('-----END PRIVATE KEY-----') || key.includes('-----END RSA PRIVATE KEY-----');
    const hasNewlines = key.includes('\\n') || key.includes('\n');
    
    envChecks.FIREBASE_PRIVATE_KEY.format = hasHeader && hasFooter;
    envChecks.FIREBASE_PRIVATE_KEY.details = {
      hasHeader,
      hasFooter,
      hasNewlines,
      lengthOk: key.length > 100
    };
    
    if (!hasHeader || !hasFooter) {
      envChecks.FIREBASE_PRIVATE_KEY.error = 'Private key appears malformed. Ensure it includes BEGIN and END markers.';
    }
    if (!hasNewlines) {
      envChecks.FIREBASE_PRIVATE_KEY.warning = 'Private key may not have proper newline characters. Ensure \\n sequences are present.';
    }
  }

  const allPresent = Object.values(envChecks).every(check => check.present);
  const allValid = Object.values(envChecks).every(check => check.present && (check.format === undefined || check.format));

  const missingVars = Object.entries(envChecks)
    .filter(([, check]) => !check.present)
    .map(([name]) => name);

  const invalidVars = Object.entries(envChecks)
    .filter(([, check]) => check.present && check.format === false)
    .map(([name, check]) => ({ name, hint: check.hint, error: check.error, warning: check.warning }));

  return res.status(200).json({
    success: allPresent && allValid,
    summary: {
      allVariablesPresent: allPresent,
      allVariablesValid: allValid,
      missingCount: missingVars.length,
      invalidCount: invalidVars.length
    },
    missing: missingVars.length > 0 ? missingVars : undefined,
    invalid: invalidVars.length > 0 ? invalidVars : undefined,
    checks: {
      FIREBASE_PROJECT_ID: {
        present: envChecks.FIREBASE_PROJECT_ID.present,
        hint: !envChecks.FIREBASE_PROJECT_ID.present ? envChecks.FIREBASE_PROJECT_ID.hint : undefined
      },
      FIREBASE_CLIENT_EMAIL: {
        present: envChecks.FIREBASE_CLIENT_EMAIL.present,
        validFormat: envChecks.FIREBASE_CLIENT_EMAIL.format,
        hint: !envChecks.FIREBASE_CLIENT_EMAIL.present || !envChecks.FIREBASE_CLIENT_EMAIL.format 
          ? envChecks.FIREBASE_CLIENT_EMAIL.hint : undefined
      },
      FIREBASE_PRIVATE_KEY: {
        present: envChecks.FIREBASE_PRIVATE_KEY.present,
        validFormat: envChecks.FIREBASE_PRIVATE_KEY.format,
        details: envChecks.FIREBASE_PRIVATE_KEY.details,
        error: envChecks.FIREBASE_PRIVATE_KEY.error,
        warning: envChecks.FIREBASE_PRIVATE_KEY.warning,
        hint: !envChecks.FIREBASE_PRIVATE_KEY.present || !envChecks.FIREBASE_PRIVATE_KEY.format 
          ? envChecks.FIREBASE_PRIVATE_KEY.hint : undefined
      },
      FIREBASE_DATABASE_URL: {
        present: envChecks.FIREBASE_DATABASE_URL.present,
        validFormat: envChecks.FIREBASE_DATABASE_URL.format,
        hint: !envChecks.FIREBASE_DATABASE_URL.present || !envChecks.FIREBASE_DATABASE_URL.format 
          ? envChecks.FIREBASE_DATABASE_URL.hint : undefined
      }
    },
    troubleshooting: !allPresent || !allValid ? [
      'Ensure all environment variables are set in your Vercel project settings.',
      'For FIREBASE_PRIVATE_KEY, copy the entire key from your Firebase service account JSON file.',
      'Make sure \\n in the private key is properly escaped or replaced with actual newlines.',
      'The private key should start with "-----BEGIN PRIVATE KEY-----" and end with "-----END PRIVATE KEY-----".',
      'Double-check that there are no extra quotes or spaces around the values.'
    ] : undefined
  });
};
