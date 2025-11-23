import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// Mock react-router-dom since we're using routing now
jest.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }) => <div>{children}</div>,
  Routes: ({ children }) => <div data-testid="routes">{children}</div>,
  Route: ({ element }) => <div>{element}</div>,
  useNavigate: () => jest.fn(),
  useParams: () => ({}),
  Navigate: ({ to }) => <div data-testid="navigate">{`Navigate to ${to}`}</div>,
}));

// Helper to render App
const renderApp = () => {
  return render(<App />);
};

test('renders auth landing page with role selection', async () => {
  renderApp();
  const headingElement = await screen.findByText(/Welcome to EGT Sports/i);
  expect(headingElement).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Member login/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Continue as Guest/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Login as Admin/i })).toBeInTheDocument();
});

test('guest flow shows bet type selection', async () => {
  renderApp();
  const guestButton = await screen.findByRole('button', { name: /Continue as Guest/i });
  await userEvent.click(guestButton);
  
  // Should now show bet type selection
  await waitFor(() => {
    expect(screen.getByText(/Choose Your Bet Type/i)).toBeInTheDocument();
  });
  expect(screen.getByRole('button', { name: /Straight Bets/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Parlays/i })).toBeInTheDocument();
});

test('selecting parlay shows sport selection', async () => {
  renderApp();
  const guestButton = await screen.findByRole('button', { name: /Continue as Guest/i });
  await userEvent.click(guestButton);
  
  const parlayButton = await screen.findByRole('button', { name: /Parlays/i });
  await userEvent.click(parlayButton);
  
  // Should now show sport selection with all sports available
  await waitFor(() => {
    expect(screen.getByText(/Select a sport to get started/i)).toBeInTheDocument();
  });
  expect(screen.getByRole('button', { name: /NFL/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /NBA/i })).toBeInTheDocument();
});

test('all sports are enabled', async () => {
  renderApp();
  const guestButton = await screen.findByRole('button', { name: /Continue as Guest/i });
  await userEvent.click(guestButton);
  
  const parlayButton = await screen.findByRole('button', { name: /Parlays/i });
  await userEvent.click(parlayButton);
  
  // All sport buttons should be enabled
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /NFL/i })).toBeEnabled();
  });
  expect(screen.getByRole('button', { name: /NBA/i })).toBeEnabled();
  expect(screen.getByRole('button', { name: /NHL/i })).toBeEnabled();
});
