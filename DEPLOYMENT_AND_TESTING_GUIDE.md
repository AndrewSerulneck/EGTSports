# Deployment and Testing Guide

## Quick Deployment Steps

### 1. Deploy Firebase Rules (CRITICAL - Do This First!)

#### Option A: Using Firebase CLI (Recommended)
```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project (if not done)
firebase init database

# Deploy the new rules
firebase deploy --only database
```

#### Option B: Manual Deployment via Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `marcs-parlays`
3. Navigate to: **Realtime Database** → **Rules**
4. Copy the entire contents of `firebase.rules.json`
5. Paste into the rules editor
6. Click **Publish**
7. Confirm the deployment

### 2. Verify Rules Deployment
After deploying, test in Firebase Console:
```
// Try writing partial data (should succeed)
{
  "spreads": {
    "NFL": {
      "401671798": {
        "timestamp": "2024-12-28T17:00:00Z",
        "homeMoneyline": "+150",
        "awayMoneyline": "-180"
      }
    }
  }
}
```

### 3. Deploy Code Changes to Vercel
```bash
# If using Vercel CLI
vercel --prod

# Or commit to main branch (auto-deploy)
git checkout main
git merge copilot/fix-api-errors-odds-display
git push origin main
```

## Testing Checklist

### Part 1: API Error Resolution (422 Fix)

**Before Testing:**
- Open Browser Developer Console (F12)
- Go to Network tab
- Filter by "odds"

**Test Steps:**
1. Load the app as Admin
2. Navigate to NFL section
3. Click "Refresh Games"
4. Check Network tab for API calls to The Odds API

**Expected Results:**
- ✅ No 422 errors in console
- ✅ API URL shows: `markets=h2h,spreads,totals` (NOT including q1, h1, etc.)
- ✅ Console logs: `📋 Markets requested: h2h,spreads,totals`
- ✅ Games load with moneylines, spreads, and totals

**Sample Console Output:**
```
🔥 Making Odds API call for NFL...
📡 URL: https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds/?apiKey=***KEY_HIDDEN***&regions=us&markets=h2h,spreads,totals&oddsFormat=american
📋 Markets requested: h2h,spreads,totals
📐 Odds format: american
```

### Part 2: Firebase Permission Tests (Save Moneylines Only)

**Test Steps:**
1. Login as Admin
2. Load NFL games
3. Edit ONLY the moneyline fields for a game (leave spreads/totals empty)
4. Click "Save & Broadcast"

**Expected Results:**
- ✅ Save succeeds (no "Permission Denied" error)
- ✅ Console shows: `💾 Saving X games to Firebase path: spreads/NFL`
- ✅ Alert: "✅ Spreads saved! All devices will update in real-time."
- ✅ Member app shows updated moneylines immediately

**Firebase Data Structure Should Look Like:**
```json
{
  "spreads": {
    "NFL": {
      "401671798": {
        "timestamp": "2024-12-28T17:15:00.000Z",
        "homeMoneyline": "+150",
        "awayMoneyline": "-180"
        // Notice: No awaySpread, homeSpread, or total fields - this is OK!
      }
    }
  }
}
```

### Part 3: Quarter/Half Odds Save Test

**Test Steps:**
1. Login as Admin
2. Load NBA or NFL games
3. Edit ONLY quarter odds (Q1_homeMoneyline, Q1_awayMoneyline, etc.)
4. Leave full game odds unchanged
5. Click "Save & Broadcast"

**Expected Results:**
- ✅ Save succeeds
- ✅ Quarter odds persist in Firebase
- ✅ Full game odds remain unchanged

**Firebase Data Should Show:**
```json
{
  "spreads": {
    "NBA": {
      "401704567": {
        "timestamp": "2024-12-28T17:20:00.000Z",
        "homeSpread": "-5.5",
        "awaySpread": "+5.5",
        "Q1_homeMoneyline": "+110",
        "Q1_awayMoneyline": "-130",
        "Q1_homeSpread": "-1.5",
        "Q1_awaySpread": "+1.5"
      }
    }
  }
}
```

### Part 4: NFL Path Fallback Test

**Setup (Create Orphaned Data):**
1. Go to Firebase Console → Realtime Database
2. Manually create test data at root:
```json
{
  "spreads": {
    "999999999": {
      "timestamp": "2024-12-28T12:00:00.000Z",
      "homeSpread": "-3.5",
      "awaySpread": "+3.5",
      "total": "47.5"
    }
  }
}
```

**Test Steps:**
1. Reload the app
2. Check console for migration logs
3. Verify data moves to `/spreads/NFL/999999999`

**Expected Console Output:**
```
🔍 Checking for orphaned data in Firebase /spreads root...
⚠️ Found 1 orphaned game IDs at root: [999999999]
  → Migrating 999999999 to spreads/NFL/999999999
  ✅ Migrated 999999999
✅ Migration complete: 1 games moved to NFL
```

**Verify in Firebase:**
- ✅ Data now exists at: `/spreads/NFL/999999999`
- ✅ Old root entry `/spreads/999999999` is deleted

### Part 5: Member App Real-Time Sync

**Test Steps:**
1. Open app in two browser windows
2. Window 1: Login as Admin, load NFL
3. Window 2: Login as Member, load NFL
4. Window 1: Edit moneylines, click Save
5. Window 2: Watch for real-time update

**Expected Results:**
- ✅ Window 2 receives update within 1-2 seconds
- ✅ Updated games show green flash animation
- ✅ Console in Window 2 shows:
```
📥 Firebase data received for NFL: X games
  🔍 Syncing game 401671798: { awayML: '-180', homeML: '+150', ... }
  ✅ Game 401671798 updated from Firebase
```

## Troubleshooting

### Issue: Still Getting 422 Errors

**Check:**
1. Clear browser cache (Ctrl+Shift+Delete)
2. Hard reload (Ctrl+F5)
3. Verify code deployed (check Network → Sources tab)
4. Look for this line in App.js:
   ```javascript
   markets = 'h2h,spreads,totals';  // Should NOT include q1, h1, etc.
   ```

### Issue: Firebase Permission Denied

**Check:**
1. Rules deployed? Go to Firebase Console → Database → Rules
2. Should show `.validate": "newData.hasChild('timestamp')"` (not `hasChildren([...])`)
3. Re-deploy rules if needed
4. Wait 30 seconds for rules to propagate

**Test with curl:**
```bash
# Get your ID token from browser console: user.getIdToken()
curl -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -X PUT \
  -d '{"timestamp":"2024-12-28T17:00:00Z","homeMoneyline":"+150"}' \
  https://marcs-parlays-default-rtdb.firebaseio.com/spreads/NFL/test123.json
```

### Issue: Moneylines Not Displaying

**Check:**
1. Console logs for parsing errors
2. Verify API returns `price` field (not `point`)
3. Check Network tab → Response for API call
4. Look for this in console:
   ```
   🔍 API Raw Price for <game_id> (home): 150
   ```

### Issue: Quarter Odds Not Loading

**Note:** Quarter/half odds require:
1. Per-event API endpoint (`/events/{eventId}/odds`)
2. This is handled by `fetchDetailedOdds()` function
3. NOT included in bulk fetch (this is correct behavior)

**To load quarter odds:**
- Currently requires manual implementation or button trigger
- Check `PROP_BETS_IMPLEMENTATION_GUIDE.md` for integration steps

## API Quota Monitoring

After deployment, monitor API usage:

1. Check browser console for quota logs:
```
📊 API Quota - Remaining: 450 | Used: 50
```

2. Expected reduction in API calls:
   - **Before**: ~10-15 calls/hour (including failed retries)
   - **After**: ~3-5 calls/hour (no failed requests)

3. Hard stop activates at <10 remaining:
```
🚨 CRITICAL: API quota below 10! Activating HARD STOP.
```

## Success Criteria

✅ **All tests passed when:**
- [ ] No 422 errors in console
- [ ] API URLs show only `h2h,spreads,totals`
- [ ] Can save moneylines without spreads
- [ ] Can save quarter odds without full game odds
- [ ] Migration script moves orphaned NFL data
- [ ] Member app receives real-time updates
- [ ] Build completes with no errors
- [ ] Firebase rules show as "Published"

## Rollback Plan (If Issues Occur)

### Rollback Code:
```bash
git revert HEAD
git push origin copilot/fix-api-errors-odds-display --force
```

### Rollback Firebase Rules:
1. Go to Firebase Console → Database → Rules
2. Click "History" tab
3. Select previous version
4. Click "Restore"
5. Publish

### Emergency Contact:
- Check GitHub Issues: https://github.com/AndrewSerulneck/EGTSports/issues
- Review `FIREBASE_RULES_AND_API_FIX_SUMMARY.md`
- Consult `copilot-instructions.md` for API rules

## Post-Deployment Verification (24 Hours Later)

Check these metrics:
1. **API Quota Usage**: Should be ~60-70% lower
2. **Error Logs**: Zero 422 or permission errors
3. **Data Completeness**: All games showing moneylines
4. **User Feedback**: Members report seeing odds correctly

---

**Prepared By**: GitHub Copilot
**Date**: December 28, 2024
**Version**: 1.0
**Related Docs**: FIREBASE_RULES_AND_API_FIX_SUMMARY.md
