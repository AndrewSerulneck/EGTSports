# Firebase Rules JSON - Updated Version

This is the complete, updated Firebase Rules JSON that should be deployed to fix the NFL migration and moneyline issues.

## How to Deploy

1. Go to Firebase Console: https://console.firebase.google.com
2. Select your project
3. Navigate to: **Realtime Database** → **Rules**
4. Replace the entire rules JSON with the content below
5. Click **Publish**

## Complete Updated Rules JSON

```json
{
  "rules": {
    "spreads": {
      ".read": true,
      ".write": "auth != null && auth.token.admin === true",
      "$sport": {
        ".read": true,
        ".write": "auth != null && auth.token.admin === true",
        "$gameId": {
          ".validate": "newData.hasChild('timestamp') || data.exists()",
          "timestamp": { 
            ".validate": "newData.isString()" 
          },
          "awaySpread": { 
            ".validate": "newData.isString()" 
          },
          "homeSpread": { 
            ".validate": "newData.isString()" 
          },
          "total": { 
            ".validate": "newData.isString()" 
          },
          "awayMoneyline": { 
            ".validate": "newData.isString()" 
          },
          "homeMoneyline": { 
            ".validate": "newData.isString()" 
          },
          "drawMoneyline": { 
            ".validate": "newData.isString()" 
          },
          "oddsApiEventId": { 
            ".validate": "newData.isString()" 
          },
          "Q1_homeMoneyline": { ".validate": "newData.isString()" },
          "Q1_awayMoneyline": { ".validate": "newData.isString()" },
          "Q1_homeSpread": { ".validate": "newData.isString()" },
          "Q1_awaySpread": { ".validate": "newData.isString()" },
          "Q1_total": { ".validate": "newData.isString()" },
          "Q2_homeMoneyline": { ".validate": "newData.isString()" },
          "Q2_awayMoneyline": { ".validate": "newData.isString()" },
          "Q2_homeSpread": { ".validate": "newData.isString()" },
          "Q2_awaySpread": { ".validate": "newData.isString()" },
          "Q2_total": { ".validate": "newData.isString()" },
          "Q3_homeMoneyline": { ".validate": "newData.isString()" },
          "Q3_awayMoneyline": { ".validate": "newData.isString()" },
          "Q3_homeSpread": { ".validate": "newData.isString()" },
          "Q3_awaySpread": { ".validate": "newData.isString()" },
          "Q3_total": { ".validate": "newData.isString()" },
          "Q4_homeMoneyline": { ".validate": "newData.isString()" },
          "Q4_awayMoneyline": { ".validate": "newData.isString()" },
          "Q4_homeSpread": { ".validate": "newData.isString()" },
          "Q4_awaySpread": { ".validate": "newData.isString()" },
          "Q4_total": { ".validate": "newData.isString()" },
          "H1_homeMoneyline": { ".validate": "newData.isString()" },
          "H1_awayMoneyline": { ".validate": "newData.isString()" },
          "H1_homeSpread": { ".validate": "newData.isString()" },
          "H1_awaySpread": { ".validate": "newData.isString()" },
          "H1_total": { ".validate": "newData.isString()" },
          "H2_homeMoneyline": { ".validate": "newData.isString()" },
          "H2_awayMoneyline": { ".validate": "newData.isString()" },
          "H2_homeSpread": { ".validate": "newData.isString()" },
          "H2_awaySpread": { ".validate": "newData.isString()" },
          "H2_total": { ".validate": "newData.isString()" },
          "$other": {
            ".validate": "newData.isString()"
          }
        }
      }
    },
    "admins": { 
      ".read": "auth != null", 
      ".write": false 
    },
    "submissions": { 
      ".read": true, 
      "$ticketNumber": { 
        ".write": true 
      } 
    },
    "analytics": { 
      ".read": "auth != null && auth.token.admin === true", 
      "$entry": { 
        ".write": true 
      } 
    },
    "users": {
      ".read": "auth != null",
      ".write": "auth != null && auth.token.admin === true",
      "$userId": {
        "totalWagered": { 
          ".write": "auth != null && auth.uid === $userId" 
        }
      }
    },
    "wagers": {
      ".read": "auth != null",
      "$wagerId": { 
        ".write": "auth != null" 
      }
    },
    "artifacts": {
      "$appId": {
        "users": {
          "$userId": {
            ".read": "auth != null && auth.uid === $userId",
            ".write": "auth != null && auth.uid === $userId"
          }
        }
      }
    }
  }
}
```

## Key Changes Explained

### 1. Line 10 - Flexible Timestamp Validation
```json
".validate": "newData.hasChild('timestamp') || data.exists()"
```
**Before**: `".validate": "newData.hasChild('timestamp')"`  
**Why**: Allows updates to existing games without requiring timestamp in every update. New games still require timestamp.

### 2. Line 66 - Allow New Market Fields
```json
"$other": {
  ".validate": "newData.isString()"
}
```
**Before**: `".validate": false`  
**Why**: Allows new market types (future quarter/half fields, prop bets, etc.) without updating rules each time.

### 3. Line 5 - Root Write Permission (Already Present)
```json
".write": "auth != null && auth.token.admin === true"
```
**Why**: Allows admins to write at the `/spreads` level for bulk operations and migrations.

## Testing the Rules

After deploying, test with:

```javascript
// Should succeed (has timestamp)
firebase.database().ref('spreads/NFL/401234567').set({
  timestamp: new Date().toISOString(),
  homeMoneyline: "-150",
  awayMoneyline: "+130"
});

// Should succeed (updating existing game)
firebase.database().ref('spreads/NFL/401234567').update({
  homeMoneyline: "-160"
});

// Should succeed (new field type)
firebase.database().ref('spreads/NFL/401234567').update({
  Q1_homeMoneyline: "+100"
});
```

## Security Notes

✅ **Write access** still requires admin authentication  
✅ **New fields** must be strings (prevents object injection)  
✅ **Timestamp** required for new entries (data integrity)  
✅ **Partial updates** allowed (flexibility)

## Rollback

If issues occur, revert to previous rules by changing:
- Line 10 back to: `".validate": "newData.hasChild('timestamp')"`
- Line 66 back to: `".validate": false`

---

**Last Updated**: 2025-12-28  
**Status**: ✅ Ready for Deployment
