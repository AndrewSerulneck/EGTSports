import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

test('renders welcome landing page with sport selection', async () => {
  render(<App />);
  
  // Wait for the loading to complete and welcome page to show
  await waitFor(() => {
    expect(screen.getByText(/Welcome to EGT Sports/i)).toBeInTheDocument();
  }, { timeout: 5000 });
  
  // Check for subtitle
  expect(screen.getByText(/Select Your Sport to Get Started/i)).toBeInTheDocument();
  
  // Check for NFL button (should be enabled)
  const nflButton = screen.getByRole('button', { name: /NFL/i });
  expect(nflButton).toBeInTheDocument();
  expect(nflButton).not.toBeDisabled();
  
  // Check for NBA button (should be disabled with Coming Soon)
  const nbaButton = screen.getByRole('button', { name: /NBA/i });
  expect(nbaButton).toBeInTheDocument();
  expect(nbaButton).toBeDisabled();
  
  // Check for "Coming Soon" badges (should be 4 of them)
  const comingSoonBadges = screen.getAllByText(/Coming Soon/i);
  expect(comingSoonBadges).toHaveLength(4);
});
