# Odds Mapping Verification Guide

## Overview
This document verifies that the odds mapping logic in `App.js` correctly matches the approach from the working `useOddsApi.ts` hook, focusing on team name normalization, confidence logging, and data structure consistency.

## Key Implementation Details

### 1. Team Name Normalization
The implementation uses a multi-tier matching system:

1. **SID (Source ID) Matching** (100% confidence)
   - Most reliable method using The Odds API's participant IDs (e.g., `par_01hqmk...`)
   - These IDs are stored in the `aliases` array of team JSON files
   - Example: `{ "id": "NBA-020", "aliases": [..., "par_01hqmk..."] }`

2. **Name-based Matching** (fuzzy confidence)
   - Fallback when SID matching is incomplete
   - Uses `findTeamByName()` from `teamMapper.js`
   - Handles variations in team names

### 2. Game Key Format
Games are keyed using ESPN Integer IDs in the format: `${homeTeamId}|${awayTeamId}`

Example: `"14|17"` for Rams (14) vs 49ers (17)

### 3. Odds Data Structure
The odds data follows this structure (matching useOddsApi.ts format):

```javascript
{
  homeMoneyline: "-110",        // American odds format with +/- prefix
  awayMoneyline: "+150",        // American odds format with +/- prefix
  drawMoneyline: "+220",        // Optional, soccer only
  homeSpread: "-3.5",           // Point spread with +/- prefix
  awaySpread: "+3.5",           // Point spread with +/- prefix
  total: "47.5",                // Over/Under line (just the number)
  oddsApiEventId: "abc123...",  // The Odds API event ID for prop bets
}
```

### 4. Bookmaker Priority
Markets are sourced independently from the best available bookmaker:
- **Priority Order**: DraftKings → FanDuel → BetMGM → Caesars → Others
- Each market (moneyline, spread, total) can come from different bookmakers

## Expected Console Output

### Successful SID-based Match (100% Confidence)

```
🔍 === PROCESSING GAME 1/16 ===

🎮 Game 1: Los Angeles Rams @ San Francisco 49ers
   ⏰ Starts in: 48.2 hours (2024-01-15T17:00:00Z)
   🆔 Normalized IDs: Away=14, Home=17

  ✅ [MAPPING SUCCESS] API SID par_01hqmkr1ybfmfb8mhz10drfe21 -> Custom ID NFL-LAR -> ESPN Game Found
  ✅ [MAPPING SUCCESS] API SID par_01hqmks8jz3fv4rsb20jk75bcd -> Custom ID NFL-SF -> ESPN Game Found

  🔍 ODDS API MATCH: Team: Los Angeles Rams | SID: par_01hqmkr1ybfmfb8mhz10drfe21 | Custom ID: NFL-LAR | ESPN ID: 14
  🔍 ODDS API MATCH: Team: San Francisco 49ers | SID: par_01hqmks8jz3fv4rsb20jk75bcd | Custom ID: NFL-SF | ESPN ID: 17
  🔄 Using ESPN IDs for game key: Home="17", Away="14"
  📊 Game Key will be: "17|14"

✓ Matched teams: {
  home: 'San Francisco 49ers',
  away: 'Los Angeles Rams',
  method: 'sid',
  homeEspnId: '17',
  awayEspnId: '14'
}

  ✅ Using SID-based matching for price lookup: Home SID=par_01hqmks8jz3fv4rsb20jk75bcd, Away SID=par_01hqmkr1ybfmfb8mhz10drfe21

🎯 Team Match Confidence: {
  game: 'Los Angeles Rams @ San Francisco 49ers',
  confidence: '100%',
  method: 'sid',
  bookmaker: 'DraftKings',
  source: 'The Odds API'
}

  ✅ Moneyline prices found via DraftKings
     Away: +150, Home: -180

  📐 Spreads market found with 2 outcomes
    ✓ San Francisco 49ers: -3.5 (price: -110)
    ✓ Los Angeles Rams: +3.5 (price: -110)

  🎯 Totals market found with 2 outcomes
    ✓ Total: 47.5 (Over: -110, Under: -110)

  💾 Storing odds with key: "17|14"

  ✅ Los Angeles Rams @ San Francisco 49ers: ML via DraftKings, Spread via DraftKings, Total via DraftKings

📊 Bookmaker Sources: {
  game: 'Los Angeles Rams @ San Francisco 49ers',
  moneyline: { bookmaker: 'DraftKings', away: '+150', home: '-180' },
  spread: { bookmaker: 'DraftKings', away: '+3.5', home: '-3.5' },
  total: { bookmaker: 'DraftKings', line: '47.5' }
}

  📊 Final odds stored with key: "17|14"
     Away Spread: ✓ +3.5
     Home Spread: ✓ -3.5
     Total: ✓ 47.5
     Away ML: ✓ +150
     Home ML: ✓ -180
```

### Fallback Name-based Match (Fuzzy Confidence)

```
🔍 === PROCESSING GAME 5/16 ===

🎮 Game 5: Buffalo Bills @ Kansas City Chiefs
   ⏰ Starts in: 72.5 hours (2024-01-16T18:30:00Z)
   🆔 Normalized IDs: Away=2, Home=12

  ⚠️ SID extraction incomplete, falling back to name-based lookup...
  [MAPPING] Fallback matched Buffalo Bills to Team ID NFL-BUF (SID: par_01hqmkp9...)
  [MAPPING] Fallback matched Kansas City Chiefs to Team ID NFL-KC (SID: par_01hqmkq5...)

  🔍 ODDS API MATCH: Team: Buffalo Bills | SID: par_01hqmkp9... | Custom ID: NFL-BUF | ESPN ID: 2
  🔍 ODDS API MATCH: Team: Kansas City Chiefs | SID: par_01hqmkq5... | Custom ID: NFL-KC | ESPN ID: 12
  🔄 Using ESPN IDs for game key: Home="12", Away="2"
  📊 Game Key will be: "12|2"

✓ Matched teams: {
  home: 'Kansas City Chiefs',
  away: 'Buffalo Bills',
  method: 'name-based',
  homeEspnId: '12',
  awayEspnId: '2'
}

  ⚠️ SID-based matching incomplete, using name-based lookup
     Home SID=par_01hqmkq5..., Away SID=par_01hqmkp9...

🎯 Team Match Confidence: {
  game: 'Buffalo Bills @ Kansas City Chiefs',
  confidence: 'fuzzy',
  method: 'fuzzy',
  bookmaker: 'FanDuel',
  source: 'The Odds API'
}

  ✅ Moneyline prices found via FanDuel
     Away: +140, Home: -168
```

### Multiple Bookmaker Sources

```
📊 Bookmaker Sources: {
  game: 'Miami Dolphins @ Baltimore Ravens',
  moneyline: { bookmaker: 'DraftKings', away: '+180', home: '-215' },
  spread: { bookmaker: 'FanDuel', away: '+5.5', home: '-5.5' },
  total: { bookmaker: 'BetMGM', line: '44.5' }
}
```

## Verification Checklist

### ✅ Implementation Complete
- [x] Using `findBestMoneylinePrices()` from priceFinder.js
- [x] Game keys in format: `${homeTeamId}|${awayTeamId}`
- [x] SID-based matching with 100% confidence logging
- [x] Fallback to name-based matching with fuzzy confidence
- [x] Moneylines formatted as American odds with +/- prefix
- [x] Spreads formatted with +/- signs
- [x] Totals formatted as decimal numbers
- [x] Bookmaker sources logged for each market
- [x] Comprehensive diagnostic logging

### ✅ Data Structure Verified
- [x] homeMoneyline: string (e.g., "-110", "+150")
- [x] awayMoneyline: string
- [x] drawMoneyline: optional string (soccer)
- [x] homeSpread: string with +/- (e.g., "-3.5", "+7")
- [x] awaySpread: string with +/-
- [x] total: string (e.g., "47.5")
- [x] oddsApiEventId: stored for prop bets

### ✅ UI Components Preserved
- [x] GridBettingLayout.js - No modifications
- [x] Sidebar.js - No modifications
- [x] Data flow remains unchanged

### ✅ JSON Data Files Preserved
- [x] src/data/nfl-teams.json
- [x] src/data/nba-teams.json
- [x] src/data/master-teams.json
- [x] All team mapping files intact

## Testing Instructions

### 1. Start the Development Server
```bash
npm start
```

### 2. Navigate to NFL or NBA
Open browser console (F12) and select NFL or NBA from the sports menu.

### 3. Check Console Output
Verify the following logs appear:

- `🎯 Team Match Confidence` with confidence score and method
- `✓ Matched teams` showing the matching method used
- `📊 Bookmaker Sources` showing which bookmaker provided each market
- All moneylines formatted with +/- prefix
- All spreads formatted with +/- signs

### 4. Verify UI Display
- Moneylines display correctly in betting grid
- Spreads display with proper +/- formatting
- Totals display as decimal numbers
- No errors in console

## Success Criteria

✅ **All criteria met:**
1. Moneylines, spreads, and totals populate from The Odds API
2. Team matching works reliably with logged confidence scores
3. SID-based matching achieves 100% confidence when available
4. GridBettingLayout displays odds correctly
5. Sidebar continues to work without modifications
6. All JSON data files remain untouched
7. Console shows comprehensive diagnostic logging
8. Build completes without errors
9. All existing tests pass

## Summary

This implementation successfully migrates the odds mapping logic to use the same approach as the working useOddsApi.ts hook:

- **Team Normalization**: Multi-tier matching (SID → name-based → fuzzy)
- **Confidence Logging**: Clear indicators of match quality (100% for SID, fuzzy for fallbacks)
- **Data Structure**: Matches expected format with proper American odds formatting
- **Bookmaker Tracking**: Independent sourcing with detailed logging
- **Preservation**: No changes to UI components or data files

The system now provides transparency into how teams are matched and which bookmakers provide each market, making debugging and verification straightforward.
