# Financial Dashboard & Dynamic Credit Logic - Implementation Summary

## Overview
This implementation adds a comprehensive financial dashboard to the "My Bets" page with dynamic credit logic and on-demand weekly balance resets. **No CRON jobs are used** - all reset logic is triggered by user interactions.

## Key Features

### 1. Dynamic Balance System
- **Current Balance**: Users have a `current_balance` that can exceed their base credit limit from winnings
- **Base Credit Limit**: Admin-assigned credit limit that serves as the weekly starting balance
- **Balance Can Exceed Limit**: Winnings are added to current balance, allowing it to grow beyond the base limit

### 2. On-Demand Wednesday Reset
- **Trigger**: Automatically checks and performs reset when user loads "My Bets" page
- **Reset Time**: Every Wednesday at 12:01 AM EST (with DST support)
- **Reset Logic**:
  - Compare user's `last_reset_timestamp` with most recent Wednesday 12:01 AM
  - If last reset is older, reset `current_balance` to `base_credit_limit`
  - Update `last_reset_timestamp` to current time
  - Create a "Weekly Balance Reset" transaction record
- **Admin Override**: Same check runs when Admin views member accounts

### 3. Sub-Navigation Tabs
Three distinct tabs with mobile-first design:

#### **Figures Tab** (Weekly Performance)
- Dropdown filter: "This Week", "Last Week", "2 Weeks Ago"
- Performance summary showing won/lost wagers
- **Weekly Net** prominently displayed (Total Won - Total Lost)
- List of resolved wagers for selected period

#### **Pending Tab** (Current Wagers)
- Shows all active wagers
- Card-style layout with:
  - Selection details
  - Odds
  - Stake amount
  - Potential payout

#### **Transactions Tab** (Running Account Ledger)
- Complete transaction history
- Columns: Date/Time, Description, Amount, Running Balance
- Horizontal scrolling support for mobile
- Chronological balance tracking

### 4. Visual Design
- **Current Balance**: Large, prominent display at the top
- **Red Underline (#ff3131)**: Active tab indicator
- **Mobile-First**: All components optimized for mobile viewing
- **Color Coding**: Green for wins, red for losses, blue for neutral

## Backend Changes

### New API Endpoint: `/api/checkReset.js`
```javascript
POST /api/checkReset
Authorization: Bearer <token>
Body: { userId: "optional-user-id" }
```

**Functionality**:
- Calculates most recent Wednesday at 12:01 AM EST
- Checks if user's last reset is older than this date
- Performs reset if needed
- Creates transaction record
- Supports DST (Daylight Saving Time)

**Security**:
- Requires authentication
- Admin can check other users' resets
- Regular users can only check their own

### Updated API: `/api/submitWager.js`
**Changes**:
- Uses `current_balance` instead of `creditLimit - totalWagered`
- Subtracts stake from `current_balance`
- Creates transaction record with:
  - Description: "Wager Placed - [bet type]"
  - Amount: negative (stake)
  - Balance before/after
  - Wager ID reference

**Validation**:
- Checks if stake exceeds current balance
- Returns detailed error if insufficient balance

### Updated API: `/api/resolveWagers.js`
**Changes**:
- Adds winnings to `current_balance` when wager wins
- Adds stake back for pushes
- Creates transaction record with:
  - Description: "Wager Won" or "Wager Pushed"
  - Amount: positive (payout)
  - Balance before/after
  - Wager ID reference

## Frontend Changes

### `MemberDashboardApp.jsx`

#### New Components

**`BalanceStatus`**
- Displays current balance prominently
- Shows base credit limit
- Progress bar (only when balance is within limit)
- Special badge when balance exceeds limit from winnings
- Calls `/api/checkReset` on mount

**`SubNavigationTabs`**
- Horizontal tab bar
- Red underline for active tab
- Mobile-friendly with overflow scroll

**`FiguresTab`**
- Period filter dropdown
- Performance metrics
- Weekly net calculation
- Wager list with color coding

**`TransactionsTab`**
- Table layout with horizontal scroll
- Shows running balance after each transaction
- Sorted by timestamp (newest first)

**`Dashboard`** (Updated)
- Added tab state management
- Integrated new balance display
- Removed old credit status component

## Database Schema Changes

### Users Collection
```javascript
{
  current_balance: Number,        // Current balance (can exceed base limit)
  base_credit_limit: Number,      // Admin-assigned weekly credit limit
  last_reset_timestamp: String,   // ISO timestamp of last reset
  creditLimit: Number,            // Legacy field (kept for compatibility)
  totalWagered: Number           // Legacy field (kept for compatibility)
}
```

### Transactions Collection
```javascript
transactions/{userId}/{transactionId}: {
  timestamp: String,              // ISO timestamp
  description: String,            // Human-readable description
  amount: Number,                 // Positive for credits, negative for debits
  balanceBefore: Number,          // Balance before this transaction
  balanceAfter: Number,           // Balance after this transaction (running balance)
  type: String,                   // 'wager', 'win', 'push', 'reset'
  wagerId: String,               // Reference to wager (if applicable)
  createdAt: String              // ISO timestamp of record creation
}
```

## Security Considerations

### Server-Side Logic
- ✅ All balance calculations happen server-side
- ✅ Reset logic is server-side (cannot be manipulated by client)
- ✅ Transaction records are created atomically
- ✅ Authentication required for all operations

### CodeQL Security Scan
- ✅ No vulnerabilities detected
- ✅ All code passes security checks

### Rate Limiting
- Reset checks have cooldown to prevent spam
- Public resolution endpoints have rate limiting

## Testing Checklist

### Manual Testing Required
- [ ] Test balance reset at Wednesday 12:01 AM EST
- [ ] Verify balance can exceed base limit from winnings
- [ ] Test transaction ledger shows correct running balances
- [ ] Verify Figures tab calculates weekly net correctly
- [ ] Test mobile responsiveness on all tabs
- [ ] Verify horizontal scrolling works on Transactions tab
- [ ] Test Admin viewing member accounts triggers reset check
- [ ] Verify DST handling (test during DST and non-DST periods)

### Automated Testing
- ✅ Build successful (npm run build)
- ✅ No lint errors
- ✅ No security vulnerabilities (CodeQL)

## Migration Notes

### For Existing Users
1. First time a user loads the page after deployment:
   - If `current_balance` is undefined, it will be set to `base_credit_limit`
   - If `base_credit_limit` is undefined, it will use `creditLimit`
   - Legacy `creditLimit` and `totalWagered` fields are maintained for backward compatibility

2. Admins should set `base_credit_limit` for all users:
   ```javascript
   // One-time migration script (run via Firebase Console or admin tool)
   users.forEach(user => {
     if (!user.base_credit_limit) {
       user.base_credit_limit = user.creditLimit || 100;
       user.current_balance = user.base_credit_limit;
     }
   });
   ```

## Key Implementation Details

### Wednesday Reset Logic
- Uses UTC time with EST offset calculation
- Supports both EST (-5) and EDT (-4) with automatic DST detection
- DST transitions:
  - Starts: Second Sunday in March at 2:00 AM
  - Ends: First Sunday in November at 2:00 AM

### Transaction Ordering
- Transactions are sorted by `timestamp` descending (newest first)
- Running balance is calculated chronologically
- Each transaction record stores both before/after balances for verification

### Mobile-First Design
- All components designed for mobile viewport first
- Horizontal scrolling enabled for tables
- Large touch targets for buttons
- Sticky sub-navigation bar

## Troubleshooting

### Balance Not Resetting
1. Check `last_reset_timestamp` in user record
2. Verify current time vs. most recent Wednesday 12:01 AM EST
3. Check server logs for reset API calls
4. Verify user has authenticated when loading page

### Transaction Balance Mismatch
1. Transactions are ordered by timestamp
2. Each transaction stores `balanceAfter` - this is the running balance
3. If mismatch occurs, check for:
   - Missing transactions
   - Transactions with incorrect timestamps
   - Direct balance updates outside transaction system

### DST Issues
1. The system auto-detects DST based on current date
2. Test during both DST and non-DST periods
3. For production, consider using a timezone library for more accurate handling

## Future Enhancements

### Potential Improvements
1. **Transaction Categories**: Add filtering by transaction type
2. **Export Functionality**: Allow users to export transaction history
3. **Balance History Chart**: Visual representation of balance over time
4. **Weekly Reports**: Automated weekly performance summaries
5. **Timezone Support**: Support for multiple timezones beyond EST
6. **Pagination**: For users with large transaction histories
7. **Search/Filter**: Search transactions by description or amount

### Scalability Considerations
1. **Caching**: Consider caching weekly net calculations
2. **Indexing**: Add database indexes on timestamp fields
3. **Archiving**: Archive old transactions (e.g., older than 6 months)
4. **Aggregations**: Pre-calculate weekly summaries

## Files Changed

### Backend
- `api/checkReset.js` - **NEW**: On-demand reset logic
- `api/submitWager.js` - **UPDATED**: Dynamic balance and transactions
- `api/resolveWagers.js` - **UPDATED**: Add winnings to balance and transactions

### Frontend
- `src/MemberDashboardApp.jsx` - **UPDATED**: Complete redesign with tabs and new balance display

### Documentation
- `FINANCIAL_DASHBOARD_IMPLEMENTATION.md` - **NEW**: This file

## Deployment Steps

1. **Deploy Backend Changes**:
   ```bash
   # Backend APIs are deployed automatically via Vercel
   git push origin copilot/redesign-my-bets-tab
   ```

2. **Deploy Frontend Changes**:
   ```bash
   npm run build
   # Deploy build folder to hosting
   ```

3. **Database Migration** (if needed):
   - Set `base_credit_limit` for existing users
   - Initialize `current_balance` for existing users
   - Set `last_reset_timestamp` to force initial reset check

4. **Testing**:
   - Verify reset logic works correctly
   - Test transaction creation
   - Verify mobile responsiveness
   - Check all three tabs function correctly

## Support

For issues or questions:
1. Check server logs for API errors
2. Verify Firebase database rules allow transaction writes
3. Check browser console for frontend errors
4. Review transaction records for data integrity

---

**Implementation Date**: December 2024  
**Status**: ✅ Complete - Ready for Testing  
**Security Status**: ✅ No Vulnerabilities Detected  
**Build Status**: ✅ Successful
