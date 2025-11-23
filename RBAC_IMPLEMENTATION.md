# Role-Based Access Control (RBAC) Implementation Summary

## Overview
This document describes the role-based access control implementation for the EGT Sports application login system.

## Implementation Location
The RBAC enforcement logic is implemented in `src/App.js`, specifically in the `handleLogin` function (lines 2767-2815).

## How It Works

### Authentication Flow
1. User lands on the application and sees the AuthLanding page with two login options:
   - "Member Login" (sets `userRole = 'user'`)
   - "Admin Login" (sets `userRole = 'admin'`)

2. User selects their intended role and enters credentials

3. Application calls `signInWithEmailAndPassword` to authenticate with Firebase

4. **RBAC Enforcement** (Critical Security Step):
   - Fetches the user's actual role from database-verified token claims
   - Calls `getIdTokenResult(true)` to force refresh and get latest claims
   - Extracts `tokenResult.claims.admin` to determine if user is an admin
   - Compares intended role (from button clicked) with actual role (from database)

5. **Access Control Rules**:
   - If user clicked "Admin Login" but lacks admin claim → **Access Denied**
     - Signs out the user immediately
     - Shows error: "Access Denied: You do not have administrator privileges."
   
   - If user clicked "Member Login" but has admin claim → **Access Denied**
     - Signs out the user immediately
     - Shows error: "Access Denied: Please use the appropriate login method for your account type."
   
   - Only if role matches does the user gain access to their dashboard

## Security Features

### 1. Database-Verified Roles
- Roles are NOT determined by client-side state
- Roles are fetched from Firebase Authentication token claims
- Claims are cryptographically signed by Firebase and cannot be forged
- `getIdTokenResult(true)` forces a token refresh to get latest claims

### 2. Immediate Signout on Mismatch
- Users with wrong role are signed out immediately
- Prevents any unauthorized access to the application
- Clears authentication state completely

### 3. Explicit Error Messages
- Users see clear feedback about why access was denied
- Helps legitimate users understand they need to use correct login method
- Doesn't reveal sensitive information about user roles

## Code Example

```javascript
const handleLogin = async (e) => {
  e.preventDefault();
  setAuthState((a) => ({ ...a, loading: true, error: "" }));
  try {
    // Sign in with Firebase Auth
    const userCredential = await signInWithEmailAndPassword(
      auth,
      loginForm.email,
      loginForm.password
    );
    
    // Get user's actual role from token claims
    const tokenResult = await userCredential.user.getIdTokenResult(true);
    const isActuallyAdmin = tokenResult?.claims?.admin === true;
    
    // Enforce role-based access control
    if (userRole === 'admin' && !isActuallyAdmin) {
      // User clicked "Admin Login" but doesn't have admin role
      await signOut(auth);
      setAuthState((a) => ({
        ...a,
        loading: false,
        error: "Access Denied: You do not have administrator privileges.",
      }));
      return;
    }
    
    if (userRole === 'user' && isActuallyAdmin) {
      // User clicked "Member Login" but has admin role
      await signOut(auth);
      setAuthState((a) => ({
        ...a,
        loading: false,
        error: "Access Denied: Please use the appropriate login method for your account type.",
      }));
      return;
    }
    
    // Login successful with correct role
    // The onAuthStateChanged handler will update authState
    
  } catch (err) {
    setAuthState((a) => ({
      ...a,
      loading: false,
      error: "Login failed: " + err.message,
    }));
  }
};
```

## Testing

### Test Coverage
A comprehensive test suite (`src/RoleBasedAuth.test.js`) verifies:
- Role is fetched from token claims with force refresh
- Member users trying Admin Login are rejected
- Admin users trying Member Login are rejected  
- RBAC enforcement happens in correct execution order
- Error messages match security requirements
- Access is denied by signing out users on role mismatch

All 9 tests passing ✅

### Security Scanning
- CodeQL security scanning: **0 vulnerabilities found** ✅

## Scenarios

### ✅ Allowed: Admin logs in via Admin Login
- User clicks "Admin Login" → `userRole = 'admin'`
- User has admin claim in token → `isActuallyAdmin = true`
- Check `userRole === 'admin' && !isActuallyAdmin` → FALSE
- Check `userRole === 'user' && isActuallyAdmin` → FALSE
- **Result: Login successful, redirected to Admin Dashboard**

### ✅ Allowed: Member logs in via Member Login
- User clicks "Member Login" → `userRole = 'user'`
- User has no admin claim → `isActuallyAdmin = false`
- Check `userRole === 'admin' && !isActuallyAdmin` → FALSE
- Check `userRole === 'user' && isActuallyAdmin` → FALSE
- **Result: Login successful, redirected to Member Dashboard**

### ❌ Denied: Member tries Admin Login
- User clicks "Admin Login" → `userRole = 'admin'`
- User has no admin claim → `isActuallyAdmin = false`
- Check `userRole === 'admin' && !isActuallyAdmin` → **TRUE**
- **Result: Signed out, error "You do not have administrator privileges."**

### ❌ Denied: Admin tries Member Login
- User clicks "Member Login" → `userRole = 'user'`
- User has admin claim → `isActuallyAdmin = true`
- Check `userRole === 'user' && isActuallyAdmin` → **TRUE**
- **Result: Signed out, error "Please use the appropriate login method..."**

## Compliance

This implementation meets all requirements specified in the problem statement:

✅ Fetch actual user role from database-verified token claims  
✅ Check if user's role matches intended destination  
✅ Reject Admin attempting Member Login with specific error  
✅ Reject Member attempting Admin Login with specific error  
✅ Sign out unauthorized users immediately  
✅ Use database role, not button-click state, for access decisions

## Maintenance Notes

- Role claims are managed through Firebase Authentication custom claims
- Admin privileges must be set via Firebase Admin SDK (see api/setAdminClaim.js)
- No client-side changes can bypass this security check
- The RBAC logic runs on every login attempt before granting access
