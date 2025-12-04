# My Bets - Member Wager Tracker

A React component (`MemberDashboardApp.jsx`) that displays a member's wager history in real-time, including pending and settled wagers with notifications.

## Features

- **Current Wagers**: Real-time display of pending wagers sorted by date placed
- **Past Wagers**: View settled wagers with win/loss status and payouts
- **Real-Time Notifications**: Notification bell with unread badge that updates in real-time
- **Mobile-First Design**: Responsive layout optimized for small screens using Tailwind CSS

## Navigation

The "My Bets" page is accessible from the main sports menu:
- **Desktop**: Click "🎯 My Bets" in the left sidebar
- **Mobile**: Tap "🎯 My Bets" on the bottom navigation bar (always visible)
- **Direct URL**: Navigate to `/member/dashboard`

## Mobile-First Design

The layout is designed for mobile devices first:
- **Bottom Navigation Bar**: Always visible on mobile with Refresh, My Bets, and Sign Out buttons
- **Sports Scroll Bar**: Horizontal scrolling for sports selection at the top
- Single-column layout on small screens
- Touch-friendly input sizes
- Responsive notification dropdown

## Technology Stack

- **Frontend**: React (JSX), functional components, and hooks
- **Styling**: Tailwind CSS (utility-first)
- **Backend**: Firebase Auth and Cloud Firestore

## Configuration

The application uses global variables for Firebase configuration:

```javascript
// These should be provided by the host environment
__app_id        // Application ID for data isolation
__firebase_config  // Firebase configuration object
__initial_auth_token  // Optional custom auth token
```

If these variables are not provided, the app falls back to environment variables or default values.

## Firestore Data Structure

### Wagers Collection

Path: `/artifacts/${appId}/users/${userId}/wagers`

| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | The authenticated user's ID |
| `amount` | number | Wager amount in dollars |
| `details` | string | Description of the wager (e.g., "Team A to win") |
| `status` | string | One of: 'pending', 'won', 'lost' |
| `datePlaced` | Timestamp | When the wager was placed |
| `dateSettled` | Timestamp | When the wager was settled (optional) |
| `payout` | number | Payout amount if won (optional) |

### Notifications Collection

Path: `/artifacts/${appId}/users/${userId}/notifications`

| Field | Type | Description |
|-------|------|-------------|
| `wagerId` | string | Reference to the related wager |
| `message` | string | Notification message (e.g., "Wager won $50!") |
| `isRead` | boolean | Whether the notification has been read |
| `timestamp` | Timestamp | When the notification was created |

---

## Complete Firebase Security Rules

### IMPORTANT: You need BOTH sets of rules

1. **Firebase Realtime Database Rules** - for existing app functionality (spreads, users, submissions, etc.)
2. **Cloud Firestore Security Rules** - for the My Bets wager tracking functionality

---

### 1. Cloud Firestore Security Rules

**Copy and paste this into Firebase Console → Firestore Database → Rules:**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Member Dashboard: Secure private user data (wagers and notifications)
    // Users can only read/write their own data
    match /artifacts/{appId}/users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
  }
}
```

---

### 2. Firebase Realtime Database Rules

**Copy and paste this into Firebase Console → Realtime Database → Rules:**

```json
{
  "rules": {
    "spreads": {
      "$sport": {
        ".read": true,
        ".write": "auth != null && auth.token.admin === true",
        "$gameId": {
          ".validate": "newData.hasChildren(['awaySpread', 'homeSpread', 'total', 'timestamp'])",
          "awaySpread": {
            ".validate": "newData.isString()"
          },
          "homeSpread": {
            ".validate": "newData.isString()"
          },
          "total": {
            ".validate": "newData.isString()"
          },
          "timestamp": {
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
      ".write": "auth != null && auth.token.admin === true"
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

---

## Security Summary

These rules ensure that:
- ✅ Only authenticated users can access their own data
- ✅ Users cannot read or modify other users' data
- ✅ The `userId` in the path must match the authenticated user's UID
- ✅ All existing functionality (spreads, admins, submissions, analytics, users) is preserved
- ✅ The `artifacts` section provides isolated storage for wagers and notifications

## Usage

### Running the App

1. Import the `MemberDashboardApp` component:
```javascript
import MemberDashboardApp from './MemberDashboardApp';
```

2. Render it in your application:
```javascript
function App() {
  return <MemberDashboardApp />;
}
```

### Authentication

The app handles authentication automatically:
- If `__initial_auth_token` is provided, it signs in with the custom token
- Otherwise, it signs in anonymously

## Component Structure

```
MemberDashboardApp
├── Header
│   └── NotificationBell
└── Dashboard
    ├── CurrentWagers
    └── PastWagers
```

## File Location

The component is located at: `src/MemberDashboardApp.jsx`

## Dependencies

Make sure you have the following packages installed:
- `firebase` (v9+)
- `react` (v18+)
- `tailwindcss` (v3+)
