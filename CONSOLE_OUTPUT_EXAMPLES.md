# Quick Reference: Console Output Examples

## SID Match (100% Confidence) - Ideal Case

```
🔍 === PROCESSING GAME 1/16 ===

🎮 Game 1: Los Angeles Rams @ San Francisco 49ers
   ⏰ Starts in: 48.2 hours (2024-01-15T17:00:00Z)
   🆔 Normalized IDs: Away=14, Home=17

  📊 Found 8 bookmaker(s) for this game

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

🔍 Price Finder: Searching for moneyline (h2h) prices
   Teams: Los Angeles Rams @ San Francisco 49ers
   Team IDs: Away=par_01hqmkr1ybfmfb8mhz10drfe21, Home=par_01hqmks8jz3fv4rsb20jk75bcd
   Sport Key: americanfootball_nfl
   Bookmakers available: 8

   📚 Checking bookmaker 1/8: DraftKings
    ✅ Found h2h market with 2 outcomes
    ✓✓✓ Home team matched by SID: par_01hqmks8jz3fv4rsb20jk75bcd = -180 (San Francisco 49ers)
    ✓✓✓ Away team matched by SID: par_01hqmkr1ybfmfb8mhz10drfe21 = 150 (Los Angeles Rams)

   ✅ SUCCESS: Found moneyline prices from DraftKings
      Home: -180, Away: 150

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

  ✅ Game 1 processing complete
```

## Name-based Fallback (Fuzzy Confidence)

```
🔍 === PROCESSING GAME 5/16 ===

🎮 Game 5: Buffalo Bills @ Kansas City Chiefs
   ⏰ Starts in: 72.5 hours (2024-01-16T18:30:00Z)
   🆔 Normalized IDs: Away=2, Home=12

  📊 Found 8 bookmaker(s) for this game

  ⚠️ SID extraction incomplete, falling back to name-based lookup...
  [MAPPING] Fallback matched Buffalo Bills to Team ID NFL-BUF (SID: par_01hqmkp9xz4fv5rsb30jk86efg)
  [MAPPING] Fallback matched Kansas City Chiefs to Team ID NFL-KC (SID: par_01hqmkq5az6fv7rsb40jk97fgh)

  🔍 ODDS API MATCH: Team: Buffalo Bills | SID: par_01hqmkp9xz4fv5rsb30jk86efg | Custom ID: NFL-BUF | ESPN ID: 2
  🔍 ODDS API MATCH: Team: Kansas City Chiefs | SID: par_01hqmkq5az6fv7rsb40jk97fgh | Custom ID: NFL-KC | ESPN ID: 12
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
     Home SID=par_01hqmkq5az6fv7rsb40jk97fgh, Away SID=par_01hqmkp9xz4fv5rsb30jk86efg

🔍 Price Finder: Searching for moneyline (h2h) prices
   Teams: Buffalo Bills @ Kansas City Chiefs
   Team IDs: Away=par_01hqmkp9xz4fv5rsb30jk86efg, Home=par_01hqmkq5az6fv7rsb40jk97fgh
   Sport Key: americanfootball_nfl
   Bookmakers available: 8

   📚 Checking bookmaker 1/8: DraftKings
    ❌ No h2h market found in this bookmaker

   📚 Checking bookmaker 2/8: FanDuel
    ✅ Found h2h market with 2 outcomes
    ✓✓✓ Home team matched by SID: par_01hqmkq5az6fv7rsb40jk97fgh = -168 (Kansas City Chiefs)
    ✓✓✓ Away team matched by SID: par_01hqmkp9xz4fv5rsb30jk86efg = 140 (Buffalo Bills)

   ✅ SUCCESS: Found moneyline prices from FanDuel
      Home: -168, Away: 140

🎯 Team Match Confidence: {
  game: 'Buffalo Bills @ Kansas City Chiefs',
  confidence: 'fuzzy',
  method: 'fuzzy',
  bookmaker: 'FanDuel',
  source: 'The Odds API'
}

  ✅ Moneyline prices found via FanDuel
     Away: +140, Home: -168

  📐 Spreads market found with 2 outcomes
    ✓ Kansas City Chiefs: -2.5 (price: -105)
    ✓ Buffalo Bills: +2.5 (price: -115)

  🎯 Totals market found with 2 outcomes
    ✓ Total: 45.5 (Over: -110, Under: -110)

  💾 Storing odds with key: "12|2"

  ✅ Buffalo Bills @ Kansas City Chiefs: ML via FanDuel, Spread via FanDuel, Total via FanDuel

📊 Bookmaker Sources: {
  game: 'Buffalo Bills @ Kansas City Chiefs',
  moneyline: { bookmaker: 'FanDuel', away: '+140', home: '-168' },
  spread: { bookmaker: 'FanDuel', away: '+2.5', home: '-2.5' },
  total: { bookmaker: 'FanDuel', line: '45.5' }
}

  📊 Final odds stored with key: "12|2"
     Away Spread: ✓ +2.5
     Home Spread: ✓ -2.5
     Total: ✓ 45.5
     Away ML: ✓ +140
     Home ML: ✓ -168

  ✅ Game 5 processing complete
```

## Multiple Bookmakers (Mixed Sources)

```
🔍 === PROCESSING GAME 8/16 ===

🎮 Game 8: Miami Dolphins @ Baltimore Ravens
   ⏰ Starts in: 96.8 hours (2024-01-17T20:15:00Z)
   🆔 Normalized IDs: Away=15, Home=33

  📊 Found 8 bookmaker(s) for this game

  ✅ [MAPPING SUCCESS] API SID par_01hqmkr8yz9fv2rsb60jk08hij -> Custom ID NFL-MIA -> ESPN Game Found
  ✅ [MAPPING SUCCESS] API SID par_01hqmks2bz2fv9rsb70jk19ijk -> Custom ID NFL-BAL -> ESPN Game Found

✓ Matched teams: {
  home: 'Baltimore Ravens',
  away: 'Miami Dolphins',
  method: 'sid',
  homeEspnId: '33',
  awayEspnId: '15'
}

  ✅ Using SID-based matching for price lookup

🎯 Team Match Confidence: {
  game: 'Miami Dolphins @ Baltimore Ravens',
  confidence: '100%',
  method: 'sid',
  bookmaker: 'DraftKings',
  source: 'The Odds API'
}

  ✅ Moneyline prices found via DraftKings
     Away: +180, Home: -215

  📐 Spreads market found with 2 outcomes (FanDuel)
    ✓ Baltimore Ravens: -5.5 (price: -108)
    ✓ Miami Dolphins: +5.5 (price: -112)

  🎯 Totals market found with 2 outcomes (BetMGM)
    ✓ Total: 44.5 (Over: -105, Under: -115)

  ✅ Miami Dolphins @ Baltimore Ravens: ML via DraftKings, Spread via FanDuel, Total via BetMGM

📊 Bookmaker Sources: {
  game: 'Miami Dolphins @ Baltimore Ravens',
  moneyline: { bookmaker: 'DraftKings', away: '+180', home: '-215' },
  spread: { bookmaker: 'FanDuel', away: '+5.5', home: '-5.5' },
  total: { bookmaker: 'BetMGM', line: '44.5' }
}

  📊 Final odds stored with key: "33|15"
     Away Spread: ✓ +5.5
     Home Spread: ✓ -5.5
     Total: ✓ 44.5
     Away ML: ✓ +180
     Home ML: ✓ -215

  ✅ Game 8 processing complete
```

## Key Logging Features

### 1. Emoji Indicators
- 🎯 = Confidence/Quality indicator
- ✅ = Success
- ⚠️ = Warning/Fallback
- ❌ = Error/Missing
- 📊 = Data summary
- 🔍 = Search/Lookup
- ✓ = Checkmark for individual values

### 2. Color Coding (in browser console)
- **Green** (`console.log`): Successful operations
- **Yellow** (`console.warn`): Warnings, fallbacks
- **Red** (`console.error`): Errors, missing data

### 3. Structured Objects
All confidence and bookmaker logs use structured objects for:
- Easy inspection in browser console
- Copy-paste for debugging
- Clear data relationships

### 4. Match Quality Indicators
- **100%**: SID-based match (most reliable)
- **fuzzy**: Name-based match (fallback, still reliable)
- **none**: No match found (troubleshooting needed)

## Testing in Browser

### Step 1: Open Developer Console
Press `F12` or `Cmd+Option+I` (Mac)

### Step 2: Navigate to NFL
Click "NFL" in the sports menu

### Step 3: Observe Output
Look for:
1. `🎯 Team Match Confidence` - Shows confidence level
2. `✓ Matched teams` - Shows matching method
3. `📊 Bookmaker Sources` - Shows data sources

### Step 4: Verify UI
Check that odds display correctly in the betting grid:
- Moneylines: `-110`, `+150`, etc.
- Spreads: `-3.5`, `+7`, etc.
- Totals: `47.5`, `45.5`, etc.

## Success Indicators

✅ All games show `🎯 Team Match Confidence`
✅ Confidence is `100%` for most games (SID matches)
✅ Some games may show `fuzzy` (name-based fallback)
✅ `📊 Bookmaker Sources` shows which sportsbooks provided data
✅ All odds formatted correctly with +/- signs
✅ No errors in console
