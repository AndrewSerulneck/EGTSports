# ESPN IDs - Future Updates

## Current Status

### ✅ NFL (Complete)
- **32/32 teams** have ESPN IDs extracted
- All teams fully functional with ESPN ID lookups
- Example: `getStandardId("Rams", "nfl")` returns `{ espnId: "14", ... }`

### ⏳ NBA (Pending)
- **0/30 teams** have ESPN IDs
- Teams work with internal IDs (e.g., "NBA-020" for Knicks)
- The Odds API SIDs are preserved in aliases
- **Action needed**: Source ESPN integer IDs for all 30 NBA teams

### ⏳ NHL (Pending)
- **0/33 teams** have ESPN IDs
- Teams work with internal IDs (e.g., "NHL-028" for Maple Leafs)
- The Odds API SIDs are preserved in aliases
- **Action needed**: Source ESPN integer IDs for all 33 NHL teams

### ✅ NCAA Basketball (No ESPN IDs Needed)
- **386 teams** with The Odds API SIDs
- Internal IDs: NCAAB-001 through NCAAB-386
- No ESPN IDs required (NCAA data handled differently)

## How to Add ESPN IDs Later

### Step 1: Find ESPN IDs
You'll need to determine the ESPN integer IDs for NBA and NHL teams. Possible sources:
- ESPN API responses for games
- ESPN website URLs (e.g., `espn.com/nba/team/_/id/20/new-york-knicks`)
- Existing ESPN data in your system

### Step 2: Update master-teams.json
For each team, add the `espnId` field:

```json
{
  "id": "NBA-020",
  "espnId": "20",  // ← Add this
  "canonical": "New York Knicks",
  "aliases": ["NYK", "NY", "Knicks", ..., "par_01hqmkq6fzfvyvrsb30jj85ade"]
}
```

### Step 3: No Code Changes Required
The system already supports ESPN IDs for all sports:
- `getStandardId("Lakers", "nba")` will return `espnId` once added
- `getTeamByEspnId("13", "nba")` will work automatically
- Fallback to internal ID is already implemented

### Step 4: Verify
Run tests to confirm:
```bash
npm test -- --testPathPattern=normalization.test.js
```

## Notes

- The system gracefully handles missing ESPN IDs (returns `espnId: null`)
- All existing functionality works without ESPN IDs (uses internal IDs)
- No breaking changes when ESPN IDs are added
- The Odds API SIDs are the primary identifier for API matching

## Files Involved

- `src/data/master-teams.json` - Team data (edit this file)
- `src/utils/normalization.js` - Already supports ESPN ID lookups
- `src/utils/teamMapper.js` - Already returns ESPN IDs when available
