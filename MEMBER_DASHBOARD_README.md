# Member Dashboard and Wager Tracker

A complete, single-file React application (`MemberDashboardApp.jsx`) that implements a Member Dashboard for placing simulated wagers, viewing wager history, and receiving real-time notifications.

## Features

- **Wager Input**: Simple form to place simulated wagers with amount and details
- **Current Wagers**: Real-time display of pending wagers sorted by date placed
- **Past Wagers**: View settled wagers with win/loss status and payouts
- **Real-Time Notifications**: Notification bell with unread badge that updates in real-time
- **Admin Simulation Tool**: "Simulate Next Result" button for testing wager settlements
- **Mobile-First Design**: Responsive layout optimized for small screens using Tailwind CSS

## Navigation

The Member Dashboard is accessible from the main sports menu:
- **Desktop**: Click "📊 Member Dashboard" in the left sidebar
- **Mobile**: Click "📊 Dashboard" in the horizontal menu bar
- **Direct URL**: Navigate to `/member/dashboard`

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

## Firebase Security Rules

### Cloud Firestore Security Rules

**IMPORTANT**: Add these security rules to your Firestore configuration to secure user data:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Member Dashboard: Secure private user data
    match /artifacts/{appId}/users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Add your other existing rules here...
    
  }
}
```

### Firebase Realtime Database Rules

If you're using Firebase Realtime Database for other parts of your application, here are the **combined rules** that preserve your existing functionality while adding the Member Dashboard:

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

**Note**: The `artifacts` section at the bottom is the new addition for the Member Dashboard. This allows authenticated users to read and write only their own wager and notification data.

These rules ensure that:
- Only authenticated users can access their own data
- Users cannot read or modify other users' data
- The `userId` in the path must match the authenticated user's UID
- All existing functionality (spreads, admins, submissions, analytics, users) is preserved

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

### Simulate Wager Settlement (Testing)

Click the "🎲 Simulate Next Result" button to:
1. Fetch the oldest pending wager
2. Randomly determine win (70% chance) or loss (30% chance)
3. Calculate payout if won
4. Create a notification about the result

This is useful for testing the real-time update functionality.

## Component Structure

```
MemberDashboardApp
├── Header
│   ├── NotificationBell
│   └── SimulateResultButton (desktop)
├── WagerInput
├── Dashboard
│   ├── CurrentWagers
│   └── PastWagers
└── SimulateResultButton (mobile floating)
```

## Mobile-First Design

The layout is designed for mobile devices first:
- Single-column layout on small screens
- Floating action button for simulation on mobile
- Touch-friendly input sizes
- Responsive notification dropdown

## File Location

The component is located at: `src/MemberDashboardApp.jsx`

## Dependencies

Make sure you have the following packages installed:
- `firebase` (v9+)
- `react` (v18+)
- `tailwindcss` (v3+)
