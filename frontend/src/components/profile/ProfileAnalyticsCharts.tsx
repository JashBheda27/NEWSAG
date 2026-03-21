import React from 'react';
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const CHART_COLORS = ['#6C63FF', '#8B5CF6', '#06B6D4', '#F59E0B', '#10B981', '#EC4899'];

interface Props {
  weeklyActivity: Array<{ day: string; count: number }>;
  categoryData: Array<{ category: string; count: number }>;
  trendLabel: string;
}

export const ProfileAnalyticsCharts: React.FC<Props> = ({ weeklyActivity, categoryData, trendLabel }) => {
  return (
    <div className="mt-7 grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 lg:col-span-2">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 dark:text-white">Weekly Reading Activity</h3>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
            {trendLabel}
          </span>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weeklyActivity}>
              <defs>
                <linearGradient id="weeklyColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#6C63FF" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} width={24} />
              <Tooltip
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  background: 'rgba(255,255,255,0.98)',
                }}
              />
              <Area type="monotone" dataKey="count" stroke="#6C63FF" strokeWidth={3} fill="url(#weeklyColor)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
        <h3 className="mb-3 text-sm font-black text-slate-900 dark:text-white">Top Categories</h3>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={categoryData} innerRadius={45} outerRadius={68} dataKey="count" nameKey="category" paddingAngle={2}>
                {categoryData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {categoryData.map((item, index) => (
            <span key={item.category} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
              {item.category}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProfileAnalyticsCharts;
