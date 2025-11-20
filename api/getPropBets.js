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

    // The Odds API endpoints for prop markets
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

    // Fetch prop bets from The Odds API
    const markets = [
      'player_pass_tds',
      'player_pass_yds',
      'player_rush_yds',
      'player_receptions',
      'player_points',
      'player_rebounds',
      'player_assists'
    ].join(',');

    const response = await axios.get(
      `https://api.the-odds-api.com/v4/sports/${sportKey}/events`,
      {
        params: {
          apiKey: apiKey,
          regions: 'us',
          markets: markets,
          oddsFormat: 'american'
        }
      }
    );

    // Transform the data for your frontend
    const propBets = transformPropBets(response.data, requestedSport);

    res.status(200).json({
      success: true,
      sport: requestedSport,
      propBets: propBets,
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
function transformPropBets(events, sport) {
  const propBets = [];
  
  events.forEach(event => {
    if (!event.bookmakers || event.bookmakers.length === 0) return;

    const gameTitle = `${event.away_team} @ ${event.home_team}`;
    
    event.bookmakers.forEach(bookmaker => {
      if (!bookmaker.markets) return;

      bookmaker.markets.forEach(market => {
        if (!market.outcomes) return;

        market.outcomes.forEach(outcome => {
          propBets.push({
            id: `${event.id}-${market.key}-${outcome.name}-${outcome.point || ''}`,
            sport: sport,
            gameTitle: gameTitle,
            commence_time: event.commence_time,
            playerName: outcome.name,
            marketKey: market.key,
            marketDisplay: formatMarketName(market.key),
            line: outcome.point,
            odds: outcome.price,
            bookmaker: bookmaker.title
          });
        });
      });
    });
  });

  return propBets;
}

// Format market names for display
function formatMarketName(marketKey) {
  const names = {
    'player_pass_tds': 'Passing Touchdowns',
    'player_pass_yds': 'Passing Yards',
    'player_rush_yds': 'Rushing Yards',
    'player_receptions': 'Receptions',
    'player_points': 'Points',
    'player_rebounds': 'Rebounds',
    'player_assists': 'Assists'
  };
  return names[marketKey] || marketKey;
}
