
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';
import { Button } from '../components/ui/Button.tsx';
import { userService } from '../services/user.service';
import type { ProfileAnalyticsResponse } from '../services/user.service';

const StatCard: React.FC<{ label: string; value: React.ReactNode; icon?: React.ReactNode; highlight?: boolean }> = ({ label, value, icon, highlight }) => {
  return (
    <div className={`relative rounded-2xl p-[1px] card-lift transition-all duration-300 ${
      highlight 
        ? 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-indigo-500/20' 
        : 'bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700'
    }`}>
      <div className="relative rounded-[15px] bg-white px-5 py-4 dark:bg-slate-800 h-full">
        {icon ? (
          <div className={`absolute right-4 top-4 ${
            highlight ? 'text-indigo-400 dark:text-indigo-300' : 'text-slate-300 dark:text-slate-500'
          }`}>{icon}</div>
        ) : null}
        <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 dark:text-slate-500">{label}</span>
        <div className={`text-2xl font-black ${
          highlight ? 'text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400' : 'text-slate-900 dark:text-slate-100'
        } animated-counter`}>{value}</div>
      </div>
    </div>
  );
};

export const Profile: React.FC = () => {
  const { signOut } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [analytics, setAnalytics] = useState<ProfileAnalyticsResponse | null>(null);

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

  const userData = {
    name: user?.fullName || user?.firstName || user?.username || "User",
    handle: `@${user?.username || 'user'}`,
    email: user?.primaryEmailAddress?.emailAddress || '',
    bio: "News enthusiast using NewsAura to stay informed.",
    avatar: user?.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username || 'user'}`,
  };

  const placeholder = <span className="inline-block h-6 w-12 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />;
  const valueOr = (value: React.ReactNode) => (isLoadingStats ? placeholder : value);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 page-transition">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="rounded-[2rem] bg-white/95 backdrop-blur-lg border border-slate-200/80 shadow-2xl shadow-slate-200/50 px-6 py-6 md:px-8 md:py-8 dark:bg-slate-800/95 dark:border-slate-700/80 dark:shadow-slate-900/50">
          <div className="flex flex-col md:flex-row items-start gap-8">
            <div className="w-28 h-28 md:w-36 md:h-36 rounded-[2rem] overflow-hidden shadow-xl shadow-indigo-500/10 flex-shrink-0 p-[3px] bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
              <img src={userData.avatar} alt={userData.name} className="w-full h-full object-cover rounded-[1.75rem]" />
            </div>
            <div className="flex-1">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100">{userData.name}</h2>
                  <p className="text-indigo-600 font-bold text-lg dark:text-indigo-400">{userData.handle}</p>
                  <p className="text-sm text-slate-400 mt-1.5 dark:text-slate-500">{userData.email}</p>
                  <p className="text-slate-600 mt-4 max-w-xl leading-relaxed dark:text-slate-400">{userData.bio}</p>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" size="sm" className="!rounded-xl !px-5">Edit Profile</Button>
                  <button
                    onClick={handleLogout}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-red-500 hover:text-white hover:bg-red-500 border-2 border-red-200 hover:border-red-500 transition-all duration-300 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-600 dark:hover:border-red-600"
                  >
                    Logout
                  </button>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Articles Read"
                  value={valueOr(analytics?.tier1.articles_read ?? '—')}
                  icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M4 5a2 2 0 012-2h8a2 2 0 012 2v16l-6-3-6 3V5z" /></svg>}
                />
                <StatCard
                  label="Bookmarks"
                  value={valueOr(analytics?.tier1.bookmarks ?? '—')}
                  icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>}
                />
                <StatCard
                  label="Read Later"
                  value={valueOr(analytics?.tier1.read_later ?? '—')}
                  icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                />
                <StatCard
                  label="Total Saved"
                  value={valueOr(analytics?.tier1.total_saved ?? '—')}
                  icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16v4H4zM4 10h16v10H4z" /></svg>}
                />
              </div>

              <div className="mt-4 grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard
                  label="Top Category"
                  value={valueOr(analytics?.tier2.top_category ?? '—')}
                  icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h16v12H4z" /></svg>}
                />
                <StatCard
                  label="Engagement"
                  value={valueOr(<span className="text-sm font-bold">{analytics?.tier3.engagement_label ?? '—'}</span>)}
                  icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M3 12h3v8H3zM9 8h3v12H9zM15 4h3v16h-3z" /></svg>}
                  highlight={true}
                />
                <StatCard
                  label="Last Active"
                  value={valueOr(analytics?.tier1.last_active_at ? new Date(analytics.tier1.last_active_at).toLocaleDateString() : '—')}
                  icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2v2H5a2 2 0 00-2 2v2h18V6a2 2 0 00-2-2h-2V2h-2v2H9V2H7zm14 8H3v10a2 2 0 002 2h14a2 2 0 002-2V10z" /></svg>}
                />
              </div>

              {!isLoadingStats && analytics?.tier2.weekly_activity?.length ? (
                <div className="mt-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 dark:text-slate-500 flex items-center gap-2">
                    <span className="w-1 h-4 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></span>
                    Weekly Activity
                  </h3>
                  <div className="grid grid-cols-7 gap-2">
                    {analytics.tier2.weekly_activity.map((item, index) => {
                      const maxCount = Math.max(...analytics.tier2.weekly_activity.map(a => a.count), 1);
                      const heightPercent = (item.count / maxCount) * 100;
                      return (
                        <div key={item.day} className="flex flex-col items-center gap-2">
                          <div className="h-20 w-full flex items-end justify-center">
                            <div 
                              className="w-full max-w-[32px] rounded-t-lg bg-gradient-to-t from-indigo-500 to-purple-500 animate-bar transition-all duration-500"
                              style={{ 
                                height: `${Math.max(heightPercent, 8)}%`,
                                animationDelay: `${index * 100}ms`
                              }}
                            />
                          </div>
                          <div className="text-center">
                            <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">{item.day}</span>
                            <span className="block text-xs font-bold text-slate-600 dark:text-slate-300">{item.count}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};