# Stripe + Authentication Implementation Guide

## Overview
This guide explains how to integrate the new authentication system and Stripe payment verification into your EGT Sports application.

## Files Created

1. **src/components/AuthLanding.js** - New landing page with role selection (User/Admin/Guest)
2. **src/components/UserManagement.js** - Admin panel for creating and managing user accounts
3. **src/services/stripe.js** - Stripe payment service integration
4. **. env.example** - Environment configuration template

## Implementation Steps

### Step 1: Install Required Dependencies

```bash
npm install @stripe/stripe-js
```

### Step 2: Set Up Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

**IMPORTANT:** Never commit your `.env` file to Git. It should already be in `.gitignore`.

### Step 3: Update App.js

The main App.js needs to be updated to support three user roles:

- **Guest**: Must pay via Venmo/Zelle before wager is accepted
- **User**: Can place wagers on credit (no immediate payment)
- **Admin**: Can manage users and verify guest payments

### Step 4: Backend API Setup

You need to create a backend API to handle Stripe operations. Here's what endpoints you need:

#### Required API Endpoints:

**1. Create Payment Intent**
- Endpoint: `POST /api/stripe/create-payment-intent`
- Purpose: Creates a pending payment record for guest wagers

**2. Check Payment Status**
- Endpoint: `POST /api/stripe/check-payment-status`
- Purpose: Checks if a payment has been verified

**3. Verify Payment (Manual)**
- Endpoint: `POST /api/stripe/verify-payment`
- Purpose: Allows admin to manually verify Venmo/Zelle payments

**4. Get Pending Payments**
- Endpoint: `GET /api/stripe/pending-payments`
- Purpose: Returns list of unverified payments for admin review

### Step 5: Firebase Database Structure

Update your Firebase Realtime Database with these new structures:

```json
{
  "users": {
    "USER_UID": {
      "email": "user@example.com",
      "displayName": "John Doe",
      "creditLimit": 100,
      "currentCredit": 0,
      "role": "user",
      "createdAt": "2025-11-02T00:00:00Z"
    }
  },
  "payments": {
    "TKT-XXXXX": {
      "ticketNumber": "TKT-XXXXX",
      "amount": 50,
      "status": "pending|verified|failed",
      "paymentMethod": "venmo|zelle",
      "createdAt": "2025-11-02T00:00:00Z",
      "verifiedAt": null,
      "verifiedBy": null
    }
  },
  "submissions": {
    "TKT-XXXXX": {
      "ticketNumber": "TKT-XXXXX",
      "userRole": "guest|user",
      "requiresPayment": true,
      "paymentVerified": false,
      ...
    }
  }
}
```

### Step 6: User Flow Diagrams

#### Guest Flow:
1. Select "Continue as Guest" on AuthLanding
2. Choose sport and make picks
3. Submit picks → Generate ticket number
4. Enter contact info and bet amount
5. **Payment Required**: Redirect to Venmo/Zelle
6. **Wait for payment verification** (admin manually verifies)
7. Once verified → Send confirmation email + Update Google Sheet

#### User Flow:
1. Login as User on AuthLanding
2. Choose sport and make picks
3. Submit picks → Generate ticket number
4. Enter contact info and bet amount
5. **No payment required** → Immediately process
6. Update user's credit balance
7. Send confirmation email + Update Google Sheet

#### Admin Flow:
1. Login as Admin
2. Access Admin Panel → User Management
3. Create new user accounts
4. View pending guest payments
5. Manually verify Venmo/Zelle payments
6. Manage user credit limits

## Key Features

### 1. Role-Based Access Control
- Guests: Must pay immediately
- Users: Credit-based system
- Admins: Full management access

### 2. Payment Verification System
- Guests submit payment info
- Admins receive notification of pending payments
- Admins manually verify Venmo/Zelle transactions
- System sends confirmation after verification

### 3. User Credit Management
- Admins set credit limits for users
- Track current credit usage
- Users can place wagers up to credit limit

## Security Considerations

1. **Never expose Stripe Secret Key in frontend**
   - Only use it in backend API
   - Store in secure environment variables

2. **Firebase Security Rules**
   - Users can only read their own data
   - Admins can read/write all data
   - Guests cannot access user database

3. **Payment Verification**
   - Always verify payments on backend
   - Don't trust frontend payment status
   - Log all payment attempts

## Testing Checklist

- [ ] Guest can select role and place wager
- [ ] Guest payment pending until admin verification
- [ ] User can login and place wager without payment
- [ ] Admin can create new user accounts
- [ ] Admin can verify guest payments
- [ ] Email confirmations sent correctly
- [ ] Google Sheets updated correctly
- [ ] Firebase data syncs properly

## Next Steps

1. Review and test all components
2. Set up backend API endpoints
3. Configure Firebase security rules
4. Test payment flows end-to-end
5. Deploy to production

## Support

If you encounter issues:
- Check browser console for errors
- Verify environment variables are set
- Ensure Firebase is configured correctly
- Test Stripe API keys are valid

---

**Note:** This implementation uses Stripe for payment tracking only, not actual payment processing. Venmo/Zelle payments are manual and require admin verification.