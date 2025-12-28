# Quick Reference: Updated fetchOdds Function & useEffect

This document provides the complete, updated code for the key functions modified in the data flow overhaul.

## 1. Updated fetchOddsFromTheOddsAPI Function

**Location**: `src/App.js` lines 2465-2530

**Key Changes**:
- Added `commenceTimeFrom` and `commenceTimeTo` parameters
- Fetches games from NOW through 7 DAYS ahead
- Uses The Odds API v4 specification

```javascript
const fetchOddsFromTheOddsAPI = async (sport, forceRefresh = false) => {
  try {
    // CRITICAL: Check hard stop first - prevent any API calls if quota exhausted
    if (apiQuotaRef.current.hardStop) {
      console.error('🛑 HARD STOP: API quota exhausted. All API calls disabled.');
      return null;
    }
    
    const sportKey = ODDS_API_SPORT_KEYS[sport];
    if (!sportKey) {
      console.warn(`⚠️ No Odds API sport key for: ${sport}`);
      return null;
    }
    
    // CRITICAL: Validate environment variable
    if (!ODDS_API_KEY || ODDS_API_KEY === 'undefined') {
      console.error('❌ Error: REACT_APP_THE_ODDS_API_KEY is not defined in .env');
      console.error('Please add REACT_APP_THE_ODDS_API_KEY to your .env file');
      return null;
    }
    
    // Check cache first
    if (!forceRefresh && oddsAPICache[sport]) {
      const cached = oddsAPICache[sport];
      if (Date.now() - cached.timestamp < ODDS_API_CACHE_DURATION) {
        console.log(`✅ Using cached Odds API data for ${sport}`);
        return cached.data;
      }
    }
    
    // Build API URL with markets based on sport type
    const isSoccer = sport === 'World Cup' || sport === 'MLS';
    const isCombat = sport === 'Boxing' || sport === 'UFC';
    
    let markets;
    if (isCombat) {
      markets = 'h2h,h2h_method,h2h_round,h2h_go_distance';
    } else if (isSoccer) {
      markets = 'h2h,spreads,totals';
    } else {
      // US Sports: h2h (moneyline), spreads, totals
      markets = 'h2h,spreads,totals';
    }
    
    // V4 API: Add time parameters to include future games (next 7 days)
    // commenceTimeFrom: Current time (now)
    // commenceTimeTo: 7 days from now
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const commenceTimeFrom = now.toISOString();
    const commenceTimeTo = sevenDaysFromNow.toISOString();
    
    // CRITICAL: Explicitly request 'american' odds format and include future games
    const url = `${ODDS_API_BASE_URL}/sports/${sportKey}/odds/?apiKey=${ODDS_API_KEY}&regions=us&markets=${markets}&oddsFormat=american&commenceTimeFrom=${commenceTimeFrom}&commenceTimeTo=${commenceTimeTo}`;
    
    // DEBUG: Log URL with masked API key for security
    const maskedUrl = url.replace(ODDS_API_KEY, '***KEY_HIDDEN***');
    console.log(`🔥 Making Odds API call for ${sport}...`);
    console.log(`📡 URL: ${maskedUrl}`);
    console.log(`📋 Markets requested: ${markets}`);
    console.log(`📐 Odds format: american`);
    console.log(`⏰ Time range: ${commenceTimeFrom} to ${commenceTimeTo} (7 days)`);
    
    const response = await fetch(url);
    
    // ... rest of function continues with quota monitoring, response handling, etc.
  } catch (error) {
    console.error(`\n❌ EXCEPTION in fetchOddsFromTheOddsAPI for ${sport}:`, error);
    return null;
  }
};
```

## 2. Updated useEffect for Auto-Population

**Location**: `src/App.js` lines 4107-4169

**Key Changes**:
- Removed `!authState.isAdmin` barrier
- Added Firebase timestamp checking
- 5-minute freshness threshold
- Intelligent fetch vs cache decision

```javascript
useEffect(() => {
  // Auto-populate data for ANY authenticated user if Firebase data is stale (> 5 minutes)
  // This ensures members can trigger updates and see fresh odds
  const shouldCheckForUpdate = authState.user && 
                               !authState.loading && 
                               !sportsDataLoadedRef.current;
  
  if (shouldCheckForUpdate) {
    sportsDataLoadedRef.current = true;
    
    // Check Firebase timestamp to determine if refresh is needed
    const checkFirebaseTimestamp = async () => {
      try {
        const spreadsRef = ref(database, 'spreads/NFL');
        const snapshot = await get(spreadsRef);
        
        if (snapshot.exists()) {
          const data = snapshot.val();
          const gameIds = Object.keys(data);
          
          if (gameIds.length > 0) {
            // Check the first game's timestamp
            const firstGame = data[gameIds[0]];
            if (firstGame.timestamp) {
              const lastUpdate = new Date(firstGame.timestamp);
              const now = new Date();
              const minutesSinceUpdate = (now - lastUpdate) / (1000 * 60);
              
              console.log(`⏰ Last Firebase update: ${minutesSinceUpdate.toFixed(1)} minutes ago`);
              
              // Only fetch if data is older than 5 minutes
              if (minutesSinceUpdate > 5) {
                console.log('🔄 Data is stale (> 5 min), fetching fresh odds...');
                loadAllSports('NFL', true).catch(() => {
                  sportsDataLoadedRef.current = false;
                });
              } else {
                console.log('✅ Data is fresh (< 5 min), using existing Firebase data');
                loadAllSports('NFL', false).catch(() => {
                  sportsDataLoadedRef.current = false;
                });
              }
              return;
            }
          }
        }
        
        // No data or no timestamp found, fetch fresh
        console.log('📭 No existing Firebase data found, fetching fresh odds...');
        loadAllSports('NFL', true).catch(() => {
          sportsDataLoadedRef.current = false;
        });
      } catch (error) {
        console.error('Error checking Firebase timestamp:', error);
        // Fallback: load without forcing refresh
        loadAllSports('NFL', false).catch(() => {
          sportsDataLoadedRef.current = false;
        });
      }
    };
    
    checkFirebaseTimestamp();
  }
}, [authState.user, authState.loading, loadAllSports]);
```

## 3. Updated Firebase Rules JSON

**File**: `firebase.rules.json`

**Key Changes**:
- `.write: "auth != null"` (members can write)
- Timestamp accepts string OR number
- Added `isManual` field validation

```json
{
  "rules": {
    "spreads": {
      ".read": true,
      ".write": "auth != null",
      "$sport": {
        ".read": true,
        ".write": "auth != null",
        "$gameId": {
          ".validate": "newData.hasChild('timestamp') || data.exists()",
          "timestamp": { 
            ".validate": "newData.isString() || newData.isNumber()" 
          },
          "awaySpread": { 
            ".validate": "newData.isString()" 
          },
          "homeSpread": { 
            ".validate": "newData.isString()" 
          },
          "total": { 
            ".validate": "newData.isString()" 
          },
          "awayMoneyline": { 
            ".validate": "newData.isString()" 
          },
          "homeMoneyline": { 
            ".validate": "newData.isString()" 
          },
          "drawMoneyline": { 
            ".validate": "newData.isString()" 
          },
          "oddsApiEventId": { 
            ".validate": "newData.isString()" 
          },
          "isManual": {
            ".validate": "newData.isBoolean()"
          },
          "Q1_homeMoneyline": { ".validate": "newData.isString()" },
          "Q1_awayMoneyline": { ".validate": "newData.isString()" },
          "Q1_homeSpread": { ".validate": "newData.isString()" },
          "Q1_awaySpread": { ".validate": "newData.isString()" },
          "Q1_total": { ".validate": "newData.isString()" },
          "Q2_homeMoneyline": { ".validate": "newData.isString()" },
          "Q2_awayMoneyline": { ".validate": "newData.isString()" },
          "Q2_homeSpread": { ".validate": "newData.isString()" },
          "Q2_awaySpread": { ".validate": "newData.isString()" },
          "Q2_total": { ".validate": "newData.isString()" },
          "Q3_homeMoneyline": { ".validate": "newData.isString()" },
          "Q3_awayMoneyline": { ".validate": "newData.isString()" },
          "Q3_homeSpread": { ".validate": "newData.isString()" },
          "Q3_awaySpread": { ".validate": "newData.isString()" },
          "Q3_total": { ".validate": "newData.isString()" },
          "Q4_homeMoneyline": { ".validate": "newData.isString()" },
          "Q4_awayMoneyline": { ".validate": "newData.isString()" },
          "Q4_homeSpread": { ".validate": "newData.isString()" },
          "Q4_awaySpread": { ".validate": "newData.isString()" },
          "Q4_total": { ".validate": "newData.isString()" },
          "H1_homeMoneyline": { ".validate": "newData.isString()" },
          "H1_awayMoneyline": { ".validate": "newData.isString()" },
          "H1_homeSpread": { ".validate": "newData.isString()" },
          "H1_awaySpread": { ".validate": "newData.isString()" },
          "H1_total": { ".validate": "newData.isString()" },
          "H2_homeMoneyline": { ".validate": "newData.isString()" },
          "H2_awayMoneyline": { ".validate": "newData.isString()" },
          "H2_homeSpread": { ".validate": "newData.isString()" },
          "H2_awaySpread": { ".validate": "newData.isString()" },
          "H2_total": { ".validate": "newData.isString()" },
          "$other": {
            ".validate": "newData.isString()"
          }
        }
      }
    },
    "admins": { 
      ".read": "auth != null", 
      ".write": false 
    },
    "submissions": { 
      ".read": true, 
      "$ticketNumber": { 
        ".write": true 
      } 
    },
    "analytics": { 
      ".read": "auth != null && auth.token.admin === true", 
      "$entry": { 
        ".write": true 
      } 
    },
    "users": {
      ".read": "auth != null",
      ".write": "auth != null && auth.token.admin === true",
      "$userId": {
        "totalWagered": { 
          ".write": "auth != null && auth.uid === $userId" 
        }
      }
    },
    "wagers": {
      ".read": "auth != null",
      "$wagerId": { 
        ".write": "auth != null" 
      }
    },
    "artifacts": {
      "$appId": {
        "users": {
          "$userId": {
            ".read": "auth != null && auth.uid === $userId",
            ".write": "auth != null && auth.uid === $userId"
          }
        }
      }
    }
  }
}
```

## Console Output Examples

### Member Login (Fresh Data)
```
⏰ Last Firebase update: 2.3 minutes ago
✅ Data is fresh (< 5 min), using existing Firebase data
📥 Firebase data received for NFL: 15 games
```

### Member Login (Stale Data)
```
⏰ Last Firebase update: 8.7 minutes ago
🔄 Data is stale (> 5 min), fetching fresh odds...
🔥 Making Odds API call for NFL...
📋 Markets requested: h2h,spreads,totals
⏰ Time range: 2025-12-28T20:00:00.000Z to 2026-01-04T20:00:00.000Z (7 days)
📊 API Quota - Remaining: 485 | Used: 15
```

### Admin Manual Save
```
💾 Saving 15 games to Firebase path: spreads/NFL with isManual=true
  → Updating spreads/NFL/401234567
✅ Spreads saved! All devices will update in real-time. Manual override flag set.
```

## Configuration Constants

```javascript
// API Configuration
const ODDS_API_BASE_URL = 'https://api.the-odds-api.com/v4';
const ODDS_API_KEY = process.env.REACT_APP_THE_ODDS_API_KEY;

// Cache & Throttle Settings
const ODDS_API_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const GLOBAL_FETCH_THROTTLE = 60 * 1000; // 60 seconds
const FRESHNESS_THRESHOLD = 5 * 60 * 1000; // 5 minutes

// Time Window for Future Games
const FUTURE_GAMES_WINDOW = 7 * 24 * 60 * 60 * 1000; // 7 days
```

## Testing Commands

```bash
# Run tests
npm test

# Build production
npm run build

# Deploy to Vercel
vercel --prod

# Check Firebase rules
firebase database:rules:get
```

---

**Last Updated**: 2025-12-28  
**Status**: ✅ Production Ready  
**For Full Details**: See `DATA_FLOW_OVERHAUL_SUMMARY.md`
