// Serverless function to update game scores from external sports APIs
// This fetches the latest scores and marks games as complete in the database
// Designed to be called before wager resolution in on-demand polling

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

// ESPN API endpoints for all supported sports
const ESPN_API_ENDPOINTS = {
  'NFL': 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  'NBA': 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  'College Football': 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
  'College Basketball': 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard',
  'Major League Baseball': 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
  'NHL': 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard'
};

// Helper function to get date range URLs for ESPN API
// Fetches events from today to 7 days in the past (to catch recently completed games)
const getESPNDateRangeURLs = (baseURL) => {
  const urls = [];
  const today = new Date();
  
  // Check past 7 days plus today for recently completed games
  for (let i = -7; i <= 0; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, ''); // Format: YYYYMMDD
    urls.push(`${baseURL}?dates=${dateStr}`);
  }
  
  return urls;
};

// Fetch and update scores for a specific sport
async function updateSportScores(sport, db) {
  try {
    const apiEndpoint = ESPN_API_ENDPOINTS[sport];
    if (!apiEndpoint) {
      console.log(`Unknown sport: ${sport}`);
      return { success: false, sport, error: 'Unknown sport' };
    }

    const dateURLs = getESPNDateRangeURLs(apiEndpoint);
    const responses = await Promise.all(
      dateURLs.map(url => fetch(url).catch(err => {
        console.error(`Fetch error for ${url}:`, err);
        return null;
      }))
    );

    const validResponses = responses.filter(r => r !== null && r.ok);
    if (validResponses.length === 0) {
      console.log(`No valid responses for ${sport}`);
      return { success: false, sport, error: 'No valid API responses' };
    }

    const allData = await Promise.all(
      validResponses.map(r => r.json().catch(() => null))
    );

    // Collect all events from all responses
    const allEvents = [];
    allData.forEach(data => {
      if (data && data.events && Array.isArray(data.events)) {
        allEvents.push(...data.events);
      }
    });

    if (allEvents.length === 0) {
      console.log(`No events found for ${sport}`);
      return { success: true, sport, updated: 0, message: 'No events found' };
    }

    // Update database with game results
    let updatedCount = 0;
    const gameResults = {};

    for (const event of allEvents) {
      try {
        const competition = event.competitions[0];
        const awayTeam = competition.competitors[1];
        const homeTeam = competition.competitors[0];
        const status = event.status.type.state;
        const isFinal = status === 'post';

        // Only update completed games
        if (isFinal) {
          const gameId = event.id;
          gameResults[gameId] = {
            gameId: gameId,
            sport: sport,
            awayTeam: awayTeam.team.displayName,
            homeTeam: homeTeam.team.displayName,
            awayScore: parseInt(awayTeam.score) || 0,
            homeScore: parseInt(homeTeam.score) || 0,
            status: 'Final',
            isFinal: true,
            updatedAt: new Date().toISOString()
          };
          updatedCount++;
        }
      } catch (eventError) {
        console.error(`Error processing event ${event.id}:`, eventError);
      }
    }

    // Batch update to Firebase
    if (Object.keys(gameResults).length > 0) {
      await db.ref(`gameResults/${sport}`).update(gameResults);
      console.log(`✅ Updated ${updatedCount} completed games for ${sport}`);
    }

    return { success: true, sport, updated: updatedCount };
  } catch (error) {
    console.error(`Error updating scores for ${sport}:`, error);
    return { success: false, sport, error: error.message };
  }
}

// Main handler
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

    const db = admin.database();

    // Update scores for all supported sports
    const allSports = Object.keys(ESPN_API_ENDPOINTS);
    const results = await Promise.all(
      allSports.map(sport => updateSportScores(sport, db))
    );

    // Summarize results
    const summary = {
      totalSports: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      totalGamesUpdated: results.reduce((sum, r) => sum + (r.updated || 0), 0),
      details: results
    };

    console.log('Game score update complete:', JSON.stringify(summary));

    return res.status(200).json({
      success: true,
      message: 'Game scores updated successfully',
      summary: summary
    });

  } catch (error) {
    console.error('Error in updateGameScores:', error);
    return res.status(500).json({
      success: false,
      error: 'An unexpected server error occurred',
      message: error.message || 'Unknown error'
    });
  }
};
