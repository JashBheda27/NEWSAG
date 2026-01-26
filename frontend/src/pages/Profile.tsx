
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button.tsx';

export const Profile: React.FC = () => {
  const user = {
    name: "Alex Newsman",
    handle: "@alex_aura",
    bio: "Tech enthusiast and heavy news reader. Focused on AI and space exploration.",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
    stats: {
      read: 142,
      saved: 24,
      streak: 12
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 md:p-12 shadow-xl border border-slate-100 dark:border-slate-700">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
          <div className="w-32 h-32 rounded-[2rem] overflow-hidden border-4 border-slate-50 dark:border-slate-900 shadow-2xl flex-shrink-0">
            <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
          </div>
          <div className="text-center md:text-left flex-grow">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-3xl font-black">{user.name}</h2>
                <p className="text-indigo-600 dark:text-indigo-400 font-bold">{user.handle}</p>
              </div>
              <Button variant="outline" size="sm">Edit Profile</Button>
            </div>
            <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium leading-relaxed">
              {user.bio}
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl text-center">
                <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Articles Read</span>
                <span className="text-xl font-black">{user.stats.read}</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl text-center">
                <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Saved</span>
                <span className="text-xl font-black">{user.stats.saved}</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl text-center">
                <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Day Streak</span>
                <span className="text-xl font-black text-orange-500">{user.stats.streak} 🔥</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
        <Link to="/bookmarks" className="group bg-indigo-600 p-8 rounded-[2rem] text-white shadow-xl shadow-indigo-600/20 hover:-translate-y-1 transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-white/20 rounded-2xl">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </div>
            <svg className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <h3 className="text-xl font-black mb-1">My Bookmarks</h3>
          <p className="text-indigo-100 text-sm font-medium">Stories you want to keep forever.</p>
        </Link>

        <Link to="/read-later" className="group bg-emerald-600 p-8 rounded-[2rem] text-white shadow-xl shadow-emerald-600/20 hover:-translate-y-1 transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-white/20 rounded-2xl">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <svg className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <h3 className="text-xl font-black mb-1">Read Later</h3>
          <p className="text-emerald-100 text-sm font-medium">Clear your queue when you have time.</p>
        </Link>
      </div>
    </div>
  );
};