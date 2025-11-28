// Diagnostic endpoint for environment variable validation
// This helps troubleshoot Firebase Admin SDK configuration issues
// NOTE: This endpoint intentionally does NOT import firebase-admin to avoid initialization errors

module.exports = async (req, res) => {
  try {
    // Set CORS headers - use '*' for diagnostic endpoint to ensure it always works
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    // Safely check environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID || '';
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || '';
    const privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
    const databaseUrl = process.env.FIREBASE_DATABASE_URL || '';

    const envChecks = {
      FIREBASE_PROJECT_ID: {
        present: projectId.length > 0,
        hint: 'Should be your Firebase project ID (e.g., "my-project-12345")'
      },
      FIREBASE_CLIENT_EMAIL: {
        present: clientEmail.length > 0,
        format: clientEmail.length > 0 
          ? /^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.iam\.gserviceaccount\.com$/.test(clientEmail)
          : false,
        hint: 'Should be a service account email (e.g., "firebase-adminsdk-xxxxx@project-id.iam.gserviceaccount.com")'
      },
      FIREBASE_PRIVATE_KEY: {
        present: privateKey.length > 0,
        format: false,
        hint: 'Should be a PEM-formatted RSA private key starting with "-----BEGIN PRIVATE KEY-----"'
      },
      FIREBASE_DATABASE_URL: {
        present: databaseUrl.length > 0,
        format: databaseUrl.length > 0 
          ? /^https:\/\/[a-zA-Z0-9._-]+(-default-rtdb)?\.firebaseio\.com\/?$/.test(databaseUrl)
          : false,
        hint: 'Should be your Firebase Realtime Database URL (e.g., "https://my-project-default-rtdb.firebaseio.com")'
      }
    };

    // Check FIREBASE_PRIVATE_KEY format without exposing the actual value
    if (privateKey.length > 0) {
      const hasHeader = privateKey.includes('-----BEGIN PRIVATE KEY-----') || privateKey.includes('-----BEGIN RSA PRIVATE KEY-----');
      const hasFooter = privateKey.includes('-----END PRIVATE KEY-----') || privateKey.includes('-----END RSA PRIVATE KEY-----');
      const hasNewlines = privateKey.includes('\\n') || privateKey.includes('\n');
      
      envChecks.FIREBASE_PRIVATE_KEY.format = hasHeader && hasFooter;
      envChecks.FIREBASE_PRIVATE_KEY.details = {
        hasHeader: hasHeader,
        hasFooter: hasFooter,
        hasNewlines: hasNewlines,
        lengthOk: privateKey.length > 100
      };
      
      if (!hasHeader || !hasFooter) {
        envChecks.FIREBASE_PRIVATE_KEY.error = 'Private key appears malformed. Ensure it includes BEGIN and END markers.';
      }
      if (!hasNewlines) {
        envChecks.FIREBASE_PRIVATE_KEY.warning = 'Private key may not have proper newline characters. Ensure \\n sequences are present.';
      }
    }

    const allPresent = envChecks.FIREBASE_PROJECT_ID.present && 
                       envChecks.FIREBASE_CLIENT_EMAIL.present && 
                       envChecks.FIREBASE_PRIVATE_KEY.present && 
                       envChecks.FIREBASE_DATABASE_URL.present;
    
    const allValid = allPresent && 
                     envChecks.FIREBASE_CLIENT_EMAIL.format && 
                     envChecks.FIREBASE_PRIVATE_KEY.format && 
                     envChecks.FIREBASE_DATABASE_URL.format;

    const missingVars = [];
    if (!envChecks.FIREBASE_PROJECT_ID.present) missingVars.push('FIREBASE_PROJECT_ID');
    if (!envChecks.FIREBASE_CLIENT_EMAIL.present) missingVars.push('FIREBASE_CLIENT_EMAIL');
    if (!envChecks.FIREBASE_PRIVATE_KEY.present) missingVars.push('FIREBASE_PRIVATE_KEY');
    if (!envChecks.FIREBASE_DATABASE_URL.present) missingVars.push('FIREBASE_DATABASE_URL');

    const invalidVars = [];
    if (envChecks.FIREBASE_CLIENT_EMAIL.present && !envChecks.FIREBASE_CLIENT_EMAIL.format) {
      invalidVars.push({ name: 'FIREBASE_CLIENT_EMAIL', hint: envChecks.FIREBASE_CLIENT_EMAIL.hint });
    }
    if (envChecks.FIREBASE_PRIVATE_KEY.present && !envChecks.FIREBASE_PRIVATE_KEY.format) {
      invalidVars.push({ 
        name: 'FIREBASE_PRIVATE_KEY', 
        hint: envChecks.FIREBASE_PRIVATE_KEY.hint,
        error: envChecks.FIREBASE_PRIVATE_KEY.error,
        warning: envChecks.FIREBASE_PRIVATE_KEY.warning
      });
    }
    if (envChecks.FIREBASE_DATABASE_URL.present && !envChecks.FIREBASE_DATABASE_URL.format) {
      invalidVars.push({ name: 'FIREBASE_DATABASE_URL', hint: envChecks.FIREBASE_DATABASE_URL.hint });
    }

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
        'Double-check that there are no extra quotes or spaces around the values.',
        'After setting/updating variables, you must REDEPLOY your Vercel app for changes to take effect.'
      ] : undefined
    });
  } catch (error) {
    // Even if something goes wrong, return a valid JSON response
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred while checking environment variables',
      message: error.message || 'Unknown error',
      troubleshooting: [
        'This is a server-side error that occurred during diagnostics.',
        'Try redeploying your Vercel app.',
        'Check Vercel function logs for more details.'
      ]
    });
  }
};
