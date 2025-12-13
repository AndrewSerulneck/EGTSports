# Wager Resolution and Weekly Reset Services

This document describes the automated services for wager resolution and weekly credit limit resets.

## Overview

Two new serverless functions have been added to automate key business processes:

1. **Wager Resolution Service (WRS)** - `api/resolveWagers.js`
2. **Weekly Credit Reset Service** - `api/weeklyReset.js`

## 1. Wager Resolution Service

### Purpose
Automatically resolves pending wagers by checking game completion status and calculating win/loss/push outcomes.

### Schedule
Runs hourly via Vercel Cron: `0 * * * *` (every hour at minute 0)

### How It Works
1. Queries all wagers with `status='pending'` from Firebase Realtime Database
2. For each wager, fetches game data from ESPN API
3. Checks if all games in the wager are final (status='post')
4. Calculates pick outcomes based on:
   - **Spread bets**: Compares adjusted scores against actual scores
   - **Moneyline bets**: Determines winner by comparing scores
   - **Total bets**: Compares actual total against over/under line
5. Determines overall wager outcome:
   - **Parlays**: All picks must win (pushes count as losses)
   - **Straight bets**: Individual pick outcome determines result
6. Updates wager status to 'won', 'lost', or 'push'
7. Calculates and stores payout amount

### Payout Multipliers (Parlays)
- 3 picks: 8 to 1
- 4 picks: 15 to 1
- 5 picks: 25 to 1
- 6 picks: 50 to 1
- 7 picks: 100 to 1
- 8 picks: 150 to 1
- 9 picks: 200 to 1
- 10 picks: 250 to 1

### Manual Invocation
Admins can manually trigger resolution:
```bash
curl -X POST https://your-domain.vercel.app/api/resolveWagers \
  -H "Authorization: Bearer YOUR_ADMIN_ID_TOKEN"
```

### Database Updates
For each resolved wager:
```javascript
{
  status: 'won' | 'lost' | 'push',
  settledAt: '2025-12-13T18:00:00.000Z',
  payout: 100.00,
  pickResults: [
    {
      gameId: '401234567',
      team: 'Team A',
      outcome: 'win',
      finalScore: 'Team A 24 - 21 Team B'
    }
  ]
}
```

## 2. Weekly Credit Reset Service

### Purpose
Automatically resets all member credit limits every Tuesday at 12:00 AM.

### Schedule
Runs weekly via Vercel Cron: `0 0 * * 2` (Tuesday at midnight UTC)

### How It Works
1. Queries all users from Firebase Realtime Database
2. Skips revoked users (optional: can be configured to include them)
3. For each active user:
   - Stores previous week's `totalWagered` as `previousWeekTotalWagered`
   - Resets `totalWagered` to 0
   - Records `lastWeeklyReset` timestamp
4. Performs batch update for efficiency
5. Logs reset event to audit trail at `auditLog/weeklyResets`

### Manual Invocation
Admins can manually trigger reset:
```bash
curl -X POST https://your-domain.vercel.app/api/weeklyReset \
  -H "Authorization: Bearer YOUR_ADMIN_ID_TOKEN"
```

### Database Updates
For each user:
```javascript
{
  totalWagered: 0,
  lastWeeklyReset: '2025-12-17T00:00:00.000Z',
  previousWeekTotalWagered: 450.00
}
```

Audit log entry:
```javascript
{
  timestamp: '2025-12-17T00:00:00.000Z',
  usersReset: 42,
  usersSkipped: 3,
  totalUsers: 45,
  errors: []
}
```

## Environment Variables Required

Add these to your Vercel project settings:

### Firebase Admin SDK (already configured)
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_DATABASE_URL`

### Cron Security (recommended)
- `CRON_SECRET` - A secret key to verify cron invocations (prevents unauthorized access)

### CORS (optional)
- `ALLOWED_ORIGIN` - Origin allowed to call these APIs (defaults to all)

## Security

### Authentication Methods
Both services support two authentication methods:

1. **Admin Token**: For manual invocations by administrators
   - Requires valid Firebase ID token with admin claim
   - Pass in `Authorization: Bearer TOKEN` header

2. **Cron Secret**: For scheduled invocations by Vercel
   - Requires `CRON_SECRET` environment variable
   - Vercel passes this in `x-vercel-cron-secret` header
   - Can also be passed as `?secret=SECRET` query parameter

## Monitoring and Logging

Both services provide detailed logging:

### Console Logs
- Processing status for each wager/user
- Success/failure messages
- Error details

### Response Data
JSON responses include:
- Success status
- Number of items processed
- Breakdown of outcomes (won/lost/push or reset/skipped)
- Error details if any

### Example Response (Wager Resolution)
```json
{
  "success": true,
  "message": "Wager resolution complete",
  "results": {
    "total": 15,
    "resolved": 12,
    "won": 5,
    "lost": 6,
    "push": 1,
    "errors": 0,
    "skipped": 3
  }
}
```

### Example Response (Weekly Reset)
```json
{
  "success": true,
  "message": "Weekly credit reset complete",
  "results": {
    "totalUsers": 42,
    "usersReset": 39,
    "usersSkipped": 3,
    "timestamp": "2025-12-17T00:00:00.000Z"
  }
}
```

## Vercel Cron Configuration

The `vercel.json` file configures both cron jobs:

```json
{
  "version": 2,
  "crons": [
    {
      "path": "/api/resolveWagers",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/weeklyReset",
      "schedule": "0 0 * * 2"
    }
  ]
}
```

### Cron Schedule Format
```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday to Saturday)
│ │ │ │ │
│ │ │ │ │
* * * * *
```

## Retroactive Wager Resolution

To resolve existing pending wagers immediately after deployment:

1. Deploy the changes to Vercel
2. Set the `CRON_SECRET` environment variable
3. Manually invoke the API:
   ```bash
   curl -X POST https://your-domain.vercel.app/api/resolveWagers \
     -H "Authorization: Bearer YOUR_ADMIN_ID_TOKEN"
   ```
4. Check the response to verify wagers were resolved
5. Verify in Firebase Console that wager statuses are updated

## Troubleshooting

### Wager Resolution Issues

**Problem**: Wagers not being resolved
- Check ESPN API is accessible and returning game data
- Verify game IDs in wagers match ESPN game IDs
- Check that games are marked as final (status='post')
- Review console logs for errors

**Problem**: Incorrect outcomes
- Verify pick data structure matches expected format
- Check spread/total calculations in `calculatePickOutcome`
- Ensure pickedTeamType is 'away' or 'home'

### Weekly Reset Issues

**Problem**: Users not being reset
- Verify Firebase connection is working
- Check user data structure in database
- Review console logs for errors
- Verify cron job is executing (check Vercel dashboard)

**Problem**: Some users skipped
- Check if users have `status='revoked'`
- Modify service to include/exclude certain user types as needed

## Future Enhancements

Potential improvements:

1. **Email Notifications**: Send emails when wagers are resolved
2. **Admin Dashboard**: UI to view resolution history and manually trigger
3. **Partial Parlay Payouts**: Pay reduced amount for partial wins
4. **Push Handling**: Remove pushes from parlay instead of counting as loss
5. **Detailed Analytics**: Track resolution statistics over time
6. **Error Recovery**: Retry failed resolutions automatically
7. **Customizable Reset Schedule**: Allow admins to change reset day/time
8. **SMS Notifications**: Notify users of credit reset

## Support

For issues or questions:
- Check Vercel logs: `vercel logs YOUR_DEPLOYMENT_URL`
- Review Firebase Database for data integrity
- Contact: support@EGTSports.ws
