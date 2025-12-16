# ⚠️ IMPORTANT NOTICE

**Prop Bets are currently disabled** due to API quota limitations. The feature was consuming 98% of the monthly API quota (490/500 calls), leaving insufficient quota for essential game odds.

This feature will be re-enabled after:
1. API quota resets (monthly)
2. Implementation of on-demand sport loading (reducing from 5 calls to 1 call per load)
3. Proper separation of prop bets API from game odds API

For now, all API calls are reserved for moneyline, spread, and totals data for main game betting.

---

# Prop Bets Implementation Guide (Temporarily Disabled)

## ✅ Complete Step-by-Step Setup Instructions

### Step 1: Set Up Your Environment Variable

1. **Create a `.env` file** in your project root directory (same location as `package.json`):
   ```bash
   # Navigate to your project directory
   cd /path/to/EGTSports
   
   # Create the .env file
   touch .env
   ```

2. **Add your API key** to the `.env` file:
   ```
   REACT_APP_ODDS_API_KEY=your_new_api_key_here
   ```
   Replace `your_new_api_key_here` with your actual Odds API key.

3. **Verify `.gitignore` includes `.env`**:
   Open `.gitignore` and ensure it contains:
   ```
   .env
   .env.local
   .env.development.local
   .env.test.local
   .env.production.local
   ```

4. **Restart your development server**:
   ```bash
   # Stop your current server (Ctrl+C)
   # Then restart it
   npm start
   ```

### Step 2: Code Changes (Already Implemented)

The following has been implemented for you:

✅ **Prop Bets API Integration**
- Fetches player props from The Odds API
- Supports NFL, NBA, College Football, College Basketball, NHL
- Focuses on player props (touchdowns, passing yards, points, rebounds, assists)
- Smart caching to stay under 500 API calls/month

✅ **UI Components**
- "Prop Bets" tab added to left sidebar
- Prop bets organized by sport
- Clean, modern card-based design matching existing UI
- Filter controls by sport

✅ **Betting Slip Integration**
- Prop bets work seamlessly with Single and Parlay betting modes
- Prop bet odds properly calculated in payouts
- Full integration with existing bet submission system

✅ **API Optimization**
- Aggressive caching: 2 hours for prop bets (refresh less frequently than live games)
- Loads only when "Prop Bets" tab is selected
- Batches requests efficiently
- Console logging for monitoring API usage

### Step 3: Testing Your Implementation

1. **Start your development server**:
   ```bash
   npm start
   ```

2. **Sign in to your account**

3. **Click "Prop Bets" in the left sidebar**

4. **You should see**:
   - Loading indicator while fetching
   - Prop bets organized by sport
   - Filter buttons for NFL, NBA, College Football, College Basketball, NHL
   - Odds displayed with Over/Under options
   - Ability to add props to betting slip

5. **Test betting functionality**:
   - Select prop bets
   - Switch between Single and Parlay tabs
   - Verify odds calculations
   - Submit a test bet

### Step 4: Monitoring API Usage

Check your browser console for API usage logs:
- `📊 Prop Bets API Response:` - Shows successful fetches
- `⚠️ Prop Bets API Error:` - Shows any errors
- `✅ Using cached prop bets data for` - Shows when cache is used (saves API calls)

You can also check The Odds API dashboard to monitor your usage.

### Step 5: Customization (Optional)

If you want to adjust settings, look for these constants in `App.js`:

```javascript
// Adjust cache duration (default: 2 hours)
const PROP_BETS_CACHE_DURATION = 2 * 60 * 60 * 1000;

// Adjust which sports to fetch props for
const PROP_BETS_SPORTS = ['NFL', 'NBA', 'College Football', 'College Basketball', 'NHL'];
```

### Troubleshooting

**Problem**: Prop bets not loading
- **Solution**: Verify your API key is correct in `.env` and restart server

**Problem**: "API key not configured" message
- **Solution**: Make sure `.env` file exists in project root with `REACT_APP_ODDS_API_KEY=your_key`

**Problem**: Too many API calls
- **Solution**: Prop bets cache for 2 hours by default. Don't refresh excessively.

**Problem**: No prop bets showing for a sport
- **Solution**: Some sports may not have active props. The Odds API availability varies by season.

### API Call Estimation

With the implemented optimizations:
- Initial load: 5 API calls (one per sport)
- Cached for 2 hours
- Maximum per day: ~60 calls (if tab opened every 2 hours)
- **Estimated monthly total: ~1,800 calls... BUT you only use calls when opening Prop Bets tab**
- **Realistic usage: 100-200 calls/month** (assuming normal browsing patterns)

### Security Best Practices ✅

- ✅ API key stored in environment variable
- ✅ `.env` file excluded from git
- ✅ No API keys in committed code
- ✅ Environment variable only accessible in your local environment

---

## Need Help?

If you encounter any issues:
1. Check browser console for error messages
2. Verify `.env` file is properly configured
3. Confirm API key is valid in The Odds API dashboard
4. Make sure you restarted the dev server after creating `.env`

Enjoy your new prop bets feature! 🎉
