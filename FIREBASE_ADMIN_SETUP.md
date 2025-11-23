# Firebase Admin SDK Setup Guide

This guide explains how to configure the Firebase Admin SDK for the user creation API endpoint.

## Why This Is Needed

When an admin creates a new user using the Firebase client SDK (`createUserWithEmailAndPassword`), Firebase automatically logs in as that new user, which kicks out the admin. This is a known limitation of the Firebase client SDK.

The solution is to use the Firebase Admin SDK via a serverless function, which can create users without affecting the current session.

## Setup Instructions

### Step 1: Create a Service Account

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project (marcs-parlays)
3. Click the gear icon ⚙️ and select "Project Settings"
4. Go to the "Service Accounts" tab
5. Click "Generate New Private Key"
6. Save the downloaded JSON file securely (DO NOT commit to Git!)

### Step 2: Extract Required Values

From the downloaded JSON file, you'll need:
- `project_id`
- `client_email`
- `private_key`

### Step 3: Configure Environment Variables

#### For Vercel Deployment:

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add the following variables:

```
FIREBASE_PROJECT_ID=marcs-parlays
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@marcs-parlays.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nYour\nPrivate\nKey\nHere\n-----END PRIVATE KEY-----\n
FIREBASE_DATABASE_URL=https://marcs-parlays-default-rtdb.firebaseio.com
```

**Important:** 
- For `FIREBASE_PRIVATE_KEY`, copy the entire value including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
- Keep the `\n` characters in the key (they represent newlines)
- Make sure the private key is surrounded by quotes if it contains special characters

#### For Local Development:

Create a `.env.local` file in the root directory (already in .gitignore):

```env
FIREBASE_PROJECT_ID=marcs-parlays
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@marcs-parlays.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour\nPrivate\nKey\nHere\n-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL=https://marcs-parlays-default-rtdb.firebaseio.com
```

### Step 4: Set Admin Custom Claims

The API endpoint requires users to have the `admin` custom claim. To set this:

```javascript
// Run this in Firebase Console or a one-time setup script
const admin = require('firebase-admin');

// Initialize admin (use your service account)
admin.initializeApp();

// Set admin claim for a specific user
admin.auth().setCustomUserClaims('USER_UID_HERE', { admin: true })
  .then(() => {
    console.log('Admin claim set successfully');
  });
```

Or use the Firebase CLI:

```bash
firebase functions:shell
admin.auth().setCustomUserClaims('USER_UID_HERE', { admin: true })
```

### Step 5: Install API Dependencies

For local development:

```bash
cd api
npm install
```

For Vercel, this happens automatically during deployment.

### Step 6: Test the Setup

1. Log in as an admin
2. Go to "Manage Users"
3. Try creating a new user
4. The form should submit without hanging
5. The admin should remain logged in
6. The new user should appear in the user list

## Troubleshooting

### Error: "Unauthorized"
- Check that the admin user has the `admin` custom claim set
- Verify the ID token is being sent in the Authorization header

### Error: "FIREBASE_PRIVATE_KEY is not set"
- Make sure environment variables are configured in Vercel
- Check that the private key includes the BEGIN and END markers
- Ensure newlines are represented as `\n`

### Error: "Invalid service account"
- Verify the service account JSON is from the correct Firebase project
- Check that the client_email and private_key match

### Admin Gets Logged Out After Creating User
- This means the serverless function isn't working
- Check Vercel function logs for errors
- Verify environment variables are set correctly

## Security Notes

- Never commit the service account JSON file to Git
- Never share your private key publicly
- Rotate the service account key if it's ever exposed
- Use environment variables for all sensitive data
- The API endpoint verifies the admin claim before allowing user creation

## API Endpoint Details

**Endpoint:** `/api/createUser`

**Method:** POST

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <FIREBASE_ID_TOKEN>
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "displayName": "John Doe",
  "creditLimit": 100
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "User John Doe created successfully",
  "uid": "generated-user-id"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message"
}
```
