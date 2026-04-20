# NewsAura Frontend

I built this frontend as the user-facing experience for NewsAura, a modern news platform focused on curated articles, personalization, and editorial tools. It is a React + TypeScript + Vite application that combines a fast news feed with authentication, bookmarking, read-later support, admin views, and an in-app chatbot.

## What this frontend does

I use this app to let readers browse trending and categorized news, search by topic, save articles for later, bookmark stories, and inspect individual articles in a dedicated viewer. The interface also includes protected profile pages, an admin dashboard, feedback flows, and theme switching for a cleaner reading experience.

## Key features

- Responsive news feed with grid and list layouts
- Category-based browsing and topic filtering
- Article viewer, bookmarks, and read-later pages
- Clerk-based authentication and protected routes
- Admin dashboard and admin-only routes
- In-app chatbot and toast notifications
- Lightweight loading states and lazy-loaded secondary pages
- Framer Motion and Recharts for richer UI and insight views

## Tech stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Clerk authentication
- Axios for API requests
- Framer Motion for animations
- Lucide icons
- Recharts for charts and data visualizations
- Sonner and NProgress for notifications and route feedback

## Main routes

- `/` Home news feed
- `/login` Authentication screen
- `/profile` User profile
- `/bookmarks` Saved stories
- `/read-later` Reading queue
- `/article-viewer` Detailed article view
- `/admin/*` Admin dashboard area

## Getting started

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

Build the production bundle:

```bash
npm run build
```

Run lint checks:

```bash
npm run lint
```

Preview the production build locally:

```bash
npm run preview
```

## Project notes

I kept the app structured around reusable services, shared UI components, and route-level guards so the experience stays maintainable as the product grows. The frontend is designed to work with the NewsAura backend APIs and to support authenticated user interactions without slowing down the initial page load.
