import React from 'react';
import '../App.css';

function AuthLanding({ onSelectRole }) {
  return (
    <div className="gradient-bg">
      <div className="container" style={{ maxWidth: '400px', paddingTop: '30px' }}>
        <div className="text-center text-white mb-4">
          <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>Welcome to EGT Sports</h1>
          <p style={{ fontSize: '10px', marginBottom: '20px' }}>How would you like to continue?</p>
        </div>
        
        <div className="card">
          <div style={{ display: 'grid', gap: '10px' }}>
            <button
              className="btn"
              onClick={() => onSelectRole('user')}
              style={{
                padding: '16px 12px',
                fontSize: '10px',
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span style={{ fontSize: '24px' }}>👤</span>
              <span>Member login</span>
              <span style={{ fontSize: '7px', opacity: '0.9', fontWeight: 'normal' }}>
                Place wagers without immediate payment
              </span>
            </button>
                  
           <button
              className="btn"
              onClick={() => onSelectRole('guest')}
              style={{
                padding: '16px 12px',
                fontSize: '10px',
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span style={{ fontSize: '24px' }}>🎲</span>
              <span>Continue as Guest</span>
              <span style={{ fontSize: '7px', opacity: '0.9', fontWeight: 'normal' }}>
                Advance payment required via Venmo/Zelle
              </span>
            </button>
                  
                  <button
              className="btn"
              onClick={() => onSelectRole('admin')}
              style={{
                padding: '16px 12px',
                fontSize: '10px',
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span style={{ fontSize: '24px' }}>🔐</span>
              <span>Login as Admin</span>
              <span style={{ fontSize: '7px', opacity: '0.9', fontWeight: 'normal' }}>
              </span>
            </button>  
          </div>
        </div>

        <div style={{
          marginTop: '20px',
          textAlign: 'center',
          color: 'white',
          fontSize: '7px',
          opacity: '0.8'
        }}>
          <p>New user? Contact an administrator to create your account.</p>
        </div>
      </div>
    </div>
  );
}

export default AuthLanding;
