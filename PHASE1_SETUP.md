# Reclaim CA — Phase 1 setup (database + login)

This upgrades your CA dashboard from browser-only storage to a real shared
database (Supabase) with a login. After this, your leads are backed up, reachable
from any device, and password-protected — ready for real client data. It's also
the foundation the automated scraper will write into (Phase 2).

Your **current live dashboard keeps working** until you deploy this version.

---

## What you'll do (about 20–30 minutes, all click-through)

### 1. Create the Supabase project
1. Go to **supabase.com** → sign up (you can sign in with GitHub) → **New project**.
2. Name it `reclaim-ca`, set a database password (save it somewhere safe), pick a region near you, create it. Give it a minute to finish.

### 2. Create the table
1. In your project, open **SQL Editor** (left sidebar) → **New query**.
2. Open the **`schema.sql`** file from this folder, copy everything, paste it in, click **Run**. You should see "Success." That's your `leads` table plus the security rules.

### 3. Get your two keys
1. Left sidebar → **Project Settings** (gear) → **API**.
2. Copy the **Project URL** and the **anon public** key. (The anon key is meant to be public — it's safe in the browser. Do **not** use the `service_role` key here.)

### 4. Create your login
1. Left sidebar → **Authentication** → **Users** → **Add user** → **Create new user**.
2. Enter your email and a password. That's your dashboard login. (Repeat later to add Javi.)

### 5. Put the keys into Netlify and deploy
You can reuse your existing CA site (recommended — it only holds sample data today):
1. In **Netlify → your CA dashboard site → Site configuration → Environment variables**, add:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon public key
2. Put this version's files into your **reclaim-ca** GitHub repo (same upload flow as before — replace the changed/new files: `src/reclaim_ca_app.jsx`, `src/supabaseClient.js`, `package.json`). Commit.
3. Netlify rebuilds automatically. When it's done, open the site and **sign in** with the user from step 4.

> Prefer to test first? Make a new repo + Netlify site instead, and point your real URL at it once you're happy.

### 6. First login
- The dashboard opens empty (your old sample data lived only in your browser). Click **Load sample data** in the header if you want the demo back, or just start adding real leads with **+ New Lead**. Everything now saves to the database.

---

## Local testing (optional, if you want to try it on your computer first)
```
npm install
cp .env.example .env      # then paste your URL + anon key into .env
npm run dev               # opens http://localhost:5173
```

---

## Good to know
- **Security:** nobody can see the data without logging in. The anon key being public is fine — the database rules (in `schema.sql`) block all access unless a user is signed in.
- **Adding people:** Supabase → Authentication → Users → Add user. Anyone you add can log in and sees the same shared leads (the internal-team model).
- **Your data is now backed up** by Supabase and shared across devices — no more "it only exists in one browser."
- **Next (Phase 2):** point the Python scraper at this same database so new CA leads appear here automatically. That's the follow-up build.
