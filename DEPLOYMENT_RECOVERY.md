# Deployment Recovery Guide

This project is a static Vite/React app. It builds to `dist/` and does not need a paid server to run.

## What Platform Was Used Before?

The current production setup was Netlify.

Local clues:

- The old deployment was created from Netlify in the browser.
- The project folder contains `ice-cream-booth-netlify.zip`.
- There is no committed `netlify.toml`, so the settings were probably entered in the Netlify dashboard.
- The correct Netlify build settings for this app were:
  - Build command: `npm run build`
  - Publish directory: `dist`

## Can The App Still Run Locally?

Yes.

Run:

```bash
npm install
npm run build
npm run dev
```

Open:

```text
http://127.0.0.1:5173/
```

If port `5173` is already busy, close the old local server or run:

```bash
PORT=5174 npm run dev
```

## What Likely Used The Credits?

The exact cause has to be checked in the Netlify dashboard, because credit usage is account-side data.

Most likely causes from this project:

- Many pushes to `main`: the repo has had many commits recently, and every push can trigger a new deploy.
- Build/deploy usage: this app rebuilds the whole static site each deploy.
- Asset bandwidth/storage: the built site is about `8.5 MB`, mostly the four dashboard PNG images.
- Netlify AI/agent usage: earlier setup used Netlify's AI agent interface, which may have consumed separate credits.

What is probably not the cause:

- Server functions: this project does not use Netlify Functions.
- Database compute: shared data uses Supabase only if configured in the app.
- Business calculations: they run in the browser.

Where to check in Netlify:

1. Open Netlify dashboard.
2. Select the team.
3. Go to **Billing / Usage**.
4. Check **Build minutes**, **Bandwidth**, **Deploys**, and any **AI agent** or **agent runs** usage.
5. Open the specific site and check **Deploys** to see how often builds were triggered.

## Recommended Fresh Free Deployment

Best beginner option: **Cloudflare Pages**.

Why:

- It supports React/Vite directly.
- The settings are simple: `npm run build` and `dist`.
- It gives a free `*.pages.dev` URL.
- It can connect to the same GitHub repo and deploy automatically.

Alternative: **Vercel**.

Also easy for Vite. Use the same build command and output directory.

Fallback prepared in this repo: **GitHub Pages**.

This repo now includes `.github/workflows/deploy-pages.yml`, which builds `dist/` and publishes it with GitHub Pages. The app also uses relative asset paths so it can work from a GitHub Pages subpath.

## Deploy On Cloudflare Pages

1. Go to Cloudflare and create/sign in to a free account.
2. Open **Workers & Pages**.
3. Click **Create application**.
4. Choose **Pages**.
5. Choose **Connect to Git**.
6. Connect GitHub.
7. Select this repository:

```text
benjaminmarcojensen-hue/ice-cream-booth
```

8. Set build settings:

```text
Framework preset: React (Vite)
Build command: npm run build
Build output directory: dist
Root directory: leave blank
Environment variables: none needed for the app build
```

9. Click **Save and Deploy**.
10. When it finishes, open the `*.pages.dev` URL.

After this, every push to `main` should deploy automatically.

## Deploy On Vercel

1. Go to Vercel and create/sign in to a free Hobby account.
2. Click **Add New Project**.
3. Import this GitHub repository:

```text
benjaminmarcojensen-hue/ice-cream-booth
```

4. Use these settings:

```text
Framework preset: Vite
Install command: npm install
Build command: npm run build
Output directory: dist
Environment variables: none needed for the app build
```

5. Click **Deploy**.
6. Open the generated `*.vercel.app` URL.

## Deploy On GitHub Pages

This repo is already prepared with a GitHub Pages workflow.

1. Push the latest code to GitHub.
2. Open the GitHub repository.
3. Go to **Settings**.
4. Open **Pages**.
5. Under **Build and deployment**, set **Source** to **GitHub Actions**.
6. Go to the **Actions** tab.
7. Run **Deploy to GitHub Pages**, or push a new commit to `main`.
8. When the workflow succeeds, open the Pages URL shown in the workflow or in **Settings → Pages**.

## Keep Costs Low

- Avoid using hosting AI agents after the site is working.
- Batch small code changes before pushing, because each push can deploy.
- Use image compression later if bandwidth becomes an issue.
- Keep Supabase on the free plan and avoid storing secret keys in the repo.
- Export JSON backups regularly from the app.

