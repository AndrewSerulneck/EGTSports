import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

test('renders welcome landing page', async () => {
  render(<App />);
  const headingElement = await screen.findByText(/Welcome to EGT Sports/i);
  expect(headingElement).toBeInTheDocument();
});

test('renders all sport buttons', async () => {
  render(<App />);
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /^NFL$/ })).toBeInTheDocument();
  });
  expect(screen.getByRole('button', { name: /NBA Coming Soon/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /College Football Coming Soon/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /College Basketball Coming Soon/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Major League Baseball Coming Soon/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /NHL Coming Soon/i })).toBeInTheDocument();
});

test('NFL button is enabled', async () => {
  render(<App />);
  const nflButton = await screen.findByRole('button', { name: /^NFL$/ });
  expect(nflButton).toBeEnabled();
});

test('non-NFL buttons are disabled', async () => {
  render(<App />);
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /NBA Coming Soon/i })).toBeDisabled();
  });
  expect(screen.getByRole('button', { name: /NHL Coming Soon/i })).toBeDisabled();
});
