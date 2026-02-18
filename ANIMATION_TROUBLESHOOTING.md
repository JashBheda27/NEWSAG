# 🎬 Animation Troubleshooting & Optimization Guide

Comprehensive guide for debugging, optimizing, and enhancing Framer Motion animations in NewsAura.

---

## 🔍 Common Animation Issues

### Issue 1: Animations Not Running

**Symptoms:**
- Elements appear instantly without animation
- No motion on hover/click
- Animations only work sometimes

**Diagnosis Steps:**

1. Check Framer Motion import:
```tsx
// ✅ Correct
import { motion, AnimatePresence } from 'framer-motion';

// ❌ Wrong - Will not work
import motion from 'framer-motion';
```

2. Verify element is wrapped in `motion.component`:
```tsx
// ✅ Correct
<motion.div animate={{ opacity: 1 }} />

// ❌ Wrong - Regular div won't animate
<div animate={{ opacity: 1 }} />
```

3. Check if AnimatePresence is needed:
```tsx
// ✅ Correct for exit animations
<AnimatePresence>
  {isVisible && <motion.div exit={{ opacity: 0 }} />}
</AnimatePresence>

// ❌ Won't animate exit without AnimatePresence
{isVisible && <motion.div exit={{ opacity: 0 }} />}
```

**Solutions:**

```tsx
// Complete working example
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

export const AnimatedComponent = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(!isOpen)}>Toggle</button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            Content
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
```

---

### Issue 2: Animations Jittery or Janky

**Symptoms:**
- Frame drops (below 60fps)
- Stuttering motion
- Browser feels sluggish during animation
- CPU usage spikes

**Diagnosis Steps:**

1. Open Chrome DevTools → Performance tab
2. Record animation while it plays
3. Look for red bars (long tasks blocking main thread)
4. Check FPS meter - should stay at 60fps

**Common Causes:**

```tsx
// ❌ BAD - Expensive re-renders during animation
export const BadAnimation = ({ data }) => {
  const expensiveCalculation = data.map((item) => {
    // Heavy computation here
    return complexAlgorithm(item);
  });

  return (
    <motion.div animate={{ x: 100 }}>
      {expensiveCalculation.map(item => (
        <div key={item.id}>{item.name}</div>
      ))}
    </motion.div>
  );
};

// ✅ GOOD - Memoize expensive calculations
import { useMemo } from 'react';

export const GoodAnimation = ({ data }) => {
  const expensiveCalculation = useMemo(() => {
    return data.map((item) => complexAlgorithm(item));
  }, [data]);

  return (
    <motion.div animate={{ x: 100 }}>
      {expensiveCalculation.map(item => (
        <div key={item.id}>{item.name}</div>
      ))}
    </motion.div>
  );
};
```

**Solutions:**

1. **Use GPU-Accelerated Properties Only**
   ```tsx
   // ✅ Good - These are GPU-accelerated
   animate={{ 
     x: 100,              // transform: translateX
     y: 50,               // transform: translateY
     scale: 1.1,          // transform: scale
     rotate: 45,          // transform: rotate
     opacity: 0.5         // opacity (GPU-friendly)
   }}

   // ❌ Avoid - These trigger repaints
   animate={{
     left: 100,           // Layout property - triggers reflow
     top: 50,             // Layout property - triggers reflow
     width: 200,          // Layout property - triggers reflow
     backgroundColor: 'red' // Paint property - causes repaint
   }}
   ```

2. **Use Proper Transition Config**
   ```tsx
   // ✅ Good - Spring with damping (natural)
   transition={{
     type: "spring",
     stiffness: 300,
     damping: 30
   }}

   // ⚠️ Okay - Tween with easing
   transition={{
     type: "tween",
     duration: 0.3,
     ease: "easeInOut"
   }}

   // ❌ Bad - No damping (bounces forever)
   transition={{
     type: "spring",
     stiffness: 1000,  // Too stiff
     damping: 0        // No damping = bouncy
   }}
   ```

3. **Avoid Animating Too Many Elements**
   ```tsx
   // ❌ Bad - Animating 100+ items at once
   {items.map((item, idx) => (
     <motion.div key={item.id} animate={{ x: 100 }} />
   ))}

   // ✅ Good - Only animate visible items
   const visibleItems = items.slice(0, 10);
   {visibleItems.map((item, idx) => (
     <motion.div 
       key={item.id} 
       animate={{ x: 100 }}
       transition={{ delay: idx * 0.05 }}
     />
   ))}
   ```

---

### Issue 3: Animations Cut Off or Not Visible

**Symptoms:**
- Animations don't complete
- Content disappears at edge of screen
- Z-index issues with overlays

**Diagnosis:**

```css
/* ❌ Bad - Clips animations */
.container {
  overflow: hidden;
  height: 200px;
}

/* ✅ Good - Allows animations to overflow */
.container {
  overflow: visible; /* or auto when scrolling needed */
  height: auto;
}
```

**Solutions:**

```tsx
// Manage overflow carefully
<div className="relative w-full overflow-hidden lg:overflow-visible">
  {/* Animations can overflow on desktop, hidden on mobile */}
</div>

// Use z-index for layering
<motion.div className="fixed z-50">
  {/* Modal with high z-index */}
</motion.div>
```

---

### Issue 4: Animations Stop on Mobile

**Symptoms:**
- Works on desktop, not on mobile
- Particularly with `whileHover` on touch devices
- Touch events don't trigger animations

**Solutions:**

```tsx
// ✅ Good - Support both pointer and touch events
<motion.button
  whileHover={{ scale: 1.05 }}        // Desktop hover
  whileTap={{ scale: 0.95 }}          // Mobile tap
  onHoverStart={ () => {} }           // Also fires on touch start
  onHoverEnd={ () => {} }             // Also fires on touch end
>
  Click me
</motion.button>

// Advanced: Detect touch support
const isTouchSupport = () => {
  return !!(
    navigator.maxTouchPoints ||
    navigator.msMaxTouchPoints
  );
};

export const TouchAwareButton = () => {
  const supportTouch = isTouchSupport();
  
  return (
    <motion.button
      whileHover={!supportTouch ? { scale: 1.05 } : {}}
      whileTap={{ scale: 0.95 }}
    >
      Click me
    </motion.button>
  );
};
```

---

### Issue 5: Dark Mode Animations Flicker

**Symptoms:**
- Animation flickers when switching theme
- Colors snap suddenly
- Transition looks broken

**Solutions:**

```tsx
// ✅ Good - Smooth transition between themes
<motion.div
  className="bg-white dark:bg-slate-900 transition-colors duration-300"
  animate={{
    // Animate on motion properties
    scale: isOpen ? 1 : 0.95,
  }}
>
  Content
</motion.div>

// Use Tailwind's transition utilities
className="transition-colors transition-opacity duration-300"

// Avoid animating color directly in framer-motion
// Use CSS transitions instead
```

---

## ⚡ Performance Optimization

### Monitoring Performance

```bash
# Use React Profiler
# 1. Install React DevTools: https://react.devtools.com/
# 2. Open DevTools → Profiler tab
# 3. Click Record button
# 4. Trigger animations
# 5. Check Ranked Chart for slow renders
```

### Optimized Component Pattern

```tsx
// Use this pattern for animated lists
import { motion } from 'framer-motion';
import { memo, useMemo } from 'react';

interface ListItemProps {
  item: Article;
  index: number;
  onDelete: (id: string) => void;
}

// 1. Memoize individual list items
const ListItem = memo(({ item, index, onDelete }: ListItemProps) => (
  <motion.div
    layout  // Important for smooth reordering animations
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{
      type: "spring",
      stiffness: 300,
      damping: 30,
      delay: index * 0.05
    }}
    className="border rounded-lg p-4"
  >
    <h3>{item.title}</h3>
    <button onClick={() => onDelete(item.id)}>Delete</button>
  </motion.div>
));

ListItem.displayName = 'ListItem';

interface ArticleListProps {
  articles: Article[];
  onDelete: (id: string) => void;
}

// 2. Memoize parent list container
export const ArticleList = memo(({ articles, onDelete }: ArticleListProps) => {
  // 3. Memoize expensive calculations
  const sortedArticles = useMemo(
    () => articles.sort((a, b) => b.createdAt - a.createdAt),
    [articles]
  );

  return (
    <motion.div layout>
      {sortedArticles.map((article, idx) => (
        <ListItem
          key={article.id}
          item={article}
          index={idx}
          onDelete={onDelete}
        />
      ))}
    </motion.div>
  );
});

ArticleList.displayName = 'ArticleList';
```

---

## 🎯 Animation Best Practices

### Timing Guidelines

```tsx
// Keep animations snappy but smooth

// Quick feedback (taps, hovers)
transition={{ duration: 0.15 }}

// Normal transitions (page loads, element entrance)
transition={{ type: "spring", stiffness: 300, damping: 30 }}
// Equivalent duration: ~0.3-0.4s

// Slower transitions (page routes, major layout changes)
transition={{ type: "spring", stiffness: 100, damping: 15 }}
// Equivalent duration: ~0.6-0.8s

// Status updates (loading spinners)
transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
```

### Stagger Delay Patterns

```tsx
// Small lists (< 5 items) - 50ms delay
transition={{ delay: idx * 0.05 }}

// Medium lists (5-15 items) - 100ms delay
transition={{ delay: idx * 0.1 }}

// Large lists - cap at 300ms total time
const maxDelay = 0.3;  // 300ms
const delay = (idx / items.length) * maxDelay;
transition={{ delay }}
```

### Respect User Preferences

```tsx
// Respect prefers-reduced-motion
import { useReducedMotion } from 'framer-motion';

export const AnimatedComponent = () => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      animate={{ x: 100 }}
      transition={{
        duration: shouldReduceMotion ? 0 : 0.3,
        type: "spring"
      }}
    >
      Content
    </motion.div>
  );
};
```

---

## 🔧 Advanced Debugging

### Debug Animation Values

```tsx
import { motion } from 'framer-motion';

export const DebugAnimation = () => {
  const [values, setValues] = useState({ x: 0, opacity: 1 });

  return (
    <motion.div
      animate={values}
      onAnimationStart={() => console.log('Animation started')}
      onAnimationComplete={() => console.log('Animation complete')}
      onDirectionLock={(axis) => console.log('Direction locked:', axis)}
    >
      <p>X: {values.x}, Opacity: {values.opacity}</p>
    </motion.div>
  );
};
```

### Check Browser Support

```javascript
// Test Framer Motion compatibility
console.log(typeof window.requestAnimationFrame); // Should be 'function'
console.log(typeof Element.prototype.animate);    // Should be 'function'

// Check CSS Transform support
const el = document.createElement('div');
console.log(el.style.transform !== undefined); // Should be true
```

### Profile Animation Impact

```tsx
// Add performance markers
import { motion } from 'framer-motion';

export const ProfiledAnimation = () => {
  return (
    <motion.div
      onAnimationStart={() => {
        performance.mark('animation-start');
      }}
      onAnimationComplete={() => {
        performance.mark('animation-end');
        performance.measure('animation', 'animation-start', 'animation-end');
        const measure = performance.getEntriesByName('animation')[0];
        console.log(`Animation took ${measure.duration}ms`);
      }}
      animate={{ x: 100 }}
    />
  );
};
```

---

## 📊 Bundle Size Impact

### Framer Motion Bundle Size

```bash
# Verify package size
npm ls framer-motion

# Expected:
# framer-motion@11.0.0
# ├── tslib@2.x.x (utility library)
# └── style-value-types@x.x.x (parser)

# Total gzipped: ~45KB (reasonable for animations)

# Tree-shake unused features
# Only import what you use:
import { motion } from 'framer-motion';  // ✅ Good
import { motion, AnimatePresence } from 'framer-motion'; // ✅ Good
```

### Check Build Output

```bash
cd frontend
npm run build

# Look for output:
# ✓ 1234 modules transformed
# dist/index-ABC123.js    123.45 kB │ gzip: 45.67 kB
```

---

## 🧪 Testing Animations

### Unit Test Example (Vitest)

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { motion } from 'framer-motion';

describe('AnimatedButton', () => {
  it('should animate on click', async () => {
    const { container } = render(
      <motion.button
        animate={{ opacity: 0 }}
        className="test-button"
      >
        Click
      </motion.button>
    );

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();

    await waitFor(() => {
      const style = window.getComputedStyle(button);
      // Check computed opacity value
      expect(parseFloat(style.opacity)).toBeCloseTo(0, 1);
    });
  });
});
```

### E2E Test Example (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test('button should animate smoothly', async ({ page }) => {
  await page.goto('/');
  
  const button = page.locator('button.animate');
  
  // Check initial state
  await expect(button).toHaveCSS('opacity', '1');
  
  // Trigger animation
  await button.click();
  
  // Wait for animation
  await page.waitForTimeout(300);
  
  // Check final state
  await expect(button).toHaveCSS('opacity', '0');
});
```

---

## 📈 Advanced Optimization

### Lazy Load Animations

```tsx
import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

export const LazyLoadingAnimation = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isVisible ? { opacity: 1, y: 0 } : {}}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {/* Content only animates when visible */}
    </motion.div>
  );
};
```

### Gesture Animations

```tsx
import { motion } from 'framer-motion';
import { useGesture } from 'react-use-gesture';

export const GestureAwareCard = () => {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      animate={{
        scale: hovered ? 1.05 : 1,
        y: hovered ? -5 : 0,
      }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileTap={{ scale: 0.95 }}
      whileDrag={{ opacity: 0.5 }}
      drag
      dragElastic={0.2}
    >
      {/* Content */}
    </motion.div>
  );
};
```

---

## 🆘 Emergency Fixes

### Disable All Animations (Quick Fix)

```tsx
// In App.tsx or main component
import { useReducedMotion } from 'framer-motion';

const disableAnimations = process.env.NODE_ENV === 'development' && 
                         process.env.DISABLE_ANIMATIONS === 'true';

// Use environment variable
process.env.DISABLE_ANIMATIONS = 'true';
npm run dev
```

### Fallback for Unsupported Browsers

```tsx
// Check for animation support
const supportsAnimations = () => {
  return typeof window.requestAnimationFrame === 'function' &&
         'animate' in Element.prototype;
};

export const SafeAnimation = () => {
  const [animate] = useState(supportsAnimations());

  return animate ? (
    <motion.div animate={{ x: 100 }} />
  ) : (
    <div style={{ transform: 'translateX(100px)' }} />
  );
};
```

---

## 📞 Getting Help

### Resources

- **Framer Motion Docs**: https://www.framer.com/motion/
- **Performance Tips**: https://www.framer.com/motion/performance/
- **Animation Patterns**: https://www.framer.com/motion/animate-presence/
- **Web.dev Performance**: https://web.dev/performance/

### Debug Checklist

- [x] Verify `framer-motion` is installed: `npm list framer-motion`
- [x] Check component is wrapped in `motion.xxx`
- [x] Verify `AnimatePresence` wraps conditional elements
- [x] Test on latest browser version
- [x] Check Chrome DevTools Performance tab
- [x] Enable React DevTools Profiler
- [x] Test with `prefers-reduced-motion` enabled
- [x] Check for console errors/warnings
- [x] Verify responsive breakpoints work
- [x] Test on actual mobile device

---

**Last Updated:** February 18, 2026
**Framer Motion Version:** ^11.0.0
**Status:** ✅ Production Tested
