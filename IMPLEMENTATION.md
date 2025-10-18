# EGT Sports Parlay Club - Implementation Guide

## Overview
This document describes the implementation of the EGT Sports parlay submission app according to the specified requirements.

## Key Features

### 1. ESPN API Integration
- **Endpoint**: `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard`
- **Refresh**: Every 5 minutes
- **Data Displayed**: Team names, scores, spreads, totals, game status

### 2. Pick Selection
- Users can select spreads for home or away teams
- Users can select over/under for totals
- Minimum 3 picks required to proceed
- Visual feedback for selected picks

### 3. Checkout Form
The checkout form collects:
- **Name** (required)
- **Email** (required)
- **Bet Amount** (required, $5-$100)

**Important**: No phone number field, no confirmation method selection. Email is the only confirmation method.

### 4. Ticket Generation
- Format: `EGT-{timestamp}`
- Example: `EGT-1737178800000`
- Generated when user clicks "Continue to Checkout"

### 5. Submission to Google Sheets
**URL**: `https://script.google.com/macros/s/AKfycbzPastor8yKkWQxKx1z0p-0ZibwBJHkJCuVvHDqP9YX7Dv1-vwakdR9RU6Y6oNw4T2W2PA/exec`

**Payload Format**:
```json
{
  "ticketNumber": "EGT-1737178800000",
  "timestamp": "2025-01-18T12:00:00.000Z",
  "contactInfo": {
    "name": "John Doe",
    "email": "john@example.com",
    "confirmMethod": "email"
  },
  "betAmount": 10,
  "picks": [
    {
      "gameId": "401671748",
      "gameName": "Kansas City Chiefs @ Houston Texans",
      "pickType": "spread",
      "team": "Kansas City Chiefs",
      "spread": "-3.5",
      "pickedTeamType": "away"
    },
    {
      "gameId": "401671749",
      "gameName": "Baltimore Ravens @ Buffalo Bills",
      "pickType": "total",
      "overUnder": "over",
      "total": "48.5"
    }
  ],
  "paymentStatus": "pending"
}
```

### 6. Payout Multipliers
- 3 picks: 6x
- 4 picks: 10x
- 5 picks: 20x
- 6 picks: 40x
- 7 picks: 75x
- 8 picks: 150x

### 7. Thank You Screen
After submission:
- Displays ticket number
- Shows confirmation email message
- Shows potential payout
- Provides Venmo payment button (@EGTSports)
- Option to submit another ticket

### 8. Validation Rules
- Minimum 3 picks required
- Bet amount must be >= $5
- Bet amount must be <= $100
- Name and email are required
- Cannot bet on completed games

## UI Structure

### Header
```
🏈 EGT Sports Parlay Club
NFL Picks & Parlays
```

### Footer
```
For entertainment only. 21+ only. Private pool among friends.
```

### Payout Odds Display
Shows multipliers in a grid:
- 3 Picks: 6x
- 4 Picks: 10x
- 5 Picks: 20x
- 6 Picks: 40x
- 7 Picks: 75x
- 8 Picks: 150x

## Removed Features
- ❌ Firebase integration
- ❌ Admin panel
- ❌ Authentication system
- ❌ Phone number collection
- ❌ SMS confirmation option
- ❌ Real-time spread updates

## Environment Variables
You can override defaults using these environment variables:
- `REACT_APP_VENMO_USERNAME` (default: EGTSports)
- `REACT_APP_MIN_BET` (default: 5)
- `REACT_APP_MAX_BET` (default: 100)
- `REACT_APP_GOOGLE_SHEET_URL` (default: specified URL)

## Development

### Install Dependencies
```bash
npm install
```

### Start Development Server
```bash
npm start
```

### Run Tests
```bash
npm test
```

### Build for Production
```bash
npm run build
```

## Testing
The app includes 6 comprehensive tests:
1. Loading state rendering
2. Header rendering
3. Tagline rendering
4. Payout odds display
5. Rules display
6. Submit button initial state

All tests use mocked fetch to avoid actual API calls.

## Security
- CodeQL security scan: 0 vulnerabilities
- No credentials stored in code
- All sensitive configuration via environment variables
- Input validation on all form fields

## Browser Compatibility
Works in all modern browsers that support:
- ES6+ JavaScript
- CSS Grid
- Fetch API
- React 19.2.0

## Mobile Responsive
The app is fully responsive and works on:
- Desktop (1000px+ width)
- Tablets (768px-1000px)
- Mobile phones (<768px)

## Notes
- The ESPN API provides game data but may not include spreads/totals for all games
- Spreads and totals can be manually updated if needed
- The app refreshes game data every 5 minutes
- Venmo link opens in mobile app if available, otherwise opens web version
