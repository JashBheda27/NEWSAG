
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';
import { Button } from '../components/ui/Button.tsx';

export const Profile: React.FC = () => {
  const { signOut } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const userData = {
    name: user?.fullName || user?.firstName || user?.username || "User",
    handle: `@${user?.username || 'user'}`,
    email: user?.primaryEmailAddress?.emailAddress || '',
    bio: "News enthusiast using NewsAura to stay informed.",
    avatar: user?.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username || 'user'}`,
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
            <img src={userData.avatar} alt={userData.name} className="w-full h-full object-cover" />
          </div>
          <div className="text-center md:text-left flex-grow">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-3xl font-black">{userData.name}</h2>
                <p className="text-indigo-600 dark:text-indigo-400 font-bold">{userData.handle}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{userData.email}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">Edit Profile</Button>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800 transition-all"
                >
                  Logout
                </button>
              </div>
            </div>
            <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium leading-relaxed">
              {userData.bio}
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl text-center">
                <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Articles Read</span>
                <span className="text-xl font-black">{userData.stats.read}</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl text-center">
                <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Saved</span>
                <span className="text-xl font-black">{userData.stats.saved}</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl text-center">
                <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Day Streak</span>
                <span className="text-xl font-black text-orange-500">{userData.stats.streak} 🔥</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};