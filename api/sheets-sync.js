// /api/sheets-sync.js
// Google Sheets Sync Script

/**
 * Vercel Serverless Function to securely proxy wager data to a Google Apps Script Web App.
 *
 * How it works:
 * 1. Accepts only POST requests from the client-side application.
 * 2. Retrieves the Google Apps Script URL from a secure, server-side environment variable (GOOGLE_SCRIPT_URL).
 * 3. Forwards the JSON payload from the client directly to the Google Apps Script.
 * 4. Returns the response (and status) from Google back to the client, effectively bypassing browser CORS restrictions.
 */
module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept');
const googleScriptUrl = process.env.REACT_APP_GOOGLE_SHEET_URL;

  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
// Other code

  // Ensure the request is a POST request
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  // Retrieve the secure URL from Vercel's environment variables
  const googleScriptUrl = process.env.GOOGLE_SCRIPT_URL;

  // Validate that the environment variable is set
  if (!googleScriptUrl) {
    console.error('CRITICAL: GOOGLE_SCRIPT_URL environment variable is not set.');
    return res.status(500).json({
      success: false,
      message: 'Server configuration error: Sync endpoint is not configured.',
    });
  }

  try {
    // Forward the entire request body to the Google Apps Script URL
    // Note: Vercel serverless functions have a 10-second execution timeout on Hobby plan,
    // 60 seconds on Pro. If Google Apps Script responses are slower, consider upgrading.
    const googleResponse = await fetch(googleScriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    // Check if the fetch itself was successful
    if (!googleResponse.ok) {
      // If Google returns an error (e.g., 400, 500), log it and forward it.
      const errorText = await googleResponse.text();
      console.error(`Google Script returned an error: ${googleResponse.status} ${errorText}`);
      return res.status(googleResponse.status).json({
        success: false,
        message: 'Error response from Google Sheets sync service.',
        details: errorText,
      });
    }

    // Read response body as text first, then parse as JSON
    const responseText = await googleResponse.text();
    
    // Parse the JSON response from Google Apps Script
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      // Handle case where Google Apps Script returns non-JSON response
      console.error('Google Script returned non-JSON response:', responseText);
      return res.status(500).json({
        success: false,
        message: 'Invalid response format from Google Sheets sync service.',
        details: 'Expected JSON response',
      });
    }

    // Return the successful response from Google back to the original client
    return res.status(200).json(responseData);

  } catch (error) {
    console.error('Error proxying request to Google Script:', error);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred while syncing data.',
    });
  }
if (!googleScriptUrl) {
    console.error('CRITICAL: REACT_APP_GOOGLE_SHEET_URL environment variable is not set.');
}

// ... rest of the code
