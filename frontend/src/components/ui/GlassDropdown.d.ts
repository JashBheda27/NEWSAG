import React from 'react';

interface GlassDropdownProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  isSignedIn: boolean;
  username: string;
  handle: string;
  onLogout: () => void | Promise<void>;
}

export const GlassDropdown: React.FC<GlassDropdownProps>;