// Google Sheets Sync Script

const googleScriptUrl = process.env.REACT_APP_GOOGLE_SHEET_URL;

// Other code

if (!googleScriptUrl) {
    console.error('CRITICAL: REACT_APP_GOOGLE_SHEET_URL environment variable is not set.');
}

// ... rest of the code