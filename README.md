# World Flipper Tools

Next.js app for World Flipper data browsing and save tooling, including:

- Save Editor (`/save-editor`)
- Community teams (`/community`)
- Save sharing (`/saves`)
- Auth pages (`/login`, `/register`)

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy env template:

```bash
cp .env.example .env.local
```

3. Fill Supabase values in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_BASE_URL`

4. Apply SQL migration in your Supabase project:

- Run `supabase/migrations/20260304_auth_community_save_sharing.sql` in Supabase SQL Editor
- Or use your migration pipeline/CLI if you already have one configured

5. Start dev server:

```bash
npm run dev
```

## Auth + community API surfaces

- `POST /api/auth/register`
- `POST /api/community/teams/import/save`
- `POST /api/community/teams/import/eliya`
- `POST /api/community/teams`
- `POST /api/community/teams/:id/submit`
- `GET /api/community/teams`
- `GET /api/community/teams/:id`
- `POST /api/moderation/teams/:id/approve`
- `POST /api/moderation/teams/:id/reject`
- `POST /api/save-shares`
- `GET /api/save-shares/:slug`
- `POST /api/save-shares/:slug/clone`
- `POST /api/reports`

## Notes

- Save sharing sanitizes JSON payloads before persistence.
- Save Editor can import shared links via `?importShare=<slug>`.
- If `public/data` is excluded in deployment, several loaders fall back to remote GitHub-hosted data.
