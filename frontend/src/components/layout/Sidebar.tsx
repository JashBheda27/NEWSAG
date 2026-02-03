import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export const Sidebar: React.FC = () => {
  const location = useLocation();
  
  const navItems = [
    {
      path: '/',
      label: 'Home',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      path: '/bookmarks',
      label: 'Bookmarks',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      ),
    },
    {
      path: '/read-later',
      label: 'Read Later',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  return (
    <>
      <aside className="sidebar-container">
        {/* Left Icon Rail */}
        <div className="sidebar-left">
          <div className="sidebar-logo">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <span className="text-white font-black text-xl">A</span>
            </div>
          </div>

          <nav className="sidebar-nav-icons">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`sidebar-icon-btn ${isActive ? 'active' : ''}`}
                  title={item.label}
                >
                  {item.icon}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Expandable Sidebar */}
        <div className="sidebar-right">
          <div className="sidebar-right-inner">
            <div className="sidebar-header">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">NewsAura</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">AI-Powered News</p>
              </div>
            </div>

            <nav className="sidebar-nav-items">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`sidebar-nav-btn ${isActive ? 'active' : ''}`}
                  >
                    <span className="sidebar-nav-icon">{item.icon}</span>
                    <span className="sidebar-nav-label">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </aside>

      <style>{`
        .sidebar-container {
          position: fixed;
          left: 18px;
          top: 88px;
          bottom: 28px;
          display: flex;
          width: 80px;
          background: white;
          border-radius: 18px;
          transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          overflow: hidden;
          z-index: 40;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }

        .dark .sidebar-container {
          background: rgb(15, 23, 42);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
        }

        .sidebar-container:hover {
          width: 300px;
        }

        /* Left Icon Rail */
        .sidebar-left {
          width: 80px;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-top: 24px;
          background: white;
          z-index: 2;
        }

        .dark .sidebar-left {
          background: rgb(15, 23, 42);
        }

        .sidebar-logo {
          margin-bottom: 28px;
        }

        .sidebar-nav-icons {
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
          align-items: center;
        }

        .sidebar-icon-btn {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          color: rgb(100, 116, 139);
        }

        .dark .sidebar-icon-btn {
          color: rgb(148, 163, 184);
        }

        .sidebar-icon-btn:hover {
          background: rgb(241, 245, 249);
          color: rgb(79, 70, 229);
        }

        .dark .sidebar-icon-btn:hover {
          background: rgb(30, 41, 59);
          color: rgb(129, 140, 248);
        }

        .sidebar-icon-btn.active {
          background: rgb(238, 242, 255);
          color: rgb(79, 70, 229);
        }

        .dark .sidebar-icon-btn.active {
          background: rgb(49, 46, 129);
          color: rgb(165, 180, 252);
        }

        /* Right Expandable Sidebar */
        .sidebar-right {
          position: relative;
          width: 0;
          transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .sidebar-container:hover .sidebar-right {
          width: 220px;
        }

        .sidebar-right-inner {
          position: absolute;
          top: 8px;
          bottom: 8px;
          left: 8px;
          right: 8px;
          background: rgb(248, 250, 252);
          border-radius: 14px;
          padding-bottom: 8px;
          overflow-y: auto;
        }

        .dark .sidebar-right-inner {
          background: rgb(30, 41, 59);
        }

        .sidebar-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 20px 16px;
          border-bottom: 1px solid rgb(226, 232, 240);
        }

        .dark .sidebar-header {
          border-bottom-color: rgb(51, 65, 85);
        }

        .sidebar-nav-items {
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .sidebar-nav-btn {
          width: 100%;
          height: 44px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 12px;
          border-radius: 10px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          color: rgb(71, 85, 105);
          font-weight: 600;
          font-size: 14px;
        }

        .dark .sidebar-nav-btn {
          color: rgb(148, 163, 184);
        }

        .sidebar-nav-btn:hover {
          background: rgb(241, 245, 249);
          color: rgb(79, 70, 229);
        }

        .dark .sidebar-nav-btn:hover {
          background: rgb(51, 65, 85);
          color: rgb(165, 180, 252);
        }

        .sidebar-nav-btn.active {
          background: rgb(238, 242, 255);
          color: rgb(79, 70, 229);
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        }

        .dark .sidebar-nav-btn.active {
          background: rgb(49, 46, 129);
          color: rgb(165, 180, 252);
        }

        .sidebar-nav-icon {
          flex-shrink: 0;
        }

        .sidebar-nav-label {
          flex: 1;
          text-align: left;
        }

        /* Hide on smaller screens */
        @media (max-width: 1023px) {
          .sidebar-container {
            display: none;
          }
        }

        /* Adjust scrollbar */
        .sidebar-right-inner::-webkit-scrollbar {
          width: 4px;
        }

        .sidebar-right-inner::-webkit-scrollbar-track {
          background: transparent;
        }

        .sidebar-right-inner::-webkit-scrollbar-thumb {
          background: rgb(203, 213, 225);
          border-radius: 4px;
        }

        .dark .sidebar-right-inner::-webkit-scrollbar-thumb {
          background: rgb(71, 85, 105);
        }
      `}</style>
    </>
  );
};
