# Moneyline Implementation Documentation

## Overview
This document explains how moneylines are extracted from The Odds API's `h2h` (head-to-head) market and saved to Firebase through the `saveSpreadToFirebase` function.

## Data Flow

### 1. API Fetch (The Odds API)
**Location**: `src/App.js` lines 2285-2500

The application fetches odds from The Odds API with the `h2h` market explicitly requested:

```javascript
// Line 2317-2331
const isSoccer = sport === 'World Cup' || sport === 'MLS';
const isCombat = sport === 'Boxing' || sport === 'UFC';

let markets;
if (isCombat) {
  markets = 'h2h,h2h_method,h2h_round,h2h_go_distance';
} else if (isSoccer) {
  markets = 'h2h,spreads,totals';
} else {
  markets = 'h2h,spreads,totals';
}

// Line 2334
const url = `${ODDS_API_BASE_URL}/sports/${sportKey}/odds/?apiKey=${ODDS_API_KEY}&regions=us&markets=${markets}&oddsFormat=american`;
```

**Key Points:**
- `h2h` market is ALWAYS included for all sports
- `american` odds format is explicitly requested
- The API returns bookmakers with markets array containing h2h data

### 2. Moneyline Extraction
**Location**: `src/App.js` lines 2645-2735

For each game, the code searches through all bookmakers to find one with a valid `h2h` market:

```javascript
// Line 2649
const h2hResult = findBookmakerWithMarket(game.bookmakers, 'h2h', homeTeam, awayTeam);
```

The `findBookmakerWithMarket` function (lines 2227-2282) uses priority-based selection:
1. **Priority bookmakers**: DraftKings → FanDuel → BetMGM → Pinnacle → WilliamHill
2. **Fallback**: Any other bookmaker if priority ones don't have the market

Once the h2h market is found, outcomes are extracted with team name matching:

```javascript
// Lines 2660-2672
const homeOutcome = h2hMarket.outcomes.find(o => {
  if (o.name === homeTeam) return true;
  return teamsMatchHelper(o.name, homeTeam); // Fuzzy matching fallback
});

const awayOutcome = h2hMarket.outcomes.find(o => {
  if (o.name === awayTeam) return true;
  return teamsMatchHelper(o.name, awayTeam);
});
```

Moneylines are formatted with proper +/- prefixes:

```javascript
// Lines 2677, 2694
if (homeOutcome.price !== undefined && homeOutcome.price !== null && !isNaN(homeOutcome.price)) {
  homeMoneyline = homeOutcome.price > 0 ? `+${homeOutcome.price}` : String(homeOutcome.price);
}

if (awayOutcome.price !== undefined && awayOutcome.price !== null && !isNaN(awayOutcome.price)) {
  awayMoneyline = awayOutcome.price > 0 ? `+${awayOutcome.price}` : String(awayOutcome.price);
}
```

**Example Transformations:**
- API returns `150` → Formatted as `+150`
- API returns `-175` → Formatted as `-175`
- API returns `100` → Formatted as `+100`
- API returns `-100` → Formatted as `-100`

### 3. Odds Data Assembly
**Location**: `src/App.js` lines 2803-2826

The extracted moneylines are assembled into an odds object:

```javascript
const oddsData = { 
  awaySpread,      // From spreads market
  homeSpread,      // From spreads market
  total,           // From totals market
  awayMoneyline,   // From h2h market ✅
  homeMoneyline,   // From h2h market ✅
  oddsApiEventId: game.id
};

oddsMap[gameKey] = oddsData;
```

**Key**: `oddsMap` is keyed by `"AwayTeam|HomeTeam"` format

### 4. Game Enrichment
**Location**: `src/App.js` lines 3340-3375

ESPN games are enriched with odds from the oddsMap:

```javascript
// Line 3347
const odds = matchOddsToGame(game, oddsMap);

// Lines 3358-3365
const updatedGame = {
  ...game,
  awaySpread: odds.awaySpread || game.awaySpread,
  homeSpread: odds.homeSpread || game.homeSpread,
  total: odds.total || game.total,
  awayMoneyline: odds.awayMoneyline || game.awayMoneyline,  // ✅
  homeMoneyline: odds.homeMoneyline || game.homeMoneyline,  // ✅
  oddsApiEventId: odds.oddsApiEventId
};
```

The `matchOddsToGame` function (lines 2883-2931) handles:
1. Exact team name matching
2. Fuzzy mascot-based matching
3. Fallback to default values if no match found

### 5. AdminPanel Display
**Location**: `src/App.js` lines 660-665

Moneylines are displayed in the admin interface:

```javascript
<div style={{marginTop: '10px'}}>
  <strong>Moneyline:</strong><br/>
  <input type="text" value={game.awayMoneyline} 
         onChange={(e) => updateMoneyline(game.id, 'away', e.target.value)} 
         placeholder={`${game.awayTeam} ML, e.g. +150`} />
  <input type="text" value={game.homeMoneyline} 
         onChange={(e) => updateMoneyline(game.id, 'home', e.target.value)} 
         placeholder={`${game.homeTeam} ML, e.g. -180`} />
</div>
```

Admins can manually edit moneylines if needed using the `updateMoneyline` function (lines 470-478).

### 6. Firebase Save
**Location**: `src/App.js` lines 437-458

The `saveSpreadToFirebase` function saves all game data including moneylines:

```javascript
const saveSpreadToFirebase = async () => {
  try {
    setIsSyncing(true);
    const spreadsData = {};
    
    games.forEach(game => {
      spreadsData[game.espnId] = {
        awaySpread: game.awaySpread || '',
        homeSpread: game.homeSpread || '',
        awayMoneyline: game.awayMoneyline || '',  // ✅ Saved
        homeMoneyline: game.homeMoneyline || '',  // ✅ Saved
        total: game.total || '',
        timestamp: new Date().toISOString()
      };
    });
    
    await set(ref(database, `spreads/${sport}`), spreadsData);
    alert('✅ Spreads saved! All devices will update in real-time.');
    setIsSyncing(false);
  } catch (error) {
    alert('❌ Error saving spreads:\n' + error.message);
    setIsSyncing(false);
  }
};
```

**Firebase Structure:**
```
spreads/
  NFL/
    401234567/  (espnId)
      awaySpread: "+3.5"
      homeSpread: "-3.5"
      awayMoneyline: "+130"
      homeMoneyline: "-150"
      total: "220.5"
      timestamp: "2024-12-27T02:48:55.078Z"
```

## Special Cases

### Soccer (3-Way Markets)
**Location**: `src/App.js` lines 2710-2722

Soccer games include a Draw outcome:

```javascript
if (isSoccer) {
  const drawOutcome = h2hMarket.outcomes.find(o => o.name === 'Draw');
  if (drawOutcome) {
    drawMoneyline = drawOutcome.price > 0 ? `+${drawOutcome.price}` : String(drawOutcome.price);
  }
}
```

The draw moneyline is added to the odds object (line 2816) but is NOT saved to Firebase by the current implementation. Only `awayMoneyline` and `homeMoneyline` are saved.

### Combat Sports (UFC/Boxing)
**Location**: `src/App.js` lines 2724-2730

Combat sports verify 2-way market structure (no draws):

```javascript
if (isCombat) {
  if (h2hMarket.outcomes.length !== 2) {
    console.warn(`⚠️ Expected 2 outcomes for combat sport, got ${h2hMarket.outcomes.length}`);
  }
}
```

Additional combat-specific markets are also extracted:
- `h2h_method` - Method of victory
- `h2h_round` - Round betting
- `h2h_go_distance` - Will fight go the distance

### Missing Moneylines
If no h2h market is found, moneylines default to `'-'`:

```javascript
// Line 2582
let homeMoneyline = '-';
let awayMoneyline = '-';
```

When saved to Firebase with no data, they become empty strings:

```javascript
// Line 445-446
awayMoneyline: game.awayMoneyline || '',
homeMoneyline: game.homeMoneyline || '',
```

## Error Handling

### Team Matching Failures
**Location**: `src/App.js` lines 2687-2707

If team names don't match between The Odds API and ESPN:

```javascript
if (!homeOutcome) {
  console.error(`🔍 REASON 3 (Matching Failure): [${gameName}]: h2h exists, but couldn't match home team outcome.`);
  console.error(`   API says outcomes: [${h2hMarket.outcomes.map(o => o.name).join(', ')}]`);
  console.error(`   Local says Home: "${homeTeam}"`);
}
```

The `teamsMatchHelper` function uses mascot extraction for fuzzy matching to handle variations like:
- "LA Lakers" vs "Los Angeles Lakers"
- "Philadelphia 76ers" vs "76ers"

### Invalid Price Values
**Location**: `src/App.js` lines 2676, 2693

Prices are validated before formatting:

```javascript
if (homeOutcome.price !== undefined && homeOutcome.price !== null && !isNaN(homeOutcome.price)) {
  homeMoneyline = homeOutcome.price > 0 ? `+${homeOutcome.price}` : String(homeOutcome.price);
} else {
  console.warn(`⚠️ ${homeTeam} outcome missing valid 'price' field: ${homeOutcome.price}`);
}
```

## Testing

### Test Coverage
**Location**: `src/MoneylineExtraction.test.js`

The implementation is validated with 9 comprehensive tests:

1. **h2h Market Extraction**
   - Basic extraction with positive and negative odds
   - Positive moneyline formatting (+150)
   - Negative moneyline formatting (-175)
   - Even money handling (±100)
   - Soccer 3-way market with Draw

2. **Firebase Save Data Structure**
   - All required fields present
   - Missing moneylines gracefully handled (empty strings)
   - Multiple games preserved correctly

3. **Integration Testing**
   - End-to-end flow from h2h market → Firebase save structure

### Running Tests

```bash
# Run all tests
npm test -- --watchAll=false

# Run only moneyline tests
npm test -- MoneylineExtraction.test.js --watchAll=false
```

## API Reference

### The Odds API Response Format

```json
{
  "id": "abc123",
  "sport_key": "americanfootball_nfl",
  "commence_time": "2024-12-27T18:00:00Z",
  "home_team": "Dallas Cowboys",
  "away_team": "Philadelphia Eagles",
  "bookmakers": [
    {
      "key": "draftkings",
      "title": "DraftKings",
      "markets": [
        {
          "key": "h2h",
          "outcomes": [
            {
              "name": "Dallas Cowboys",
              "price": -150
            },
            {
              "name": "Philadelphia Eagles",
              "price": 130
            }
          ]
        },
        {
          "key": "spreads",
          "outcomes": [...]
        },
        {
          "key": "totals",
          "outcomes": [...]
        }
      ]
    }
  ]
}
```

**Market Keys Used:**
- `h2h` - Moneyline/Head-to-head (winner of game)
- `spreads` - Point spread
- `totals` - Over/Under total points

## Troubleshooting

### Common Issues

#### 1. Moneylines showing as '-'
**Cause**: No h2h market found for game  
**Check**: Console logs for "❌ No 'h2h' (moneyline) market found"  
**Solution**: Bookmakers may have taken moneyline off the board

#### 2. Team matching failures
**Cause**: Team name mismatch between APIs  
**Check**: Console logs for "REASON 3 (Matching Failure)"  
**Solution**: Verify team names match or add to mascot extraction logic

#### 3. Moneylines not saving
**Cause**: Game object missing moneyline fields  
**Check**: Verify `game.awayMoneyline` and `game.homeMoneyline` exist  
**Solution**: Ensure odds enrichment completed successfully

## Related Documentation

- **Master Documentation**: `copilot-instructions.md` - Complete system architecture
- **API Rules**: `copilot-instructions.md` section "The Odds API - Master Betting Market & UI Rules"
- **RBAC**: `RBAC_IMPLEMENTATION.md` - Role-based access control
- **Deployment**: `DEPLOYMENT_GUIDE.md` - Production deployment steps

## Last Updated
December 27, 2024
