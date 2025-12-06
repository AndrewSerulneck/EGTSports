import React, { useState, useEffect } from 'react';
import { getDatabase, ref, onValue } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import '../App.css';

// Helper function to get submission timestamp from various possible fields
const getSubmissionTimestamp = (submission) => {
  if (submission.timestamp) {
    return new Date(submission.timestamp).getTime();
  }
  if (submission.createdAt) {
    return new Date(submission.createdAt).getTime();
  }
  return 0;
};

function SubmissionsViewer({ onBack }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedSubmissions, setExpandedSubmissions] = useState({});
  const [cancelingId, setCancelingId] = useState(null);
  const [cancelMessage, setCancelMessage] = useState({ type: '', text: '' });

  const database = getDatabase();
  const auth = getAuth();

  useEffect(() => {
    setLoading(true);
    setError('');

    try {
      // Calculate 14 days ago timestamp
      const fourteenDaysAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
      
      // Query submissions from Firebase Realtime Database
      const submissionsRef = ref(database, 'submissions');
      
      const unsubscribe = onValue(submissionsRef, (snapshot) => {
        if (snapshot.exists()) {
          const submissionsData = [];
          snapshot.forEach((childSnapshot) => {
            const submission = {
              submissionId: childSnapshot.key,
              ...childSnapshot.val()
            };
            
            // Filter by 14 days using helper function
            const submissionTime = getSubmissionTimestamp(submission);
            
            if (submissionTime >= fourteenDaysAgo) {
              submissionsData.push(submission);
            }
          });
          
          // Sort by timestamp (newest first) using helper function
          submissionsData.sort((a, b) => {
            return getSubmissionTimestamp(b) - getSubmissionTimestamp(a);
          });
          
          setSubmissions(submissionsData);
        } else {
          setSubmissions([]);
        }
        setLoading(false);
      }, (err) => {
        console.error('Error fetching submissions:', err);
        setError('Failed to load submissions. Please try again.');
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err) {
      console.error('Error setting up submissions listener:', err);
      setError('Failed to connect to database.');
      setLoading(false);
    }
  }, [database]);

  const toggleExpand = (submissionId) => {
    setExpandedSubmissions(prev => ({
      ...prev,
      [submissionId]: !prev[submissionId]
    }));
  };

  // Cancel wager and return credit to user
  const handleCancelWager = async (submission) => {
    const submissionId = submission.submissionId;
    const status = submission.status?.toLowerCase();
    
    // Only allow canceling for pending/new/in-progress wagers
    if (status === 'won' || status === 'lost' || status === 'canceled' || status === 'closed') {
      setCancelMessage({ type: 'error', text: 'Cannot cancel settled or already canceled bets' });
      setTimeout(() => setCancelMessage({ type: '', text: '' }), 3000);
      return;
    }

    if (!window.confirm(`Are you sure you want to cancel this bet and return $${(submission.betAmount || submission.amount || 0).toFixed(2)} to the member's credit?`)) {
      return;
    }

    setCancelingId(submissionId);
    setCancelMessage({ type: '', text: '' });

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Not authenticated');
      }

      const idToken = await user.getIdToken();

      const response = await fetch('/api/cancelWager', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ submissionId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel wager');
      }

      setCancelMessage({ 
        type: 'success', 
        text: `Bet canceled! $${(data.details?.creditReturned || 0).toFixed(2)} returned to member's credit.`
      });
      
      // Clear message after 5 seconds
      setTimeout(() => setCancelMessage({ type: '', text: '' }), 5000);

    } catch (err) {
      console.error('Error canceling wager:', err);
      setCancelMessage({ type: 'error', text: err.message || 'Failed to cancel wager' });
      setTimeout(() => setCancelMessage({ type: '', text: '' }), 5000);
    } finally {
      setCancelingId(null);
    }
  };

  // Check if a wager can be canceled
  const canCancelWager = (status) => {
    const normalizedStatus = status?.toLowerCase() || 'new';
    return !['won', 'lost', 'canceled', 'closed'].includes(normalizedStatus);
  };

  const getStatusStyle = (status) => {
    switch (status?.toLowerCase()) {
      case 'new':
        return { background: '#17a2b8', color: 'white' };
      case 'in-progress':
        return { background: '#ffc107', color: '#000' };
      case 'canceled':
        return { background: '#6c757d', color: 'white' };
      case 'closed':
      case 'won':
        return { background: '#28a745', color: 'white' };
      case 'lost':
        return { background: '#dc3545', color: 'white' };
      default:
        return { background: '#6c757d', color: 'white' };
    }
  };

  const filteredSubmissions = submissions.filter(sub => {
    if (statusFilter === 'all') return true;
    const status = sub.status?.toLowerCase() || 'new';
    return status === statusFilter.toLowerCase();
  });

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="gradient-bg">
        <div className="container submissions-container">
          <div className="card text-center">
            <h2>Loading submissions...</h2>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gradient-bg">
      <div className="container submissions-container">
        {/* Header */}
        <div className="card">
          <div className="submissions-header">
            <h1>📋 Submissions Log</h1>
            <button className="btn btn-secondary" onClick={onBack}>← Back to Dashboard</button>
          </div>
          <p style={{ color: '#666', marginTop: '8px' }}>
            Showing submissions from the last 14 days ({filteredSubmissions.length} of {submissions.length} total)
          </p>
        </div>

        {/* Cancel Message */}
        {cancelMessage.text && (
          <div className="card" style={{ 
            background: cancelMessage.type === 'success' ? '#d4edda' : '#f8d7da', 
            border: `1px solid ${cancelMessage.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`, 
            color: cancelMessage.type === 'success' ? '#155724' : '#721c24' 
          }}>
            {cancelMessage.type === 'success' ? '✅' : '❌'} {cancelMessage.text}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="card" style={{ background: '#f8d7da', border: '1px solid #f5c6cb', color: '#721c24' }}>
            ❌ {error}
          </div>
        )}

        {/* Status Filters */}
        <div className="card">
          <div className="status-filters">
            <button 
              className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              All ({submissions.length})
            </button>
            <button 
              className={`filter-btn ${statusFilter === 'new' ? 'active' : ''}`}
              onClick={() => setStatusFilter('new')}
            >
              New
            </button>
            <button 
              className={`filter-btn ${statusFilter === 'in-progress' ? 'active' : ''}`}
              onClick={() => setStatusFilter('in-progress')}
            >
              In Progress
            </button>
            <button 
              className={`filter-btn ${statusFilter === 'won' ? 'active' : ''}`}
              onClick={() => setStatusFilter('won')}
            >
              Won
            </button>
            <button 
              className={`filter-btn ${statusFilter === 'lost' ? 'active' : ''}`}
              onClick={() => setStatusFilter('lost')}
            >
              Lost
            </button>
            <button 
              className={`filter-btn ${statusFilter === 'canceled' ? 'active' : ''}`}
              onClick={() => setStatusFilter('canceled')}
            >
              Canceled
            </button>
          </div>
        </div>

        {/* Submissions List */}
        {filteredSubmissions.length === 0 ? (
          <div className="card text-center">
            <p style={{ color: '#666' }}>No submissions found for the selected filter.</p>
          </div>
        ) : (
          <div className="submissions-list">
            {filteredSubmissions.map((submission) => (
              <div key={submission.submissionId} className="submission-card card">
                {/* Mobile: Collapsible Header */}
                <div 
                  className="submission-header"
                  onClick={() => toggleExpand(submission.submissionId)}
                >
                  <div className="submission-header-main">
                    <div className="submission-id">
                      {submission.ticketNumber || submission.submissionId}
                    </div>
                    <span 
                      className="status-badge"
                      style={getStatusStyle(submission.status)}
                    >
                      {submission.status || 'NEW'}
                    </span>
                  </div>
                  <div className="submission-header-details">
                    <span className="submission-date">
                      {formatDate(submission.timestamp || submission.createdAt)}
                    </span>
                    <span className="submission-email">
                      {submission.contactInfo?.email || submission.userEmail || 'N/A'}
                    </span>
                  </div>
                  <button className="expand-btn">
                    {expandedSubmissions[submission.submissionId] ? '▲' : '▼'}
                  </button>
                </div>

                {/* Expanded Details (visible on mobile when expanded, always visible on desktop) */}
                <div className={`submission-details ${expandedSubmissions[submission.submissionId] ? 'expanded' : ''}`}>
                  <div className="submission-info-grid">
                    <div className="info-item">
                      <strong>Name:</strong> {submission.contactInfo?.name || 'N/A'}
                    </div>
                    <div className="info-item">
                      <strong>Bet Amount:</strong> ${submission.betAmount?.toFixed(2) || '0.00'}
                    </div>
                    <div className="info-item">
                      <strong>Sport:</strong> {submission.sport || 'N/A'}
                    </div>
                    <div className="info-item">
                      <strong>Bet Type:</strong> {submission.betType === 'parlay' ? 'Parlay' : 'Straight'}
                    </div>
                    {submission.potentialPayout && (
                      <div className="info-item">
                        <strong>Potential Payout:</strong> ${submission.potentialPayout.toFixed(2)}
                      </div>
                    )}
                  </div>

                  {/* Picks */}
                  {submission.picks && submission.picks.length > 0 && (
                    <div className="picks-section">
                      <strong>Picks ({submission.picks.length}):</strong>
                      <div className="picks-list">
                        {submission.picks.map((pick, idx) => (
                          <div key={idx} className="pick-item">
                            <span className="pick-number">{idx + 1}.</span>
                            <span className="pick-text">
                              {pick.gameName} - {
                                pick.pickType === 'spread' 
                                  ? `${pick.team} ${pick.spread}` 
                                  : pick.pickType === 'total' 
                                    ? `${pick.overUnder} ${pick.total}` 
                                    : pick.pickType === 'winner'
                                      ? `${pick.team} ${pick.moneyline}`
                                      : 'Unknown'
                              }
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cancel Bet Button - Only show for pending/new/in-progress bets */}
                  {canCancelWager(submission.status) && (
                    <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #eee' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelWager(submission);
                        }}
                        disabled={cancelingId === submission.submissionId}
                        style={{
                          background: cancelingId === submission.submissionId ? '#ccc' : '#dc3545',
                          color: 'white',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '6px',
                          cursor: cancelingId === submission.submissionId ? 'not-allowed' : 'pointer',
                          fontSize: '14px',
                          fontWeight: '500',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        {cancelingId === submission.submissionId ? (
                          <>⏳ Canceling...</>
                        ) : (
                          <>🚫 Cancel Bet & Return Credit</>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Show canceled info if bet was canceled */}
                  {submission.status?.toLowerCase() === 'canceled' && submission.canceledAt && (
                    <div style={{ marginTop: '12px', padding: '8px', background: '#f8f9fa', borderRadius: '6px', fontSize: '13px', color: '#6c757d' }}>
                      <strong>Canceled:</strong> {formatDate(submission.canceledAt)}
                      {submission.previousStatus && <span> (was: {submission.previousStatus})</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SubmissionsViewer;
