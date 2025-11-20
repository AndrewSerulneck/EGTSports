import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

const functions = require('firebase-functions');
const axios = require('axios');
const cors = require('cors')({origin: true});

// Store your API key in Firebase environment config
// Run this command in your terminal (replace with your actual API key):
// firebase functions:config:set odds.api_key="YOUR_NEW_API_KEY_HERE"

exports.getPropBets = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    try {
      const apiKey = functions.config().odds.api_key;
      
      if (!apiKey) {
        return res.status(500).json({ error: 'API key not configured' });
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
      // Available markets: player_pass_tds, player_pass_yds, player_points, player_rebounds, etc.
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

      res.json({
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
  });
});

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
