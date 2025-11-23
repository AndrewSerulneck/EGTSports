import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import App from './App';

// Helper to render App with Router
const renderApp = () => {
  return render(
    <MemoryRouter>
      <App />
    </MemoryRouter>
  );
};

test('renders auth landing page with role selection', async () => {
  renderApp();
  const headingElement = await screen.findByText(/Welcome to EGT Sports/i);
  expect(headingElement).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Member Login/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Admin Login/i })).toBeInTheDocument();
});

test('clicking Member Login shows login form', async () => {
  renderApp();
  const memberButton = await screen.findByRole('button', { name: /Member Login/i });
  await userEvent.click(memberButton);
  
  // Should navigate to login page
  await waitFor(() => {
    expect(screen.getByText(/User Login/i)).toBeInTheDocument();
  });
  expect(screen.getByPlaceholderText(/Email/i)).toBeInTheDocument();
  expect(screen.getByPlaceholderText(/Password/i)).toBeInTheDocument();
});

test('clicking Admin Login shows admin login form', async () => {
  renderApp();
  const adminButton = await screen.findByRole('button', { name: /Admin Login/i });
  await userEvent.click(adminButton);
  
  // Should navigate to admin login page
  await waitFor(() => {
    expect(screen.getByText(/Admin Login/i)).toBeInTheDocument();
  });
  expect(screen.getByPlaceholderText(/Admin Email/i)).toBeInTheDocument();
  expect(screen.getByPlaceholderText(/Password/i)).toBeInTheDocument();
});

test('login form has back button', async () => {
  renderApp();
  const memberButton = await screen.findByRole('button', { name: /Member Login/i });
  await userEvent.click(memberButton);
  
  await waitFor(() => {
    expect(screen.getByText(/User Login/i)).toBeInTheDocument();
  });
  
  // Should have a back button
  const backButton = screen.getByRole('button', { name: /Back/i });
  expect(backButton).toBeInTheDocument();
});
