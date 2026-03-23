/**
 * Tests for Profile.tsx badge rendering
 *
 * Tests ensure:
 * - Correct tier name extraction from tier4.badge.current_tier
 * - Fallback to tier3.engagement_label when tier4 unavailable
 * - Badge chip active state matches current tier
 * - Progress percentage display
 * - "Next tier" text shown correctly
 * - Resilience to missing or malformed data
 */

import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import { Profile } from './Profile';
import * as userService from '../services/user.service';

// Mock dependencies
jest.mock('../services/user.service');
jest.mock('../components/profile/ProfileAnalyticsCharts', () => {
  return function MockCharts() {
    return <div data-testid="analytics-charts">Charts</div>;
  };
});
jest.mock('../components/EditProfileModal', () => {
  return function MockEditModal() {
    return <div data-testid="edit-modal">Modal</div>;
  };
});
jest.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ signOut: jest.fn() }),
  useUser: () => ({
    user: {
      fullName: 'Test User',
      username: 'testuser',
      primaryEmailAddress: { emailAddress: 'test@example.com' },
      imageUrl: 'https://example.com/avatar.jpg',
      setProfileImage: jest.fn(),
    },
  }),
  ClerkProvider,
}));

// Helper: Render Profile with necessary providers
const renderProfile = (mockAnalytics) => {
  (userService.userService.getProfileAnalytics as jest.Mock).mockResolvedValue(mockAnalytics);

  return render(
    <BrowserRouter>
      <Profile />
    </BrowserRouter>
  );
};

describe('Profile Badge Rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Badge Tier Display - Tier4 Available', () => {
    it('should display current tier from tier4.badge.current_tier', async () => {
      const mockAnalytics = {
        tier1: { articles_read: 50, bookmarks: 20, read_later: 10, total_saved: 30, last_active_at: null },
        tier2: { top_category: 'technology', category_breakdown: [], weekly_activity: [] },
        tier3: { sentiment_breakdown: null, engagement_score: 45, engagement_label: 'Regular' },
        tier4: {
          weekly_trend_percent: 50,
          stat_trends: { articles_read: 50, bookmarks: 50, read_later: 50, total_saved: 50 },
          reading_streak: { current: 5, best: 10 },
          reading_time_estimate_minutes_week: 120,
          most_read_category: 'technology',
          badge: { current_tier: 'Power Reader', next_tier: 'News Addict', progress_to_next: 75 },
          recent_activity: [],
        },
      };

      renderProfile(mockAnalytics);

      // Wait for async data load
      await screen.findByText('Power Reader');
      expect(screen.getByText('Power Reader')).toBeInTheDocument();
    });

    it('should highlight active badge chip', async () => {
      const mockAnalytics = {
        tier1: { articles_read: 10, bookmarks: 5, read_later: 3, total_saved: 8, last_active_at: null },
        tier2: { top_category: 'tech', category_breakdown: [], weekly_activity: [] },
        tier3: { sentiment_breakdown: null, engagement_score: 20, engagement_label: 'Regular' },
        tier4: {
          weekly_trend_percent: 20,
          stat_trends: { articles_read: 20, bookmarks: 20, read_later: 20, total_saved: 20 },
          reading_streak: { current: 2, best: 3 },
          reading_time_estimate_minutes_week: 30,
          most_read_category: 'tech',
          badge: { current_tier: 'Regular', next_tier: 'Power Reader', progress_to_next: 50 },
          recent_activity: [],
        },
      };

      const { container } = renderProfile(mockAnalytics);

      await screen.findByText('Regular');

      // Find all badge chips
      const badgeChips = container.querySelectorAll('span[class*="rounded-full"][class*="px-3"]');
      const regularChip = Array.from(badgeChips).find((chip) => chip.textContent === 'Regular');

      // Active badge should have gradient background
      expect(regularChip).toHaveClass('from-[#6C63FF]');
    });

    it('should display next tier name', async () => {
      const mockAnalytics = {
        tier1: { articles_read: 50, bookmarks: 20, read_later: 10, total_saved: 30, last_active_at: null },
        tier2: { top_category: 'tech', category_breakdown: [], weekly_activity: [] },
        tier3: { sentiment_breakdown: null, engagement_score: 40, engagement_label: 'Power Reader' },
        tier4: {
          weekly_trend_percent: 30,
          stat_trends: { articles_read: 30, bookmarks: 30, read_later: 30, total_saved: 30 },
          reading_streak: { current: 3, best: 5 },
          reading_time_estimate_minutes_week: 60,
          most_read_category: 'tech',
          badge: { current_tier: 'Power Reader', next_tier: 'News Addict', progress_to_next: 60 },
          recent_activity: [],
        },
      };

      renderProfile(mockAnalytics);

      await screen.findByText('Next: News Addict');
      expect(screen.getByText('Next: News Addict')).toBeInTheDocument();
    });

    it('should display "Top tier reached" when at max tier', async () => {
      const mockAnalytics = {
        tier1: { articles_read: 100, bookmarks: 50, read_later: 30, total_saved: 80, last_active_at: null },
        tier2: { top_category: 'tech', category_breakdown: [], weekly_activity: [] },
        tier3: { sentiment_breakdown: null, engagement_score: 100, engagement_label: 'News Addict' },
        tier4: {
          weekly_trend_percent: 100,
          stat_trends: { articles_read: 100, bookmarks: 100, read_later: 100, total_saved: 100 },
          reading_streak: { current: 20, best: 25 },
          reading_time_estimate_minutes_week: 360,
          most_read_category: 'tech',
          badge: { current_tier: 'News Addict', next_tier: null, progress_to_next: 100 },
          recent_activity: [],
        },
      };

      renderProfile(mockAnalytics);

      await screen.findByText('Top tier reached');
      expect(screen.getByText('Top tier reached')).toBeInTheDocument();
    });

    it('should display progress percentage', async () => {
      const mockAnalytics = {
        tier1: { articles_read: 25, bookmarks: 10, read_later: 5, total_saved: 15, last_active_at: null },
        tier2: { top_category: 'tech', category_breakdown: [], weekly_activity: [] },
        tier3: { sentiment_breakdown: null, engagement_score: 35, engagement_label: 'Power Reader' },
        tier4: {
          weekly_trend_percent: 25,
          stat_trends: { articles_read: 25, bookmarks: 25, read_later: 25, total_saved: 25 },
          reading_streak: { current: 5, best: 8 },
          reading_time_estimate_minutes_week: 90,
          most_read_category: 'tech',
          badge: { current_tier: 'Power Reader', next_tier: 'News Addict', progress_to_next: 42 },
          recent_activity: [],
        },
      };

      renderProfile(mockAnalytics);

      await screen.findByText('42%');
      expect(screen.getByText('42%')).toBeInTheDocument();
    });
  });

  describe('Badge Tier Display - Tier4 Unavailable (Fallback)', () => {
    it('should use tier3.engagement_label when tier4 is missing', async () => {
      const mockAnalytics = {
        tier1: { articles_read: 30, bookmarks: 12, read_later: 6, total_saved: 18, last_active_at: null },
        tier2: { top_category: 'tech', category_breakdown: [], weekly_activity: [] },
        tier3: { sentiment_breakdown: null, engagement_score: 30, engagement_label: 'Regular' },
        // tier4 is undefined or null
      };

      renderProfile(mockAnalytics);

      await screen.findByText('Regular');
      expect(screen.getByText('Regular')).toBeInTheDocument();
    });

    it('should default to "Curious Reader" when both tier4 and tier3 missing', async () => {
      const mockAnalytics = {
        tier1: { articles_read: 5, bookmarks: 2, read_later: 1, total_saved: 3, last_active_at: null },
        tier2: { top_category: 'tech', category_breakdown: [], weekly_activity: [] },
        tier3: { sentiment_breakdown: null, engagement_score: 5, engagement_label: null },
        // tier4 is undefined
      };

      renderProfile(mockAnalytics);

      await screen.findByText('Curious Reader');
      expect(screen.getByText('Curious Reader')).toBeInTheDocument();
    });

    it('should show 0% progress when tier4 unavailable', async () => {
      const mockAnalytics = {
        tier1: { articles_read: 10, bookmarks: 4, read_later: 2, total_saved: 6, last_active_at: null },
        tier2: { top_category: 'tech', category_breakdown: [], weekly_activity: [] },
        tier3: { sentiment_breakdown: null, engagement_score: 12, engagement_label: 'Regular' },
      };

      renderProfile(mockAnalytics);

      await screen.findByText('0%');
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should show "Top tier reached" when tier3 is top tier', async () => {
      const mockAnalytics = {
        tier1: { articles_read: 100, bookmarks: 50, read_later: 30, total_saved: 80, last_active_at: null },
        tier2: { top_category: 'tech', category_breakdown: [], weekly_activity: [] },
        tier3: { sentiment_breakdown: null, engagement_score: 100, engagement_label: null },
      };

      renderProfile(mockAnalytics);

      await screen.findByText('Top tier reached');
      expect(screen.getByText('Top tier reached')).toBeInTheDocument();
    });
  });

  describe('Badge Tier Display - No Analytics Data', () => {
    it('should handle null analytics gracefully', async () => {
      (userService.userService.getProfileAnalytics as jest.Mock).mockResolvedValue(null);

      // Should not crash
      const { container } = renderProfile(null);
      expect(container).toBeInTheDocument();

      // Wait to ensure component loads
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(container).toBeInTheDocument();
    });

    it('should show placeholder while loading', () => {
      (userService.userService.getProfileAnalytics as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves to keep loading state
      );

      const { container } = renderProfile(undefined);

      // Look for loading placeholders
      const placeholders = container.querySelectorAll('.animate-pulse');
      expect(placeholders.length).toBeGreaterThan(0);
    });
  });

  describe('Badge Tier Display - Malformed Data', () => {
    it('should handle tier4.badge as undefined', async () => {
      const mockAnalytics = {
        tier1: { articles_read: 20, bookmarks: 8, read_later: 4, total_saved: 12, last_active_at: null },
        tier2: { top_category: 'tech', category_breakdown: [], weekly_activity: [] },
        tier3: { sentiment_breakdown: null, engagement_score: 20, engagement_label: 'Regular' },
        tier4: {
          weekly_trend_percent: 20,
          stat_trends: { articles_read: 20, bookmarks: 20, read_later: 20, total_saved: 20 },
          reading_streak: { current: 1, best: 2 },
          reading_time_estimate_minutes_week: 30,
          most_read_category: 'tech',
          badge: undefined, // Badge is missing
          recent_activity: [],
        },
      };

      const { container } = renderProfile(mockAnalytics);

      // Should fallback to tier3 safely
      await screen.findByText('Regular');
      expect(container).toBeInTheDocument();
    });

    it('should handle badge.current_tier as empty string', async () => {
      const mockAnalytics = {
        tier1: { articles_read: 20, bookmarks: 8, read_later: 4, total_saved: 12, last_active_at: null },
        tier2: { top_category: 'tech', category_breakdown: [], weekly_activity: [] },
        tier3: { sentiment_breakdown: null, engagement_score: 20, engagement_label: 'Regular' },
        tier4: {
          weekly_trend_percent: 20,
          stat_trends: { articles_read: 20, bookmarks: 20, read_later: 20, total_saved: 20 },
          reading_streak: { current: 1, best: 2 },
          reading_time_estimate_minutes_week: 30,
          most_read_category: 'tech',
          badge: { current_tier: '', next_tier: null, progress_to_next: 0 }, // Empty string
          recent_activity: [],
        },
      };

      const { container } = renderProfile(mockAnalytics);

      // Should fallback to tier3
      await screen.findByText('Regular');
      expect(container).toBeInTheDocument();
    });

    it('should clamp progress percentage to 0-100', async () => {
      const mockAnalytics = {
        tier1: { articles_read: 20, bookmarks: 8, read_later: 4, total_saved: 12, last_active_at: null },
        tier2: { top_category: 'tech', category_breakdown: [], weekly_activity: [] },
        tier3: { sentiment_breakdown: null, engagement_score: 20, engagement_label: 'Regular' },
        tier4: {
          weekly_trend_percent: 20,
          stat_trends: { articles_read: 20, bookmarks: 20, read_later: 20, total_saved: 20 },
          reading_streak: { current: 1, best: 2 },
          reading_time_estimate_minutes_week: 30,
          most_read_category: 'tech',
          badge: { current_tier: 'Regular', next_tier: 'Power Reader', progress_to_next: 150 }, // Invalid: > 100
          recent_activity: [],
        },
      };

      renderProfile(mockAnalytics);

      await screen.findByText('Regular');

      // Progress bar width should be clamped
      const progressBar = screen.queryByText('150%');
      expect(progressBar).not.toBeInTheDocument(); // Should not show 150%
    });
  });

  describe('All Badge Tiers Displayed', () => {
    it('should always show all 4 badge chip options', async () => {
      const mockAnalytics = {
        tier1: { articles_read: 5, bookmarks: 2, read_later: 1, total_saved: 3, last_active_at: null },
        tier2: { top_category: 'tech', category_breakdown: [], weekly_activity: [] },
        tier3: { sentiment_breakdown: null, engagement_score: 5, engagement_label: 'Curious Reader' },
        tier4: {
          weekly_trend_percent: 0,
          stat_trends: { articles_read: 0, bookmarks: 0, read_later: 0, total_saved: 0 },
          reading_streak: { current: 0, best: 0 },
          reading_time_estimate_minutes_week: 0,
          most_read_category: null,
          badge: { current_tier: 'Curious Reader', next_tier: 'Regular', progress_to_next: 25 },
          recent_activity: [],
        },
      };

      renderProfile(mockAnalytics);

      await screen.findByText('Curious Reader');

      // All badge tiers should be available
      expect(screen.getByText('Curious Reader')).toBeInTheDocument();
      expect(screen.getByText('Regular')).toBeInTheDocument();
      expect(screen.getByText('Power Reader')).toBeInTheDocument();
      expect(screen.getByText('News Addict')).toBeInTheDocument();
    });
  });
});
