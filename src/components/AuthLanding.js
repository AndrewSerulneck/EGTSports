import React from 'react';
import '../App.css';

function AuthLanding({ onSelectRole }) {
  return (
    <div className="gradient-bg">
      <div className="container" style={{ maxWidth: '800px', paddingTop: '60px' }}>
        <div className="text-center text-white mb-4">
          {/* Desktop-only Football Logo */}
          <div className="desktop-logo">
            <span style={{ fontSize: '80px' }}>🏈</span>
          </div>
          <h1 style={{ fontSize: '48px', marginBottom: '16px' }}>Welcome to EGT Sports</h1>
          <p style={{ fontSize: '20px', marginBottom: '40px' }}>How would you like to continue?</p>
        </div>
        
        <div className="card">
          <div style={{ display: 'grid', gap: '20px' }}>
            <button
              className="btn"
              onClick={() => onSelectRole('user')}
              style={{
                padding: '32px 24px',
                fontSize: '20px',
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <span style={{ fontSize: '48px' }}>👤</span>
              <span>Member Login</span>
              <span style={{ fontSize: '14px', opacity: '0.9', fontWeight: 'normal' }}>
                Sign in with your account credentials
              </span>
            </button>
                  
                  <button
              className="btn"
              onClick={() => onSelectRole('admin')}
              style={{
                padding: '32px 24px',
                fontSize: '20px',
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <span style={{ fontSize: '48px' }}>🔐</span>
              <span>Admin Login</span>
              <span style={{ fontSize: '14px', opacity: '0.9', fontWeight: 'normal' }}>
                Administrative access
              </span>
            </button>  
          </div>
        </div>

        <div style={{
          marginTop: '40px',
          textAlign: 'center',
          color: 'white',
          fontSize: '14px',
          opacity: '0.8'
        }}>
          <p>New user? Contact an administrator to create your account.</p>
        </div>
      </div>
    </div>
  );
}

export default AuthLanding;
