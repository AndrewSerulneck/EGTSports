# Manual Testing Checklist

This document provides a comprehensive checklist for manually testing the implemented RBAC and admin dashboard improvements.

## Prerequisites

Before testing, ensure you have:
- [ ] Admin account credentials
- [ ] Member account credentials
- [ ] Access to Firebase Console
- [ ] Test environment or staging server

---

## Test Suite 1: Role-Based Access Control (RBAC)

### Test 1.1: Admin Login with Admin Account ✅ Expected: Success
**Steps:**
1. Navigate to the application
2. Click "Admin Login" button
3. Enter admin email and password
4. Click "Login"

**Expected Result:**
- Login succeeds
- User is redirected to Admin Dashboard
- Admin Dashboard shows:
  - "Manage Users" button
  - "View Submissions" button
  - "Sign Out" button
  - Six sport league buttons (NFL, NBA, CFB, CBB, MLB, NHL)

---

### Test 1.2: Member Login with Member Account ✅ Expected: Success
**Steps:**
1. Navigate to the application
2. Click "Member Login" button
3. Enter member email and password
4. Click "Login"

**Expected Result:**
- Login succeeds
- User is redirected to Member Dashboard
- Sports menu is displayed
- Betting interface is available

---

### Test 1.3: Admin Account via Member Login ❌ Expected: Failure
**Steps:**
1. Navigate to the application
2. Click "Member Login" button
3. Enter **admin** email and password
4. Click "Login"

**Expected Result:**
- Login attempt fails
- User is signed out automatically
- Error message displayed: "Access Denied: Please use the appropriate login method for your account type."
- User remains on login screen

---

### Test 1.4: Member Account via Admin Login ❌ Expected: Failure
**Steps:**
1. Navigate to the application
2. Click "Admin Login" button
3. Enter **member** email and password
4. Click "Login"

**Expected Result:**
- Login attempt fails
- User is signed out automatically
- Error message displayed: "Access Denied: You do not have administrator privileges."
- User remains on login screen

---

### Test 1.5: Invalid Credentials
**Steps:**
1. Navigate to the application
2. Click either login button
3. Enter invalid credentials
4. Click "Login"

**Expected Result:**
- Error message: "Login failed: [Firebase error message]"
- User remains on login screen

---

## Test Suite 2: Admin Dashboard Navigation

### Test 2.1: Admin Dashboard Landing Page
**Steps:**
1. Login as admin (via Admin Login)

**Expected Result:**
- Main Admin Dashboard page loads
- NOT redirected to any specific sport page
- All admin action buttons visible
- All sport league buttons visible

---

### Test 2.2: League Routing - NFL
**Steps:**
1. Login as admin
2. Click "NFL" button

**Expected Result:**
- Redirected to NFL admin management page
- NFL game schedules displayed
- Odds editing interface shown
- "Back to Admin Menu" button visible

---

### Test 2.3: League Routing - NBA
**Steps:**
1. Login as admin
2. Click "NBA" button

**Expected Result:**
- Redirected to NBA admin management page
- NBA game schedules displayed
- NOT redirected to NFL page

---

### Test 2.4: League Routing - All Sports
**Repeat Test 2.3 for:**
- [ ] College Football
- [ ] College Basketball
- [ ] Major League Baseball
- [ ] NHL

**Expected Result for Each:**
- Correct sport page loads
- Games for that sport are displayed
- No cross-contamination with other sports

---

### Test 2.5: Back Navigation
**Steps:**
1. Login as admin
2. Click any sport button
3. Click "← Back to Admin Menu"

**Expected Result:**
- Returns to main Admin Dashboard
- All buttons still functional

---

## Test Suite 3: Centralized Submissions View

### Test 3.1: Access Submissions View
**Steps:**
1. Login as admin
2. Click "View Submissions" button

**Expected Result:**
- Centralized submissions page loads
- Header shows "📋 All Submissions (X)" where X is the count
- "← Back to Dashboard" button visible
- All submissions from all sports displayed in one list

---

### Test 3.2: Submission Details Display
**Prerequisites:** At least one submission exists in the system

**Steps:**
1. Access submissions view
2. Locate a submission entry

**Expected Result for Each Submission:**
- Ticket number displayed prominently
- Timestamp shown
- Sport and bet type labeled
- User information (name, email) visible
- Bet amount and potential payout shown
- Win/loss record displayed
- All picks listed with details

---

### Test 3.3: Cross-Sport Submissions
**Prerequisites:** Create a cross-sport parlay with picks from different leagues

**Steps:**
1. As member, create a parlay with picks from NFL and NBA
2. Submit the parlay
3. Login as admin
4. View submissions

**Expected Result:**
- Cross-sport parlay appears in submissions list
- Sport shows as "Multi-Sport"
- All picks from different sports are visible
- Each pick shows correct sport label

---

### Test 3.4: Submission Status - Pending
**Prerequisites:** Submission with games not yet completed

**Steps:**
1. View submissions as admin
2. Find submission with pending games

**Expected Result:**
- Record shows wins, losses, and pending count
- "(X pending)" displayed
- No final status badge shown

---

### Test 3.5: Submission Status - Won
**Prerequisites:** Submission where all picks won

**Steps:**
1. View submissions as admin
2. Find completed winning submission

**Expected Result:**
- Green "WON" badge displayed
- "✅ ALL PICKS WON" message shown
- Payout amount calculated and displayed
- Green highlighting indicates win

---

### Test 3.6: Submission Status - Lost
**Prerequisites:** Submission where at least one pick lost

**Steps:**
1. View submissions as admin
2. Find completed losing submission

**Expected Result:**
- Red "LOST" badge displayed
- "❌ SOME PICKS LOST" message shown
- No payout amount shown
- Red highlighting indicates loss

---

## Test Suite 4: User Data Persistence

### Test 4.1: Create New User
**Steps:**
1. Login as admin
2. Click "Manage Users"
3. Fill in new user form:
   - Display Name: "Test User"
   - Email: "testuser@example.com"
   - Password: "password123"
   - Credit Limit: 100
4. Click "➕ Create User"

**Expected Result:**
- Success message: "User Test User created successfully!"
- New user appears in Registered Users list
- User count increments
- Form is reset

---

### Test 4.2: Verify User in Firebase
**Steps:**
1. After creating user, open Firebase Console
2. Navigate to Authentication
3. Navigate to Realtime Database

**Expected Result in Authentication:**
- User exists with correct email

**Expected Result in Database:**
- User record exists at `users/{uid}`
- Fields present:
  - `email`: testuser@example.com
  - `displayName`: Test User
  - `creditLimit`: 100
  - `currentCredit`: 0
  - `role`: "user"
  - `createdAt`: ISO timestamp
  - `createdBy`: Admin's UID

---

### Test 4.3: User List Updates
**Steps:**
1. Login as admin
2. Open "Manage Users" in browser tab 1
3. In browser tab 2, login as same admin
4. Open "Manage Users" in tab 2
5. Create a user in tab 2

**Expected Result:**
- New user appears in BOTH tabs without refresh
- Count updates in both tabs
- Real-time synchronization works

---

### Test 4.4: Update User Credit
**Steps:**
1. Login as admin
2. Click "Manage Users"
3. Find a user
4. Click "💰 Update Credit"
5. Enter new credit amount
6. Click OK

**Expected Result:**
- Success message appears
- Credit amount updates in the list
- Change persists after page refresh

---

### Test 4.5: Delete User
**Steps:**
1. Login as admin
2. Click "Manage Users"
3. Find a test user
4. Click "🗑️ Delete"
5. Confirm deletion

**Expected Result:**
- Confirmation dialog appears
- After confirmation, success message appears
- User removed from list
- User count decrements

---

## Test Suite 5: Data Synchronization

### Test 5.1: Odds Sync Admin to Member
**Steps:**
1. Login as admin in browser tab 1
2. Login as member in browser tab 2
3. In admin tab, select NFL
4. Update spread for a game
5. Click "Save & Broadcast to All Devices"
6. Check member tab

**Expected Result:**
- Member view updates with new odds
- No page refresh needed
- Updates appear within 1-2 seconds

---

### Test 5.2: Multiple Admin Sync
**Steps:**
1. Login as admin in two different browsers
2. In browser 1, select NBA
3. Update odds for a game
4. Save changes
5. Check browser 2

**Expected Result:**
- Browser 2 reflects the changes
- Real-time synchronization works
- No conflicts or data loss

---

## Test Suite 6: Security & Error Handling

### Test 6.1: Invalid Score Data
**Steps:**
1. Ensure a game in Firebase has invalid score data (null, undefined, or non-numeric)
2. Login as admin
3. View submissions with picks on that game

**Expected Result:**
- No application crash
- Score treated as 0 (fallback value)
- Submission displays correctly
- No console errors

---

### Test 6.2: Session Timeout
**Steps:**
1. Login as admin
2. Wait for Firebase session to expire (or manually invalidate token)
3. Attempt to perform admin action

**Expected Result:**
- User is signed out
- Redirected to login page
- Appropriate error message

---

### Test 6.3: Direct URL Access
**Steps:**
1. Without logging in, directly access admin URLs:
   - `/#/admin`
   - `/#/admin/nfl`
   - `/#/admin/users`

**Expected Result:**
- User is not authenticated
- Redirected to landing page
- No unauthorized access

---

## Test Suite 7: Regression Testing

### Test 7.1: Member Functionality Unchanged
**Steps:**
1. Login as member
2. Test all member features:
   - [ ] View games
   - [ ] Select picks
   - [ ] Create parlay
   - [ ] Submit bet
   - [ ] Receive confirmation

**Expected Result:**
- All member features work as before
- No breaking changes
- User experience unchanged

---

### Test 7.2: Existing Submissions Readable
**Steps:**
1. Verify there are submissions created before the update
2. Login as admin
3. View submissions

**Expected Result:**
- Old submissions display correctly
- All data intact
- Status calculations work
- No data corruption

---

## Test Suite 8: Cross-Browser Testing

**Browsers to Test:**
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

**For Each Browser:**
1. Test admin login flow
2. Test member login flow
3. Test RBAC enforcement
4. Test submissions view
5. Verify UI renders correctly

---

## Test Suite 9: Performance Testing

### Test 9.1: Large Submission List
**Prerequisites:** System has 50+ submissions

**Steps:**
1. Login as admin
2. Click "View Submissions"
3. Scroll through list

**Expected Result:**
- Page loads within 3 seconds
- Smooth scrolling
- No lag or freezing
- All submissions render correctly

---

### Test 9.2: Multiple Sports Data Load
**Steps:**
1. Login as admin
2. Navigate through all 6 sport pages

**Expected Result:**
- Each sport page loads within 5 seconds
- No memory leaks
- Browser remains responsive

---

## Test Summary Template

After completing all tests, fill in this summary:

```
Test Date: ______________
Tester: ______________
Environment: ______________

Test Results:
- Total Tests: 40+
- Passed: _____
- Failed: _____
- Blocked: _____

Critical Issues Found: _____
Minor Issues Found: _____

Overall Status: ☐ PASS ☐ FAIL ☐ NEEDS WORK

Notes:
_________________________________
_________________________________
_________________________________
```

---

## Known Issues & Limitations

Document any known issues or limitations discovered during testing:

1. 
2. 
3. 

---

## Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Developer | | | |
| Tester | | | |
| Product Owner | | | |
| Security Review | | | |

---

## Additional Notes

Use this section for any additional observations, suggestions, or concerns:
