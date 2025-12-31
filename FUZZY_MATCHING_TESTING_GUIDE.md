# Fuzzy Matching Implementation - Testing Guide

## Overview
This implementation replaces the broken ID-based team mapping logic with a working fuzzy matching approach for displaying American odds from The Odds API.

## What Changed

### 1. Core Logic Replacement
**Before:**
- Used complex ID mapping with master-teams.json
- Required ESPN IDs to match against The Odds API SIDs
- Failed when IDs couldn't be matched → dashes (`-`) displayed

**After:**
- Uses direct team name fuzzy matching
- No JSON mapping files required
- Matches "Los Angeles Rams" with "Rams" automatically
- Falls back to ESPN odds if API fails

### 2. New Files Created
- **`src/hooks/useOddsApi.js`** - React hook for fetching odds with fuzzy matching
- **`FUZZY_MATCHING_TESTING_GUIDE.md`** - This document

### 3. Modified Files
- **`src/utils/priceFinder.js`** - Exported fuzzyMatchTeamName function
- **`src/App.js`** - Updated to use new hook and fuzzy matching logic

## How to Test

### 1. Build Verification (Already Passed ✅)
```bash
npm run build
# Expected: Compiled successfully
```

### 2. Test Suite (Already Passed ✅)
```bash
npm test
# Expected: 279 tests passed
```

### 3. Manual Testing with Live Data

#### Setup
1. Ensure `.env` file has valid `REACT_APP_THE_ODDS_API_KEY`
2. Start the development server:
   ```bash
   npm start
   ```

#### Test NFL Odds
1. Log in as a member
2. Navigate to NFL games
3. **Expected Console Output:**
   ```
   🎯 Fetching odds from The Odds API for NFL using fuzzy matching...
   ✅ Received odds for X games
   
   📊 Processing: [Team A] @ [Team B]
   ✅ MATCHED: ESPN "Los Angeles Rams @ Seattle Seahawks" ↔ Odds API "Rams @ Seahawks"
      ML: +150/-180 | Spread: +3.5/-3.5 | Total: 47.5
   
   📊 === ODDS MATCHING DIAGNOSTICS ===
   ESPN Games: 15
   Odds API Games: 15
   
   ✅ Match Results (first 3):
     ✅ Arizona Cardinals @ San Francisco 49ers: +180 / -220 (DraftKings)
     ✅ Buffalo Bills @ Miami Dolphins: -110 / -110 (FanDuel)
   ```

4. **Expected UI:**
   - GameCard components show American odds (e.g., `+150`, `-110`)
   - Bookmaker name displays (e.g., "DraftKings", "FanDuel")
   - No dashes (`-`) for games with available odds

#### Test NBA Odds
1. Navigate to NBA games
2. Verify similar console output
3. Check odds display correctly

#### Test Soccer (World Cup / MLS)
1. Navigate to soccer games
2. Look for 3-way odds (Home/Draw/Away)
3. Verify draw line displays

### 4. What to Look For

#### ✅ Success Indicators
- Console shows: `✅ MATCHED: ESPN "..." ↔ Odds API "..."`
- GameCards display American odds format (`+150`, `-110`)
- Bookmaker names appear on GameCards
- Spreads show with signs (`+3.5`, `-3.5`)
- Totals display as numbers (`47.5`)

#### ⚠️ Warning Signs (Normal Cases)
- Console shows: `⚠️ NO MATCH: Could not find odds for "..."`
  - This is okay for games not yet available in API
- Console shows: `⚠️ No The Odds API moneyline for ..., using ESPN`
  - ESPN fallback is working correctly

#### ❌ Failure Indicators
- All odds show as dashes (`-`)
- Console shows: `❌ Error fetching odds:`
- Bookmaker name is "Unknown" for all games
- No match diagnostics appear in console

### 5. Debugging Failed Matches

If you see `⚠️ NO MATCH` for a game that should have odds:

1. Check the console for:
   ```
   Available odds keys: ["Rams|Seahawks", "Cardinals|49ers", ...]
   ```

2. Compare ESPN team name vs Odds API team name:
   - ESPN might use: "Los Angeles Rams"
   - Odds API might use: "Rams"
   - Fuzzy matching should handle this

3. If fuzzy matching fails, check `src/utils/priceFinder.js`:
   - The `fuzzyMatchTeamName` function handles:
     - Exact matches
     - Substring matches
     - Mascot (last word) matches
     - City/location prefix matches

## Expected Console Log Flow

```
🎯 Fetching odds from The Odds API for NFL using fuzzy matching...
📋 Markets: h2h,spreads,totals
📅 Time window: 2025-12-30T23:00:00Z to 2026-01-13T23:00:00Z

✅ Received 15 events from The Odds API for NFL

📊 Processing: Buffalo Bills @ Miami Dolphins

🔍 Price Finder: Searching for moneyline (h2h) prices
   Teams: Buffalo Bills @ Miami Dolphins
   Bookmakers available: 8

   📚 Checking bookmaker 1/8: DraftKings
    ✅ Found h2h market with 2 outcomes
    ✓✓✓ Home team matched by SID: par_01hq... = -110 (Miami Dolphins)
    ✓✓✓ Away team matched by SID: par_01hq... = -110 (Buffalo Bills)

   ✅ SUCCESS: Found moneyline prices from DraftKings
      Home: -110, Away: -110

  ✓ Spreads: Miami Dolphins -3.5 (-110) / Buffalo Bills +3.5 (-110)
  ✓ Total: 47.5 (Over: -110, Under: -110)
  💰 Stored with key: "Buffalo Bills|Miami Dolphins"

✅ Built oddsMap with 15 games

📞 ESPN missing moneyline for Buffalo Bills @ Miami Dolphins
  ✅ MATCHED: ESPN "Buffalo Bills @ Miami Dolphins" ↔ Odds API "Buffalo Bills|Miami Dolphins"
     ML: -110/-110 | Spread: +3.5/-3.5 | Total: 47.5

📊 === ODDS MATCHING DIAGNOSTICS ===
ESPN Games: 15
Odds API Games: 15

📺 ESPN Team Names (first 3):
  "Buffalo Bills @ Miami Dolphins"
  "Arizona Cardinals @ San Francisco 49ers"
  "New York Giants @ Philadelphia Eagles"

🎲 Odds API Keys (first 3):
  "Buffalo Bills|Miami Dolphins"
  "Arizona Cardinals|San Francisco 49ers"
  "New York Giants|Philadelphia Eagles"

✅ Match Results (first 3):
  ✅ Buffalo Bills @ Miami Dolphins: -110 / -110 (DraftKings)
  ✅ Arizona Cardinals @ San Francisco 49ers: +180 / -220 (FanDuel)
  ✅ New York Giants @ Philadelphia Eagles: +240 / -280 (BetMGM)
```

## Rollback Plan

If the new implementation doesn't work:

1. Revert to previous commit:
   ```bash
   git revert HEAD~3..HEAD
   ```

2. The old `fetchOddsFromTheOddsAPI` function is still in the code (just unused)

3. No data loss - only display logic changed

## Support

For issues:
1. Check console logs for diagnostic messages
2. Verify API key is valid
3. Ensure The Odds API has data for the sport
4. Check network tab for 401/429 errors

## Success Criteria Checklist

- [ ] American odds display on GameCards (not dashes)
- [ ] Console shows successful fuzzy matches
- [ ] Bookmaker names appear on GameCards
- [ ] Spreads include +/- signs
- [ ] Totals display as numbers
- [ ] No console errors
- [ ] All 279 tests pass
- [ ] Build completes successfully

## Next Steps

After manual testing validation:
1. Monitor API quota usage
2. Consider adding unit tests for fuzzy matching
3. Document any team name variations that need special handling
4. Clean up commented-out legacy code (optional future PR)
