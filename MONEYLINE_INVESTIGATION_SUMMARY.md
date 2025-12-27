# Moneyline (h2h) Data Investigation Summary

## Problem Statement
Only the Phoenix Suns vs New Orleans Pelicans NBA game shows moneyline odds. Other games across NFL, NHL, and NBA show dashes ("-") for moneyline odds.

## Investigation Findings

### 1. Data Flow Architecture
```
ESPN API (Primary) → Parse odds → If incomplete → The Odds API (Fallback) → Match to games
```

### 2. Team Name Matching Logic
The `extractMascot()` function extracts the last word from team names for matching:
- "Phoenix Suns" → "suns"
- "New Orleans Pelicans" → "pelicans"
- "Philadelphia 76ers" → "76ers"

**Finding**: The mascot matching logic works correctly for standard team names and handles special cases (Sox, Bulls, etc.) properly.

### 3. The Odds API Integration

#### API Request Configuration
```javascript
// Location: src/App.js, line 2077-2081
markets = 'h2h,spreads,totals'; // For US sports
const url = `${ODDS_API_BASE_URL}/sports/${sportKey}/odds/?apiKey=${ODDS_API_KEY}&regions=us&markets=${markets}&oddsFormat=american`;
```

**Key Point**: The API explicitly requests the `h2h` (moneyline) market.

#### Data Parsing Logic (lines 2350-2407)
1. Checks if `h2hMarket` exists in bookmaker's markets array
2. If found: Matches team names to outcomes by exact string comparison
3. If not found: Logs warning and stores dash ("-")

### 4. Root Cause Analysis

The enhanced logging (added in this investigation) will reveal one of these scenarios:

#### Scenario A: h2h Market Missing from API Response
```
❌ No moneyline (h2h) market found
📋 Available markets: spreads, totals
```
**Cause**: The Odds API bookmaker doesn't provide h2h odds for that game.

#### Scenario B: Team Name Mismatch
```
💰 Moneyline (h2h) market found
⚠️ No h2h outcome found for home team: "Dallas Cowboys"
   Available outcome names: "Dallas", "Green Bay Packers"
```
**Cause**: Team names in h2h outcomes don't match ESPN team names.

#### Scenario C: Suns/Pelicans Success Case
```
💰 Moneyline (h2h) market found
✓ Phoenix Suns: -150
✓ New Orleans Pelicans: +130
```
**Why it works**: Both h2h market exists AND team names match exactly.

## Enhanced Logging Implemented

### Console Output Enhancements (src/App.js, lines 2350-2418)
1. **When h2h found**: Shows all outcome names and exact team names being matched
2. **When h2h missing**: Lists available markets and suggests possible causes
3. **On mismatch**: Shows which team names don't match and what alternatives exist

Example output:
```javascript
🎮 Game 1: Dallas Cowboys @ Green Bay Packers
  📋 Available markets: spreads, totals, h2h
  💰 Moneyline (h2h) market found with 2 outcomes
    Raw outcomes: [
      { name: "Dallas Cowboys", price: -140 },
      { name: "Green Bay Packers", price: 120 }
    ]
    🔍 Attempting to match against:
       Home team from API: "Green Bay Packers"
       Away team from API: "Dallas Cowboys"
    ✓ Dallas Cowboys: -140
    ✓ Green Bay Packers: +120
```

## Recommendations

### Short-term Fix: Use Enhanced Logging
1. Run the application with browser console open
2. Navigate to each sport (NFL, NBA, NHL)
3. Check console logs for each game to identify the exact failure point
4. Look for patterns:
   - Is h2h market consistently missing?
   - Are team names mismatched?
   - Does one bookmaker provide better data?

### Medium-term Fix: Multiple Bookmaker Fallback
Currently, only the first bookmaker is used (line 2260):
```javascript
const bookmaker = game.bookmakers[0];
```

**Improvement**: Loop through all bookmakers to find one with h2h market:
```javascript
let bookmaker = game.bookmakers.find(bm => 
  bm.markets.some(m => m.key === 'h2h')
);
if (!bookmaker) bookmaker = game.bookmakers[0]; // Fallback to first
```

### Long-term Fix: Fuzzy Team Name Matching
If team names don't match exactly, use the existing `teamsMatch()` function:
```javascript
const homeOutcome = h2hMarket.outcomes.find(o => teamsMatch(o.name, homeTeam));
const awayOutcome = h2hMarket.outcomes.find(o => teamsMatch(o.name, awayTeam));
```

## Testing Checklist

To verify the fix works:
- [ ] Check browser console logs for each sport
- [ ] Identify which games have h2h markets
- [ ] Verify team name matching for games with h2h
- [ ] Test with different bookmakers if available
- [ ] Compare ESPN vs Odds API team name formats
- [ ] Verify Suns/Pelicans still works after changes

## Files Modified
- `src/App.js` (lines 2350-2418): Enhanced logging for h2h market parsing

## Next Steps
1. **Run the application** and collect console logs
2. **Share console logs** showing both working (Suns/Pelicans) and failing games
3. **Implement fix** based on which scenario is most common:
   - If h2h missing → Try multiple bookmakers
   - If names mismatch → Use fuzzy matching with teamsMatch()
   - If API key issue → Verify API subscription includes h2h markets
