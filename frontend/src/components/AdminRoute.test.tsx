/**
 * Tests for AdminRoute Component
 *
 * Tests cover:
 * - Unauthenticated users see login modal
 * - Authenticated non-admin users see permission denied modal
 * - Authenticated admin users see admin content
 * - Loading and unloading states
 * - Clerk metadata.admin claim checking
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { AdminRoute } from './AdminRoute';

// Mock Clerk
jest.mock('@clerk/clerk-react');

// Mock the child component
const TestAdminChild = () => <div data-testid="admin-child">Admin Dashboard Content</div>;

// Helper: Render AdminRoute with necessary providers
const renderAdminRoute = () => {
  return render(
    <BrowserRouter>
      <AdminRoute>
        <TestAdminChild />
      </AdminRoute>
    </BrowserRouter>
  );
};

describe('AdminRoute Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading skeleton while Clerk loads', () => {
      (useUser as jest.Mock).mockReturnValue({
        isLoaded: false,
        isSignedIn: false,
        user: null,
      });

      renderAdminRoute();

      const skeleton = screen.getByRole('img', { hidden: true });
      expect(skeleton).toBeInTheDocument();
    });
  });

  describe('Unauthenticated Users', () => {
    it('should show login required modal when not signed in', async () => {
      (useUser as jest.Mock).mockReturnValue({
        isLoaded: true,
        isSignedIn: false,
        user: null,
      });

      renderAdminRoute();

      await waitFor(() => {
        expect(screen.getByText('Login Required')).toBeInTheDocument();
      });

      expect(screen.getByText(/sign in to continue/i)).toBeInTheDocument();
    });

    it('should show sign in button in login modal', async () => {
      (useUser as jest.Mock).mockReturnValue({
        isLoaded: true,
        isSignedIn: false,
        user: null,
      });

      renderAdminRoute();

      await waitFor(() => {
        expect(screen.getByText(/Sign In \/ Sign Up/i)).toBeInTheDocument();
      });
    });

    it('should not render admin content when not signed in', () => {
      (useUser as jest.Mock).mockReturnValue({
        isLoaded: true,
        isSignedIn: false,
        user: null,
      });

      renderAdminRoute();

      expect(screen.queryByTestId('admin-child')).not.toBeInTheDocument();
    });
  });

  describe('Authenticated Non-Admin Users', () => {
    it('should show access denied modal for non-admin users', async () => {
      (useUser as jest.Mock).mockReturnValue({
        isLoaded: true,
        isSignedIn: true,
        user: {
          id: 'user_123',
          fullName: 'Regular User',
          publicMetadata: { admin: false },  // Explicitly not admin
        },
      });

      renderAdminRoute();

      await waitFor(() => {
        expect(screen.getByText('Access Denied')).toBeInTheDocument();
      });

      expect(
        screen.getByText(/You do not have admin permissions/i)
      ).toBeInTheDocument();
    });

    it('should show access denied modal when metadata is missing', async () => {
      (useUser as jest.Mock).mockReturnValue({
        isLoaded: true,
        isSignedIn: true,
        user: {
          id: 'user_456',
          fullName: 'Another User',
          publicMetadata: {},  // No admin flag
        },
      });

      renderAdminRoute();

      await waitFor(() => {
        expect(screen.getByText('Access Denied')).toBeInTheDocument();
      });
    });

    it('should show access denied modal when metadata is undefined', async () => {
      (useUser as jest.Mock).mockReturnValue({
        isLoaded: true,
        isSignedIn: true,
        user: {
          id: 'user_789',
          fullName: 'Yet Another User',
          publicMetadata: undefined,
        },
      });

      renderAdminRoute();

      await waitFor(() => {
        expect(screen.getByText('Access Denied')).toBeInTheDocument();
      });
    });

    it('should not render admin content for non-admin users', async () => {
      (useUser as jest.Mock).mockReturnValue({
        isLoaded: true,
        isSignedIn: true,
        user: {
          id: 'user_non_admin',
          fullName: 'Non Admin User',
          publicMetadata: { admin: false },
        },
      });

      renderAdminRoute();

      await waitFor(() => {
        expect(screen.getByText('Access Denied')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('admin-child')).not.toBeInTheDocument();
    });

    it('should have close button on permission denied modal', async () => {
      (useUser as jest.Mock).mockReturnValue({
        isLoaded: true,
        isSignedIn: true,
        user: {
          id: 'user_with_close',
          fullName: 'User With Close',
          publicMetadata: { admin: false },
        },
      });

      renderAdminRoute();

      await waitFor(() => {
        expect(screen.getByText('Access Denied')).toBeInTheDocument();
      });

      const continueButton = screen.getByText(/continue with general news/i);
      expect(continueButton).toBeInTheDocument();
    });
  });

  describe('Authenticated Admin Users', () => {
    it('should show admin content when user has metadata.admin=true', async () => {
      (useUser as jest.Mock).mockReturnValue({
        isLoaded: true,
        isSignedIn: true,
        user: {
          id: 'user_admin_123',
          fullName: 'Admin User',
          publicMetadata: { admin: true },  // Admin flag present
        },
      });

      renderAdminRoute();

      await waitFor(() => {
        expect(screen.getByTestId('admin-child')).toBeInTheDocument();
      });

      expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
      expect(screen.queryByText('Login Required')).not.toBeInTheDocument();
    });

    it('should render admin content without loading skeleton', async () => {
      (useUser as jest.Mock).mockReturnValue({
        isLoaded: true,
        isSignedIn: true,
        user: {
          id: 'user_admin_456',
          fullName: 'Another Admin',
          publicMetadata: { admin: true },
        },
      });

      renderAdminRoute();

      await waitFor(() => {
        expect(screen.getByTestId('admin-child')).toBeInTheDocument();
      });

      // Verify no skeleton/loading state visible
      expect(screen.queryByRole('img', { hidden: true })).not.toBeInTheDocument();
    });

    it('should not show any modal for admin users', async () => {
      (useUser as jest.Mock).mockReturnValue({
        isLoaded: true,
        isSignedIn: true,
        user: {
          id: 'user_admin_789',
          fullName: 'Third Admin',
          publicMetadata: { admin: true },
        },
      });

      renderAdminRoute();

      await waitFor(() => {
        expect(screen.getByTestId('admin-child')).toBeInTheDocument();
      });

      expect(screen.queryByText('Login Required')).not.toBeInTheDocument();
      expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
    });
  });

  describe('State Transitions', () => {
    it('should handle loading then unauthenticated transition', async () => {
      const { rerender } = render(
        <BrowserRouter>
          <AdminRoute>
            <TestAdminChild />
          </AdminRoute>
        </BrowserRouter>
      );

      // Start loading
      (useUser as jest.Mock).mockReturnValue({
        isLoaded: false,
        isSignedIn: false,
        user: null,
      });
      rerender(
        <BrowserRouter>
          <AdminRoute>
            <TestAdminChild />
          </AdminRoute>
        </BrowserRouter>
      );

      // Loading state shown
      await waitFor(() => {
        expect(screen.queryByText('Login Required')).not.toBeInTheDocument();
      });

      // Then load as unauthenticated
      (useUser as jest.Mock).mockReturnValue({
        isLoaded: true,
        isSignedIn: false,
        user: null,
      });
      rerender(
        <BrowserRouter>
          <AdminRoute>
            <TestAdminChild />
          </AdminRoute>
        </BrowserRouter>
      );

      // Login modal should now be visible
      await waitFor(() => {
        expect(screen.getByText('Login Required')).toBeInTheDocument();
      });
    });

    it('should handle transition from loading to admin user', async () => {
      const { rerender } = render(
        <BrowserRouter>
          <AdminRoute>
            <TestAdminChild />
          </AdminRoute>
        </BrowserRouter>
      );

      // Start loading
      (useUser as jest.Mock).mockReturnValue({
        isLoaded: false,
        isSignedIn: false,
        user: null,
      });

      // Load as admin user
      (useUser as jest.Mock).mockReturnValue({
        isLoaded: true,
        isSignedIn: true,
        user: {
          id: 'user_admin_transition',
          fullName: 'Transition Admin',
          publicMetadata: { admin: true },
        },
      });
      rerender(
        <BrowserRouter>
          <AdminRoute>
            <TestAdminChild />
          </AdminRoute>
        </BrowserRouter>
      );

      // Admin content should be rendered
      await waitFor(() => {
        expect(screen.getByTestId('admin-child')).toBeInTheDocument();
      });
    });
  });

  describe('Metadata Edge Cases', () => {
    it('should treat admin=false as non-admin', async () => {
      (useUser as jest.Mock).mockReturnValue({
        isLoaded: true,
        isSignedIn: true,
        user: {
          id: 'user_explicit_false',
          fullName: 'Explicit False User',
          publicMetadata: { admin: false },
        },
      });

      renderAdminRoute();

      await waitFor(() => {
        expect(screen.getByText('Access Denied')).toBeInTheDocument();
      });
    });

    it('should treat admin=0 or other falsy values as non-admin', async () => {
      (useUser as jest.Mock).mockReturnValue({
        isLoaded: true,
        isSignedIn: true,
        user: {
          id: 'user_falsy',
          fullName: 'Falsy User',
          publicMetadata: { admin: 0 },
        },
      });

      renderAdminRoute();

      await waitFor(() => {
        expect(screen.getByText('Access Denied')).toBeInTheDocument();
      });
    });

    it('should only treat admin=true as admin (not truthy strings)', async () => {
      (useUser as jest.Mock).mockReturnValue({
        isLoaded: true,
        isSignedIn: true,
        user: {
          id: 'user_string_true',
          fullName: 'String True User',
          publicMetadata: { admin: 'true' },  // String, not boolean true
        },
      });

      renderAdminRoute();

      await waitFor(() => {
        expect(screen.getByText('Access Denied')).toBeInTheDocument();
      });
    });
  });
});
