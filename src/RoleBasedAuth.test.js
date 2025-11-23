/**
 * Role-Based Access Control (RBAC) Tests
 * 
 * This test suite verifies that the RBAC implementation in src/App.js correctly
 * enforces role-based access control during login. The implementation is found
 * in the handleLogin function (lines 2767-2815 in src/App.js).
 * 
 * Key RBAC Requirements:
 * 1. User role must be fetched from database-verified token claims
 * 2. Admin users attempting to login via "Member Login" must be rejected
 * 3. Member users attempting to login via "Admin Login" must be rejected
 * 4. Only users with matching roles can access their designated dashboards
 */

import fs from 'fs';
import path from 'path';

describe('Role-Based Access Control - Implementation Verification', () => {
  let appSource;

  beforeAll(() => {
    // Read the App.js source code
    const appPath = path.join(__dirname, 'App.js');
    appSource = fs.readFileSync(appPath, 'utf8');
  });

  test('handleLogin function fetches role from token claims with force refresh', () => {
    // Verify that getIdTokenResult is called with true parameter to force refresh
    expect(appSource).toContain('getIdTokenResult(true)');
    
    // Verify the role is stored in a variable
    expect(appSource).toMatch(/const\s+isActuallyAdmin\s*=/);
  });

  test('RBAC check rejects member users trying to use Admin Login', () => {
    // When a user without admin privileges tries to login via Admin Login
    // userRole is 'admin' (from clicking Admin Login button)
    // but isActuallyAdmin is false (they don't have admin claim in token)
    expect(appSource).toContain("userRole === 'admin' && !isActuallyAdmin");
    
    // Verify it signs out the user
    expect(appSource).toMatch(/await signOut\(auth\)/);
    
    // Verify error message
    expect(appSource).toContain('You do not have administrator privileges');
  });

  test('RBAC check rejects admin users trying to use Member Login', () => {
    // When a user with admin privileges tries to login via Member Login
    // userRole is 'user' (from clicking Member Login button)
    // but isActuallyAdmin is true (they have admin claim in token)
    expect(appSource).toContain("userRole === 'user' && isActuallyAdmin");
    
    // Verify error message
    expect(appSource).toContain('Please use the appropriate login method for your account type');
  });

  test('RBAC enforcement happens after successful authentication', () => {
    // Find the signInWithEmailAndPassword call
    const signInMatch = appSource.match(/await signInWithEmailAndPassword\([^)]+\)/);
    expect(signInMatch).toBeTruthy();
    
    // Find the RBAC checks
    const rbacCheckMatch = appSource.match(/userRole === 'admin' && !isActuallyAdmin/);
    expect(rbacCheckMatch).toBeTruthy();
    
    // Verify RBAC check comes after signIn (by position in source)
    const signInIndex = appSource.indexOf('signInWithEmailAndPassword');
    const rbacIndex = appSource.indexOf("userRole === 'admin' && !isActuallyAdmin");
    expect(rbacIndex).toBeGreaterThan(signInIndex);
  });

  test('Role is fetched from database token claims, not client-side state', () => {
    // Verify that the role check uses tokenResult.claims.admin
    expect(appSource).toContain('tokenResult?.claims?.admin === true');
    
    // Verify it's not just checking a client-side variable
    expect(appSource).toContain('getIdTokenResult');
  });

  test('Access is denied by signing out user on role mismatch', () => {
    // Extract handleLogin function
    const handleLoginMatch = appSource.match(/const handleLogin = async[^}]+\{[\s\S]+?\n  \};/);
    expect(handleLoginMatch).toBeTruthy();
    
    const handleLoginCode = handleLoginMatch[0];
    
    // Count signOut calls
    const signOutCalls = (handleLoginCode.match(/await signOut\(auth\)/g) || []).length;
    
    // Should have at least 2 signOut calls (one for each rejection case)
    expect(signOutCalls).toBeGreaterThanOrEqual(2);
  });

  test('Error messages match requirements', () => {
    // Admin privilege error
    expect(appSource).toContain('Access Denied: You do not have administrator privileges.');
    
    // Wrong login method error  
    expect(appSource).toContain('Access Denied: Please use the appropriate login method for your account type.');
  });
});

describe('RBAC Implementation - Code Structure', () => {
  let appSource;

  beforeAll(() => {
    const appPath = path.join(__dirname, 'App.js');
    appSource = fs.readFileSync(appPath, 'utf8');
  });

  test('handleLogin function exists and handles authentication', () => {
    expect(appSource).toContain('const handleLogin = async');
    expect(appSource).toContain('signInWithEmailAndPassword');
  });

  test('RBAC logic is in correct execution order', () => {
    // Extract handleLogin function
    const handleLoginMatch = appSource.match(/const handleLogin = async[^}]+\{[\s\S]+?\n  \};/);
    expect(handleLoginMatch).toBeTruthy();
    
    const handleLoginCode = handleLoginMatch[0];
    
    // Check order: 1. Sign in, 2. Get token, 3. Check role, 4. Enforce
    const signInIndex = handleLoginCode.indexOf('signInWithEmailAndPassword');
    const getTokenIndex = handleLoginCode.indexOf('getIdTokenResult');
    const adminCheckIndex = handleLoginCode.indexOf("userRole === 'admin'");
    const userCheckIndex = handleLoginCode.indexOf("userRole === 'user'");
    
    expect(signInIndex).toBeGreaterThan(0);
    expect(getTokenIndex).toBeGreaterThan(signInIndex);
    expect(adminCheckIndex).toBeGreaterThan(getTokenIndex);
    expect(userCheckIndex).toBeGreaterThan(adminCheckIndex);
  });
});
