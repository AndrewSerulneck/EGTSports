# Deployment and Testing Guide

## Summary of Changes

This PR implements four major enhancements to the EGT Sports betting platform:

1. ✅ **My Bets Page Enhancement** - Display full wager terms
2. ✅ **Navigation Fix** - Added "Back to Betting" button
3. ✅ **Wager Resolution Service** - Automated hourly wager resolution
4. ✅ **Weekly Credit Reset** - Automated Tuesday credit limit reset

## Pre-Deployment Checklist

### Environment Variables (Vercel)
Ensure these are set in your Vercel project settings:

#### Required (Already Configured)
- ✅ `FIREBASE_PROJECT_ID`
- ✅ `FIREBASE_CLIENT_EMAIL`
- ✅ `FIREBASE_PRIVATE_KEY`
- ✅ `FIREBASE_DATABASE_URL`

#### New (Must Add)
- ⚠️ `CRON_SECRET` - A secret key to verify cron job invocations
  - Example: Generate with `openssl rand -hex 32`
  - This prevents unauthorized access to cron endpoints

#### Optional
- `ALLOWED_ORIGIN` - CORS origin (defaults to accept all)

### Build Verification
```bash
npm install
npm run build
```
✅ **Status**: Build successful (verified)

### Security Check
```bash
# CodeQL security scan
```
✅ **Status**: No security vulnerabilities found

## Deployment Steps

1. **Merge this PR** to your main branch
2. **Vercel will automatically deploy** the changes
3. **Add `CRON_SECRET` environment variable** in Vercel dashboard:
   - Go to Project Settings → Environment Variables
   - Add `CRON_SECRET` with a secure random value
   - Apply to Production, Preview, and Development
4. **Redeploy** after adding the environment variable

## Post-Deployment Testing

### 1. Test My Bets Page Enhancements

**Steps:**
1. Log in as a member account
2. Navigate to "My Bets" from the bottom navigation
3. Verify pending wagers show:
   - Full pick details (e.g., "Team A -5.5", "Over 42.5")
   - Game names for each pick
   - Bet type (Parlay/Straight)
   - Amount and status
4. Check past wagers (if any exist) show the same level of detail

**Expected Result:**
- All wager details are clearly visible
- Multi-leg parlays show all individual picks
- Pick descriptions are formatted correctly

### 2. Test Navigation Back Button

**Steps:**
1. From "My Bets" page, click the back arrow button in the header
2. Should navigate back to the betting page you came from

**Expected Result:**
- Successfully returns to main betting grid
- No errors in console

### 3. Test Wager Resolution (Manual Trigger)

**Important**: Only test this with non-production data or in a test environment!

**Steps:**
1. Create a test wager on a completed game (or wait for a game to complete)
2. Get your admin ID token:
   ```javascript
   // In browser console on admin page
   firebase.auth().currentUser.getIdToken().then(token => console.log(token))
   ```
3. Manually trigger resolution:
   ```bash
   curl -X POST https://your-domain.vercel.app/api/resolveWagers \
     -H "Authorization: Bearer YOUR_ADMIN_ID_TOKEN"
   ```
4. Check the response JSON for resolution results
5. Verify in Firebase Console:
   - Wager status changed from "pending" to "won"/"lost"/"push"
   - `settledAt` timestamp is set
   - `payout` amount is calculated correctly
   - `pickResults` array shows outcome for each pick

**Expected Result:**
```json
{
  "success": true,
  "message": "Wager resolution complete",
  "results": {
    "total": 5,
    "resolved": 3,
    "won": 2,
    "lost": 1,
    "push": 0,
    "errors": 0,
    "skipped": 2
  }
}
```

### 4. Test Weekly Reset (Manual Trigger)

**Important**: This will reset ALL user credit limits! Only test in development/staging.

**Steps:**
1. Get your admin ID token (same as above)
2. Note current `totalWagered` values for a few test users
3. Manually trigger reset:
   ```bash
   curl -X POST https://your-domain.vercel.app/api/weeklyReset \
     -H "Authorization: Bearer YOUR_ADMIN_ID_TOKEN"
   ```
4. Check the response JSON
5. Verify in Firebase Console:
   - All users have `totalWagered: 0`
   - `previousWeekTotalWagered` contains old value
   - `lastWeeklyReset` timestamp is set
6. Check audit log at `auditLog/weeklyResets` has entry

**Expected Result:**
```json
{
  "success": true,
  "message": "Weekly credit reset complete",
  "results": {
    "totalUsers": 42,
    "usersReset": 39,
    "usersSkipped": 3,
    "timestamp": "2025-12-13T18:00:00.000Z"
  }
}
```

### 5. Verify Cron Jobs

**Check Vercel Dashboard:**
1. Go to your project in Vercel
2. Navigate to Logs
3. Filter by cron job invocations
4. Verify hourly executions of `/api/resolveWagers`
5. Wait until next Tuesday to verify `/api/weeklyReset`

**Monitor First Week:**
- Check logs daily for the first week
- Verify no errors in resolution
- Confirm payouts are calculated correctly
- Ensure credit reset happens on Tuesday

## Rollback Plan

If issues arise:

1. **Revert the PR** in GitHub
2. **Redeploy previous version** in Vercel
3. **Disable cron jobs** (if needed):
   - Remove `crons` section from vercel.json
   - Deploy update

## Database Schema Changes

### Wager Schema (Updated)
```javascript
{
  uid: "user123",
  amount: 50.00,
  wagerData: {
    picks: [
      {
        gameId: "401234567",
        gameName: "Team A @ Team B",
        sport: "NFL",
        pickType: "spread",
        team: "Team A",
        spread: "-5.5",
        pickedTeamType: "away"
      }
    ],
    betType: "parlay"
  },
  status: "won",              // NEW: "pending" | "won" | "lost" | "push"
  settledAt: "...",           // NEW: ISO timestamp
  payout: 400.00,             // NEW: payout amount
  pickResults: [              // NEW: detailed results
    {
      gameId: "401234567",
      team: "Team A",
      outcome: "win",
      finalScore: "Team A 24 - 21 Team B"
    }
  ],
  createdAt: "..."
}
```

### User Schema (Updated)
```javascript
{
  displayName: "John Doe",
  email: "john@example.com",
  creditLimit: 500.00,
  totalWagered: 0,                        // Reset weekly
  lastWeeklyReset: "...",                 // NEW: ISO timestamp
  previousWeekTotalWagered: 450.00,       // NEW: previous week's total
  status: "active"
}
```

### Audit Log Schema (New)
```javascript
{
  weeklyResets: {
    "-NXxxx": {
      timestamp: "...",
      usersReset: 39,
      usersSkipped: 3,
      totalUsers: 42,
      errors: []
    }
  }
}
```

## Monitoring and Alerts

### Key Metrics to Monitor

1. **Wager Resolution Rate**
   - How many wagers are resolved per hour
   - Percentage of successful resolutions
   - Average time from game completion to resolution

2. **Credit Reset Success**
   - Number of users reset each week
   - Any skipped users and why
   - Audit trail completeness

3. **Error Rates**
   - ESPN API failures
   - Firebase connection issues
   - Invalid wager data

### Recommended Alerts

Set up alerts for:
- More than 10% resolution failures
- Cron job doesn't execute for 2+ hours
- Weekly reset doesn't complete
- Unusual payout amounts (potential calculation errors)

## Support and Troubleshooting

### Common Issues

**Issue**: Wagers not resolving
- Check ESPN API is accessible
- Verify game IDs match ESPN format
- Ensure games are marked as final

**Issue**: Credit reset not happening
- Verify cron job is enabled in Vercel
- Check `CRON_SECRET` is set correctly
- Review Vercel logs for errors

**Issue**: Incorrect payouts
- Verify parlay multipliers are correct
- Check pick outcome calculations
- Review business rules (pushes = losses)

### Getting Help

For issues:
1. Check Vercel logs: `vercel logs`
2. Review Firebase Console for data integrity
3. Test manually using curl commands above
4. Contact: support@EGTSports.ws

## Additional Resources

- [Wager Resolution README](./WAGER_RESOLUTION_README.md) - Detailed service documentation
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs) - Official documentation
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup) - SDK reference

## Next Steps (Future Enhancements)

Consider implementing:
1. Email notifications when wagers are settled
2. SMS alerts for credit resets
3. Admin dashboard for viewing resolution history
4. Configurable push handling (remove vs loss)
5. Partial parlay payouts
6. Automated error recovery and retry logic
7. Historical analytics and reporting
