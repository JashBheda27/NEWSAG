import React from 'react';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 py-8 px-8 lg:pl-32">
      <div className="w-full flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-xl flex items-center justify-center font-black text-lg shadow-lg shadow-indigo-600/30">
                 NA
               </div>
               <div className="flex flex-col">
                 <span className="font-black text-slate-900 dark:text-white text-sm">NewsAura</span>
                 <span className="text-xs text-slate-500 dark:text-slate-400">AI-Powered News Platform</span>
               </div>
          </div>
          
          <div className="flex items-center gap-6 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium">© {currentYear} NewsAura. All rights reserved.</span>
              <a href="#" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-semibold">Privacy</a>
              <a href="#" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-semibold">Terms</a>
              <a href="#" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-semibold">Support</a>
          </div>
      </div>
    </footer>
  );
};
