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
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { LoginRequiredModal } from '../ui/LoginRequiredModal';
import { CategoryPillBar } from '../ui/CategoryPillBar';
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

  const handleCategoryClick = (cat: CategoryItem) => (e: React.MouseEvent) => {
    if (cat.id !== 'general' && !isSignedIn) {
      e.preventDefault();
      setSelectedCategoryName(cat.label);
      setShowLoginModal(true);
      return;
    }

  };

  const renderIconLink = (cat: CategoryItem) => {
    const isCategoryActive = location.pathname === '/' && currentCategory === cat.id;
    const CategoryIcon = cat.icon;
    const isLocked = cat.id !== 'general' && !isSignedIn;

    return (
      <div key={`icon-${cat.id}`} className="sidebar-icon-wrapper">
        <Link
          to={`/?category=${cat.id}`}
          onClick={handleCategoryClick(cat)}
          aria-label={`Browse ${cat.label}${isLocked ? ' (login required)' : ''}`}
          className={`sidebar-icon-btn sidebar-category-btn ${isCategoryActive ? 'active' : ''} ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isCategoryActive && (
            <span className="sidebar-active-indicator" aria-hidden="true">
              <Check size={10} />
            </span>
          )}
          <CategoryIcon size={18} aria-hidden="true" className="sidebar-btn-icon" />
          <span className="sidebar-btn-label">{cat.label}</span>
        </Link>
      </div>
    );
  };

  return (
    <>
      <>
        <aside className="sidebar-icon-rail" aria-label="News categories quick menu">
          <div className="sidebar-logo">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30 flex-shrink-0">
              <span className="text-white font-black text-lg">NA</span>
            </div>
            <p className="sidebar-ai-label">AI-Powered News</p>
          </div>
          <div className="sidebar-section-heading">CATEGORIES</div>
          <nav className="sidebar-nav-icons">{categories.map(renderIconLink)}</nav>
        </aside>

        <CategoryPillBar
          categories={categories}
          currentCategory={currentCategory}
          onCategoryClick={handleCategoryClick}
          isSignedIn={isSignedIn}
        />
      </>

      <LoginRequiredModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        categoryName={selectedCategoryName}
      />

      <style>{`
        .sidebar-icon-rail {
          position: fixed;
          left: 12px;
          top: 120px;
          width: 156px;
          height: auto;
          max-height: calc(100vh - 144px);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 16px 10px 18px;
          z-index: 20;
          background: rgba(255, 255, 255, 0.82);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 0.5px solid rgba(226, 232, 240, 0.8);
          border-radius: 28px;
          box-shadow:
            0 8px 32px -8px rgba(15, 23, 42, 0.12),
            0 2px 8px -2px rgba(15, 23, 42, 0.06),
            inset 0 1px 0 rgba(255,255,255,0.7);
          overflow-y: auto;
          scrollbar-width: none;
        }

        .sidebar-icon-rail::-webkit-scrollbar { display: none; }

        .dark .sidebar-icon-rail {
          background: rgba(15, 23, 42, 0.78);
          border-color: rgba(51, 65, 85, 0.7);
          box-shadow:
            0 8px 32px -8px rgba(0, 0, 0, 0.4),
            0 2px 8px -2px rgba(0, 0, 0, 0.2),
            inset 0 1px 0 rgba(255,255,255,0.06);
        }



        .sidebar-logo {
          margin-bottom: 18px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 0 8px;
          width: 100%;
        }

        .sidebar-ai-label {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.03em;
          color: rgb(148, 163, 184);
          text-transform: uppercase;
          line-height: 1.2;
          text-align: center;
          max-width: 112px;
        }

        .dark .sidebar-ai-label {
          color: rgb(100, 116, 139);
        }

        .sidebar-section-heading {
          width: 100%;
          margin: 0 0 12px;
          padding: 0 12px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: rgb(148, 163, 184);
          text-transform: uppercase;
        }

        .dark .sidebar-section-heading {
          color: rgb(100, 116, 139);
        }

        .sidebar-nav-icons {
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: 100%;
          align-items: stretch;
        }

        .sidebar-icon-wrapper {
          position: relative;
          width: 100%;
        }

        .sidebar-icon-btn {
          width: 100%;
          min-height: 46px;
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 12px;
          padding: 0 14px;
          border-radius: 999px;
          transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
          color: rgb(71, 85, 105);
          position: relative;
          background: rgba(255, 255, 255, 0.35);
          box-shadow: inset 0 0 0 1px rgba(226, 232, 240, 0.75);
        }

        .sidebar-btn-icon {
          flex-shrink: 0;
          width: 18px;
          height: 18px;
        }

        .sidebar-btn-label {
          font-size: 13px;
          font-weight: 600;
          white-space: nowrap;
          flex: 1;
          text-align: left;
        }

        .dark .sidebar-icon-btn {
          color: rgb(148, 163, 184);
          background: rgba(30, 41, 59, 0.35);
          box-shadow: inset 0 0 0 1px rgba(51, 65, 85, 0.9);
        }

        .sidebar-icon-btn:hover {
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.12) 100%);
          color: rgb(79, 70, 229);
          transform: translateX(2px);
          box-shadow: 
            0 4px 12px -4px rgba(99, 102, 241, 0.25),
            0 0 0 1px rgba(99, 102, 241, 0.1);
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
          /* uses sidebar-icon-btn full-width row styles */
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
          top: 50%;
          right: 10px;
          transform: translateY(-50%);
          font-size: 10px;
          background: white;
          border: 2px solid rgb(79, 70, 229);
          color: rgb(79, 70, 229);
          border-radius: 50%;
          width: 18px;
          height: 18px;
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

        /* Tooltip hidden — labels always visible */
        .sidebar-tooltip { display: none; }

        .sidebar-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 16px;
          border-bottom: 0.5px solid rgb(226, 232, 240);
        }

        .dark .sidebar-header {
          border-bottom-color: rgb(51, 65, 85);
        }

        .sidebar-nav-items {
          padding: 12px 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .sidebar-nav-btn {
          width: 100%;
          min-height: 44px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 16px;
          border-radius: 8px;
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

        /* Tablet/mobile: hide left sidebar and use top drawer menu */
        @media (max-width: 1023px) {
          .sidebar-icon-rail,
          .sidebar-tooltip {
            display: none;
          }
        }

        .sidebar-category-panel::-webkit-scrollbar {
          width: 4px;
        }

        .sidebar-category-panel::-webkit-scrollbar-track {
          background: transparent;
        }

        .sidebar-category-panel::-webkit-scrollbar-thumb {
          background: rgb(203, 213, 225);
          border-radius: 4px;
        }

        .dark .sidebar-category-panel::-webkit-scrollbar-thumb {
          background: rgb(71, 85, 105);
        }
      `}</style>
    </>
  );
};
