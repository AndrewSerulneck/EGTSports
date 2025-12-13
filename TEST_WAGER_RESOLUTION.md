# Testing Wager Resolution Service

## Prerequisites
- ✅ CRON_SECRET environment variable set in Vercel
- ✅ Code deployed to Vercel
- Admin access to the application

## Step-by-Step Testing Instructions

### Step 1: Get Your Vercel Deployment URL

Find your deployment URL in Vercel dashboard. It will look like:
- Production: `https://egt-sports.vercel.app` (or your custom domain)
- Preview: `https://egt-sports-<hash>.vercel.app`

### Step 2: Get Your Admin ID Token

1. Log in to your application as an admin user
2. Open browser developer console (F12)
3. Run this command:
```javascript
firebase.auth().currentUser.getIdToken().then(token => {
  console.log('Your Admin Token:');
  console.log(token);
  // Also copy to clipboard
  navigator.clipboard.writeText(token);
  console.log('✅ Token copied to clipboard!');
});
```
4. Copy the token (it will be automatically copied to clipboard)

### Step 3: Test the Wager Resolution Endpoint

**Option A: Using curl (Command Line)**

```bash
# Replace YOUR_DOMAIN and YOUR_ADMIN_TOKEN with actual values
curl -X POST https://YOUR_DOMAIN.vercel.app/api/resolveWagers \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -v
```

**Option B: Using Postman/Insomnia**

1. Method: POST
2. URL: `https://YOUR_DOMAIN.vercel.app/api/resolveWagers`
3. Headers:
   - `Authorization: Bearer YOUR_ADMIN_TOKEN`
   - `Content-Type: application/json`
4. Click Send

**Option C: Using Browser Console**

```javascript
// Get your token first (from Step 2)
const token = 'YOUR_ADMIN_TOKEN_HERE';
const domain = 'YOUR_DOMAIN.vercel.app';

fetch(`https://${domain}/api/resolveWagers`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
.then(response => response.json())
.then(data => {
  console.log('✅ Wager Resolution Results:');
  console.log(JSON.stringify(data, null, 2));
})
.catch(error => {
  console.error('❌ Error:', error);
});
```

### Step 4: Verify the Results

#### Expected Success Response:
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

#### What Each Field Means:
- `total`: Number of pending wagers found
- `resolved`: Number successfully resolved
- `won`: Number marked as won
- `lost`: Number marked as lost
- `push`: Number marked as push/tie
- `errors`: Number that failed to resolve
- `skipped`: Number skipped (games not complete yet)

### Step 5: Verify in Firebase Console

1. Go to Firebase Console → Realtime Database
2. Navigate to `/wagers`
3. Find the resolved wagers
4. Verify they have:
   - `status`: Changed from "pending" to "won"/"lost"/"push"
   - `settledAt`: Timestamp when resolved
   - `payout`: Calculated payout amount (for wins)
   - `pickResults`: Array showing outcome for each pick

Example resolved wager:
```json
{
  "uid": "user123",
  "amount": 50,
  "status": "won",
  "settledAt": "2025-12-13T19:45:00.000Z",
  "payout": 400,
  "pickResults": [
    {
      "gameId": "401234567",
      "team": "Patriots",
      "outcome": "win",
      "finalScore": "Patriots 24 - 21 Bills"
    }
  ],
  "wagerData": {
    "picks": [...],
    "betType": "parlay"
  }
}
```

### Step 6: Check Vercel Logs

1. Go to Vercel Dashboard → Your Project → Logs
2. Filter by `/api/resolveWagers`
3. Look for execution logs showing:
   - Number of wagers processed
   - Any errors or warnings
   - Resolution results

## Troubleshooting

### Error: "Unauthorized"
- **Cause**: Admin token is invalid or expired
- **Fix**: Get a fresh token (tokens expire after 1 hour)

### Error: "Invalid cron secret"
- **Cause**: CRON_SECRET not set in Vercel
- **Fix**: Add CRON_SECRET environment variable in Vercel dashboard

### Error: "No pending wagers to resolve"
- **Cause**: No pending wagers in database
- **Result**: This is actually successful - just means nothing to resolve

### Error: "ESPN API error"
- **Cause**: ESPN API is temporarily unavailable
- **Fix**: Wait a few minutes and try again

### Wagers Not Resolving
- Check game completion status in ESPN
- Verify game IDs in wagers match ESPN format
- Check that games are marked as "Final" (status='post')

## Testing Scenarios

### Scenario 1: Single Straight Bet (Won)
1. Create a pending wager on a completed game where your pick won
2. Run resolution
3. Expect: Status = "won", payout calculated

### Scenario 2: Parlay Bet (All Picks Won)
1. Create a 3-leg parlay where all picks won
2. Run resolution
3. Expect: Status = "won", payout = amount × 8

### Scenario 3: Parlay Bet (One Pick Lost)
1. Create a parlay where one pick lost
2. Run resolution
3. Expect: Status = "lost", payout = 0

### Scenario 4: Game Not Complete Yet
1. Create a wager on an upcoming game
2. Run resolution
3. Expect: Wager skipped (still pending)

## Automated Testing (Hourly Cron)

The service runs automatically every hour. To verify:

1. Check Vercel Logs at the top of each hour
2. Look for automatic executions
3. Verify wagers are being resolved without manual trigger

## Next Steps After Successful Test

1. ✅ Verify hourly cron is working
2. ✅ Monitor for the first few days
3. ✅ Check payout calculations are correct
4. ✅ Verify users see updated status in "My Bets"
5. ✅ Test the "Back" button navigation
6. ✅ Verify full wager details display correctly

## Support

If you encounter issues:
1. Check Vercel logs for detailed error messages
2. Verify Firebase connection is working
3. Test with a simple wager first
4. Review DEPLOYMENT_GUIDE.md for more details

---

**Note**: The first run may take a few seconds as the serverless function cold-starts. Subsequent runs will be faster.
