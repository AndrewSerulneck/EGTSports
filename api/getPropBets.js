const axios = require('axios');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept');

  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Get API key from environment variable (set in Vercel dashboard)
    const apiKey = process.env.ODDS_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'API key not configured',
        message: 'Please set ODDS_API_KEY in Vercel environment variables'
      });
    }

    // The Odds API endpoints for main betting markets
    // To enable debug logging, set ODDS_API_DEBUG=true in environment variables
    const sports = {
      'NFL': 'americanfootball_nfl',
      'NBA': 'basketball_nba',
      'College Football': 'americanfootball_ncaaf',
      'College Basketball': 'basketball_ncaab',
      'NHL': 'icehockey_nhl'
    };

    const requestedSport = req.query.sport || 'NFL';
    const sportKey = sports[requestedSport];

    if (!sportKey) {
      return res.status(400).json({ error: 'Invalid sport' });
    }

    // Fetch odds from The Odds API - using correct endpoint and markets
    const response = await axios.get(
      `https://api.the-odds-api.com/v4/sports/${sportKey}/odds`,
      {
        params: {
          apiKey: apiKey,
          regions: 'us',
          markets: 'h2h,spreads,totals',
          oddsFormat: 'american'
        }
      }
    );

    // Log the raw JSON response for debugging (controlled by environment variable)
    const enableDebugLogs = process.env.ODDS_API_DEBUG === 'true';
    
    if (enableDebugLogs) {
      console.log('=== RAW API RESPONSE ===');
      console.log(`Sport: ${requestedSport} (${sportKey})`);
      console.log(`Total games returned: ${response.data.length}`);
      console.log('Full response data:', JSON.stringify(response.data, null, 2));
      console.log('========================');
    }

    // Transform the data for your frontend
    const oddsData = transformOdds(response.data, requestedSport, enableDebugLogs);

    if (enableDebugLogs) {
      console.log(`\n=== FINAL SUMMARY ===`);
      console.log(`Total odds entries created: ${oddsData.length}`);
      console.log('=====================\n');
    }

    res.status(200).json({
      success: true,
      sport: requestedSport,
      propBets: oddsData,
      remainingRequests: response.headers['x-requests-remaining'],
      usedRequests: response.headers['x-requests-used']
    });

  } catch (error) {
    console.error('Error fetching prop bets:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch prop bets',
      message: error.message 
    });
  }
};

// Helper function to transform API response
function transformOdds(games, sport, enableDebugLogs = false) {
  const oddsEntries = [];
  
  if (enableDebugLogs) {
    console.log(`\n=== TRANSFORMING ODDS FOR ${sport} ===`);
    console.log(`Processing ${games.length} games...`);
  }
  
  games.forEach((game, gameIndex) => {
    const gameTitle = `${game.away_team} @ ${game.home_team}`;
    
    if (enableDebugLogs) {
      console.log(`\n--- Game ${gameIndex + 1}: ${gameTitle} ---`);
      console.log(`Game ID: ${game.id}`);
      console.log(`Commence time: ${game.commence_time}`);
    }
    
    if (!game.bookmakers || game.bookmakers.length === 0) {
      if (enableDebugLogs) {
        console.log(`  ⚠️ No bookmakers available for this game`);
      }
      return;
    }
    
    if (enableDebugLogs) {
      console.log(`  Found ${game.bookmakers.length} bookmaker(s)`);
    }
    
    // Iterate through each bookmaker
    game.bookmakers.forEach((bookmaker, bookmakerIndex) => {
      if (enableDebugLogs) {
        console.log(`  \n  Bookmaker ${bookmakerIndex + 1}: ${bookmaker.title}`);
      }
      
      if (!bookmaker.markets || bookmaker.markets.length === 0) {
        if (enableDebugLogs) {
          console.log(`    ⚠️ No markets available for this bookmaker`);
        }
        return;
      }
      
      if (enableDebugLogs) {
        console.log(`    Found ${bookmaker.markets.length} market(s)`);
        
        // Check which markets are available
        const availableMarkets = bookmaker.markets.map(m => m.key);
        console.log(`    Available markets: ${availableMarkets.join(', ')}`);
        
        // Check for missing markets
        const expectedMarkets = ['h2h', 'spreads', 'totals'];
        const missingMarkets = expectedMarkets.filter(m => !availableMarkets.includes(m));
        if (missingMarkets.length > 0) {
          console.log(`    ⚠️ Missing markets: ${missingMarkets.join(', ')}`);
        }
      }
      
      // Iterate through each market
      bookmaker.markets.forEach((market) => {
        const marketType = market.key;
        
        if (enableDebugLogs) {
          console.log(`    \n    Processing market: ${marketType}`);
        }
        
        if (!market.outcomes || market.outcomes.length === 0) {
          if (enableDebugLogs) {
            console.log(`      ⚠️ No outcomes for this market`);
          }
          return;
        }
        
        if (enableDebugLogs) {
          console.log(`      Found ${market.outcomes.length} outcome(s)`);
        }
        
        // Process outcomes based on market type
        if (marketType === 'h2h') {
          // Moneyline - one outcome per team
          market.outcomes.forEach((outcome) => {
            const entry = {
              id: `${game.id}-${bookmaker.key || bookmaker.title}-h2h-${outcome.name}`,
              sport: sport,
              gameTitle: gameTitle,
              gameId: game.id,
              commence_time: game.commence_time,
              marketType: 'h2h',
              marketDisplay: 'Moneyline',
              bookmaker: bookmaker.title,
              team: outcome.name,
              odds: outcome.price,
              lastUpdate: bookmaker.last_update
            };
            oddsEntries.push(entry);
            if (enableDebugLogs) {
              console.log(`      ✓ Added h2h: ${outcome.name} @ ${outcome.price}`);
            }
          });
        } else if (marketType === 'spreads') {
          // Point Spreads - one outcome per team with point value
          market.outcomes.forEach((outcome) => {
            const entry = {
              id: `${game.id}-${bookmaker.key || bookmaker.title}-spreads-${outcome.name}-${outcome.point}`,
              sport: sport,
              gameTitle: gameTitle,
              gameId: game.id,
              commence_time: game.commence_time,
              marketType: 'spreads',
              marketDisplay: 'Point Spread',
              bookmaker: bookmaker.title,
              team: outcome.name,
              point: outcome.point,
              odds: outcome.price,
              lastUpdate: bookmaker.last_update
            };
            oddsEntries.push(entry);
            if (enableDebugLogs) {
              const pointDisplay = outcome.point === 0 ? '0' : (outcome.point > 0 ? `+${outcome.point}` : `${outcome.point}`);
              console.log(`      ✓ Added spread: ${outcome.name} ${pointDisplay} @ ${outcome.price}`);
            }
          });
        } else if (marketType === 'totals') {
          // Over/Under Totals - Over and Under outcomes with point value
          market.outcomes.forEach((outcome) => {
            const entry = {
              id: `${game.id}-${bookmaker.key || bookmaker.title}-totals-${outcome.name}-${outcome.point}`,
              sport: sport,
              gameTitle: gameTitle,
              gameId: game.id,
              commence_time: game.commence_time,
              marketType: 'totals',
              marketDisplay: 'Over/Under',
              bookmaker: bookmaker.title,
              selection: outcome.name, // "Over" or "Under"
              point: outcome.point,
              odds: outcome.price,
              lastUpdate: bookmaker.last_update
            };
            oddsEntries.push(entry);
            if (enableDebugLogs) {
              console.log(`      ✓ Added total: ${outcome.name} ${outcome.point} @ ${outcome.price}`);
            }
          });
        } else {
          if (enableDebugLogs) {
            console.log(`      ⚠️ Unknown market type: ${marketType}`);
          }
        }
      });
    });
  });
  
  if (enableDebugLogs) {
    console.log(`\n=== TRANSFORMATION COMPLETE ===`);
    console.log(`Total odds entries created: ${oddsEntries.length}`);
    
    // Summary by market type
    const h2hCount = oddsEntries.filter(e => e.marketType === 'h2h').length;
    const spreadsCount = oddsEntries.filter(e => e.marketType === 'spreads').length;
    const totalsCount = oddsEntries.filter(e => e.marketType === 'totals').length;
    
    console.log(`  - Moneyline (h2h): ${h2hCount}`);
    console.log(`  - Point Spreads: ${spreadsCount}`);
    console.log(`  - Over/Under Totals: ${totalsCount}`);
    console.log(`================================\n`);
  }
  
  return oddsEntries;
}

