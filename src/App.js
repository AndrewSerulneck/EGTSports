import React, { useState, useEffect } from 'react';
import './App.css';
import { Route, Routes, Link } from 'react-router-dom';

// Enhanced Navbar Component
function Navbar() {
  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark fixed-top">
      <div className="container-fluid">
        <Link className="navbar-brand" to="/">
          <img src="/logo.png" alt="EGT Sports Logo" style={{ height: '40px', marginRight: '10px' }} />
          EGT Sports
        </Link>
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto">
            <li className="nav-item">
              <Link className="nav-link" to="/">Home</Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/about">About</Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/contact">Contact</Link>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}

// Footer Component
function Footer() {
  return (
    <footer className="bg-dark text-white text-center py-4 mt-5">
      <div className="container">
        <p>&copy; 2024 EGT Sports. All rights reserved.</p>
        <p>
          <Link to="/privacy" className="text-white me-3">Privacy Policy</Link>
          <Link to="/terms" className="text-white">Terms of Service</Link>
        </p>
      </div>
    </footer>
  );
}

// About Page Component
function AboutPage() {
  return (
    <div className="container mt-5 pt-5">
      <div className="row">
        <div className="col-lg-8 mx-auto">
          <h1 className="display-4 text-center mb-4">About EGT Sports</h1>
          <div className="card shadow-lg">
            <div className="card-body p-5">
              <h2 className="card-title mb-4">Our Mission</h2>
              <p className="lead">
                EGT Sports is dedicated to providing sports enthusiasts with cutting-edge betting calculators
                and analytics tools to make informed decisions.
              </p>
              
              <h3 className="mt-4 mb-3">What We Offer</h3>
              <ul className="list-group list-group-flush mb-4">
                <li className="list-group-item">
                  <strong>Advanced Calculators:</strong> Precise calculations for straight bets, parlays, and more
                </li>
                <li className="list-group-item">
                  <strong>Real-time Odds:</strong> Up-to-date odds from major sportsbooks
                </li>
                <li className="list-group-item">
                  <strong>Expert Analysis:</strong> Comprehensive betting strategies and tips
                </li>
                <li className="list-group-item">
                  <strong>User-Friendly Interface:</strong> Intuitive design for seamless experience
                </li>
              </ul>

              <h3 className="mt-4 mb-3">Our Team</h3>
              <p>
                Founded by sports betting enthusiasts and data analysts, our team combines decades of
                experience in sports analytics, software development, and responsible gaming practices.
              </p>

              <div className="alert alert-info mt-4">
                <h4 className="alert-heading">Responsible Gaming</h4>
                <p className="mb-0">
                  We are committed to promoting responsible gaming. Our tools are designed for educational
                  and entertainment purposes. Please bet responsibly and within your means.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Contact Page Component
function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Here you would typically send the form data to a backend
    console.log('Form submitted:', formData);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 5000);
  };

  return (
    <div className="container mt-5 pt-5">
      <div className="row">
        <div className="col-lg-8 mx-auto">
          <h1 className="display-4 text-center mb-4">Contact Us</h1>
          <div className="card shadow-lg">
            <div className="card-body p-5">
              {submitted && (
                <div className="alert alert-success" role="alert">
                  Thank you for your message! We'll get back to you soon.
                </div>
              )}
              
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="name" className="form-label">Name</label>
                  <input
                    type="text"
                    className="form-control"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>
                
                <div className="mb-3">
                  <label htmlFor="email" className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
                
                <div className="mb-3">
                  <label htmlFor="subject" className="form-label">Subject</label>
                  <input
                    type="text"
                    className="form-control"
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                  />
                </div>
                
                <div className="mb-3">
                  <label htmlFor="message" className="form-label">Message</label>
                  <textarea
                    className="form-control"
                    id="message"
                    name="message"
                    rows="5"
                    value={formData.message}
                    onChange={handleChange}
                    required
                  ></textarea>
                </div>
                
                <button type="submit" className="btn btn-primary btn-lg w-100">
                  Send Message
                </button>
              </form>

              <hr className="my-4" />

              <div className="row text-center">
                <div className="col-md-6 mb-3">
                  <h5>Email</h5>
                  <p>support@egtsports.com</p>
                </div>
                <div className="col-md-6 mb-3">
                  <h5>Phone</h5>
                  <p>1-800-EGT-SPORT</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Privacy Policy Page Component
function PrivacyPage() {
  return (
    <div className="container mt-5 pt-5">
      <div className="row">
        <div className="col-lg-10 mx-auto">
          <h1 className="display-4 text-center mb-4">Privacy Policy</h1>
          <div className="card shadow-lg">
            <div className="card-body p-5">
              <p className="text-muted">Last Updated: January 2024</p>
              
              <h3 className="mt-4">1. Information We Collect</h3>
              <p>
                We collect information that you provide directly to us, including when you create an account,
                use our calculators, or contact us for support.
              </p>

              <h3 className="mt-4">2. How We Use Your Information</h3>
              <p>
                We use the information we collect to provide, maintain, and improve our services, to communicate
                with you, and to protect our users.
              </p>

              <h3 className="mt-4">3. Information Sharing</h3>
              <p>
                We do not sell your personal information. We may share information with service providers who
                perform services on our behalf.
              </p>

              <h3 className="mt-4">4. Data Security</h3>
              <p>
                We implement appropriate security measures to protect your personal information from unauthorized
                access, alteration, disclosure, or destruction.
              </p>

              <h3 className="mt-4">5. Your Rights</h3>
              <p>
                You have the right to access, correct, or delete your personal information. Contact us to
                exercise these rights.
              </p>

              <h3 className="mt-4">6. Cookies</h3>
              <p>
                We use cookies and similar technologies to enhance your experience on our site and to analyze
                site traffic.
              </p>

              <h3 className="mt-4">7. Contact Us</h3>
              <p>
                If you have questions about this Privacy Policy, please contact us at privacy@egtsports.com
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Terms of Service Page Component
function TermsPage() {
  return (
    <div className="container mt-5 pt-5">
      <div className="row">
        <div className="col-lg-10 mx-auto">
          <h1 className="display-4 text-center mb-4">Terms of Service</h1>
          <div className="card shadow-lg">
            <div className="card-body p-5">
              <p className="text-muted">Last Updated: January 2024</p>
              
              <h3 className="mt-4">1. Acceptance of Terms</h3>
              <p>
                By accessing and using EGT Sports, you accept and agree to be bound by the terms and provision
                of this agreement.
              </p>

              <h3 className="mt-4">2. Use License</h3>
              <p>
                Permission is granted to temporarily use EGT Sports for personal, non-commercial purposes only.
              </p>

              <h3 className="mt-4">3. Disclaimer</h3>
              <p>
                The materials on EGT Sports are provided on an 'as is' basis. EGT Sports makes no warranties,
                expressed or implied, and hereby disclaims all other warranties.
              </p>

              <h3 className="mt-4">4. Limitations</h3>
              <p>
                In no event shall EGT Sports or its suppliers be liable for any damages arising out of the
                use or inability to use the materials on EGT Sports.
              </p>

              <h3 className="mt-4">5. Responsible Gaming</h3>
              <p>
                Our tools are for educational and entertainment purposes only. Users must be of legal gambling
                age in their jurisdiction. We encourage responsible betting practices.
              </p>

              <h3 className="mt-4">6. Accuracy of Information</h3>
              <p>
                While we strive for accuracy, the materials on EGT Sports could include technical, typographical,
                or photographic errors. We do not warrant that any of the materials are accurate or complete.
              </p>

              <h3 className="mt-4">7. Modifications</h3>
              <p>
                EGT Sports may revise these terms of service at any time without notice. By using this site,
                you agree to be bound by the current version of these terms.
              </p>

              <h3 className="mt-4">8. Governing Law</h3>
              <p>
                These terms and conditions are governed by and construed in accordance with applicable laws.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Enhanced Landing Page Component with Premium Layout
function LandingPage() {
  const [betType, setBetType] = useState('straight');
  const [odds, setOdds] = useState('');
  const [stake, setStake] = useState('');
  const [result, setResult] = useState(null);
  const [oddsFormat, setOddsFormat] = useState('american');
  const [parlayLegs, setParlayLegs] = useState([{ odds: '', stake: '' }]);

  const calculatePayout = () => {
    if (betType === 'straight') {
      const numOdds = parseFloat(odds);
      const numStake = parseFloat(stake);
      
      if (isNaN(numOdds) || isNaN(numStake)) {
        alert('Please enter valid numbers');
        return;
      }

      let profit, payout, impliedProbability;

      if (oddsFormat === 'american') {
        if (numOdds > 0) {
          profit = (numStake * numOdds) / 100;
          impliedProbability = 100 / (numOdds + 100);
        } else {
          profit = numStake / (Math.abs(numOdds) / 100);
          impliedProbability = Math.abs(numOdds) / (Math.abs(numOdds) + 100);
        }
      } else if (oddsFormat === 'decimal') {
        profit = (numStake * numOdds) - numStake;
        impliedProbability = 1 / numOdds;
      } else { // fractional
        const [numerator, denominator] = numOdds.toString().split('/').map(Number);
        profit = numStake * (numerator / denominator);
        impliedProbability = denominator / (numerator + denominator);
      }

      payout = numStake + profit;

      setResult({
        stake: numStake.toFixed(2),
        profit: profit.toFixed(2),
        payout: payout.toFixed(2),
        impliedProbability: (impliedProbability * 100).toFixed(2)
      });
    } else if (betType === 'parlay') {
      let totalOdds = 1;
      let totalStake = 0;
      let isValid = true;

      parlayLegs.forEach(leg => {
        const legOdds = parseFloat(leg.odds);
        const legStake = parseFloat(leg.stake);

        if (isNaN(legOdds) || isNaN(legStake)) {
          isValid = false;
          return;
        }

        totalStake += legStake;

        if (oddsFormat === 'american') {
          if (legOdds > 0) {
            totalOdds *= (1 + legOdds / 100);
          } else {
            totalOdds *= (1 + 100 / Math.abs(legOdds));
          }
        } else if (oddsFormat === 'decimal') {
          totalOdds *= legOdds;
        }
      });

      if (!isValid) {
        alert('Please enter valid numbers for all legs');
        return;
      }

      const profit = (totalStake * totalOdds) - totalStake;
      const payout = totalStake + profit;
      const impliedProbability = 1 / totalOdds;

      setResult({
        stake: totalStake.toFixed(2),
        profit: profit.toFixed(2),
        payout: payout.toFixed(2),
        impliedProbability: (impliedProbability * 100).toFixed(2)
      });
    }
  };

  const addParlayLeg = () => {
    setParlayLegs([...parlayLegs, { odds: '', stake: '' }]);
  };

  const removeParlayLeg = (index) => {
    const newLegs = parlayLegs.filter((_, i) => i !== index);
    setParlayLegs(newLegs);
  };

  const updateParlayLeg = (index, field, value) => {
    const newLegs = [...parlayLegs];
    newLegs[index][field] = value;
    setParlayLegs(newLegs);
  };

  const GridBettingLayout = () => {
    const [grid, setGrid] = useState([]);
    const [numRows, setNumRows] = useState(3);
    const [numCols, setNumCols] = useState(3);
    const [homeTeam, setHomeTeam] = useState('');
    const [awayTeam, setAwayTeam] = useState('');
    const [quarter, setQuarter] = useState('Q1');
    const [selectedCells, setSelectedCells] = useState([]);

    useEffect(() => {
      const newGrid = Array(numRows).fill(null).map(() => Array(numCols).fill(''));
      setGrid(newGrid);
      setSelectedCells([]);
    }, [numRows, numCols]);

    const updateCell = (row, col, value) => {
      const newGrid = [...grid];
      newGrid[row][col] = value;
      setGrid(newGrid);
    };

    const toggleCellSelection = (row, col) => {
      const cellKey = `${row}-${col}`;
      if (selectedCells.includes(cellKey)) {
        setSelectedCells(selectedCells.filter(key => key !== cellKey));
      } else {
        setSelectedCells([...selectedCells, cellKey]);
      }
    };

    const clearGrid = () => {
      const newGrid = Array(numRows).fill(null).map(() => Array(numCols).fill(''));
      setGrid(newGrid);
      setSelectedCells([]);
    };

    const exportGrid = () => {
      const data = {
        homeTeam,
        awayTeam,
        quarter,
        grid,
        selectedCells
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `betting-grid-${homeTeam}-${awayTeam}-${quarter}.json`;
      a.click();
    };

    return (
      <div className="card shadow-lg mt-4">
        <div className="card-header bg-success text-white">
          <h3 className="mb-0">Grid Betting Layout</h3>
        </div>
        <div className="card-body">
          <div className="row mb-4">
            <div className="col-md-3">
              <label className="form-label">Home Team</label>
              <input
                type="text"
                className="form-control"
                value={homeTeam}
                onChange={(e) => setHomeTeam(e.target.value)}
                placeholder="e.g., Lakers"
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Away Team</label>
              <input
                type="text"
                className="form-control"
                value={awayTeam}
                onChange={(e) => setAwayTeam(e.target.value)}
                placeholder="e.g., Warriors"
              />
            </div>
            <div className="col-md-2">
              <label className="form-label">Quarter</label>
              <select
                className="form-select"
                value={quarter}
                onChange={(e) => setQuarter(e.target.value)}
              >
                <option value="Q1">Q1</option>
                <option value="Q2">Q2</option>
                <option value="Q3">Q3</option>
                <option value="Q4">Q4</option>
                <option value="Full Game">Full Game</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label">Rows</label>
              <input
                type="number"
                className="form-control"
                min="2"
                max="10"
                value={numRows}
                onChange={(e) => setNumRows(parseInt(e.target.value) || 3)}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label">Columns</label>
              <input
                type="number"
                className="form-control"
                min="2"
                max="10"
                value={numCols}
                onChange={(e) => setNumCols(parseInt(e.target.value) || 3)}
              />
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-bordered text-center">
              <thead>
                <tr>
                  <th className="bg-light"></th>
                  {Array(numCols).fill(null).map((_, i) => (
                    <th key={i} className="bg-info text-white">{awayTeam || 'Away'} {i}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    <th className="bg-warning">{homeTeam || 'Home'} {rowIndex}</th>
                    {row.map((cell, colIndex) => (
                      <td
                        key={colIndex}
                        className={selectedCells.includes(`${rowIndex}-${colIndex}`) ? 'table-success' : ''}
                        onClick={() => toggleCellSelection(rowIndex, colIndex)}
                        style={{ cursor: 'pointer', minWidth: '80px' }}
                      >
                        <input
                          type="text"
                          className="form-control form-control-sm text-center"
                          value={cell}
                          onChange={(e) => updateCell(rowIndex, colIndex, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="..."
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="d-flex gap-2 mt-3">
            <button className="btn btn-warning" onClick={clearGrid}>
              Clear Grid
            </button>
            <button className="btn btn-success" onClick={exportGrid}>
              Export Grid
            </button>
          </div>

          <div className="alert alert-info mt-3">
            <strong>Instructions:</strong> Enter values in the grid cells. Click on cells to highlight them.
            The grid represents possible score combinations between {homeTeam || 'Home'} and {awayTeam || 'Away'}.
          </div>

          {selectedCells.length > 0 && (
            <div className="mt-3">
              <h5>Selected Cells: {selectedCells.length}</h5>
              <div className="d-flex flex-wrap gap-2">
                {selectedCells.map(cellKey => {
                  const [row, col] = cellKey.split('-').map(Number);
                  return (
                    <span key={cellKey} className="badge bg-success">
                      {homeTeam || 'Home'}{row} - {awayTeam || 'Away'}{col}: {grid[row][col] || 'empty'}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="landing-page">
      {/* Hero Section */}
      <div className="hero-section text-center text-white py-5" style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        marginTop: '56px'
      }}>
        <div className="container">
          <h1 className="display-3 fw-bold mb-3">EGT Sports Betting Calculator</h1>
          <p className="lead mb-4">Professional-grade betting calculator with advanced features</p>
          <div className="d-flex justify-content-center gap-3">
            <div className="stat-card bg-white bg-opacity-25 p-3 rounded">
              <h3 className="mb-0">10,000+</h3>
              <p className="mb-0">Active Users</p>
            </div>
            <div className="stat-card bg-white bg-opacity-25 p-3 rounded">
              <h3 className="mb-0">$1M+</h3>
              <p className="mb-0">Calculated Daily</p>
            </div>
            <div className="stat-card bg-white bg-opacity-25 p-3 rounded">
              <h3 className="mb-0">99.9%</h3>
              <p className="mb-0">Accuracy</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Calculator Section */}
      <div className="container my-5">
        <div className="row">
          <div className="col-lg-8 mx-auto">
            {/* Calculator Card */}
            <div className="card shadow-lg border-0">
              <div className="card-header bg-primary text-white">
                <h2 className="mb-0">Betting Calculator</h2>
              </div>
              <div className="card-body p-4">
                {/* Bet Type Selection */}
                <div className="mb-4">
                  <label className="form-label fw-bold">Bet Type</label>
                  <div className="btn-group w-100" role="group">
                    <button
                      type="button"
                      className={`btn ${betType === 'straight' ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => setBetType('straight')}
                    >
                      Straight Bet
                    </button>
                    <button
                      type="button"
                      className={`btn ${betType === 'parlay' ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => setBetType('parlay')}
                    >
                      Parlay
                    </button>
                  </div>
                </div>

                {/* Odds Format Selection */}
                <div className="mb-4">
                  <label className="form-label fw-bold">Odds Format</label>
                  <select
                    className="form-select"
                    value={oddsFormat}
                    onChange={(e) => setOddsFormat(e.target.value)}
                  >
                    <option value="american">American (e.g., -110, +150)</option>
                    <option value="decimal">Decimal (e.g., 1.91, 2.50)</option>
                    <option value="fractional">Fractional (e.g., 10/11, 3/2)</option>
                  </select>
                </div>

                {/* Straight Bet Inputs */}
                {betType === 'straight' && (
                  <div>
                    <div className="mb-3">
                      <label className="form-label fw-bold">Odds</label>
                      <input
                        type="text"
                        className="form-control form-control-lg"
                        placeholder={oddsFormat === 'american' ? 'e.g., -110 or +150' : oddsFormat === 'decimal' ? 'e.g., 1.91' : 'e.g., 10/11'}
                        value={odds}
                        onChange={(e) => setOdds(e.target.value)}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold">Stake ($)</label>
                      <input
                        type="number"
                        className="form-control form-control-lg"
                        placeholder="Enter amount"
                        value={stake}
                        onChange={(e) => setStake(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Parlay Inputs */}
                {betType === 'parlay' && (
                  <div>
                    {parlayLegs.map((leg, index) => (
                      <div key={index} className="card mb-3 bg-light">
                        <div className="card-body">
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <h5 className="mb-0">Leg {index + 1}</h5>
                            {parlayLegs.length > 1 && (
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => removeParlayLeg(index)}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <div className="row">
                            <div className="col-md-6 mb-2">
                              <label className="form-label">Odds</label>
                              <input
                                type="text"
                                className="form-control"
                                placeholder={oddsFormat === 'american' ? 'e.g., -110' : oddsFormat === 'decimal' ? 'e.g., 1.91' : 'e.g., 10/11'}
                                value={leg.odds}
                                onChange={(e) => updateParlayLeg(index, 'odds', e.target.value)}
                              />
                            </div>
                            <div className="col-md-6 mb-2">
                              <label className="form-label">Stake ($)</label>
                              <input
                                type="number"
                                className="form-control"
                                placeholder="Amount"
                                value={leg.stake}
                                onChange={(e) => updateParlayLeg(index, 'stake', e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <button
                      className="btn btn-outline-primary w-100 mb-3"
                      onClick={addParlayLeg}
                    >
                      + Add Another Leg
                    </button>
                  </div>
                )}

                {/* Calculate Button */}
                <button
                  className="btn btn-primary btn-lg w-100 mb-3"
                  onClick={calculatePayout}
                >
                  Calculate Payout
                </button>

                {/* Results */}
                {result && (
                  <div className="alert alert-success">
                    <h4 className="alert-heading">Results</h4>
                    <hr />
                    <div className="row text-center">
                      <div className="col-md-3">
                        <p className="mb-0 text-muted">Total Stake</p>
                        <h5 className="mb-0">${result.stake}</h5>
                      </div>
                      <div className="col-md-3">
                        <p className="mb-0 text-muted">Profit</p>
                        <h5 className="mb-0 text-success">${result.profit}</h5>
                      </div>
                      <div className="col-md-3">
                        <p className="mb-0 text-muted">Total Payout</p>
                        <h5 className="mb-0 fw-bold">${result.payout}</h5>
                      </div>
                      <div className="col-md-3">
                        <p className="mb-0 text-muted">Implied Probability</p>
                        <h5 className="mb-0">{result.impliedProbability}%</h5>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Tips Card */}
            <div className="card shadow-lg border-0 mt-4">
              <div className="card-header bg-info text-white">
                <h3 className="mb-0">Quick Tips</h3>
              </div>
              <div className="card-body">
                <ul className="list-unstyled">
                  <li className="mb-2">
                    <i className="bi bi-check-circle-fill text-success me-2"></i>
                    <strong>American Odds:</strong> Negative odds show how much you need to bet to win $100. Positive odds show how much you win on a $100 bet.
                  </li>
                  <li className="mb-2">
                    <i className="bi bi-check-circle-fill text-success me-2"></i>
                    <strong>Decimal Odds:</strong> Multiply your stake by the decimal to get total return (including stake).
                  </li>
                  <li className="mb-2">
                    <i className="bi bi-check-circle-fill text-success me-2"></i>
                    <strong>Parlay Bets:</strong> All legs must win for the parlay to pay out. Higher risk, higher reward.
                  </li>
                  <li className="mb-2">
                    <i className="bi bi-check-circle-fill text-success me-2"></i>
                    <strong>Implied Probability:</strong> Shows the likelihood of an outcome based on the odds.
                  </li>
                </ul>
              </div>
            </div>

            <div className="text-center text-white mb-4" style={{ marginTop: '2rem' }}>
              <h2 className="display-5" style={{ color: '#333' }}>Grid Betting System</h2>
              <p className="lead" style={{ color: '#666' }}>Track and analyze your betting grids for better strategy</p>
            </div>

            <GridBettingLayout />
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-light py-5">
        <div className="container">
          <h2 className="text-center mb-5">Why Choose EGT Sports?</h2>
          <div className="row">
            <div className="col-md-4 mb-4">
              <div className="card h-100 text-center shadow">
                <div className="card-body">
                  <div className="feature-icon bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '60px', height: '60px' }}>
                    <i className="bi bi-calculator fs-3"></i>
                  </div>
                  <h4>Accurate Calculations</h4>
                  <p className="text-muted">Professional-grade algorithms ensure precise calculations every time.</p>
                </div>
              </div>
            </div>
            <div className="col-md-4 mb-4">
              <div className="card h-100 text-center shadow">
                <div className="card-body">
                  <div className="feature-icon bg-success text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '60px', height: '60px' }}>
                    <i className="bi bi-graph-up fs-3"></i>
                  </div>
                  <h4>Multiple Bet Types</h4>
                  <p className="text-muted">Support for straight bets, parlays, teasers, and more exotic bet types.</p>
                </div>
              </div>
            </div>
            <div className="col-md-4 mb-4">
              <div className="card h-100 text-center shadow">
                <div className="card-body">
                  <div className="feature-icon bg-warning text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '60px', height: '60px' }}>
                    <i className="bi bi-shield-check fs-3"></i>
                  </div>
                  <h4>Safe & Secure</h4>
                  <p className="text-muted">Your data is protected with industry-standard security measures.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-primary text-white py-5">
        <div className="container text-center">
          <h2 className="mb-4">Ready to Make Smarter Bets?</h2>
          <p className="lead mb-4">Join thousands of bettors using our professional calculator</p>
          <button className="btn btn-light btn-lg">Get Started Free</button>
        </div>
      </div>
    </div>
  );
}

// Main App Component
function App() {
  return (
    <div className="App">
      <Navbar />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
      </Routes>
      <Footer />
    </div>
  );
}

export default App;