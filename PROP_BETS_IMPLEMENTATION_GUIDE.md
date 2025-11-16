# Prop Bets Implementation Guide

## Overview
This guide will walk you through implementing prop bets in your EGTSports application using The Odds API. The implementation uses Firebase Cloud Functions to securely store your API key and fetch prop bets data.

---

## ⚠️ Important Security Note
**NEVER share your API key publicly or commit it to GitHub!** Always use Firebase Cloud Functions or similar serverless solutions to keep your API key secure.

---

## Step-by-Step Implementation

### Step 1: Set Up Firebase Cloud Functions

1. **Install Firebase CLI** (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:
   ```bash
   firebase login
   ```

3. **Initialize Firebase Functions in your project**:
   ```bash
   cd /path/to/your/EGTSports/project
   firebase init functions
   ```
   - Select your existing Firebase project
   - Choose JavaScript or TypeScript (JavaScript is simpler)
   - Choose to install dependencies now

### Step 2: Create the Cloud Function

1. **Navigate to the functions directory**:
   ```bash
   cd functions
   ```

2. **Install axios** (for making HTTP requests):
   ```bash
   npm install axios
   ```

3. **Edit `functions/index.js`** and add the following code:

```javascript
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
```

4. **Set your API key** (run this in your terminal, replacing with your actual API key):
   ```bash
   firebase functions:config:set odds.api_key="YOUR_NEW_API_KEY_HERE"
   ```

5. **Deploy the function**:
   ```bash
   firebase deploy --only functions
   ```

### Step 3: Update Your React App

The frontend code has already been prepared for you. You just need to update the API endpoint in `src/App.js`.

1. **Find the `FIREBASE_FUNCTIONS_BASE_URL` constant** in `src/App.js` (around line 60)

2. **Replace it with your Firebase Functions URL**:
   ```javascript
   // After deploying, Firebase will give you a URL like:
   // https://us-central1-your-project-id.cloudfunctions.net
   const FIREBASE_FUNCTIONS_BASE_URL = 'https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net';
   ```

3. **Your Firebase Project ID** can be found:
   - In your Firebase Console URL
   - In your `.firebaserc` file in the project root
   - Run `firebase projects:list` to see all your projects

### Step 4: Test the Implementation

1. **Start your React app**:
   ```bash
   npm start
   ```

2. **Sign in to your application**

3. **Click on the "Prop Bets" tab** in the left sidebar (🎯 icon)

4. **You should see**:
   - Sport tabs (NFL, NBA, College Football, College Basketball, NHL)
   - Player prop bets organized by game
   - Ability to select props and add them to your betting slip

### Step 5: Monitor API Usage

To check your API usage:

1. **Check Firebase Function logs**:
   ```bash
   firebase functions:log
   ```
   Look for the `remainingRequests` value in the responses

2. **Check The Odds API dashboard**:
   - Visit https://the-odds-api.com/account/
   - View your API usage and remaining requests

---

## API Usage Optimization

The implementation includes several optimizations to stay under 500 requests/month:

1. **Caching**: Prop bets are cached for 2 hours
2. **On-Demand Loading**: Props are only fetched when you click the "Prop Bets" tab
3. **Single Sport Fetching**: Only one sport's props are fetched at a time
4. **No Auto-Refresh**: Props don't auto-refresh like game schedules

**Estimated Monthly Usage**: 50-100 requests (well under your 500 limit)

---

## Troubleshooting

### Function deployment fails
- Make sure you're logged in: `firebase login`
- Check your Firebase project: `firebase use --add`
- Verify billing is enabled in Firebase Console (Functions require Blaze plan)

### API key not working
- Verify you set it correctly: `firebase functions:config:get`
- Redeploy after setting: `firebase deploy --only functions`

### CORS errors
- The function includes CORS headers - if you still see errors, check your Firebase project settings

### No props showing up
- Check the browser console for errors
- Verify the Firebase Function URL is correct
- Check if The Odds API has data for the sport you selected

---

## What's Already Done For You

✅ PropBetsView component created  
✅ Prop bets integrated into betting slip  
✅ Prop Bets tab added to sidebar  
✅ Styling and UI complete  
✅ Caching implemented  
✅ API optimization in place  

## What You Need to Do

📝 Step 1: Initialize Firebase Functions  
📝 Step 2: Create and deploy the Cloud Function  
📝 Step 3: Set your API key securely  
📝 Step 4: Update the Firebase Functions URL in App.js  
📝 Step 5: Test and enjoy!  

---

## Security Best Practices

✅ API key stored in Firebase config (not in code)  
✅ Cloud Function acts as secure proxy  
✅ Frontend never directly accesses The Odds API  
✅ API key never exposed in browser  
✅ Usage tracked server-side  

---

## Need Help?

If you run into issues:
1. Check Firebase Functions logs: `firebase functions:log`
2. Check browser console for errors
3. Verify your API key is valid at https://the-odds-api.com/account/
4. Make sure Firebase billing (Blaze plan) is enabled for Cloud Functions

---

## Summary

You now have a complete prop bets system that:
- ✅ Securely stores your API key
- ✅ Fetches real-time player props
- ✅ Displays props by sport and game
- ✅ Integrates with your existing betting slip
- ✅ Stays under your API limits
- ✅ Looks professional and matches your app's design

The only steps left are deploying the Firebase Function and updating the URL in your React app!
