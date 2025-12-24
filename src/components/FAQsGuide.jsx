import React, { useState } from 'react';

/**
 * FAQsGuide - Member Guide with Important Rules and Parlay Payout Odds
 * Standalone main tab component with accordion sections
 */
function FAQsGuide({ onNavigateToHome, onNavigateToMyBets }) {
  const [expandedSection, setExpandedSection] = useState(null);

  const toggleSection = (sectionId) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId);
  };

  // Parlay payout multipliers
  const parlayPayouts = [
    { legs: 3, payout: '8 to 1' },
    { legs: 4, payout: '15 to 1' },
    { legs: 5, payout: '25 to 1' },
    { legs: 6, payout: '50 to 1' },
    { legs: 7, payout: '100 to 1' },
    { legs: 8, payout: '150 to 1' },
    { legs: 9, payout: '200 to 1' },
    { legs: 10, payout: '250 to 1' }
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-blue-600 shadow-lg sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">📖 Member Guide</h1>
              <p className="text-xs text-blue-200">Rules and Payout Information</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-4 pb-24">
        <div className="space-y-3">
          {/* Section 1: Important Rules */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <button
              onClick={() => toggleSection('rules')}
              className="w-full px-4 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
            >
              <span className="font-bold text-gray-800 text-lg">
                📋 Important Rules
              </span>
              <span className="text-2xl text-gray-600">
                {expandedSection === 'rules' ? '▼' : '▶'}
              </span>
            </button>
            {expandedSection === 'rules' && (
              <div className="px-4 pb-4 text-sm text-gray-700 space-y-3 border-t border-gray-200 pt-4">
                <div className="space-y-2">
                  <h3 className="font-bold text-gray-900">General Betting Rules:</h3>
                  <ul className="list-disc list-inside space-y-1 pl-2">
                    <li>All wagers must be placed before the game or period starts</li>
                    <li>Minimum bet: $5.00 per wager</li>
                    <li>Maximum single bet: $250 per wager</li>
                    <li>Maximum parlay bet: $100 per wager</li>                    
                  </ul>
                </div>
                <div className="space-y-2">
                  <h3 className="font-bold text-gray-900">Parlay Rules:</h3>
                  <ul className="list-disc list-inside space-y-1 pl-2">
                    <li>Minimum 3 legs required for parlay bets</li>
                    <li>Maximum 10 legs allowed per parlay</li>
                    <li>ALL picks must win for parlay to pay out</li>
                    <li>If any pick loses, entire parlay loses</li>
                    <li>No teasers or alternate lines allowed</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h3 className="font-bold text-gray-900">Straight Bet Rules:</h3>
                  <ul className="list-disc list-inside space-y-1 pl-2">
                    <li>One pick per straight bet</li>
                    <li>Each straight bet is independent</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h3 className="font-bold text-gray-900">Settlement:</h3>
                  <ul className="list-disc list-inside space-y-1 pl-2">
                    <li>Bets are settled after game completion</li>
                    <li>Check "Current Wagers" tab for wager status</li>
                    <li>Winnings are automatically added to your balance</li>
                    <li>Balances reset every Wednesday at 12:01am EST</li>
                    <li>Winnings are distributed on Tuesday evenings </li>
                    <li>Contact admin for any discrepancies</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Parlay Payout Odds */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <button
              onClick={() => toggleSection('payouts')}
              className="w-full px-4 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
            >
              <span className="font-bold text-gray-800 text-lg">
                💰 Parlay Payout Odds
              </span>
              <span className="text-2xl text-gray-600">
                {expandedSection === 'payouts' ? '▼' : '▶'}
              </span>
            </button>
            {expandedSection === 'payouts' && (
              <div className="px-4 pb-4 border-t border-gray-200 pt-4">
                <p className="text-sm text-gray-600 mb-4">
                  Parlay payouts multiply your stake based on the number of legs. All picks must win for payout.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-blue-600 text-white">
                        <th className="px-4 py-3 text-left font-bold text-sm">Number of Legs</th>
                        <th className="px-4 py-3 text-left font-bold text-sm">Payout</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {parlayPayouts.map((item) => (
                        <tr key={item.legs} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {item.legs} Legs
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-green-600">
                            {item.payout}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-gray-700">
                    <strong>Example:</strong> A $10 bet on a 5-leg parlay pays $250 if all picks win (25 × $10).
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation - Matches main app nav */}
      <div className="mobile-bottom-nav">
        <button 
          onClick={onNavigateToHome}
          className="mobile-nav-btn"
        >
          <span className="mobile-nav-icon">🏠</span>
          <span className="mobile-nav-label">Home</span>
        </button>
        <button 
          onClick={onNavigateToMyBets}
          className="mobile-nav-btn"
        >
          <span className="mobile-nav-icon">🎯</span>
          <span className="mobile-nav-label">My Bets</span>
        </button>
        <button 
          className="mobile-nav-btn mobile-nav-btn-active"
        >
          <span className="mobile-nav-icon">📖</span>
          <span className="mobile-nav-label">FAQs</span>
        </button>
        <button 
          onClick={() => window.location.href = '/'}
          className="mobile-nav-btn"
        >
          <span className="mobile-nav-icon">🚪</span>
          <span className="mobile-nav-label">Sign Out</span>
        </button>
      </div>
    </div>
  );
}

export default FAQsGuide;
