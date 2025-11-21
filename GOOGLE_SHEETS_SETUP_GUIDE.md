# Google Sheets Setup Guide for EGT Sports Betting App

This guide will walk you through setting up a Google Sheet to receive betting submissions from the EGT Sports app when users click "Send Me My Confirmation Ticket".

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Step 1: Create a New Google Sheet](#step-1-create-a-new-google-sheet)
3. [Step 2: Add the App Script Code](#step-2-add-the-app-script-code)
4. [Step 3: Deploy the Web App](#step-3-deploy-the-web-app)
5. [Step 4: Update Your Application Environment Variables](#step-4-update-your-application-environment-variables)
6. [Step 5: Test the Integration](#step-5-test-the-integration)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- A Google account
- Access to Google Sheets and Google Apps Script
- The Google Apps Script code from the original problem statement

---

## Step 1: Create a New Google Sheet

1. **Go to Google Sheets**
   - Navigate to [https://sheets.google.com](https://sheets.google.com)
   - Sign in with your Google account

2. **Create a New Spreadsheet**
   - Click the **"+ Blank"** button to create a new spreadsheet
   - Name your spreadsheet (e.g., "EGT Sports Betting Submissions")

3. **Important**: The script will automatically create two sheets when it receives data:
   - **"Single Bets"** - for straight/single bet submissions
   - **"Parlay Bets"** - for parlay bet submissions

   You don't need to create these sheets manually; the script handles this automatically.

---

## Step 2: Add the App Script Code

1. **Open the Script Editor**
   - In your Google Sheet, click **Extensions** → **Apps Script**
   - This will open a new tab with the Apps Script editor

2. **Replace the Default Code**
   - Delete any existing code in the editor (usually a placeholder `myFunction()`)
   - Copy the entire Google Apps Script code from the problem statement
   - Paste it into the editor

3. **Save the Script**
   - Click the **Save** icon (💾) or press `Ctrl+S` (Windows) / `Cmd+S` (Mac)
   - Name your project (e.g., "EGT Sports Bet Handler")

### Complete App Script Code

Here's the complete code to paste into the Apps Script editor:

```javascript
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    // Check if this is a status update
    if (data.type === 'status_update') {
      updateSubmissionStatus(spreadsheet, data);
      return ContentService.createTextOutput(JSON.stringify({success: true}));
    }
    
    // Otherwise, it's a new submission
    addNewSubmission(spreadsheet, data);
    return ContentService.createTextOutput(JSON.stringify({success: true}));
    
  } catch (error) {
    Logger.log('Error: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false, 
      error: error.toString()
    }));
  }
}

function addNewSubmission(spreadsheet, data) {
  // Determine which sheet to use based on bet type
  const betType = data.betType || 'parlay';
  let sheet;
  
  if (betType === 'straight') {
    // Single bets go to "Single Bets" sheet
    sheet = spreadsheet.getSheetByName('Single Bets');
    if (!sheet) {
      sheet = spreadsheet.insertSheet('Single Bets');
    }
    addSingleBet(sheet, data);
  } else {
    // Parlay bets go to "Parlay Bets" sheet
    sheet = spreadsheet.getSheetByName('Parlay Bets');
    if (!sheet) {
      sheet = spreadsheet.insertSheet('Parlay Bets');
    }
    addParlayBet(sheet, data);
  }
}

function addSingleBet(sheet, data) {
  // Add headers if this is the first submission
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Ticket Number',
      'Timestamp',
      'User Name',
      'User Email',
      'Pick Type',        // winner/spread/total
      'Game',
      'Selection',        // Team name or Over/Under
      'Odds',
      'Bet Amount',
      'Potential Payout',
      'Status',           // Pending/Won/Lost
      'Result',           // Actual result
      'Finalized At'
    ]);
    
    // Format header row
    const headerRange = sheet.getRange(1, 1, 1, 13);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#4285f4');
    headerRange.setFontColor('white');
  }
  
  // For single bets, add one row per pick
  data.picks.forEach(pick => {
    let pickType, selection, odds;
    
    if (pick.pickType === 'winner') {
      pickType = 'Moneyline';
      selection = pick.team;
      odds = pick.odds || 'N/A';
    } else if (pick.pickType === 'spread') {
      pickType = 'Spread';
      selection = `${pick.team} ${pick.spread}`;
      odds = pick.odds || '-110';
    } else if (pick.pickType === 'total') {
      pickType = 'Total';
      selection = `${pick.overUnder.toUpperCase()} ${pick.total}`;
      odds = pick.odds || '-110';
    }
    
    const betAmount = pick.betAmount || 0;
    const potentialPayout = calculatePayout(betAmount, odds);
    
    sheet.appendRow([
      data.ticketNumber,
      new Date(data.timestamp),
      data.contactInfo.name,
      data.contactInfo.email,
      pickType,
      pick.gameName || pick.game || 'N/A',
      selection,
      odds,
      betAmount,
      potentialPayout,
      'Pending',
      '',
      ''
    ]);
  });
  
  // Auto-resize columns
  sheet.autoResizeColumns(1, 13);
  
  Logger.log('Single bet(s) added: ' + data.ticketNumber);
}

function addParlayBet(sheet, data) {
  // Add headers if this is the first submission
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Ticket Number',
      'Timestamp',
      'User Name',
      'User Email',
      'Number of Picks',
      'Picks Details',
      'Bet Amount',
      'Multiplier',
      'Potential Payout',
      'Status',           // Pending/Won/Lost
      'Wins',
      'Losses',
      'Actual Payout',
      'Finalized At'
    ]);
    
    // Format header row
    const headerRange = sheet.getRange(1, 1, 1, 14);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#4285f4');
    headerRange.setFontColor('white');
  }
  
  // Format picks for display
  const picksText = data.picks.map(pick => {
    if (pick.pickType === 'winner') {
      return `${pick.team} ML (${pick.gameName})`;
    } else if (pick.pickType === 'spread') {
      return `${pick.team} ${pick.spread} (${pick.gameName})`;
    } else {
      return `${pick.overUnder.toUpperCase()} ${pick.total} (${pick.gameName})`;
    }
  }).join('\n');
  
  // Calculate multiplier based on picks
  const multiplier = getParlayMultiplier(data.picks.length);
  
  // Add the new parlay submission
  sheet.appendRow([
    data.ticketNumber,
    new Date(data.timestamp),
    data.contactInfo.name,
    data.contactInfo.email,
    data.picks.length,
    picksText,
    data.betAmount,
    multiplier,
    data.potentialPayout || (data.betAmount * multiplier),
    'Pending',
    0,
    0,
    0,
    ''
  ]);
  
  // Auto-resize columns
  sheet.autoResizeColumns(1, 14);
  
  Logger.log('Parlay bet added: ' + data.ticketNumber);
}

function updateSubmissionStatus(spreadsheet, data) {
  const ticketNumber = data.ticketNumber;
  const betType = data.betType || 'parlay';
  
  let sheet;
  if (betType === 'straight') {
    sheet = spreadsheet.getSheetByName('Single Bets');
  } else {
    sheet = spreadsheet.getSheetByName('Parlay Bets');
  }
  
  if (!sheet) {
    Logger.log('Sheet not found for bet type: ' + betType);
    return;
  }
  
  const numRows = sheet.getLastRow();
  
  // Find and update rows with this ticket number
  for (let i = 2; i <= numRows; i++) {
    const cellValue = sheet.getRange(i, 1).getValue();
    if (cellValue === ticketNumber) {
      
      if (betType === 'straight') {
        // Update single bet row
        const statusCol = 11; // Status column for single bets
        const finalizedCol = 13;
        
        sheet.getRange(i, statusCol).setValue(data.status);
        sheet.getRange(i, finalizedCol).setValue(new Date(data.finalizedAt));
        
        // Color code the row
        const rowRange = sheet.getRange(i, 1, 1, 13);
        if (data.status === 'won') {
          rowRange.setBackground('#d4edda');
          sheet.getRange(i, statusCol).setFontColor('#155724');
          sheet.getRange(i, statusCol).setFontWeight('bold');
        } else if (data.status === 'lost') {
          rowRange.setBackground('#f8d7da');
          sheet.getRange(i, statusCol).setFontColor('#721c24');
          sheet.getRange(i, statusCol).setFontWeight('bold');
        }
        
      } else {
        // Update parlay bet row
        sheet.getRange(i, 10).setValue(data.status);        // Status
        sheet.getRange(i, 11).setValue(data.wins);          // Wins
        sheet.getRange(i, 12).setValue(data.losses);        // Losses
        sheet.getRange(i, 13).setValue(data.payout);        // Actual Payout
        sheet.getRange(i, 14).setValue(new Date(data.finalizedAt));
        
        // Color code the row
        const rowRange = sheet.getRange(i, 1, 1, 14);
        if (data.status === 'won') {
          rowRange.setBackground('#d4edda');
          sheet.getRange(i, 10).setFontColor('#155724');
          sheet.getRange(i, 10).setFontWeight('bold');
          sheet.getRange(i, 13).setFontWeight('bold');
          sheet.getRange(i, 13).setFontColor('#155724');
        } else if (data.status === 'lost') {
          rowRange.setBackground('#f8d7da');
          sheet.getRange(i, 10).setFontColor('#721c24');
          sheet.getRange(i, 10).setFontWeight('bold');
        }
      }
      
      Logger.log('Updated status for ticket: ' + ticketNumber + ' - ' + data.status);
    }
  }
}

// Helper function to calculate payout from American odds
function calculatePayout(stake, odds) {
  if (!stake || !odds) return 0;
  
  const numOdds = parseInt(odds);
  let winnings;
  
  if (numOdds > 0) {
    winnings = (stake * numOdds) / 100;
  } else {
    winnings = (stake * 100) / Math.abs(numOdds);
  }
  
  return stake + winnings; // Return total payout (stake + winnings)
}

// Helper function for parlay multipliers
function getParlayMultiplier(picks) {
  const multipliers = {
    3: 8, 4: 15, 5: 25, 6: 50, 7: 100, 8: 150, 9: 200, 10: 250
  };
  return multipliers[picks] || 0;
}

function doGet(e) {
  return ContentService.createTextOutput('Google Apps Script is running!');
}

// Test function for single bets
function testAddSingleBet() {
  const testData = {
    ticketNumber: 'TEST-SINGLE-' + Date.now(),
    timestamp: new Date().toISOString(),
    contactInfo: {
      name: 'Test User',
      email: 'test@example.com'
    },
    betType: 'straight',
    picks: [
      {
        pickType: 'spread',
        team: 'Patriots',
        spread: '-3.5',
        gameName: 'Patriots @ Bills',
        odds: '-110',
        betAmount: 25
      },
      {
        pickType: 'total',
        overUnder: 'over',
        total: '42.5',
        gameName: 'Cowboys @ Giants',
        odds: '-110',
        betAmount: 50
      }
    ]
  };
  
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  addNewSubmission(spreadsheet, testData);
  Logger.log('Test single bet added!');
}

// Test function for parlay bets
function testAddParlayBet() {
  const testData = {
    ticketNumber: 'TEST-PARLAY-' + Date.now(),
    timestamp: new Date().toISOString(),
    contactInfo: {
      name: 'Test User',
      email: 'test@example.com'
    },
    betType: 'parlay',
    betAmount: 25,
    potentialPayout: 200,
    picks: [
      {
        pickType: 'spread',
        team: 'Patriots',
        spread: '-3.5',
        gameName: 'Patriots @ Bills'
      },
      {
        pickType: 'total',
        overUnder: 'over',
        total: '42.5',
        gameName: 'Cowboys @ Giants'
      },
      {
        pickType: 'winner',
        team: 'Chiefs',
        gameName: 'Chiefs @ Broncos'
      }
    ]
  };
  
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  addNewSubmission(spreadsheet, testData);
  Logger.log('Test parlay bet added!');
}
```

---

## Step 3: Deploy the Web App

1. **Click Deploy**
   - In the Apps Script editor, click the **Deploy** button (top right)
   - Select **New deployment**

2. **Configure the Deployment**
   - Click the gear icon (⚙️) next to "Select type"
   - Choose **Web app**

3. **Set Deployment Settings**
   - **Description**: Enter a description (e.g., "EGT Sports Betting Webhook v1")
   - **Execute as**: Select **Me** (your email address)
   - **Who has access**: Select **Anyone** (important: this allows the app to send data)

4. **Authorize the Script**
   - Click **Deploy**
   - You'll be prompted to authorize the script
   - Click **Review Permissions**
   - Choose your Google account
   - Click **Advanced** → **Go to [Your Project Name] (unsafe)**
   - Click **Allow**

5. **Copy the Web App URL**
   - After deployment, you'll see a **Web app URL**
   - **IMPORTANT**: Copy this URL - you'll need it for Step 4
   - The URL will look like: `https://script.google.com/macros/s/AKfycby.../exec`
   - Click **Done**

---

## Step 4: Update Your Application Environment Variables

1. **Locate Your Environment File**
   - In your EGT Sports repository, find the `.env` file (or `.env.local`)
   - If it doesn't exist, create one based on `.env.example`

2. **Update the Google Sheet URL**
   - Add or update this line in your `.env` file:
   ```
   REACT_APP_GOOGLE_SHEET_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
   ```
   - Replace `YOUR_DEPLOYMENT_ID` with the actual URL you copied in Step 3

3. **Example `.env` File**
   ```env
   REACT_APP_FIREBASE_API_KEY=your_firebase_key
   REACT_APP_FIREBASE_AUTH_DOMAIN=your_domain
   REACT_APP_FIREBASE_DATABASE_URL=your_database_url
   REACT_APP_FIREBASE_PROJECT_ID=your_project_id
   REACT_APP_FIREBASE_STORAGE_BUCKET=your_bucket
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   REACT_APP_FIREBASE_APP_ID=your_app_id
   REACT_APP_MIN_BET=5
   REACT_APP_MAX_BET=100
   REACT_APP_GOOGLE_SHEET_URL=https://script.google.com/macros/s/AKfycby.../exec
   ```

4. **Restart Your Application**
   - Stop your development server (if running)
   - Run `npm start` to restart with the new environment variable

---

## Step 5: Test the Integration

### Option A: Use the Test Functions in Apps Script

1. **Test Single Bet**
   - In the Apps Script editor, select `testAddSingleBet` from the function dropdown (top toolbar)
   - Click the **Run** button (▶️)
   - Check your Google Sheet - you should see a new row in the "Single Bets" sheet

2. **Test Parlay Bet**
   - Select `testAddParlayBet` from the function dropdown
   - Click **Run**
   - Check the "Parlay Bets" sheet for the new entry

### Option B: Test from Your Application

1. **Submit a Test Bet**
   - Run your application (`npm start`)
   - Navigate to the betting interface
   - Select a few picks
   - Enter test contact information
   - Click "Send Me My Confirmation Ticket"

2. **Verify in Google Sheets**
   - Go to your Google Sheet
   - Check the appropriate sheet (Single Bets or Parlay Bets)
   - You should see your submission with:
     - Ticket number
     - Timestamp
     - Contact information
     - Pick details
     - Status (Pending)

### What to Expect

**For Single Bets**, you'll see rows like:
| Ticket Number | Timestamp | User Name | User Email | Pick Type | Game | Selection | Odds | Bet Amount | Potential Payout | Status | Result | Finalized At |
|---------------|-----------|-----------|------------|-----------|------|-----------|------|------------|------------------|--------|--------|--------------|
| TKT-ABC123 | 11/21/2025 10:30 | John Doe | john@example.com | Spread | Patriots @ Bills | Patriots -3.5 | -110 | $25.00 | $47.73 | Pending | | |

**For Parlay Bets**, you'll see rows like:
| Ticket Number | Timestamp | User Name | User Email | Number of Picks | Picks Details | Bet Amount | Multiplier | Potential Payout | Status | Wins | Losses | Actual Payout | Finalized At |
|---------------|-----------|-----------|------------|-----------------|---------------|------------|------------|------------------|--------|------|--------|---------------|--------------|
| TKT-XYZ789 | 11/21/2025 10:35 | Jane Smith | jane@example.com | 3 | Patriots -3.5 (Patriots @ Bills)<br>OVER 42.5 (Cowboys @ Giants)<br>Chiefs ML (Chiefs @ Broncos) | $25.00 | 8 | $200.00 | Pending | 0 | 0 | $0.00 | |

---

## Troubleshooting

### Issue: Submissions Not Appearing in Sheet

**Possible Causes:**
1. **Wrong URL**: Double-check that the `REACT_APP_GOOGLE_SHEET_URL` matches your deployment URL
2. **Permissions**: Make sure the web app is set to "Anyone" can access
3. **CORS Issues**: The app uses `mode: 'no-cors'` which is correct for Google Apps Script

**Solutions:**
- Check browser console for errors
- Verify the URL in your `.env` file
- Redeploy the web app with correct permissions

### Issue: "Script Error" or "Authorization Required"

**Cause**: The script hasn't been properly authorized

**Solution:**
1. Go back to Apps Script editor
2. Click Deploy → Manage deployments
3. Click the pencil icon (✏️) to edit
4. Ensure "Execute as" is set to "Me"
5. Ensure "Who has access" is set to "Anyone"
6. Click **Deploy**

### Issue: Data Format Errors

**Cause**: The app might be sending data in an unexpected format

**Solution:**
1. Check the Apps Script logs:
   - In Apps Script editor, click **View** → **Logs** or **Execution log**
2. Look for error messages that indicate what data is missing
3. Verify that your App.js changes are deployed

### Issue: Test Functions Not Working

**Cause**: Sheet might not exist or have wrong name

**Solution:**
1. The test functions will automatically create the sheets
2. Make sure you've saved the script after pasting the code
3. Check the execution log for specific errors

### Issue: Environment Variable Not Loading

**Cause**: React doesn't hot-reload environment variables

**Solution:**
1. Stop your development server (Ctrl+C)
2. Run `npm start` again
3. Verify the URL is being loaded: check `console.log(process.env.REACT_APP_GOOGLE_SHEET_URL)` in your code

---

## Additional Tips

### Viewing Script Execution Logs

- In Apps Script, click **View** → **Logs** to see execution details
- This helps debug issues with data processing

### Updating the Script

If you need to make changes:
1. Edit the code in Apps Script editor
2. Click **Save**
3. Click **Deploy** → **Manage deployments**
4. Click the edit icon (✏️) on your deployment
5. Change **Version** to "New version"
6. Click **Deploy**

The URL stays the same, so you don't need to update your `.env` file.

### Managing Multiple Environments

For production vs development:
- Create separate Google Sheets for each environment
- Deploy separate web apps from each sheet
- Use different environment variables:
  - `.env.development` for `npm start`
  - `.env.production` for `npm run build`

### Security Considerations

⚠️ **Important**: The web app URL should be treated as sensitive:
- Don't commit it to public repositories
- Use environment variables (as shown above)
- Keep your `.env` file in `.gitignore`

### Sheet Organization

The script automatically:
- Creates sheets on first submission
- Formats headers with blue background
- Auto-resizes columns for readability
- Color-codes won (green) and lost (red) bets

---

## Summary Checklist

- [ ] Created a new Google Sheet
- [ ] Added the Apps Script code
- [ ] Deployed the web app with "Anyone" access
- [ ] Copied the web app URL
- [ ] Updated `.env` with `REACT_APP_GOOGLE_SHEET_URL`
- [ ] Restarted the development server
- [ ] Tested with test functions or real submission
- [ ] Verified data appears correctly in sheets

---

## Need Help?

If you encounter issues not covered here:
1. Check the Apps Script execution logs
2. Check your browser's developer console
3. Verify the data format matches the expected structure (see PR description)
4. Ensure you're using the latest code changes from the PR

**Common Data Fields the Script Expects:**
- `betType`: 'straight' or 'parlay'
- `ticketNumber`: Unique ticket identifier
- `timestamp`: ISO format date string
- `contactInfo`: Object with `name` and `email`
- `picks`: Array of pick objects with:
  - `pickType`: 'winner', 'spread', or 'total'
  - `team`, `spread`, `odds`, `game/gameName` (as applicable)
  - `betAmount` (for straight bets only)

These fields are now being sent correctly after the PR changes!
