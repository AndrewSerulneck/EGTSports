# Migration Script Fix - Firebase Rules Update

## Issue Identified by User

The original Firebase rules blocked the migration script from deleting orphaned data at the root path (`spreads/${espnId}`).

### Problem
```json
{
  "spreads": {
    "$sport": {
      ".write": "auth != null && auth.token.admin === true",
      // Migration can write to spreads/NFL/${espnId} ✅
      // But CANNOT delete spreads/${espnId} ❌
    }
  }
}
```

When the migration script tried to delete old data:
```javascript
await set(ref(database, `spreads/${espnId}`), null);
```

Firebase rejected it with "Permission Denied" because there was no write rule at the root `spreads` level.

### Solution Applied (Commit f45bee5)

Added root-level read/write permissions:
```json
{
  "spreads": {
    ".read": true,
    ".write": "auth != null && auth.token.admin === true",
    "$sport": {
      ".read": true,
      ".write": "auth != null && auth.token.admin === true",
      "$gameId": { ... }
    }
  }
}
```

Now the migration script can:
1. ✅ Read from root: `spreads/${espnId}`
2. ✅ Write to target: `spreads/NFL/${espnId}`
3. ✅ Delete from root: `spreads/${espnId}` (set to null)

### Security Maintained

Both levels still require admin authentication:
- Root level: `auth != null && auth.token.admin === true`
- Sport level: `auth != null && auth.token.admin === true`
- Game level: Validated with optional fields

No security downgrade - only admin users can write at any level.

## Timestamp Requirement Verification

User correctly identified that the `.validate` rule requires `timestamp` in every update.

### Confirmed: Already Implemented ✅

The `saveSpreadToFirebase` function (line 475) includes timestamp in every save:
```javascript
const gameData = {
  timestamp: new Date().toISOString()
};
```

The `fetchDetailedOdds` function only returns data—it doesn't save to Firebase directly. All Firebase writes go through `saveSpreadToFirebase`, which always includes the timestamp.

## Verification

### Test Migration
After deploying the updated rules:
1. Console should show: `✅ Migrated ${espnId}`
2. No "Permission Denied" errors
3. Old data successfully removed from root
4. New data exists at `spreads/NFL/${espnId}`

### Test Saves
1. Save only moneylines → ✅ Works (timestamp included)
2. Save quarter odds → ✅ Works (timestamp included)
3. Save combination → ✅ Works (timestamp included)

## Complete Updated Rules

The complete Firebase rules are in `firebase.rules.json` and include:
- Root-level read/write for migration
- Sport-level read/write for normal operations
- Game-level validation with flexible fields
- All existing paths (admins, submissions, analytics, users, wagers, artifacts)

---

**Fixed By**: Commit f45bee5
**Reported By**: @AndrewSerulneck
**Date**: December 28, 2024
