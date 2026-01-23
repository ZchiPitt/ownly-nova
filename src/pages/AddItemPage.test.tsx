import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('heic2any', () => ({ default: vi.fn() }));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'test-user' } }),
}));

import { AddItemPage } from './AddItemPage';

describe('AddItemPage Quick Add', () => {
  it('renders the capture view', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AddItemPage />
      </QueryClientProvider>
    );

    expect(screen.getByText('Add Item')).toBeInTheDocument();
  });
});
