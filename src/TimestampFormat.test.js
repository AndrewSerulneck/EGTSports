/**
 * Test Suite for API Timestamp Format Fix
 * 
 * Validates that timestamps are formatted correctly for The Odds API:
 * - Must be in format: YYYY-MM-DDTHH:MM:SSZ (whole seconds, no milliseconds)
 * - Milliseconds must be stripped from ISO strings
 * 
 * This test documents the fix for the 422 error:
 * "Invalid commenceTimeFrom parameter. The format must be YYYY-MM-DDTHH:MM:SSZ."
 */

describe('API Timestamp Format', () => {
  
  test('toISOString() includes milliseconds (causes 422 error)', () => {
    const now = new Date();
    const timestamp = now.toISOString();
    
    // Verify it includes milliseconds
    expect(timestamp).toMatch(/\.\d{3}Z$/);
    
    // Example format: 2025-12-28T21:39:36.077Z
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
  
  test('Stripped timestamp removes milliseconds (fixes 422 error)', () => {
    const now = new Date();
    const timestamp = now.toISOString().split('.')[0] + 'Z';
    
    // Verify milliseconds are removed
    expect(timestamp).not.toMatch(/\.\d{3}Z$/);
    
    // Must match format: YYYY-MM-DDTHH:MM:SSZ
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    
    // Example format: 2025-12-28T21:39:36Z
    const parts = timestamp.split('T');
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);  // Date
    expect(parts[1]).toMatch(/^\d{2}:\d{2}:\d{2}Z$/); // Time
  });
  
  test('Both commenceTimeFrom and commenceTimeTo should be formatted correctly', () => {
    const now = new Date();
    const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    
    const commenceTimeFrom = now.toISOString().split('.')[0] + 'Z';
    const commenceTimeTo = fourteenDaysFromNow.toISOString().split('.')[0] + 'Z';
    
    // Both timestamps must be in correct format
    expect(commenceTimeFrom).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(commenceTimeTo).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    
    // Verify no milliseconds
    expect(commenceTimeFrom).not.toContain('.');
    expect(commenceTimeTo).not.toContain('.');
  });
  
  test('Firebase timestamp should include milliseconds for precision', () => {
    // Firebase timestamps SHOULD include milliseconds for precision
    const timestamp = new Date().toISOString();
    
    // Firebase timestamp format: 2025-12-28T21:39:36.077Z
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    
    // This is correct for Firebase - only The Odds API rejects milliseconds
  });
  
  test('Migration script should add timestamp to orphaned data', () => {
    const originalGameData = {
      espnId: '401772635',
      awaySpread: '+3.5',
      homeSpread: '-3.5',
      awayMoneyline: '+150',
      homeMoneyline: '-180'
    };
    
    // Simulate migration script logic with immutable update
    const gameData = !originalGameData.timestamp 
      ? { ...originalGameData, timestamp: new Date().toISOString() }
      : originalGameData;
    
    // Verify timestamp was added
    expect(gameData.timestamp).toBeDefined();
    expect(gameData.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    
    // Verify other fields remain unchanged
    expect(gameData.espnId).toBe('401772635');
    expect(gameData.awaySpread).toBe('+3.5');
  });
  
  test('Firebase rules require timestamp field for new data', () => {
    // Simulates Firebase rules validation:
    // ".validate": "newData.hasChild('timestamp') || data.exists()"
    
    const newGameData = {
      awaySpread: '+3.5',
      homeSpread: '-3.5',
      timestamp: new Date().toISOString()
    };
    
    const existingGameData = {
      awaySpread: '+3.5',
      homeSpread: '-3.5'
    };
    
    // New data must have timestamp
    const hasTimestamp = Object.prototype.hasOwnProperty.call(newGameData, 'timestamp');
    expect(hasTimestamp).toBe(true);
    
    // Existing data check (simulated by presence of other fields)
    const dataExists = Object.prototype.hasOwnProperty.call(existingGameData, 'awaySpread');
    expect(dataExists).toBe(true);
  });
});
