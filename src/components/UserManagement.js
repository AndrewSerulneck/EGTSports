import React, { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { getDatabase, ref, set, onValue } from 'firebase/database';
import '../App.css';

function UserManagement({ onBack }) {
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    displayName: '',
    creditLimit: 100
  });
  const [loading, setLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(true);
  const [revokeLoading, setRevokeLoading] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const auth = getAuth();
  const database = getDatabase();

  useEffect(() => {
    // Load users from Firebase
    console.log('UserManagement: Setting up Firebase listener for users...');
    setUsersLoading(true);
    const usersRef = ref(database, 'users');
    
    const unsubscribe = onValue(usersRef, (snapshot) => {
      console.log('UserManagement: Received data from Firebase');
      console.log('UserManagement: Snapshot exists:', snapshot.exists());
      
      if (snapshot.exists()) {
        const usersData = [];
        snapshot.forEach((childSnapshot) => {
          console.log('UserManagement: Found user:', childSnapshot.key);
          usersData.push({
            uid: childSnapshot.key,
            ...childSnapshot.val()
          });
        });
        console.log('UserManagement: Total users loaded:', usersData.length);
        setUsers(usersData);
      } else {
        console.log('UserManagement: No users found in database');
        setUsers([]);
      }
      setUsersLoading(false);
    }, (error) => {
      // Handle Firebase permission or connection errors
      console.error('UserManagement: Firebase read error:', error);
      console.error('UserManagement: Error code:', error.code);
      console.error('UserManagement: Error message:', error.message);
      setError(`Failed to load users: ${error.message}. Check Firebase security rules.`);
      setUsersLoading(false);
    });

    return () => {
      console.log('UserManagement: Cleaning up Firebase listener');
      unsubscribe();
    };
  }, [database]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Validate input
      if (!newUser.email || !newUser.password || !newUser.displayName) {
        throw new Error('Please fill in all fields');
      }

      if (newUser.password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }

      // Get the current admin's ID token for authentication
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Not authenticated');
      }
      
      const idToken = await currentUser.getIdToken();

      // Call the serverless function to create user using Admin SDK
      // This prevents the admin from being logged out
      const response = await fetch('/api/createUser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          email: newUser.email,
          password: newUser.password,
          displayName: newUser.displayName,
          creditLimit: parseFloat(newUser.creditLimit) || 100
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to create user');
      }

      setSuccess(`User ${newUser.displayName} created successfully with member role!`);
      
      // Reset form
      setNewUser({
        email: '',
        password: '',
        displayName: '',
        creditLimit: 100
      });

    } catch (err) {
      console.error('Error creating user:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeUser = async (uid, displayName, method = 'soft') => {
    const actionText = method === 'soft' 
      ? `revoke access for ${displayName}? This will invalidate all their sessions.`
      : `permanently DELETE ${displayName}? This action cannot be undone.`;
    
    if (!window.confirm(`Are you sure you want to ${actionText}`)) {
      return;
    }

    setRevokeLoading(prev => ({ ...prev, [uid]: true }));
    setError('');
    setSuccess('');

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Not authenticated');
      }
      
      const idToken = await currentUser.getIdToken();

      const response = await fetch('/api/revokeUser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ uid, method })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to revoke user access');
      }

      setSuccess(result.message);

    } catch (err) {
      console.error('Error revoking user:', err);
      setError(err.message);
    } finally {
      setRevokeLoading(prev => ({ ...prev, [uid]: false }));
    }
  };

  const handleReactivateUser = async (uid, displayName) => {
    if (!window.confirm(`Reactivate access for ${displayName}?`)) {
      return;
    }

    setRevokeLoading(prev => ({ ...prev, [uid]: true }));
    setError('');
    setSuccess('');

    try {
      // Update user status in database with atomic batch update
      await set(ref(database, `users/${uid}`), {
        ...users.find(u => u.uid === uid),
        status: 'active',
        reactivatedAt: new Date().toISOString()
      });
      
      setSuccess(`Access reactivated for ${displayName}. User will need to log in again.`);

    } catch (err) {
      console.error('Error reactivating user:', err);
      setError(err.message);
    } finally {
      setRevokeLoading(prev => ({ ...prev, [uid]: false }));
    }
  };

  const handleDeleteUser = async (uid, displayName) => {
    // Use hard revocation which deletes the user
    await handleRevokeUser(uid, displayName, 'hard');
  };

  const handleUpdateCreditLimit = async (uid, displayName, currentLimit, totalWagered) => {
    const newLimit = parseFloat(prompt(
      `Update credit limit for ${displayName}\n\nCurrent Limit: $${currentLimit}\nTotal Wagered: $${totalWagered}\n\nEnter new credit limit:`,
      currentLimit
    ));

    if (isNaN(newLimit) || newLimit === null) return;

    if (newLimit < 0) {
      setError('Credit limit cannot be negative');
      return;
    }

    try {
      await set(ref(database, `users/${uid}/creditLimit`), newLimit);
      setSuccess(`Credit limit updated for ${displayName}: $${newLimit}`);
    } catch (err) {
      console.error('Error updating credit limit:', err);
      setError(err.message);
    }
  };

  const handleResetWager = async (uid, displayName, currentWagered) => {
    const newAmount = parseFloat(prompt(
      `Reset wagered amount for ${displayName}\n\nCurrent Total Wagered: $${currentWagered}\n\nEnter new wagered amount (usually 0 to reset):`,
      0
    ));

    if (isNaN(newAmount) || newAmount === null) return;

    if (newAmount < 0) {
      setError('Wagered amount cannot be negative');
      return;
    }

    setRevokeLoading(prev => ({ ...prev, [uid]: true }));
    setError('');
    setSuccess('');

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Not authenticated');
      }
      
      const idToken = await currentUser.getIdToken();

      const response = await fetch('/api/resetWager', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ uid, resetAmount: newAmount })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to reset wagered amount');
      }

      setSuccess(`Wagered amount reset for ${displayName}: $${newAmount}`);

    } catch (err) {
      console.error('Error resetting wager:', err);
      setError(err.message);
    } finally {
      setRevokeLoading(prev => ({ ...prev, [uid]: false }));
    }
  };

  const getStatusBadge = (status) => {
    if (status === 'revoked') {
      return (
        <span style={{
          display: 'inline-block',
          padding: '4px 12px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: 'bold',
          background: '#dc3545',
          color: 'white'
        }}>
          REVOKED
        </span>
      );
    }
    return (
      <span style={{
        display: 'inline-block',
        padding: '4px 12px',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: 'bold',
        background: '#28a745',
        color: 'white'
      }}>
        ACTIVE
      </span>
    );
  };

  return (
    <div className="gradient-bg">
      <div className="container user-management-container">
        <div className="card">
          <div className="user-management-header">
            <h1>👥 User Management</h1>
            <button className="btn btn-secondary" onClick={onBack}>← Back</button>
          </div>
        </div>

        {error && (
          <div className="card" style={{ background: '#f8d7da', border: '1px solid #f5c6cb', color: '#721c24' }}>
            ❌ {error}
          </div>
        )}

        {success && (
          <div className="card" style={{ background: '#d4edda', border: '1px solid #c3e6cb', color: '#155724' }}>
            ✅ {success}
          </div>
        )}

        {/* Create New User Form */}
        <div className="card">
          <h2 className="mb-2">Create New User</h2>
          <form onSubmit={handleCreateUser}>
            <div className="user-form-grid">
              <div className="form-field">
                <label>Display Name *</label>
                <input
                  type="text"
                  value={newUser.displayName}
                  onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="form-field">
                <label>Email *</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div className="form-field">
                <label>Password * (min 6 characters)</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="••••••"
                  required
                  minLength={6}
                />
              </div>
              <div className="form-field">
                <label>Credit Limit ($)</label>
                <input
                  type="number"
                  value={newUser.creditLimit}
                  onChange={(e) => setNewUser({ ...newUser, creditLimit: e.target.value })}
                  placeholder="100"
                  step="0.01"
                />
              </div>
            </div>
            <button 
              type="submit" 
              className="btn btn-success user-form-submit" 
              disabled={loading}
            >
              {loading ? 'Creating User...' : '➕ Create User'}
            </button>
          </form>
        </div>

        {/* Users List */}
        <div className="card">
          <h2 className="mb-2">Registered Users ({users.length})</h2>
          {usersLoading ? (
            <p style={{ textAlign: 'center', color: '#666' }}>⏳ Loading users...</p>
          ) : users.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
              <p>No users yet</p>
              <p style={{ fontSize: '14px', marginTop: '10px' }}>
                Create a new user using the form above. Users will appear here after creation.
              </p>
            </div>
          ) : (
            <div className="user-list">
              {users.map((user) => (
                <div key={user.uid} className="user-card">
                  <div className="user-info">
                    <div className="user-name-row">
                      <span className="user-name">{user.displayName}</span>
                      {getStatusBadge(user.status)}
                    </div>
                    <div className="user-email">{user.email}</div>
                    <div className="user-details">
                      <span>
                        <strong>Wagered:</strong> ${user.totalWagered || user.currentCredit || 0} / ${user.creditLimit || 100}
                      </span>
                      <span>
                        <strong>Created:</strong> {new Date(user.createdAt).toLocaleDateString()}
                      </span>
                      {user.revokedAt && (
                        <span style={{ color: '#dc3545' }}>
                          <strong>Revoked:</strong> {new Date(user.revokedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="user-actions">
                    <button
                      className="btn btn-primary user-action-btn"
                      onClick={() => handleUpdateCreditLimit(user.uid, user.displayName, user.creditLimit || 100, user.totalWagered || user.currentCredit || 0)}
                    >
                      💰 Limit
                    </button>
                    <button
                      className="btn btn-info user-action-btn"
                      onClick={() => handleResetWager(user.uid, user.displayName, user.totalWagered || user.currentCredit || 0)}
                      disabled={revokeLoading[user.uid]}
                      style={{ background: '#17a2b8', color: '#fff' }}
                    >
                      {revokeLoading[user.uid] ? '...' : '🔄 Reset'}
                    </button>
                    {user.status === 'revoked' ? (
                      <button
                        className="btn btn-success user-action-btn"
                        onClick={() => handleReactivateUser(user.uid, user.displayName)}
                        disabled={revokeLoading[user.uid]}
                      >
                        {revokeLoading[user.uid] ? '...' : '✓ Reactivate'}
                      </button>
                    ) : (
                      <button
                        className="btn btn-warning user-action-btn"
                        onClick={() => handleRevokeUser(user.uid, user.displayName, 'soft')}
                        disabled={revokeLoading[user.uid]}
                        style={{ background: '#ffc107', color: '#000' }}
                      >
                        {revokeLoading[user.uid] ? '...' : '🚫 Revoke'}
                      </button>
                    )}
                    <button
                      className="btn btn-danger user-action-btn"
                      onClick={() => handleDeleteUser(user.uid, user.displayName)}
                      disabled={revokeLoading[user.uid]}
                    >
                      {revokeLoading[user.uid] ? '...' : '🗑️ Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UserManagement;