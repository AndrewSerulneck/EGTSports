# The Odds API Integration

This API endpoint fetches betting odds (Moneyline, Point Spreads, and Over/Under Totals) from The Odds API.

## Endpoint

`GET /api/getPropBets?sport={sport}`

## Supported Sports

- `NFL` - americanfootball_nfl
- `NBA` - basketball_nba
- `College Football` - americanfootball_ncaaf
- `College Basketball` - basketball_ncaab
- `NHL` - icehockey_nhl

## Example Request

```
GET /api/getPropBets?sport=NFL
```

## Response Format

```json
{
  "success": true,
  "sport": "NFL",
  "propBets": [
    {
      "id": "game123-draftkings-h2h-TeamA",
      "sport": "NFL",
      "gameTitle": "TeamA @ TeamB",
      "gameId": "game123",
      "commence_time": "2025-11-21T18:00:00Z",
      "marketType": "h2h",
      "marketDisplay": "Moneyline",
      "bookmaker": "DraftKings",
      "team": "TeamA",
      "odds": -150,
      "lastUpdate": "2025-11-21T12:00:00Z"
    },
    {
      "id": "game123-draftkings-spreads-TeamA-3.5",
      "sport": "NFL",
      "gameTitle": "TeamA @ TeamB",
      "gameId": "game123",
      "commence_time": "2025-11-21T18:00:00Z",
      "marketType": "spreads",
      "marketDisplay": "Point Spread",
      "bookmaker": "DraftKings",
      "team": "TeamA",
      "point": 3.5,
      "odds": -110,
      "lastUpdate": "2025-11-21T12:00:00Z"
    },
    {
      "id": "game123-draftkings-totals-Over-45.5",
      "sport": "NFL",
      "gameTitle": "TeamA @ TeamB",
      "gameId": "game123",
      "commence_time": "2025-11-21T18:00:00Z",
      "marketType": "totals",
      "marketDisplay": "Over/Under",
      "bookmaker": "DraftKings",
      "selection": "Over",
      "point": 45.5,
      "odds": -110,
      "lastUpdate": "2025-11-21T12:00:00Z"
    }
  ],
  "remainingRequests": "450",
  "usedRequests": "50"
}
```

## Market Types

### Moneyline (h2h)
- `marketType`: "h2h"
- `team`: Team name
- `odds`: American odds format (e.g., -150, +200)

### Point Spreads (spreads)
- `marketType`: "spreads"
- `team`: Team name
- `point`: Point spread value (e.g., 3.5, -7.5)
- `odds`: American odds format

### Over/Under Totals (totals)
- `marketType`: "totals"
- `selection`: "Over" or "Under"
- `point`: Total points line (e.g., 45.5)
- `odds`: American odds format

## Environment Variables

### Required
- `ODDS_API_KEY`: Your API key from The Odds API

### Optional
- `ODDS_API_DEBUG`: Set to `true` to enable detailed debug logging

## Debug Logging

To enable comprehensive debug logging:

1. Set the environment variable: `ODDS_API_DEBUG=true`
2. Check your server logs for detailed output including:
   - Raw API response data
   - Game-by-game processing
   - Bookmaker-by-bookmaker analysis
   - Market availability tracking
   - Missing market warnings
   - Final summary with counts by market type

## Error Handling

The API gracefully handles:
- Missing bookmakers for a game
- Missing markets for a bookmaker
- Missing outcomes for a market
- Unknown market types

All edge cases are logged when debug mode is enabled.

## API Rate Limiting

The Odds API has rate limits. The response includes:
- `remainingRequests`: Number of API calls remaining
- `usedRequests`: Number of API calls used

Monitor these values to avoid hitting rate limits.
