# GitHub Copilot Instructions for EGT Sports

## Project Overview

EGT Sports is a React-based sports betting application that provides users with real-time sports data, betting options, and payment tracking. The application supports multiple user roles (Guest, User, Admin) with different capabilities and payment requirements.

### Technology Stack

- **Frontend**: React 19.2.0 with Create React App
- **Database & Auth**: Firebase (Realtime Database & Authentication)
- **Payment Tracking**: Stripe (for tracking Venmo/Zelle payments)
- **Sports Data**: ESPN API for live scores and game data
- **Odds Data**: The Odds API for betting lines
- **Testing**: Jest with React Testing Library

## Development Guidelines

### Code Style & Standards

1. **React Patterns**
   - Use functional components with hooks (useState, useEffect, useCallback, useRef)
   - Follow existing naming conventions (camelCase for functions, PascalCase for components)
   - Keep components modular and reusable
   - Use proper prop types and validation

2. **State Management**
   - Use React hooks for local state management
   - Firebase Realtime Database for persistent data
   - Cache API responses to minimize unnecessary calls

3. **Naming Conventions**
   - Components: PascalCase (e.g., `AuthLanding`, `UserManagement`)
   - Functions: camelCase (e.g., `fetchGames`, `handleSubmit`)
   - Constants: UPPER_SNAKE_CASE (e.g., `ESPN_API_ENDPOINTS`, `CACHE_DURATION`)
   - Files: Match component name or use camelCase for services

### Building & Testing

**Build Commands:**
```bash
npm start      # Development server (http://localhost:3000)
npm test       # Run tests in watch mode
npm run build  # Production build
```

**Before Committing:**
1. Run tests: `npm test` (ensure all tests pass)
2. Build project: `npm run build` (verify no build errors)
3. Check for console errors in browser

**Testing Guidelines:**
- Write tests using React Testing Library
- Use `@testing-library/user-event` for user interactions
- Test user flows, not implementation details
- Mock Firebase and external APIs in tests
- Follow existing test patterns in `App.test.js`

## Architecture & Key Files

### Core Application Files

- **`src/App.js`**: Main application component with routing logic, Firebase initialization, and state management
- **`src/components/AuthLanding.js`**: Landing page with role selection (Guest, User, Admin)
- **`src/components/UserManagement.js`**: Admin panel for user account management
- **`src/services/stripe.js`**: Stripe payment service integration for tracking

### Configuration Files

- **`.env.example`**: Template for environment variables (copy to `.env` for local development)
- **`IMPLEMENTATION_GUIDE.md`**: Detailed implementation guide for authentication and payment features

### Important Constants

- `ESPN_API_ENDPOINTS`: Maps sport names to ESPN API URLs
- `ODDS_API_KEY`: API key for The Odds API (needs to be in environment variables in production)
- `CACHE_DURATION`: 5 minutes for most sports, 1 hour for College Basketball
- `REFRESH_INTERVAL_ACTIVE`: 2 minutes when games are live
- `REFRESH_INTERVAL_INACTIVE`: 30 minutes when no active games

## Security & Best Practices

### Environment Variables & Secrets

**CRITICAL**: Never commit sensitive data to the repository!

- Store API keys and Firebase config in `.env` file (already in `.gitignore`)
- Use `.env.example` as template but never include real values
- Firebase config should be in environment variables for production
- Stripe keys must never be exposed in frontend code (use backend API)

**Required Environment Variables:**
- Firebase configuration (apiKey, authDomain, databaseURL, projectId, etc.)
- Stripe publishable key (backend needs secret key)
- API keys should be in `.env` for local development

### API Usage & Rate Limiting

- **ESPN API**: Free but rate-limited, use caching extensively
- **The Odds API**: Limited quota (especially for College Basketball), cache for 1 hour
- Track API usage with `apiCallCount` object
- Implement exponential backoff for failed requests

### Firebase Security

1. **Authentication Rules**:
   - Guests: No authentication required, limited access
   - Users: Email/password authentication, credit-based system
   - Admins: Special privileges for user management

2. **Database Security Rules** (should be configured in Firebase Console):
   - Users can only read their own data
   - Admins have read/write access to all data
   - Guests cannot access user database
   - Payment verification only by admins

### Code Security Guidelines

1. **Input Validation**: Always validate and sanitize user input
2. **Payment Verification**: Never trust frontend for payment status, verify on backend
3. **Error Handling**: Don't expose sensitive error details to users
4. **Logging**: Log security events but avoid logging sensitive data

## User Roles & Workflows

### Guest User Flow
1. Select "Continue as Guest" on landing page
2. Choose bet type (Straight Bets or Parlays)
3. Select sport and make picks
4. Submit picks → Generate unique ticket number
5. Enter contact info and bet amount
6. **Payment Required**: Redirect to Venmo/Zelle with instructions
7. Wait for admin verification
8. Receive confirmation once payment verified

### Authenticated User Flow
1. Login with email/password
2. Choose bet type and sport
3. Make picks and submit
4. **No immediate payment**: Wager placed on credit
5. Credit balance updated automatically
6. Instant confirmation

### Admin Flow
1. Login as admin
2. Access User Management panel
3. Create/manage user accounts
4. View pending guest payments
5. Manually verify Venmo/Zelle payments
6. Manage user credit limits

## Common Tasks

### Adding a New Sport

1. Add ESPN API endpoint to `ESPN_API_ENDPOINTS` object
2. Add Odds API sport key to `ODDS_API_SPORT_KEYS` (if needed)
3. Update sport selection UI in `App.js`
4. Add appropriate caching strategy
5. Test data fetching and display
6. Update tests to include new sport

### Modifying Payment Flow

1. Check `services/stripe.js` for payment tracking logic
2. Update `AuthLanding.js` for guest payment flow
3. Modify `UserManagement.js` for admin payment verification
4. Update Firebase database structure if needed
5. Test entire payment verification workflow
6. Update `IMPLEMENTATION_GUIDE.md` with changes

### Adding New User Role

1. Update `AuthLanding.js` to add role selection
2. Modify authentication logic in `App.js`
3. Update Firebase security rules
4. Add role-specific UI components
5. Update `UserManagement.js` if role needs admin management
6. Write tests for new role workflows

## Troubleshooting

### Common Issues

1. **API Rate Limits**: Check `apiCallCount` object, increase cache duration
2. **Firebase Connection**: Verify `.env` has correct configuration
3. **Build Failures**: Check for missing dependencies, run `npm install`
4. **Test Failures**: Mock external APIs, check for async timing issues
5. **Payment Issues**: Verify Stripe configuration, check backend API status

### Debugging Tips

- Use browser console for frontend errors
- Check Network tab for API call failures
- Use React Developer Tools for component debugging
- Check Firebase Console for database/auth issues
- Review `apiCallCount` for API usage patterns

## Contributing Guidelines

When making changes to this repository:

1. **Minimal Changes**: Make the smallest possible changes to achieve the goal
2. **Test Coverage**: Add tests for new features or bug fixes
3. **Documentation**: Update relevant documentation (README, IMPLEMENTATION_GUIDE)
4. **Security**: Run security checks, never commit secrets
5. **Build Verification**: Ensure `npm run build` succeeds
6. **Code Review**: Follow existing patterns and conventions

## Additional Resources

- **React Documentation**: https://reactjs.org/
- **Firebase Documentation**: https://firebase.google.com/docs
- **React Testing Library**: https://testing-library.com/react
- **Create React App**: https://create-react-app.dev/
- **ESPN API**: Use public scoreboard endpoints (no auth required)
- **The Odds API**: https://the-odds-api.com/
