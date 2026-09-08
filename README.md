# Browar Pogórza CRM

Replacement for the Bitrix24 CRM used by Browar Pogórza: deals on a kanban, companies with deal history,
product catalog with prices and photos, contacts, timeline comments. Single user, mobile-first PWA.

- Frontend: React + TypeScript + Vite + Tailwind, `@dnd-kit` for the board, hash routing (GitHub Pages).
- Backend: Supabase (Postgres + Auth + Storage). Without `VITE_SUPABASE_URL` the app runs on the bundled
  snapshot with changes kept in the browser (`localStorage`) - used for development, tests and demos.
- Data: full migration of the Bitrix portal (795 deals, 1 831 product lines, 120 companies, 13 contacts,
  59 products, 2 590 stage moves, 170 timeline entries).

## Commands

```
npm run dev          # local mode on http://localhost:5173
npm run verify       # typecheck + unit + build + e2e (desktop and mobile)
npm run build        # production build; set VITE_BASE=/browar-crm/ for GitHub Pages
```

## Migration

```
python migrate/normalize.py        # Bitrix dump (Downloads/browar_bitrix_inventory) -> public/snapshot.json + product_images
python migrate/load_supabase.py    # --schema --user --data --images, secrets in migrate/.secrets.json
```

`migrate/.secrets.json` (git-ignored):

```json
{"url": "https://xxxx.supabase.co", "service_role": "...", "db_password": "...",
 "user_email": "slawek@browarpogorza.pl", "user_password": "..."}
```

## Deploy

GitHub Actions (`.github/workflows/deploy.yml`) builds on every push to `main` and publishes to GitHub Pages.
Repository secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Pages source must be set to "GitHub Actions".
