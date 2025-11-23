import React, { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { getDatabase, ref, set, onValue, remove } from 'firebase/database';
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
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const auth = getAuth();
  const database = getDatabase();

  useEffect(() => {
    // Load users from Firebase
    const usersRef = ref(database, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        const usersData = [];
        snapshot.forEach((childSnapshot) => {
          usersData.push({
            uid: childSnapshot.key,
            ...childSnapshot.val()
          });
        });
        setUsers(usersData);
      } else {
        setUsers([]);
      }
    });

    return () => unsubscribe();
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

      setSuccess(`User ${newUser.displayName} created successfully!`);
      
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

  const handleDeleteUser = async (uid, displayName) => {
    if (!window.confirm(`Are you sure you want to delete user ${displayName}?`)) {
      return;
    }

    try {
      await remove(ref(database, `users/${uid}`));
      setSuccess(`User ${displayName} deleted successfully`);
    } catch (err) {
      console.error('Error deleting user:', err);
      setError(err.message);
    }
  };

  const handleUpdateCredit = async (uid, displayName, currentCredit, amount) => {
    const newCredit = parseFloat(prompt(
      `Update credit for ${displayName}\nCurrent credit: $${currentCredit}\nEnter new credit amount:`,
      currentCredit
    ));

    if (isNaN(newCredit) || newCredit === null) return;

    try {
      await set(ref(database, `users/${uid}/currentCredit`), newCredit);
      setSuccess(`Credit updated for ${displayName}`);
    } catch (err) {
      console.error('Error updating credit:', err);
      setError(err.message);
    }
  };

  return (
    <div className="gradient-bg">
      <div className="container" style={{ maxWidth: '1200px' }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label>Display Name *</label>
                <input
                  type="text"
                  value={newUser.displayName}
                  onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div>
                <label>Email *</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div>
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
              <div>
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
              className="btn btn-success" 
              disabled={loading}
              style={{ width: '100%', marginTop: '16px' }}
            >
              {loading ? 'Creating User...' : '➕ Create User'}
            </button>
          </form>
        </div>

        {/* Users List */}
        <div className="card">
          <h2 className="mb-2">Registered Users ({users.length})</h2>
          {users.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#666' }}>No users yet</p>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {users.map((user) => (
                <div 
                  key={user.uid}
                  style={{
                    background: '#f8f9fa',
                    padding: '16px',
                    borderRadius: '8px',
                    border: '1px solid #e0e0e0',
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: '16px',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px' }}>
                      {user.displayName}
                    </div>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                      {user.email}
                    </div>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '14px' }}>
                      <span>
                        <strong>Credit:</strong> ${user.currentCredit || 0} / ${user.creditLimit || 100}
                      </span>
                      <span>
                        <strong>Created:</strong> {new Date(user.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleUpdateCredit(user.uid, user.displayName, user.currentCredit || 0)}
                      style={{ padding: '8px 16px', fontSize: '14px' }}
                    >
                      💰 Update Credit
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDeleteUser(user.uid, user.displayName)}
                      style={{ 
                        padding: '8px 16px', 
                        fontSize: '14px',
                        background: '#dc3545',
                        color: 'white'
                      }}
                    >
                      🗑️ Delete
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