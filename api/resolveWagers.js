// Serverless function to resolve pending wagers
// This checks game completion status and updates wager outcomes
// Designed to run on a schedule (hourly via Vercel cron)

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

// ESPN API endpoints for checking game status
const ESPN_API_ENDPOINTS = {
  'NFL': 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  'NBA': 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  'College Football': 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
  'College Basketball': 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard',
  'Major League Baseball': 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
  'NHL': 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard'
};

// Fetch game data from ESPN API
async function fetchGameData(gameId, sport) {
  try {
    const baseUrl = ESPN_API_ENDPOINTS[sport];
    if (!baseUrl) {
      console.error(`Unknown sport: ${sport}`);
      return null;
    }

    // Fetch from ESPN API
    const response = await fetch(baseUrl);
    if (!response.ok) {
      console.error(`ESPN API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    // Find the specific game in the response
    if (!data.events || !Array.isArray(data.events)) {
      return null;
    }

    const event = data.events.find(e => e.id === gameId);
    if (!event) {
      return null;
    }

    const competition = event.competitions[0];
    const awayTeam = competition.competitors[1];
    const homeTeam = competition.competitors[0];
    const status = event.status.type.state;

    return {
      id: event.id,
      status: status,
      isFinal: status === 'post',
      awayScore: parseInt(awayTeam.score) || 0,
      homeScore: parseInt(homeTeam.score) || 0,
      awayTeam: awayTeam.team.displayName,
      homeTeam: homeTeam.team.displayName
    };
  } catch (error) {
    console.error(`Error fetching game data for ${gameId}:`, error);
    return null;
  }
}

// Calculate wager outcome based on pick type
function calculatePickOutcome(pick, gameData) {
  if (pick.pickType === 'spread') {
    const spread = parseFloat(pick.spread);
    if (isNaN(spread)) {
      return 'unknown';
    }

    if (pick.pickedTeamType === 'away') {
      const adjustedScore = gameData.awayScore + spread;
      if (adjustedScore > gameData.homeScore) {
        return 'win';
      } else if (adjustedScore === gameData.homeScore) {
        return 'push';
      } else {
        return 'loss';
      }
    } else {
      const adjustedScore = gameData.homeScore + spread;
      if (adjustedScore > gameData.awayScore) {
        return 'win';
      } else if (adjustedScore === gameData.awayScore) {
        return 'push';
      } else {
        return 'loss';
      }
    }
  } else if (pick.pickType === 'winner' || pick.pickType === 'moneyline') {
    if (pick.pickedTeamType === 'away') {
      return gameData.awayScore > gameData.homeScore ? 'win' : 'loss';
    } else {
      return gameData.homeScore > gameData.awayScore ? 'win' : 'loss';
    }
  } else if (pick.pickType === 'total') {
    const total = parseFloat(pick.total);
    if (isNaN(total)) {
      return 'unknown';
    }

    const totalScore = gameData.awayScore + gameData.homeScore;
    if (pick.overUnder === 'over') {
      if (totalScore > total) {
        return 'win';
      } else if (totalScore === total) {
        return 'push';
      } else {
        return 'loss';
      }
    } else {
      if (totalScore < total) {
        return 'win';
      } else if (totalScore === total) {
        return 'push';
      } else {
        return 'loss';
      }
    }
  }

  return 'unknown';
}

// Payout multipliers for parlays
const PARLAY_MULTIPLIERS = {
  3: 8,
  4: 15,
  5: 25,
  6: 50,
  7: 100,
  8: 150,
  9: 200,
  10: 250
};

// Resolve a single wager
async function resolveWager(wagerId, wagerData, db) {
  try {
    const picks = wagerData.wagerData?.picks || wagerData.picks;
    if (!picks || !Array.isArray(picks) || picks.length === 0) {
      console.log(`Wager ${wagerId} has no picks, skipping`);
      return { success: false, reason: 'no_picks' };
    }

    // Check all picks and fetch game data
    const pickResults = [];
    let allGamesComplete = true;

    for (const pick of picks) {
      const gameData = await fetchGameData(pick.gameId, pick.sport);
      
      if (!gameData) {
        console.log(`Game data not available for ${pick.gameId}`);
        allGamesComplete = false;
        break;
      }

      if (!gameData.isFinal) {
        allGamesComplete = false;
        break;
      }

      const outcome = calculatePickOutcome(pick, gameData);
      pickResults.push({
        pick: pick,
        gameData: gameData,
        outcome: outcome
      });
    }

    // If not all games are complete, don't resolve yet
    if (!allGamesComplete) {
      return { success: false, reason: 'games_not_complete' };
    }

    // Calculate overall wager outcome
    let wins = 0;
    let losses = 0;
    let pushes = 0;

    pickResults.forEach(result => {
      if (result.outcome === 'win') {
        wins++;
      } else if (result.outcome === 'loss') {
        losses++;
      } else if (result.outcome === 'push') {
        pushes++;
      }
    });

    let wagerStatus;
    let payout = 0;
    const betType = wagerData.wagerData?.betType || wagerData.betType || 'parlay';
    const wagerAmount = parseFloat(wagerData.amount) || 0;

    if (betType === 'parlay') {
      // For parlays: all picks must win (pushes are treated as losses)
      if (losses > 0 || pushes > 0) {
        wagerStatus = 'lost';
      } else if (wins === picks.length) {
        wagerStatus = 'won';
        const multiplier = PARLAY_MULTIPLIERS[picks.length] || 0;
        payout = wagerAmount * multiplier;
      } else {
        wagerStatus = 'lost';
      }
    } else {
      // For straight bets: each pick is independent
      // This wager represents a single pick
      if (wins > 0) {
        wagerStatus = 'won';
        // For straight bets, payout is typically stake + winnings
        // Using 1.91 multiplier for standard -110 odds
        payout = wagerAmount * 1.91;
      } else if (pushes > 0) {
        wagerStatus = 'push';
        payout = wagerAmount; // Return original stake
      } else {
        wagerStatus = 'lost';
      }
    }

    // Update wager in database
    const updates = {
      status: wagerStatus,
      settledAt: new Date().toISOString(),
      payout: payout,
      pickResults: pickResults.map(r => ({
        gameId: r.pick.gameId,
        team: r.pick.team,
        outcome: r.outcome,
        finalScore: `${r.gameData.awayTeam} ${r.gameData.awayScore} - ${r.gameData.homeScore} ${r.gameData.homeTeam}`
      }))
    };

    await db.ref(`wagers/${wagerId}`).update(updates);

    console.log(`✅ Wager ${wagerId} resolved as ${wagerStatus}`);
    return { success: true, status: wagerStatus, payout: payout };

  } catch (error) {
    console.error(`Error resolving wager ${wagerId}:`, error);
    return { success: false, reason: 'error', error: error.message };
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

    try {
      // For cron jobs, verify the request is from Vercel
      const authHeader = req.headers.authorization;
      const cronSecret = process.env.CRON_SECRET;
      
      // If invoked manually with auth token, verify admin
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        
        if (!decodedToken.admin) {
          return res.status(403).json({ 
            success: false, 
            error: 'Admin privileges required'
          });
        }
      } else if (cronSecret) {
        // Verify cron secret for scheduled invocations
        const providedSecret = req.headers['x-vercel-cron-secret'] || req.query.secret;
        if (providedSecret !== cronSecret) {
          return res.status(401).json({ 
            success: false, 
            error: 'Unauthorized: Invalid cron secret'
          });
        }
      }

      const db = admin.database();

      // Get all pending wagers
      const wagersSnapshot = await db.ref('wagers').orderByChild('status').equalTo('pending').once('value');
      
      if (!wagersSnapshot.exists()) {
        return res.status(200).json({
          success: true,
          message: 'No pending wagers to resolve',
          resolved: 0
        });
      }

      const wagers = wagersSnapshot.val();
      const results = {
        total: 0,
        resolved: 0,
        won: 0,
        lost: 0,
        push: 0,
        errors: 0,
        skipped: 0
      };

      // Process each wager
      for (const [wagerId, wagerData] of Object.entries(wagers)) {
        results.total++;
        
        const result = await resolveWager(wagerId, wagerData, db);
        
        if (result.success) {
          results.resolved++;
          if (result.status === 'won') {
            results.won++;
          } else if (result.status === 'lost') {
            results.lost++;
          } else if (result.status === 'push') {
            results.push++;
          }
        } else if (result.reason === 'error') {
          results.errors++;
        } else {
          results.skipped++;
        }
      }

      console.log(`Wager resolution complete: ${JSON.stringify(results)}`);

      return res.status(200).json({
        success: true,
        message: 'Wager resolution complete',
        results: results
      });

    } catch (error) {
      console.error('Error in wager resolution:', error);
      
      return res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to resolve wagers'
      });
    }
  } catch (outerError) {
    console.error('Unexpected error in resolveWagers:', outerError);
    return res.status(500).json({
      success: false,
      error: 'An unexpected server error occurred',
      message: outerError.message || 'Unknown error'
    });
  }
};
