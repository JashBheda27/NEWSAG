# 🎯 Enhanced Components Usage Guide

This guide documents the new and enhanced UI components available in NewsAura.

---

## 📦 New Components

### 1. ConfirmationModal

Used for delete operations with a confirmation dialog.

**Location:** `src/components/ui/ConfirmationModal.tsx`

#### Props

```typescript
interface ConfirmationModalProps {
  isOpen: boolean;                    // Control modal visibility
  title: string;                      // Modal title (e.g., "Delete Bookmark?")
  message: string;                    // Description message
  confirmText?: string;               // Button text (default: "Confirm")
  cancelText?: string;                // Button text (default: "Cancel")
  isDanger?: boolean;                 // Red styling for destructive actions
  isLoading?: boolean;                // Show loading state on confirm button
  onConfirm: () => void;             // Callback when confirming
  onCancel: () => void;              // Callback when canceling
}
```

#### Example Usage

```tsx
const [showConfirm, setShowConfirm] = useState(false);
const [isDeleting, setIsDeleting] = useState(false);

const handleDelete = async () => {
  setIsDeleting(true);
  try {
    await deleteBookmark(id);
    setShowConfirm(false);
  } finally {
    setIsDeleting(false);
  }
};

return (
  <>
    <button onClick={() => setShowConfirm(true)}>Delete</button>
    
    <ConfirmationModal
      isOpen={showConfirm}
      title="Delete Bookmark?"
      message="This action cannot be undone. Are you sure?"
      confirmText="Delete"
      cancelText="Keep It"
      isDanger={true}
      isLoading={isDeleting}
      onConfirm={handleDelete}
      onCancel={() => setShowConfirm(false)}
    />
  </>
);
```

---

### 2. EmptyState

Used to display helpful messaging when content is empty.

**Location:** `src/components/ui/EmptyState.tsx`

#### Props

```typescript
interface EmptyStateProps {
  icon?: string | React.ReactNode;    // Optional custom icon
  title: string;                      // Main heading
  description: string;                // Description text
  action?: {                          // Optional CTA button
    label: string;
    href: string;
  };
  illustration?: 'bookmarks' | 'readlater' | 'search' | 'generic';
}
```

#### Example Usage

```tsx
{articles.length === 0 ? (
  <EmptyState
    title="No Articles Found"
    description="Try a different search or browse our categories"
    action={{ label: 'Browse Categories', href: '/' }}
    illustration="search"
  />
) : (
  <ArticleList articles={articles} />
)}
```

#### Illustration Options

- `bookmarks` - 🔖 For saved articles
- `readlater` - 📌 For read later list
- `search` - 🔍 For no search results
- `generic` - 📭 For other empty states

---

### 3. Enhanced Button Component

The Button component now includes spring physics animations.

**Location:** `src/components/ui/Button.tsx`

#### Props (NEW)
All existing props remain the same, with enhanced animations:

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;                // Shows animated spinner
}
```

#### Enhancements

- ✅ Gradient backgrounds
- ✅ Hover scale effect (1.02x)
- ✅ Tap scale effect (0.98x)
- ✅ Animated loading spinner
- ✅ Improved shadow on hover

#### Example

```tsx
<Button 
  variant="primary" 
  size="lg" 
  isLoading={isSubmitting}
  onClick={handleSubmit}
>
  {isSubmitting ? 'Saving...' : 'Save Changes'}
</Button>
```

---

## 🎨 Enhanced Components

### 1. Modal

**Location:** `src/components/ui/Modal.tsx`

#### New Features

- ✅ Spring-based entrance/exit animations
- ✅ Backdrop blur effect
- ✅ Better visual hierarchy
- ✅ AnimatePresence for smooth exit

#### Usage (No changes needed!)

```tsx
<Modal
  isOpen={isOpen}
  onClose={onClose}
  title="Edit Profile"
>
  {/* Content */}
</Modal>
```

---

### 2. Toast

**Location:** `src/components/ui/Toast.tsx`

#### New Features

- ✅ Spring-based animations
- ✅ Animated indicator dot
- ✅ Better visual design
- ✅ Smooth backdrop blur

#### Usage (No changes needed!)

```tsx
<Toast
  message="Article saved!"
  type="success"
  onClose={handleClose}
/>
```

---

### 3. ChatBot

**Location:** `src/components/ui/ChatBot.tsx`

#### New Features

- ✅ Floating button with pulse animation
- ✅ Animated message bubbles
- ✅ Three-dot typing indicator
- ✅ Auto-scroll to latest message
- ✅ Spring-based modal animations

#### Usage (No changes needed!)

```tsx
<ChatBot 
  articleContext={context} 
  onError={handleError}
/>
```

---

### 4. SentimentBadge

**Location:** `src/components/news/SentimentBadge.tsx`

#### New Features

- ✅ Emoji icons (😊 😐 😔)
- ✅ Confidence percentage with pulse
- ✅ Subtle rotate animation on icon
- ✅ Better color scheme with borders
- ✅ Hovers scale for interactivity

#### Example

```tsx
<SentimentBadge sentiment={article.sentiment} />
// Output: 😊 Positive 87%
```

---

### 5. NewsGrid

**Location:** `src/components/news/NewsGrid.tsx`

#### New Features

- ✅ React.memo for performance
- ✅ Staggered card animations
- ✅ Integrated EmptyState
- ✅ Animated loading skeletons
- ✅ memoized className calculations

#### Usage (No API changes!)

```tsx
<NewsGrid 
  articles={articles}
  isLoading={isLoading}
  viewType="grid"
  onError={handleError}
/>
```

---

### 6. NewsSkeleton

**Location:** `src/components/news/NewsSkeleton.tsx`

#### New Features

- ✅ Shimmer animation
- ✅ Staggered element delays
- ✅ Smooth 2-second loop
- ✅ Better visual feedback

#### Example

```tsx
{isLoading && (
  <>
    <NewsSkeleton />
    <NewsSkeleton />
    <NewsSkeleton />
  </>
)}
```

---

### 7. Enhanced Pages

All pages now include smooth animations:

#### Home (`src/pages/Home.tsx`)
- Fade-in on mount
- Staggered animations for sections
- Animated count badges
- Loading state transitions

#### Bookmarks (`src/pages/Bookmarks.tsx`)
- Fade-in entrance
- Staggered list item animations
- Hover scale effects
- Integrated EmptyState

#### ReadLater (`src/pages/ReadLater.tsx`)
- Same animation patterns as Bookmarks
- Orange accent colors
- Smooth delete animations

---

## 🎬 Animation Patterns

### Standard Spring Config

```typescript
{
  type: "spring",
  stiffness: 300,
  damping: 30
}
```

Use for: Normal interactions (buttons, hovers, etc.)

### Fast Spring Config

```typescript
{
  type: "spring",
  stiffness: 400,
  damping: 30
}
```

Use for: Quick feedback (taps, toggles)

### Stagger Delay

```typescript
transition={{ delay: idx * 0.05 }}
```

Typical pattern: Apply 5-10ms delay multiplier

### Loading Animation

```typescript
animate={{ rotate: 360 }}
transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
```

---

## 📱 Responsive Design

All new components are fully responsive:

- ✅ Mobile-first design
- ✅ Touch-friendly hit targets (min 44x44px)
- ✅ Animations disabled for `prefers-reduced-motion`
- ✅ No animation delays on mobile for speed

---

## ♿ Accessibility Features

### Keyboard Navigation

- `Escape` to close modals
- `Enter` to submit forms
- `Tab` to navigate

### ARIA Labels

All interactive elements have proper `aria-label` or `aria-labelledby`

### Color Contrast

- WCAG AA compliant (4.5:1 for text)
- WCAG AAA compliant (7:1 for headings)

---

## 🌙 Dark Mode

All components automatically adapt to dark mode:

```tsx
// Example Tailwind classes
className="bg-white dark:bg-slate-800"
className="text-slate-900 dark:text-white"
className="border-slate-200 dark:border-slate-700"
```

---

## 🚀 Performance Tips

### Use React.memo for Lists

```tsx
const ListItem = React.memo(({ item, onDelete }) => {
  return <div>{item.title}</div>;
});
```

### Memoize Expensive Calculations

```tsx
const memoizedValue = useMemo(() => {
  return calculateExpensiveValue(data);
}, [dependencies]);
```

### Lazy Load Components

```tsx
const ProfilePage = lazy(() => import('./pages/Profile'));
```

---

## 🎯 Best Practices

### 1. Use EmptyState for Better UX

Instead of just returning null or empty message:

```tsx
// ❌ Bad
{items.length === 0 && <p>No items</p>}

// ✅ Good
{items.length === 0 && (
  <EmptyState
    title="No Items"
    description="Get started by adding your first item"
    action={{ label: 'Add Item', href: '/new' }}
  />
)}
```

### 2. Confirm Destructive Actions

```tsx
// ❌ Bad
<button onClick={() => deleteItem(id)}>Delete</button>

// ✅ Good
<button onClick={() => setShowConfirm(true)}>Delete</button>
{/* Show ConfirmationModal */}
```

### 3. Provide Visual Feedback

```tsx
// ✅ Good - Uses Button's built-in loading state
<Button isLoading={isSaving} onClick={handleSave}>
  Save Changes
</Button>
```

### 4. Use Spring Animations for Interactive Elements

```tsx
// ✅ Good - Provides satisfying spring feedback
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
/>
```

---

## 🐛 Debugging

### React DevTools

- Components wrapped in `React.memo` show as `Memo(ComponentName)`
- Use `displayName` to identify components in profiler

### Framer Motion DevTools

- Inspect animations in browser DevTools
- Check Transform values in Elements panel
- Monitor performance in Lighthouse

---

## 📊 Animation Performance

### Monitor with Chrome DevTools

1. Open DevTools → Performance
2. Record interaction
3. Check for smooth 60fps
4. Verify no long tasks blocking main thread

### Typical Performance Metrics

- Spring animation: 150-300ms
- Staggered list (6 items): 300-400ms total
- Page transition: 400-600ms

---

## ✅ Migration Checklist

For upgrading existing components:

- [x] Install Framer Motion: `npm install framer-motion`
- [x] Import motion components where needed
- [x] Wrap conditional renders with AnimatePresence
- [x] Add whileHover/whileTap to interactive elements
- [x] Test animations on mobile devices
- [x] Check accessibility (Escape key, focus states)
- [x] Verify dark mode support
- [x] Test with prefers-reduced-motion

---

## 📚 Additional Resources

### Framer Motion Docs
https://www.framer.com/motion/

### Tailwind CSS Docs
https://tailwindcss.com/docs

### Web Accessibility Guidelines
https://www.w3.org/WAI/

---

## 🎓 Examples

### Example: Delete with Confirmation

```tsx
import { useState } from 'react';
import { ConfirmationModal } from '../ui/ConfirmationModal';
import { Button } from '../ui/Button';

export const BookmarkCard = ({ bookmark, onDelete }) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(bookmark.id);
      setShowConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="p-4 border rounded-lg">
        <h3>{bookmark.title}</h3>
        <Button 
          variant="danger" 
          size="sm"
          onClick={() => setShowConfirm(true)}
        >
          Delete
        </Button>
      </div>

      <ConfirmationModal
        isOpen={showConfirm}
        title="Delete Bookmark?"
        message="Are you sure? This bookmark will be removed."
        confirmText="Delete"
        isDanger={true}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
};
```

---

**Last Updated:** February 18, 2026
**Status:** ✅ Production Ready
