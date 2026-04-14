import React, { Suspense, lazy, useEffect, useState } from 'react';
import {
  BookOpen,
  Bookmark,
  Check,
  Clock3,
  Copy,
  Files,
  Flame,
  Layers,
  LogOut,
  Pencil,
  Timer,
  Upload,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';
import { EditProfileModal } from '../components/EditProfileModal.tsx';
import { userService } from '../services/user.service';
import type { ProfileAnalyticsResponse } from '../services/user.service';

const ProfileAnalyticsCharts = lazy(() => import('../components/profile/ProfileAnalyticsCharts'));

// Updated badge tier list (synchronized with backend badge_policy.py)
// This list should match the BADGE_TIERS defined in backend/app/services/badge_policy.py
const BADGE_TIERS = ['Curious Reader', 'Regular', 'Power Reader', 'News Addict'];

// Helper: Safely get the current badge tier with fallback chain
const getCurrentBadgeTier = (tier4?: any, tier3?: any): string => {
  // Primary: use tier4.badge.current_tier from new policy
  if (tier4?.badge?.current_tier && typeof tier4.badge.current_tier === 'string') {
    return tier4.badge.current_tier;
  }
  // Fallback: use tier3.engagement_label (legacy label for compatibility)
  if (tier3?.engagement_label && typeof tier3.engagement_label === 'string') {
    return tier3.engagement_label;
  }
  // Final fallback
  return 'Curious Reader';
};

// Helper: Normalize tier name in case of minor discrepancies
const normalizeTierName = (name: string): string => {
  return name?.trim() || 'Curious Reader';
};

const formatTrend = (value: number | undefined) => {
  const trend = value ?? 0;
  const direction = trend >= 0 ? '↑' : '↓';
  return `${direction} ${Math.abs(trend)}% this week`;
};

const HeroKpiCard: React.FC<{
  label: string;
  value: React.ReactNode;
  subText?: string;
  icon?: React.ReactNode;
}> = ({ label, value, subText, icon }) => {
  return (
    <div className="rounded-2xl border border-indigo-100/80 bg-white/90 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{label}</p>
        {icon ? <span className="text-indigo-500 dark:text-indigo-300">{icon}</span> : null}
      </div>
      <div className="text-2xl font-black leading-none text-slate-900 dark:text-white">{value}</div>
      {subText ? <p className="mt-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">{subText}</p> : null}
    </div>
  );
};

const BadgeChip: React.FC<{ label: string; active: boolean }> = ({ label, active }) => {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${
        active
          ? 'bg-gradient-to-r from-[#6C63FF] to-purple-500 text-white shadow-md shadow-indigo-300/40 dark:shadow-indigo-900/40'
          : 'border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
      }`}
    >
      {label}
    </span>
  );
};

const RelativeTime: React.FC<{ timestamp: string }> = ({ timestamp }) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return <span>Unknown</span>;
  }
  return <span>{date.toLocaleString()}</span>;
};

export const Profile: React.FC = () => {
  const { signOut } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [analytics, setAnalytics] = useState<ProfileAnalyticsResponse | null>(null);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUsernameCopied, setIsUsernameCopied] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  useEffect(() => {
    let isActive = true;
    userService
      .getProfileAnalytics()
      .then((res) => {
        if (!isActive) return;
        setAnalytics(res);
      })
      .catch(() => {
        if (!isActive) return;
        setAnalytics(null);
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoadingStats(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    try {
      setIsUploadingAvatar(true);
      setUploadError(null);
      await user.setProfileImage({ file });
    } catch {
      setUploadError('Failed to update profile image. Please try another file.');
    } finally {
      setIsUploadingAvatar(false);
      event.target.value = '';
    }
  };

  const handleCopyUsername = async () => {
    try {
      await navigator.clipboard.writeText(userData.handle);
      setIsUsernameCopied(true);
      window.setTimeout(() => setIsUsernameCopied(false), 1200);
    } catch {
      setIsUsernameCopied(false);
    }
  };

  const userData = {
    name: user?.fullName || user?.firstName || user?.username || 'User',
    handle: `@${user?.username || 'user'}`,
    email: user?.primaryEmailAddress?.emailAddress || '',
    bio: 'News enthusiast using NewsAura to stay informed.',
    avatar: user?.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username || 'user'}`,
  };

  const tier1 = analytics?.tier1;
  const tier2 = analytics?.tier2;
  const tier3 = analytics?.tier3;
  const tier4 = analytics?.tier4;
  const trendLabel = `${tier4?.weekly_trend_percent ?? 0}% this week`;
  const statTrends = tier4?.stat_trends;

  const weeklyActivity = tier2?.weekly_activity ?? [];
  const categoryData = (tier2?.category_breakdown ?? []).slice(0, 6);
  const recentActivity = tier4?.recent_activity ?? [];

  const placeholder = <span className="inline-block h-7 w-14 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />;
  const valueOr = (value: React.ReactNode) => (isLoadingStats ? placeholder : value);

  return (
    <div className="min-h-screen bg-slate-50 py-0 dark:bg-slate-900">
      <div className="mx-auto w-full max-w-[1600px] px-3 md:px-6 xl:px-8">
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:items-stretch">
          <div className="space-y-4 xl:col-span-8">
            <div className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-xl shadow-indigo-100/30 dark:border-slate-700/80 dark:bg-slate-800 dark:shadow-slate-950/50">
              <div className="h-16 bg-gradient-to-r from-indigo-600/85 via-indigo-500/80 to-violet-500/80 md:h-20" />

              <div className="relative -mt-8 px-5 pb-5 md:px-8">
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-12 xl:gap-6">
                  <div className="xl:col-span-7">
                    <div className="relative flex flex-col gap-4 md:flex-row md:items-start">
                    <div className="relative mt-2 md:mt-4 flex flex-col items-start">
                      <div className="relative h-28 w-28 rounded-3xl border-4 border-white bg-white p-1 shadow-xl dark:border-slate-800 dark:bg-slate-800">
                        <img src={userData.avatar} alt={userData.name} className="h-full w-full rounded-[1.2rem] object-cover" />
                        <label className="absolute -bottom-2 -right-2 inline-flex cursor-pointer items-center gap-1 rounded-full bg-[#6C63FF] px-3 py-1 text-[11px] font-bold text-white shadow-md shadow-indigo-300/40">
                          <Upload size={12} />
                          <span>{isUploadingAvatar ? 'Uploading...' : 'Change'}</span>
                          <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={isUploadingAvatar} />
                        </label>
                      </div>

                      <div className="mt-2 w-[140px] rounded-lg border border-white/80 bg-white/95 px-2.5 py-1.5 shadow-md shadow-indigo-200/30 backdrop-blur dark:border-slate-700/80 dark:bg-slate-900/90 dark:shadow-slate-950/40">
                        <p className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Username</p>
                        <button
                          type="button"
                          onClick={handleCopyUsername}
                          className="inline-flex w-full items-center justify-between gap-1 rounded-md px-0.5 py-0.5 text-left transition-colors hover:bg-indigo-50 dark:hover:bg-slate-800/70"
                          title="Copy username"
                          aria-label="Copy username"
                        >
                          <span className="truncate text-sm font-bold text-[#6C63FF]">{userData.handle}</span>
                          <span className="text-indigo-500 dark:text-indigo-300">
                            {isUsernameCopied ? <Check size={14} /> : <Copy size={14} />}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="pt-3 md:pt-10">
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{userData.email}</p>
                      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">{userData.bio}</p>
                      {uploadError ? <p className="mt-2 text-xs font-semibold text-red-500">{uploadError}</p> : null}

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => setIsEditProfileOpen(true)}
                          className="inline-flex h-11 items-center gap-2 rounded-xl border border-indigo-300 bg-indigo-50 px-4 text-sm font-bold text-indigo-700 transition-all hover:-translate-y-0.5 hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-indigo-500/70 dark:bg-indigo-500/20 dark:text-indigo-200 dark:hover:bg-indigo-500/30"
                        >
                          <Pencil size={16} />
                          <span>Edit Profile</span>
                        </button>
                        <button
                          onClick={handleLogout}
                          className="inline-flex h-11 items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 text-sm font-bold text-rose-700 transition-all hover:-translate-y-0.5 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 dark:border-rose-500/70 dark:bg-rose-500/20 dark:text-rose-200 dark:hover:bg-rose-500/30"
                        >
                          <LogOut size={16} />
                          <span>Logout</span>
                        </button>
                      </div>

                    </div>
                    </div>
                  </div>

                  <div className="xl:col-span-5 xl:pt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <HeroKpiCard label="Articles Read" value={valueOr(tier1?.articles_read ?? 0)} icon={<BookOpen size={14} />} subText={formatTrend(statTrends?.articles_read)} />
                      <HeroKpiCard label="Bookmarks" value={valueOr(tier1?.bookmarks ?? 0)} icon={<Bookmark size={14} />} subText={formatTrend(statTrends?.bookmarks)} />
                      <HeroKpiCard label="Read Later" value={valueOr(tier1?.read_later ?? 0)} icon={<Clock3 size={14} />} subText={formatTrend(statTrends?.read_later)} />
                      <HeroKpiCard label="Total Saved" value={valueOr(tier1?.total_saved ?? 0)} icon={<Files size={14} />} subText={formatTrend(statTrends?.total_saved)} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Suspense
              fallback={<div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-slate-100/80 dark:border-slate-700 dark:bg-slate-800/70" />}
            >
              <ProfileAnalyticsCharts weeklyActivity={weeklyActivity} categoryData={categoryData} trendLabel={trendLabel} />
            </Suspense>

          </div>

          <aside className="space-y-4 xl:col-span-4 xl:flex xl:min-h-0 xl:flex-col">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-2.5 dark:border-orange-600/40 dark:from-orange-500/10 dark:to-amber-500/10">
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-orange-500">Reading Streak</p>
                <p className="flex items-center gap-1.5 text-[30px] font-black leading-none text-slate-900 dark:text-white">
                  <Flame className="text-orange-500" size={18} />
                  {tier4?.reading_streak.current ?? 0} days
                </p>
                <p className="mt-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">Best streak: {tier4?.reading_streak.best ?? 0} days</p>
              </div>

              <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-cyan-50 p-2.5 dark:border-sky-600/40 dark:from-sky-500/10 dark:to-cyan-500/10">
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-sky-600">Reading Time Estimate</p>
                <p className="flex items-center gap-1.5 text-[30px] font-black leading-none text-slate-900 dark:text-white">
                  <Timer className="text-sky-500" size={18} />
                  ~{tier4?.reading_time_estimate_minutes_week ?? 0} min
                </p>
                <p className="mt-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">Estimated this week</p>
              </div>
            </div>

            <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-3 dark:border-violet-600/40 dark:from-violet-500/10 dark:to-fuchsia-500/10">
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-violet-600">Most Read Category</p>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-black capitalize text-violet-700 shadow-sm dark:bg-slate-900 dark:text-violet-300">
                <Layers size={14} />
                <span>{tier4?.most_read_category || tier2?.top_category || 'general'}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/60">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">Engagement Badges</h3>
                <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-black text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                  {getCurrentBadgeTier(tier4, tier3)}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {BADGE_TIERS.map((tier) => {
                  const currentTier = getCurrentBadgeTier(tier4, tier3);
                  const isActive = normalizeTierName(tier) === normalizeTierName(currentTier);
                  return <BadgeChip key={tier} label={tier} active={isActive} />;
                })}
              </div>

              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span>Progress to next badge</span>
                  <span>{tier4?.badge.progress_to_next ?? 0}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#6C63FF] to-purple-500 transition-all duration-700" style={{ width: `${tier4?.badge.progress_to_next ?? 0}%` }} />
                </div>
                <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Next: {tier4?.badge.next_tier || 'Top tier reached'}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/60 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Recent Activity</h3>

              {recentActivity.length ? (
                <div className="mt-3 h-[186px] space-y-2 overflow-y-auto pr-1">
                  {recentActivity.map((item) => (
                    <Link
                      key={`${item.url}-${item.timestamp}`}
                      to={`/article-viewer?url=${encodeURIComponent(item.url)}&title=${encodeURIComponent(item.title)}&source=${encodeURIComponent(item.source || '')}`}
                      className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5 transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50/40 dark:border-slate-700 dark:hover:border-indigo-500/50 dark:hover:bg-indigo-500/10"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-800 group-hover:text-[#6C63FF] dark:text-slate-100">{item.title}</p>
                        <div className="mt-1 flex items-center gap-2 text-xs">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold capitalize text-slate-600 dark:bg-slate-800 dark:text-slate-300">{item.category}</span>
                          <span className="text-slate-400 dark:text-slate-500"><RelativeTime timestamp={item.timestamp} /></span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">No recent reading activity yet.</p>
              )}
            </div>
          </aside>
        </section>
      </div>

      <EditProfileModal isOpen={isEditProfileOpen} onClose={() => setIsEditProfileOpen(false)} />
    </div>
  );
};
