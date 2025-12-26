# EGT Sports Betting Platform - AI Development Guide

## Architecture Overview

**Two-App System with Shared Firebase Backend:**
- **Main App** (`App.js`): Admin dashboard + Member betting interface (React Router-based SPA)
- **Member Dashboard** (`MemberDashboardApp.jsx`): Standalone wager tracking (can be embedded independently)
- **Backend**: Vercel serverless functions (`/api`) with Firebase Admin SDK for RBAC & data persistence

### Critical Dual-Entry Points
```
src/App.js              → Main betting + admin interface (React Router)
src/MemberDashboardApp.jsx → My Bets dashboard (standalone, uses window.location)
```
**Why:** MemberDashboardApp renders independently without React Router context to allow embedding or standalone hosting.

## Role-Based Access Control (RBAC)

**Security Model:** Database-verified token claims, not client-side state.

### Authentication Flow (Lines 2767-2815 in `App.js`)
1. User selects role → "Member Login" or "Admin Login" (`AuthLanding.js`)
2. Firebase authenticates → `signInWithEmailAndPassword`
3. **CRITICAL ENFORCEMENT:** 
   - Fetch `getIdTokenResult(true)` to force token refresh
   - Extract `tokenResult.claims.admin` (cryptographically signed by Firebase)
   - Compare intended role vs actual claim
   - **Mismatch = immediate signOut + error message**

### Setting Admin Claims (Firebase)
```javascript
// Use Firebase Admin SDK (not client SDK)
admin.auth().setCustomUserClaims(uid, { admin: true });
```

**Test Coverage:** 9 tests in `RoleBasedAuth.test.js` verify enforcement logic.

## Key Architectural Patterns

### 1. Optimistic UI for Wager Submission
**Location:** `App.js` lines 2360-2480 (`handleWagerSubmission`)

**Pattern:**
```javascript
// 1. Immediate UI feedback
setSubmissionSuccess(ticketNum);
setSelectedPicks({});  // Clear betting slip

// 2. Create optimistic wager object
const optimisticWager = { id: `optimistic-${ticketNum}`, isOptimistic: true, ... };
setOptimisticWagers(prev => [...prev, optimisticWager]);

// 3. Server validation (API call)
const wagerResponse = await fetch('/api/wager-manager?action=submit', ...);

// 4. Handle success/failure
if (!wagerResponse.ok) {
  // Remove optimistic wager + restore UI
  setOptimisticWagers(prev => prev.filter(w => w.id !== optimisticWager.id));
  setSubmissionSuccess(null);
  alert(error);
}
```
**Cleanup:** Auto-remove optimistic wagers after 3s (real data appears from Firebase sync).

### 2. Mobile-First Design (768px Breakpoint)
**Constant:** `MOBILE_BREAKPOINT = 768` in `BettingSlip.js`

**UI Hierarchy:**
- **Mobile (<768px):** Vertical scroll menu + bottom nav (Home, My Bets, FAQs, Sign Out)
- **Desktop (≥768px):** Sidebar menu + no bottom nav

**CSS Strategy:** Base styles are mobile, `@media (min-width: 768px)` adds desktop enhancements.

### 3. Betting Slip Collapse Control
**Cross-Component State Sync:**
- `sessionStorage.setItem('collapseBettingSlipOnReturn', 'true')` in `MemberDashboardApp.jsx`
- React Router location state: `navigate('/member/NFL', { state: { collapseSlip: true } })`
- BettingSlip listens to `shouldCollapse` prop via useEffect

**Constant:** `COLLAPSE_FLAG_KEY = 'collapseBettingSlipOnReturn'`

### 4. Multi-Sport ESPN API Caching
**Cache Strategy (Lines 140-200 in `App.js`):**
- In-memory cache per sport with 5-minute TTL (College Basketball: 15 min)
- Fallback to The Odds API if ESPN odds incomplete
- Rate limit handling: Return cached data on 429 errors

```javascript
const gameCache = {}; // { 'NFL': { data: [...], timestamp: 123 }, ... }
const CACHE_DURATION = 5 * 60 * 1000;
```

## Serverless API Architecture

### Consolidated Endpoints (Vercel Functions)
```
/api/wager-manager.js    → ?action=submit|cancel|reset|resolve|updateScores|getPropBets|getHistory
/api/system-sync.js      → ?action=weeklyReset|sheetsSync|checkEnv|checkReset
/api/user-admin.js       → create|update|delete|list|setAdmin users
```

### Authentication Pattern
```javascript
// Extract & verify ID token
const authHeader = req.headers.authorization;
const idToken = authHeader?.split('Bearer ')[1];
const decodedToken = await admin.auth().verifyIdToken(idToken);
```

### Credit Limit Enforcement
**Server-side validation in `/api/wager-manager.js`:**
```javascript
const userData = await admin.database().ref(`users/${uid}`).once('value');
const creditLimit = userData.val().creditLimit || 100;
const totalWagered = userData.val().totalWagered || 0;
if (wagerAmount > (creditLimit - totalWagered)) {
  return res.json({ success: false, error: 'Wager exceeds credit limit' });
}
```

## Critical Constants

```javascript
// App.js
MIN_BET = 1
MAX_BET = 500
CACHE_DURATION = 5 * 60 * 1000
FIREBASE_LISTENER_SETUP_DELAY = 2000
DATA_REFRESH_INTERVAL = 5 * 60 * 1000
OPTIMISTIC_WAGER_CLEANUP_DELAY = 3000
COLLAPSE_RESET_DELAY = 50

// MemberDashboardApp.jsx
COLLAPSE_FLAG_KEY = 'collapseBettingSlipOnReturn'

// BettingSlip.js
MOBILE_BREAKPOINT = 768
```

## Development Workflows

### Build & Test
```bash
npm install && npm test              # Run Jest tests (27 tests)
npm run build                        # Production build (React)
cd api && npm install                # Install API dependencies
```

### Local Development
```bash
npm start                            # React dev server (port 3000)
# API functions run via Vercel CLI or direct Node.js execution
```

### Environment Variables
**Client (.env):**
- `REACT_APP_FIREBASE_*` (8 keys) - Firebase config
- `REACT_APP_THE_ODDS_API_KEY` - The Odds API key

**Server (Vercel):**
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_DATABASE_URL`
- `CRON_SECRET` - Secure cron job verification
- `ALLOWED_ORIGIN` - CORS origin (defaults to *)

## Data Flow Patterns

### Wager Submission (Straight Bets)
```javascript
// Each pick becomes separate submission with own ticket number
submissionsToCreate.push({
  ticketNumber: `${baseTicket}-${index}`,
  picks: [singlePick],
  betAmount: individualAmount,
  betType: 'straight'
});
```

### Firebase Real-Time Sync
```javascript
// setupFirebaseListener in App.js (lines 890-940)
onValue(ref(database, `spreads/${sport}`), (snapshot) => {
  // Update games with new odds data
  // Trigger visual "recently updated" animation
});
```

## Testing Strategy

**Unit Tests (Jest + React Testing Library):**
- `App.test.js` - Component rendering
- `RoleBasedAuth.test.js` - RBAC enforcement (9 tests)
- `BettingSlip.test.js` - Bet calculations
- `MemberDashboardApp.test.js` - Dashboard logic

**Manual Testing:** See `TESTING_CHECKLIST.md` for comprehensive scenarios.

## Common Pitfalls

1. **Route Guards:** Always check `authInitialized.current` before navigating (prevents race conditions)
2. **Admin Detection:** Use `isAdminRef.current` for synchronous checks, `authState.isAdmin` for rendering
3. **Betting Slip State:** Never use `forceCollapse` prop bi-directionally (one-way control only)
4. **API Calls:** Always include `Authorization: Bearer ${idToken}` header for authenticated endpoints
5. **Mobile Testing:** Test at exactly 768px width (breakpoint boundary behavior)
6. **Firebase Config:** `databaseURL` must match between App.js and MemberDashboardApp.jsx (avoid duplicate-app error)

## Key Documentation Files

- `RBAC_IMPLEMENTATION.md` - Role-based access control details
- `FINAL_SUMMARY.md` - Complete feature implementation history
- `DEPLOYMENT_GUIDE.md` - Vercel deployment steps
- `FIREBASE_ADMIN_SETUP.md` - Service account configuration
- `PROP_BETS_IMPLEMENTATION_GUIDE.md` - Prop bets integration (The Odds API)

## Deployment (Vercel)

**Build Configuration (`vercel.json`):**
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "build",
  "installCommand": "npm install && cd api && npm install",
  "crons": [
    { "path": "/api/system-sync?action=weeklyReset", "schedule": "0 0 * * 2" }
  ]
}
```

**Cron Jobs:** Weekly credit reset runs Tuesdays at midnight (Tuesday 00:00 UTC).

## Navigation Architecture

**React Router Routes:**
```
/                          → Role selection (AuthLanding)
/login/user                → Member login
/login/admin               → Admin login
/admin/dashboard           → Admin landing page
/admin/:sport              → Sport-specific admin panel
/member/:sport             → Member betting interface
/member/dashboard          → My Bets (renders MemberDashboardApp)
```

**Navigation Methods:**
- **App.js:** `useNavigate()` from react-router-dom
- **MemberDashboardApp.jsx:** `window.location.href` (standalone compatibility)

## When Making Changes

### Adding New Sports
1. Add ESPN API endpoint to `ESPN_API_ENDPOINTS` object
2. Add sport key to `ODDS_API_SPORT_KEYS` (if using The Odds API)
3. Update admin dashboard sport list in `AdminLandingPage` component
4. Create Firebase Realtime Database path: `spreads/{sportName}`

### Modifying RBAC
1. Update enforcement logic in `handleLogin` (lines 2767-2815)
2. Add corresponding test to `RoleBasedAuth.test.js`
3. Update `RBAC_IMPLEMENTATION.md` documentation
4. Verify with manual test checklist

### API Changes
1. Update consolidated endpoint action handlers
2. Maintain backward compatibility (check for existing action names)
3. Add CORS headers via `setCorsHeaders` helper
4. Document in corresponding `*_README.md` file

---

# The Odds API - Master Betting Market & UI Rules

## 1. Mandatory Market Keys
Use these exact keys for all requests and parsing as defined in the official documentation.

### Core Markets (Standard Endpoint)
Use the `/sports/{sport}/odds` endpoint for these.
- **Moneyline:** `h2h` (Winner of game, includes draw for soccer)
- **Point Spread:** `spreads` (Winning team after handicap)
- **Over/Under:** `totals` (Total score threshold)
- **Outrights:** `outrights` (Tournament winner)
- **Soccer 3-Way:** `h2h_3_way` (Includes the Draw outcome explicitly)

### Game Period Markets (Specific Segments)
- **1st Quarter:** `h2h_q1`, `spreads_q1`, `totals_q1`
- **2nd Quarter:** `h2h_q2`, `spreads_q2`, `totals_q2`
- **3rd Quarter:** `h2h_q3`, `spreads_q3`, `totals_q3`
- **4th Quarter:** `h2h_q4`, `spreads_q4`, `totals_q4`
- **1st Half:** `h2h_h1`, `spreads_h1`, `totals_h1`
- **2nd Half:** `h2h_h2`, `spreads_h2`, `totals_h2`
- **NHL Periods:** `h2h_p1`, `h2h_p2`, `h2h_p3` (Valid for ice hockey)

### Specialized Props & Combat Sports (Event Endpoint Required)
MANDATORY: These must be accessed via the `/events/{eventId}/odds` endpoint.
- **Combat Sports:** `h2h_method`, `h2h_round`, `h2h_go_distance`
- **NBA/NFL Points:** `player_points`, `player_assists`, `player_rebounds`
- **NFL Specific:** `player_pass_yds`, `player_rush_yds`, `player_rece_yds`, `player_anytime_td`
- **MLB Specific:** `player_home_runs`, `player_strikeouts`, `player_hits`

## 2. UI & Frontend Rules
- **Odds Formatting:** Remove all logic prefixing odds with team mascot initials. Odds boxes should only contain the numerical line and the price (e.g., "-3.5 (-110)").
- **Error States:** If the API returns no data for a market, display a simple dash ("-") on the frontend. Never display "N/A" to users.
- **Prop Bets Hub:** Interactive buttons must trigger a fetch using the `/events/{eventId}/odds` endpoint for the specific prop key selected.

## 3. Data Fetching & Matching Logic
- **Matching Rule:** Always use the `extractMascot()` logic to match API team names (e.g., "Philadelphia 76ers") to local names (e.g., "76ers").
- **Endpoint Selection:** Standard league endpoints ONLY return core markets. All additional markets (props, alternates, periods) require the event-specific endpoint.

**Last Updated:** December 2025 (React 19.2.0, Firebase 12.4.0)
