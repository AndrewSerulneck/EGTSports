import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

// Mock fetch to avoid actual API calls during tests
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({
      events: [
        {
          id: '401671748',
          date: '2025-01-18T18:00Z',
          competitions: [{
            competitors: [
              { id: '1', team: { displayName: 'Kansas City Chiefs' }, score: '0' },
              { id: '2', team: { displayName: 'Houston Texans' }, score: '0' }
            ]
          }],
          status: { type: { state: 'pre', detail: 'Scheduled' } }
        }
      ]
    })
  })
);

beforeEach(() => {
  fetch.mockClear();
});

test('renders loading state initially', () => {
  render(<App />);
  const loadingElement = screen.getByText(/Loading games from ESPN/i);
  expect(loadingElement).toBeInTheDocument();
});

test('renders EGT Sports header after loading', async () => {
  render(<App />);
  await waitFor(() => {
    const headerElement = screen.getByText(/EGT Sports Parlay Club/i);
    expect(headerElement).toBeInTheDocument();
  });
});

test('renders NFL Picks & Parlays tagline after loading', async () => {
  render(<App />);
  await waitFor(() => {
    const taglineElement = screen.getByText(/NFL Picks & Parlays/i);
    expect(taglineElement).toBeInTheDocument();
  });
});

test('renders payout odds after loading', async () => {
  render(<App />);
  await waitFor(() => {
    const payoutElement = screen.getByText(/Payout Odds/i);
    expect(payoutElement).toBeInTheDocument();
  });
});

test('renders minimum 3 picks required rule after loading', async () => {
  render(<App />);
  await waitFor(() => {
    const ruleElement = screen.getByText(/Minimum 3 picks required/i);
    expect(ruleElement).toBeInTheDocument();
  });
});

test('submit button is disabled initially after loading', async () => {
  render(<App />);
  await waitFor(() => {
    const submitButton = screen.getByRole('button', { name: /Select 3 More/i });
    expect(submitButton).toBeDisabled();
  });
});
