import React, { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import {
  BriefcaseBusiness,
  Check,
  Clapperboard,
  Cpu,
  Globe,
  HeartPulse,
  Landmark,
  Lock,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { LoginRequiredModal } from '../ui/LoginRequiredModal';
import { NEWS_CATEGORY_IDS } from '../../utils/constants';

interface CategoryItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

const iconMap: Record<string, LucideIcon> = {
  general: Globe,
  nation: Landmark,
  business: BriefcaseBusiness,
  technology: Cpu,
  sports: Trophy,
  entertainment: Clapperboard,
  health: HeartPulse,
};

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const currentCategory = searchParams.get('category') || 'general';
  const { isSignedIn } = useUser();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [selectedCategoryName, setSelectedCategoryName] = useState('');

  const categories: CategoryItem[] = NEWS_CATEGORY_IDS.map((cat) => ({
    id: cat.id,
    label: cat.label,
    icon: iconMap[cat.id] ?? Globe,
  }));

  return (
    <>
      <aside className="sidebar-container">
        {/* Left Icon Rail */}
        <div className="sidebar-left">
          <div className="sidebar-logo">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <span className="text-white font-black text-xl">NA</span>
            </div>
          </div>

          <nav className="sidebar-nav-icons">
            {/* Category Icons */}
            {categories.map((cat) => {
              const isCategoryActive = location.pathname === '/' && currentCategory === cat.id;
              const CategoryIcon = cat.icon;
              
              const handleCategoryClick = (e: React.MouseEvent) => {
                // Allow public access to 'general' category
                if (cat.id !== 'general' && !isSignedIn) {
                  e.preventDefault();
                  setSelectedCategoryName(cat.label);
                  setShowLoginModal(true);
                }
              };

              return (
                <div key={cat.id} className="sidebar-icon-wrapper">
                  <Link
                    to={`/?category=${cat.id}`}
                    onClick={handleCategoryClick}
                    aria-label={`Browse ${cat.label}${cat.id !== 'general' && !isSignedIn ? ' (login required)' : ''}`}
                    title={`${cat.label}${cat.id !== 'general' && !isSignedIn ? ' (login required)' : ''}`}
                    className={`sidebar-icon-btn sidebar-category-btn ${isCategoryActive ? 'active' : ''} ${
                      cat.id !== 'general' && !isSignedIn ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {isCategoryActive && (
                      <span className="sidebar-active-indicator" aria-hidden="true">
                        <Check size={12} />
                      </span>
                    )}
                    <CategoryIcon size={20} aria-hidden="true" />
                    <span className="sr-only">{cat.label}</span>
                  </Link>
                  <div className="sidebar-tooltip">
                    {cat.label} {cat.id !== 'general' && !isSignedIn ? '(Locked)' : ''}
                  </div>
                </div>
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
              <div className="sidebar-section-divider">
                <span className="sidebar-section-label">CATEGORIES</span>
              </div>

              {categories.map((cat) => {
                const isCategoryActive = location.pathname === '/' && currentCategory === cat.id;
                const CategoryIcon = cat.icon;
                
                const handleCategoryClick = (e: React.MouseEvent) => {
                  if (cat.id !== 'general' && !isSignedIn) {
                    e.preventDefault();
                    setSelectedCategoryName(cat.label);
                    setShowLoginModal(true);
                  }
                };

                return (
                  <Link
                    key={cat.id}
                    to={`/?category=${cat.id}`}
                    onClick={handleCategoryClick}
                    aria-label={`Browse ${cat.label}${cat.id !== 'general' && !isSignedIn ? ' (login required)' : ''}`}
                    className={`sidebar-nav-btn ${isCategoryActive ? 'active' : ''} ${
                      cat.id !== 'general' && !isSignedIn ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <span className="sidebar-nav-icon">
                      <CategoryIcon size={20} aria-hidden="true" />
                    </span>
                    <span className="sidebar-nav-label">
                      {cat.label}
                      {cat.id !== 'general' && !isSignedIn && (
                        <span className="inline-flex items-center" aria-label="Login required">
                          <Lock size={14} aria-hidden="true" />
                        </span>
                      )}
                    </span>
                    {isCategoryActive && (
                      <span className="sidebar-category-badge" aria-hidden="true">
                        <Check size={14} />
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </aside>

      <LoginRequiredModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        categoryName={selectedCategoryName}
      />

      <style>{`
        .sidebar-container {
          position: fixed;
          left: 18px;
          top: 88px;
          bottom: 28px;
          display: flex;
          width: 80px;
          background: rgb(255, 255, 255);
          border-radius: 24px;
          transition: width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
          overflow: hidden;
          z-index: 40;
          box-shadow: 
            0 4px 6px -1px rgba(0, 0, 0, 0.1),
            0 2px 4px -1px rgba(0, 0, 0, 0.06);
          border: 1px solid rgb(226, 232, 240);
        }

        .dark .sidebar-container {
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          box-shadow: 
            0 8px 32px -8px rgba(0, 0, 0, 0.5),
            0 2px 8px -2px rgba(0, 0, 0, 0.3),
            inset 0 1px 1px rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .sidebar-container:hover {
          width: 280px;
        }

        /* Left Icon Rail */
        .sidebar-left {
          width: 80px;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-top: 24px;
          background: transparent;
          z-index: 2;
        }

        .dark .sidebar-left {
          background: transparent;
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

        .sidebar-icon-wrapper {
          position: relative;
          width: 100%;
          display: flex;
          justify-content: center;
        }

        .sidebar-icon-btn {
          width: 52px;
          height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          color: rgb(71, 85, 105);
          position: relative;
        }

        .sidebar-icon-btn svg {
          width: 22px;
          height: 22px;
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .dark .sidebar-icon-btn {
          color: rgb(148, 163, 184);
        }

        .sidebar-icon-btn:hover {
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.12) 100%);
          color: rgb(79, 70, 229);
          transform: translateY(-3px);
          box-shadow: 
            0 8px 20px -6px rgba(99, 102, 241, 0.3),
            0 0 0 1px rgba(99, 102, 241, 0.1);
        }

        .sidebar-icon-btn:hover svg {
          transform: scale(1.1);
        }

        .dark .sidebar-icon-btn:hover {
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%);
          color: rgb(165, 180, 252);
          box-shadow: 
            0 8px 20px -6px rgba(99, 102, 241, 0.4),
            0 0 0 1px rgba(99, 102, 241, 0.2);
        }

        .sidebar-icon-btn.active {
          background: linear-gradient(135deg, rgb(79, 70, 229) 0%, rgb(124, 58, 237) 100%);
          color: white;
          box-shadow: 
            0 8px 24px -6px rgba(79, 70, 229, 0.5),
            0 0 0 1px rgba(255, 255, 255, 0.2),
            inset 0 1px 1px rgba(255, 255, 255, 0.2);
        }

        .dark .sidebar-icon-btn.active {
          background: linear-gradient(135deg, rgb(79, 70, 229) 0%, rgb(139, 92, 246) 100%);
          color: white;
          box-shadow: 
            0 8px 24px -6px rgba(99, 102, 241, 0.5),
            0 0 24px -4px rgba(99, 102, 241, 0.3);
        }

        .sidebar-category-btn {
          width: 48px;
          height: 48px;
        }

        .sidebar-divider {
          width: 40px;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgb(203, 213, 225), transparent);
          margin: 12px 0;
          border-radius: 2px;
        }

        .dark .sidebar-divider {
          background: linear-gradient(90deg, transparent, rgb(51, 65, 85), transparent);
        }

        .sidebar-active-indicator {
          position: absolute;
          top: -6px;
          right: -6px;
          font-size: 12px;
          background: white;
          border: 2px solid rgb(79, 70, 229);
          border-radius: 50%;
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          box-shadow: 0 4px 12px -2px rgba(79, 70, 229, 0.3);
          animation: pop-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes pop-in {
          from {
            transform: scale(0);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        .dark .sidebar-active-indicator {
          background: rgb(30, 41, 59);
          border-color: rgb(129, 140, 248);
          color: white;
        }

        /* Tooltip */
        .sidebar-tooltip {
          position: absolute;
          left: 74px;
          top: 50%;
          transform: translateY(-50%) translateX(-8px);
          background: linear-gradient(135deg, rgb(30, 41, 59) 0%, rgb(15, 23, 42) 100%);
          color: white;
          padding: 8px 14px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
          z-index: 100;
          box-shadow: 
            0 8px 24px -6px rgba(0, 0, 0, 0.3),
            0 0 0 1px rgba(255, 255, 255, 0.1);
        }

        .dark .sidebar-tooltip {
          background: linear-gradient(135deg, rgb(51, 65, 85) 0%, rgb(30, 41, 59) 100%);
        }

        .sidebar-tooltip::before {
          content: '';
          position: absolute;
          left: -6px;
          top: 50%;
          transform: translateY(-50%);
          border: 6px solid transparent;
          border-right-color: rgb(30, 41, 59);
        }

        .dark .sidebar-tooltip::before {
          border-right-color: rgb(51, 65, 85);
        }

        .sidebar-container:not(:hover) .sidebar-icon-wrapper:hover .sidebar-tooltip {
          opacity: 1;
          transform: translateY(-50%) translateX(0);
        }

        /* Right Expandable Sidebar */
        .sidebar-right {
          position: relative;
          width: 0;
          transition: width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
          overflow: hidden;
        }

        .sidebar-container:hover .sidebar-right {
          width: 200px;
        }

        .sidebar-right-inner {
          position: absolute;
          top: 12px;
          bottom: 12px;
          left: 8px;
          right: 12px;
          background: rgb(248, 250, 252);
          border-radius: 18px;
          padding-bottom: 12px;
          overflow-y: auto;
          border: 1px solid rgb(226, 232, 240);
        }

        .dark .sidebar-right-inner {
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.6) 100%);
          border-color: rgba(51, 65, 85, 0.5);
        }

        .sidebar-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 16px 12px;
          border-bottom: 2px solid rgb(226, 232, 240);
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
          border-radius: 12px;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          color: rgb(71, 85, 105);
          font-weight: 600;
          font-size: 13px;
        }

        .dark .sidebar-nav-btn {
          color: rgb(148, 163, 184);
        }

        .sidebar-nav-btn:hover {
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
          color: rgb(79, 70, 229);
          transform: translateX(4px);
          box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.1);
        }

        .dark .sidebar-nav-btn:hover {
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%);
          color: rgb(165, 180, 252);
          box-shadow: 0 0 20px -6px rgba(99, 102, 241, 0.3);
        }

        .sidebar-nav-btn.active {
          background: linear-gradient(135deg, rgb(79, 70, 229) 0%, rgb(124, 58, 237) 100%);
          color: white;
          box-shadow: 
            0 4px 16px -4px rgba(79, 70, 229, 0.4),
            inset 0 1px 1px rgba(255, 255, 255, 0.2);
        }

        .dark .sidebar-nav-btn.active {
          background: linear-gradient(135deg, rgb(79, 70, 229) 0%, rgb(139, 92, 246) 100%);
          color: white;
          box-shadow: 
            0 4px 20px -4px rgba(99, 102, 241, 0.5),
            0 0 24px -6px rgba(99, 102, 241, 0.3);
        }

        .sidebar-nav-icon {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
        }

        .sidebar-nav-icon svg {
          display: block;
        }

        .sidebar-nav-label {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 8px;
          text-align: left;
          white-space: nowrap;
        }

        .sidebar-section-divider {
          margin: 12px 0 8px 0;
          padding: 0 10px;
        }

        .sidebar-section-label {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: rgb(148, 163, 184);
        }

        .dark .sidebar-section-label {
          color: rgb(100, 116, 139);
        }

        .sidebar-category-badge {
          font-size: 14px;
          background: rgba(255, 255, 255, 0.2);
          padding: 2px 6px;
          border-radius: 6px;
        }

        /* Hide on smaller screens */
        @media (max-width: 1023px) {
          .sidebar-container {
            position: fixed;
            left: 0;
            right: 0;
            top: auto;
            bottom: 0;
            width: 100%;
            height: 80px;
            border-radius: 24px 24px 0 0;
            display: flex;
            flex-direction: row;
            padding: 0 12px;
            justify-content: flex-start;
            overflow-x: auto;
            overflow-y: hidden;
          }

          .sidebar-left {
            width: 100%;
            flex-direction: row;
            padding-top: 0;
            padding: 12px 0;
            gap: 8px;
          }

          .sidebar-logo {
            margin-bottom: 0;
            margin-right: 12px;
          }

          .sidebar-nav-icons {
            flex-direction: row;
            justify-content: flex-start;
            gap: 4px;
            width: auto;
          }

          .sidebar-icon-btn {
            width: 48px;
            height: 48px;
            flex-shrink: 0;
          }

          .sidebar-category-btn {
            width: 44px;
            height: 44px;
          }

          .sidebar-right {
            display: none;
          }

          .sidebar-divider {
            display: none;
          }

          .sidebar-tooltip {
            display: none;
          }

          .sidebar-container:hover {
            width: 100%;
          }
        }

        /* Tablet - Show sidebar but make it more compact */
        @media (max-width: 1279px) and (min-width: 768px) {
          .sidebar-container {
            width: 70px;
            left: 12px;
          }

          .sidebar-container:hover {
            width: 240px;
          }

          .sidebar-right {
            width: 0;
          }

          .sidebar-container:hover .sidebar-right {
            width: 160px;
          }
        }

        /* Scrollbar */
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
