import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';

export const CategoryPillBar = ({
  categories,
  currentCategory,
  onCategoryClick,
  isSignedIn,
}) => {
  const pillRefs = useRef({});

  useEffect(() => {
    const activePill = pillRefs.current[currentCategory];
    if (!activePill) return;

    activePill.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, [currentCategory, categories]);

  return (
    <>
      <div className="category-pill-bar lg:hidden" role="navigation" aria-label="News categories">
        <div className="category-pill-track">
          {categories.map((cat) => {
            const CategoryIcon = cat.icon;
            const isActive = currentCategory === cat.id;
            const isLocked = cat.id !== 'general' && !isSignedIn;

            return (
              <Link
                key={`pill-${cat.id}`}
                ref={(node) => {
                  if (node) {
                    pillRefs.current[cat.id] = node;
                  }
                }}
                to={`/?category=${cat.id}`}
                onClick={onCategoryClick(cat)}
                className={`category-pill ${isActive ? 'active' : ''} ${isLocked ? 'locked cursor-not-allowed' : ''}`}
                aria-current={isActive ? 'true' : undefined}
                aria-label={`Browse ${cat.label}${isLocked ? ' (login required)' : ''}`}
              >
                <CategoryIcon size={16} aria-hidden="true" />
                <span>{cat.label}</span>
                {isLocked && <Lock size={10} aria-hidden="true" className="category-pill-lock" />}
              </Link>
            );
          })}
        </div>
      </div>

      <style>{`
        .category-pill-bar {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 50;
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 10px 12px calc(16px + env(safe-area-inset-bottom));
          background: transparent;
          border-top: none;
          box-shadow: none;
        }

        @media (min-width: 1024px) {
          .category-pill-bar {
            display: none !important;
          }
        }

        .category-pill-track {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          scroll-behavior: smooth;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
          scroll-snap-type: x mandatory;
        }

        .category-pill-track::-webkit-scrollbar {
          display: none;
        }

        .category-pill {
          scroll-snap-align: start;
          flex-shrink: 0;
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 500;
          line-height: 1;
          white-space: nowrap;
          cursor: pointer;
          transition: all 150ms ease;
          border: 0.5px solid var(--color-border-tertiary, rgb(226, 232, 240));
          background: rgb(255, 255, 255);
          color: var(--color-text-secondary, rgb(71, 85, 105));
        }

        .category-pill.locked {
          opacity: 1;
          padding-right: 38px;
          background: rgb(255, 255, 255);
          color: rgb(100, 116, 139);
          border-color: rgb(226, 232, 240);
        }

        .category-pill-lock {
          position: absolute;
          top: 50%;
          right: 10px;
          transform: translateY(-50%);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border-radius: 999px;
          color: rgb(133, 77, 14);
          background: linear-gradient(135deg, rgb(255, 244, 214) 0%, rgb(253, 230, 138) 100%);
          border: 1px solid rgb(245, 158, 11);
          box-shadow: 0 2px 6px -2px rgba(245, 158, 11, 0.65);
          flex-shrink: 0;
        }

        .category-pill.active {
          background: rgb(83, 74, 183);
          color: rgb(255, 255, 255);
          border-color: rgb(83, 74, 183);
        }

        .dark .category-pill-bar {
          background: transparent;
        }

        .dark .category-pill {
          background: rgb(30, 41, 59);
          color: var(--color-text-secondary, rgb(148, 163, 184));
          border-color: var(--color-border-tertiary, rgb(51, 65, 85));
        }

        .dark .category-pill.locked {
          opacity: 1;
          background: rgb(30, 41, 59);
          color: rgb(148, 163, 184);
        }

        .dark .category-pill-lock {
          color: rgb(251, 191, 36);
          background: linear-gradient(135deg, rgba(120, 53, 15, 0.42) 0%, rgba(180, 83, 9, 0.35) 100%);
          border-color: rgba(251, 191, 36, 0.75);
          box-shadow: 0 2px 8px -3px rgba(251, 191, 36, 0.55);
        }

        .dark .category-pill.active {
          background: rgb(83, 74, 183);
          color: rgb(255, 255, 255);
          border-color: rgb(83, 74, 183);
        }
      `}</style>
    </>
  );
};
