// WagerComponent.js (Example)
import React, { useState } from 'react';

// Example wager data for a single bet
const exampleSingleBetData = {
  Wager_ID: `wager_${Date.now()}`,
  Timestamp: new Date().toISOString(),
  User: 'bettor123',
  Pick: 'Lakers -7.5',
  Pick_Type: 'Spread',
  Amount: 100,
};

// Example wager data for a parlay bet
const exampleParlayBetData = {
  Wager_ID: `wager_${Date.now() + 1}`,
  Timestamp: new Date().toISOString(),
  User: 'bettor456',
  Number_of_Picks: 3,
  Parlay_Picks: 'Lakers -7.5, Knicks ML, Nets Over 220.5',
  Amount: 50,
};


const WagerComponent = () => {
  const [statusMessage, setStatusMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Sends wager data to the new Vercel serverless function endpoint.
   * This avoids the CORS error by letting the server handle the Google Script communication.
   */
  const handleSyncWager = async (wagerData) => {
    setIsLoading(true);
    setStatusMessage('Syncing your wager...');

    try {
      const response = await fetch('/api/sheets-sync', { // <-- The NEW, relative URL
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(wagerData),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        // The serverless function or Google Script returned an error
        setStatusMessage(result.message || 'Google Sheets sync failed. Please try again.');
        console.error('Sync failed:', result);
      } else {
        // Success!
        setStatusMessage('Wager successfully synced to Google Sheets!');
        console.log('Sync successful:', result);
      }
    } catch (error) {
      // Network error or other issue fetching the API route
      console.error('Error calling the sync API:', error);
      setStatusMessage('Failed to connect to the sync service. Check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2>Wager Sync</h2>
      <p>Click the buttons below to test syncing different bet types.</p>
      <button onClick={() => handleSyncWager(exampleSingleBetData)} disabled={isLoading}>
        Sync Single Bet
      </button>
      <button onClick={() => handleSyncWager(exampleParlayBetData)} disabled={isLoading}>
        Sync Parlay Bet
      </button>
      {statusMessage && <p><strong>Status:</strong> {statusMessage}</p>}
    </div>
  );
};

export default WagerComponent;
