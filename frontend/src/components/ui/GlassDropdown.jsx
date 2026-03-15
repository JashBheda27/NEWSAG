import React, { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bookmark, Clock3, Home, LogOut, Menu, User, X } from 'lucide-react';

const menuItems = [
  { to: '/', label: 'Home', Icon: Home },
  { to: '/bookmarks', label: 'Bookmarks', Icon: Bookmark },
  { to: '/read-later', label: 'Read Later', Icon: Clock3 },
];

export const GlassDropdown = ({
  isOpen,
  onToggle,
  onClose,
  isSignedIn,
  username,
  handle,
  onLogout,
}) => {
  const location = useLocation();
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    onCloseRef.current();
  }, [location.pathname, location.search]);

  return (
    <div className="relative md:hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-label="Toggle menu"
        aria-expanded={isOpen}
        className={`glass-dropdown-trigger ${isOpen ? 'open' : ''}`}
      >
        {isOpen ? (
          <X size={18} strokeWidth={2.5} className="glass-dropdown-trigger-icon" aria-hidden="true" />
        ) : (
          <Menu size={18} strokeWidth={2.5} className="glass-dropdown-trigger-icon" aria-hidden="true" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close menu"
              className="glass-dropdown-backdrop"
              onClick={onClose}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
            />

            <motion.div
              className="glass-dropdown-panel"
              initial={{ opacity: 0, scale: 0.92, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: -6 }}
              transition={{
                duration: 0.2,
                ease: [0.34, 1.56, 0.64, 1],
              }}
            >
              <div className="glass-dropdown-header">
                <div className="glass-dropdown-username">{username}</div>
                <div className="glass-dropdown-handle">{handle}</div>
                {isSignedIn && (
                  <Link to="/profile" onClick={onClose} className="glass-dropdown-profile-link">
                    <User size={14} className="glass-dropdown-item-icon" aria-hidden="true" />
                    <span>Profile</span>
                  </Link>
                )}
              </div>

              <nav>
                {menuItems.map(({ to, label, Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    onClick={onClose}
                    className="glass-dropdown-item"
                  >
                    <Icon size={14} className="glass-dropdown-item-icon" aria-hidden="true" />
                    <span>{label}</span>
                  </Link>
                ))}

                {isSignedIn && (
                  <>
                    <div className="glass-dropdown-divider" />
                    <button
                      type="button"
                      onClick={onLogout}
                      className="glass-dropdown-item glass-dropdown-item-logout"
                    >
                      <LogOut size={14} className="glass-dropdown-item-icon" aria-hidden="true" />
                      <span>Logout</span>
                    </button>
                  </>
                )}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`
        .glass-dropdown-trigger {
          padding: 0 !important;
          margin: 0;
          position: relative;
          z-index: 201;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.75);
          border: 0.5px solid rgba(15, 23, 42, 0.2);
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.12);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          transition: box-shadow 200ms ease, border-color 200ms ease;
          color: rgb(30, 41, 59);
        }

        .glass-dropdown-trigger.open {
          color: rgb(30, 41, 59);
          box-shadow: 0 8px 22px rgba(79, 70, 229, 0.25);
        }

        .glass-dropdown-trigger-icon {
          width: 18px;
          height: 18px;
          display: block;
          flex-shrink: 0;
          color: currentColor;
        }

        .dark .glass-dropdown-trigger {
          background: rgba(30, 41, 59, 0.75);
          color: rgb(241, 245, 249);
          border-color: rgba(148, 163, 184, 0.35);
        }

        .glass-dropdown-backdrop {
          color: rgb(241, 245, 249);
          position: fixed;
          inset: 0;
          z-index: 100;
          background: transparent;
        }

        .glass-dropdown-panel {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 188px;
          z-index: 200;
          overflow: hidden;
          transform-origin: top right;
          background: rgba(255, 255, 255, 0.84);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 0.5px solid rgba(148, 163, 184, 0.4);
          border-radius: 14px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
        }

        .dark .glass-dropdown-panel {
          background: rgba(15, 23, 42, 0.72);
          border-color: rgba(148, 163, 184, 0.25);
        }

        .glass-dropdown-header {
          padding: 12px 14px 10px;
          border-bottom: 0.5px solid rgba(100, 116, 139, 0.28);
        }

        .glass-dropdown-username {
          font-size: 12px;
          font-weight: 600;
          color: rgb(15, 23, 42);
        }

        .glass-dropdown-handle {
          margin-top: 2px;
          font-size: 10px;
          color: rgba(51, 65, 85, 0.8);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .dark .glass-dropdown-username {
          color: rgb(241, 245, 249);
        }

        .dark .glass-dropdown-handle {
          color: rgba(203, 213, 225, 0.72);
        }

        .glass-dropdown-profile-link {
          margin-top: 8px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          color: rgb(67, 56, 202);
          background: rgba(99, 102, 241, 0.12);
        }

        .dark .glass-dropdown-profile-link {
          color: rgb(165, 180, 252);
          background: rgba(99, 102, 241, 0.2);
        }

        .glass-dropdown-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          font-size: 13px;
          font-weight: 500;
          color: rgb(51, 65, 85);
          cursor: pointer;
          transition: background 120ms ease;
          text-align: left;
        }

        .dark .glass-dropdown-item {
          color: rgba(226, 232, 240, 0.92);
        }

        .glass-dropdown-item:hover {
          background: rgba(99, 102, 241, 0.14);
        }

        .glass-dropdown-item-icon {
          opacity: 0.85;
          flex-shrink: 0;
        }

        .glass-dropdown-divider {
          height: 0.5px;
          background: rgba(100, 116, 139, 0.3);
          margin: 3px 0;
        }

        .glass-dropdown-item-logout {
          color: rgb(255, 168, 168);
        }

        .glass-dropdown-item-logout .glass-dropdown-item-icon {
          color: rgb(255, 168, 168);
        }

        .glass-dropdown-item-logout:hover {
          background: rgba(255, 100, 100, 0.12);
        }
      `}</style>
    </div>
  );
};