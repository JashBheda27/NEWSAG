import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface CategoryPillBarCategory {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface CategoryPillBarProps {
  categories: CategoryPillBarCategory[];
  currentCategory: string;
  onCategoryClick: (cat: CategoryPillBarCategory) => (e: React.MouseEvent) => void;
  isSignedIn: boolean | undefined;
}

export const CategoryPillBar: React.FC<CategoryPillBarProps>;
