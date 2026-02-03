# NewsAura Frontend - Environment Variables Setup

## Clerk Authentication Setup

### 1. Get Your Clerk Keys

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Sign up or log in to your account
3. Create a new project or select existing one
4. Go to **API Keys** section
5. Copy your **Publishable Key**

### 2. Create `.env.local` in Frontend

Create a file at `frontend/.env.local`:

```env
# Clerk Authentication
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
```

Replace `pk_test_your_publishable_key_here` with your actual Clerk Publishable Key.

### 3. File Structure

```
frontend/
├── src/
│   ├── config/
│   │   └── clerk.ts              # Clerk configuration
│   ├── components/
│   │   ├── ProtectedRoute.tsx      # Protected route wrapper
│   │   ├── ui/
│   │   │   └── LoginRequiredModal.tsx  # Login required modal
│   │   └── layout/
│   │       └── Sidebar.tsx         # Updated with auth checks
│   ├── pages/
│   │   ├── Login.tsx               # Login/Register page
│   │   └── ...
│   └── app/
│       ├── App.tsx                 # Updated with ClerkProvider
│       └── router.tsx              # Updated with protected routes
└── .env.local                      # Your environment variables
```

## Feature Overview

### 1. Public Access (No Login Required)
- **General Category**: Anyone can view general news
- **Login Page**: Accessible to all users

### 2. Protected Access (Login Required)
- **Other Categories**: Business, Technology, Sports, etc. (locked with 🔒)
- **Bookmarks**: Save articles for later
- **Read Later**: Queue articles to read
- **Profile**: User profile settings

### 3. Authentication Flow

#### User Opens App
```
User → Home Page (General Category Visible)
       ↓
   Try to access protected category?
       ↓
   Show "Login Required" Modal
       ↓
   Click "Sign In / Sign Up" → Login Page
       ↓
   Complete authentication with Clerk
       ↓
   Redirect to Home → Access all categories
```

#### User navigates
- **General News**: Always available (public)
- **Business, Technology, etc.**: 
  - Not logged in? → Show modal → Redirect to login
  - Logged in? → Access granted
- **Bookmarks/Read Later**: 
  - Protected route → Show modal if not logged in
  - Redirect to login page

## Clerk Features Integrated

✅ **Sign Up & Sign In**: Email/password + OAuth
✅ **Session Management**: Automatic token handling
✅ **Protected Routes**: Block unauthorized access
✅ **Login Modal**: Friendly UX for restricted content
✅ **User Profile**: Access via `/profile`
✅ **Responsive Design**: Works on all screen sizes

## Customization

### Change Lock Message
Edit `LoginRequiredModal.tsx` to customize the modal message.

### Change Protected Categories
Edit `Sidebar.tsx` and `Home.tsx` to change which categories require login:

```typescript
// In Sidebar.tsx - Change this line:
if (cat.id !== 'general' && !isSignedIn) {
  // Currently: Only 'general' is public
  // Change to: if (['general', 'sports'].includes(cat.id) && !isSignedIn)
}
```

### Add More Protected Routes
Edit `router.tsx` to add more protected pages:

```typescript
<Route
  path="/custom-page"
  element={
    <ProtectedRoute requiredCategory="Custom Feature">
      <SignedIn>
        <YourComponent />
      </SignedIn>
    </ProtectedRoute>
  }
/>
```

## Troubleshooting

### Clerk Keys Not Working
- Check `.env.local` exists in `frontend/` folder
- Verify key starts with `pk_test_` or `pk_live_`
- Restart dev server after adding .env.local
- Check Clerk dashboard for correct project

### Users Stuck on Login
- Clear browser cookies
- Hard refresh (Ctrl+Shift+R)
- Check browser console for errors

### Protected Routes Not Working
- Ensure ClerkProvider wraps all routes
- Check that `@clerk/clerk-react` is installed
- Verify user authentication status in React DevTools

## Installation Commands

```bash
# Install Clerk
npm install @clerk/clerk-react

# Install other dependencies if needed
npm install react-router-dom

# Run dev server
npm run dev
```

## Next Steps

1. ✅ Set up Clerk account and get keys
2. ✅ Create `.env.local` with your keys
3. ✅ Install dependencies
4. ✅ Run the app
5. Test login flow with different users
6. Customize categories and permissions as needed
