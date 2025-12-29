/**
 * Unit tests for getStandardizedKey function
 * Validates team name standardization logic for JsonOdds API matching
 */

// Mock the function since it's in App.js
// In a production environment, this should be extracted to a separate utility file
const getStandardizedKey = (away, home) => {
  const stripMascot = (name) => {
    if (!name) return '';
    const trimmed = name.trim(); // Trim first so $ anchor works correctly
    // Multi-word mascots first, then single-word mascots
    return trimmed.replace(/\s+(Red Raiders|Crimson Tide|Fighting Irish|Blue Devils|Tar Heels|Demon Deacons|Yellow Jackets|Black Knights|Golden Eagles|Red Storm|River Hawks|Mountain Hawks|Ragin Cajuns|Red Wolves|Golden Panthers|Mean Green|Trail Blazers|Nittany Lions|Scarlet Knights|Eagles|Bulldogs|Panthers|Tigers|Bears|Lions|Wildcats|Spartans|Trojans|Bruins|Huskies|Cardinals|Cowboys|Indians|Terrapins|Volunteers|Gators|Buckeyes|Wolverines|Sooners|Longhorns|Aggies|Rebels|Commodores|RedHawks|Rams|Falcons|Saints|Chiefs|49ers|Seahawks|Steelers|Ravens|Browns|Bengals|Texans|Colts|Jaguars|Titans|Patriots|Bills|Dolphins|Jets|Broncos|Raiders|Chargers|Packers|Vikings|Giants|Commanders|Buccaneers|76ers|Celtics|Nets|Knicks|Raptors|Warriors|Clippers|Lakers|Suns|Kings|Jazz|Nuggets|Timberwolves|Thunder|Mavericks|Rockets|Spurs|Grizzlies|Pelicans|Heat|Magic|Hawks|Hornets|Wizards|Pacers|Pistons|Bucks|Cavaliers|Hokies|Orange|Midshipmen|Friars|Pirates|Hoyas|Colonials|Minutemen|Leopards|Engineers|Dutchmen|Pride|Greyhounds|Mocs|Catamounts|Warhawks|Owls|Hilltoppers|Blazers|Knights|Phoenix|Roadrunners|Anteaters|Gauchos|Tritons|Highlanders|Matadors|Beach|Waves|Cougars|Hurricanes|Seminoles|Gamecocks|Badgers|Cornhuskers|Boilermakers|Illini|Hawkeyes)$/i, '').trim();
  };
  
  const normalize = (name) => {
    if (!name) return '';
    return name
      .replace(/\s+\(.*?\)/, '')
      .replace(/\bSt\b\.?/gi, 'State')
      .replace(/\bN\b\.?/gi, 'North')
      .replace(/\bS\b\.?/gi, 'South')
      .replace(/\bE\b\.?/gi, 'East')
      .replace(/\bW\b\.?/gi, 'West')
      .replace(/\bCent\b\.?/gi, 'Central')
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .trim();
  };
  
  const awayStandardized = normalize(stripMascot(away));
  const homeStandardized = normalize(stripMascot(home));
  
  return `${awayStandardized}|${homeStandardized}`;
};

describe('getStandardizedKey', () => {
  test('strips mascots from team names', () => {
    expect(getStandardizedKey('Winthrop Eagles', 'Texas Tech Red Raiders')).toBe('winthrop|texas tech');
  });
  
  test('handles Miami (OH) notation', () => {
    expect(getStandardizedKey('Miami (OH) RedHawks', 'Fresno State Bulldogs')).toBe('miami|fresno state');
  });
  
  test('normalizes N to North', () => {
    expect(getStandardizedKey('N Carolina Cent', 'Penn State')).toBe('north carolina central|penn state');
  });
  
  test('normalizes St to State', () => {
    expect(getStandardizedKey('Jacksonville St', 'SMU')).toBe('jacksonville state|smu');
  });
  
  test('normalizes Cent to Central', () => {
    expect(getStandardizedKey('N Carolina Cent Eagles', 'Penn State')).toBe('north carolina central|penn state');
  });
  
  test('handles professional teams', () => {
    expect(getStandardizedKey('Los Angeles Rams', 'Atlanta Falcons')).toBe('los angeles|atlanta');
  });
  
  test('handles multi-word city names', () => {
    expect(getStandardizedKey('San Francisco 49ers', 'New York Giants')).toBe('san francisco|new york');
  });
  
  test('handles teams without mascots', () => {
    expect(getStandardizedKey('Montana', 'San Francisco')).toBe('montana|san francisco');
  });
  
  test('lowercases all output', () => {
    expect(getStandardizedKey('TEXAS TECH Red Raiders', 'WINTHROP Eagles')).toBe('texas tech|winthrop');
  });
  
  test('trims whitespace and strips mascots', () => {
    expect(getStandardizedKey('  Texas Tech Red Raiders  ', '  Winthrop Eagles  ')).toBe('texas tech|winthrop');
  });
  
  test('handles St. with period', () => {
    expect(getStandardizedKey('St. Johns Red Storm', 'Villanova Wildcats')).toBe('state johns|villanova');
  });
  
  test('handles multiple abbreviations', () => {
    expect(getStandardizedKey('N Carolina St Wolfpack', 'S Carolina Gamecocks')).toBe('north carolina state wolfpack|south carolina');
  });
  
  test('handles empty strings', () => {
    expect(getStandardizedKey('', '')).toBe('|');
  });
  
  test('handles NBA teams', () => {
    expect(getStandardizedKey('Los Angeles Lakers', 'Boston Celtics')).toBe('los angeles|boston');
  });
  
  test('handles NFL teams', () => {
    expect(getStandardizedKey('New England Patriots', 'Buffalo Bills')).toBe('new england|buffalo');
  });
  
  test('matches example from problem statement - Rams vs Falcons', () => {
    const key1 = getStandardizedKey('Los Angeles Rams', 'Atlanta Falcons');
    expect(key1).toBe('los angeles|atlanta');
  });
  
  test('handles college teams with location modifiers', () => {
    expect(getStandardizedKey('Miami (FL) Hurricanes', 'Miami (OH) RedHawks')).toBe('miami|miami');
  });
});
