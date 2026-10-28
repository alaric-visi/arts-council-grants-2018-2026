# Arts Council England Funding Grants (2018–2026) — Subdomain Web App

> **Independent web application and data explorer for Arts Council England National Lottery Project Grants (2018–19 onwards).**  
> Engineered as a standalone Astro + React application ready to be deployed as its own GitHub repository and hosted on a dedicated subdomain (e.g., `https://grants.mikehiggins.me.uk`).

---

## 🌟 Why Move to a Subdomain?

The Arts Council Funding Grants Explorer indexes over **15,000+ individual recipient profile pages, local authority directories, and artistic discipline hubs**. 

Moving this application to an independent subdomain:
1. **Removes 15,000+ programmatic pages** from your personal portfolio's crawl budget, keeping your main site lean and focused on your consulting services, articles, and high-impact case studies.
2. **Creates a dedicated niche authority site** for UK cultural grants, data journalism, and arts funding transparency.
3. **Decouples deployment and build times**: The 13MB dataset and 15k-URL sitemap build independently in their own repository.
4. **Preserves 100% of SEO equity** via seamless 301 wild-card redirects from your portfolio.

---

## 📁 Repository Structure

```text
arts-council-subdomain/
├── astro.config.mjs               # Astro 5 configuration with React, Tailwind & Netlify adapter
├── netlify.toml                   # Netlify build configuration & Edge Function routing
├── package.json                   # Full dependency manifest
├── tsconfig.json                  # TypeScript configuration with @/* path aliases
├── tailwind.config.js             # Dark-mode design system & typography tokens
├── import_grants.py               # Data processing pipeline for Excel reports
├── netlify/
│   └── edge-functions/
│       └── seo-injector.js        # Edge Function providing dynamic SEO tags for 15,000+ URLs
├── public/
│   ├── _redirects                 # SPA client-side routing fallback
│   ├── favicon.png                # Site icon
│   └── data/
│       ├── arts-council-grants.json  # Complete 13MB dataset (2018–2026)
│       └── sample-grants.json        # Fast development sample
└── src/
    ├── index.css                  # Base styles and CSS variables
    ├── layouts/
    │   └── Layout.astro           # Global HTML shell with OpenGraph and JSON-LD schema
    ├── pages/
    │   ├── index.astro            # Root landing page (/)
    │   ├── [...slug].astro        # Server-side catch-all route for deep links & tabs
    │   ├── sitemap.xml.ts         # Programmatic sitemap listing all 15k+ routes
    │   └── robots.txt.ts          # Search engine crawler instructions
    ├── components/
    │   └── arts-council-explorer/ # Complete UI explorer suite (Analytics, Maps, Tables, Drawers)
    └── lib/
        └── arts-council/          # SQL database schemas & Supabase connection helpers
```

---

## 🚀 Step 1: Initialize Git & Push to GitHub

To turn this folder into an independent GitHub repository:

```bash
# 1. Navigate into the subdomain directory
cd arts-council-subdomain

# 2. Initialize a new git repository
git init

# 3. Stage all files
git add .

# 4. Create the initial commit
git commit -m "Initial commit: Arts Council Funding Grants independent web application"

# 5. Set default branch to main
git branch -M main

# 6. Add your new GitHub repository remote (replace with your repo URL)
git remote add origin https://github.com/alaric-visi/arts-council-funding-grants.git

# 7. Push to GitHub
git push -u origin main
```

---

## 🌐 Step 2: Deploy to Netlify

1. Go to your [Netlify Dashboard](https://app.netlify.com/) and click **Add new site** > **Import an existing project**.
2. Connect to GitHub and select `arts-council-funding-grants`.
3. Netlify will automatically detect the build settings from `netlify.toml`:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
4. Click **Deploy site**.

---

## 🔗 Step 3: Configure Your Subdomain DNS

1. In Netlify, go to **Domain management** > **Add a domain**.
2. Enter your chosen subdomain, for example: `grants.mikehiggins.me.uk` (or `artscouncil.mikehiggins.me.uk`).
3. In your DNS provider (e.g., Cloudflare, Namecheap, Netlify DNS), add a `CNAME` record:
   - **Type**: `CNAME`
   - **Name / Host**: `grants`
   - **Target**: `<your-new-netlify-site-name>.netlify.app`
   - **Proxy**: DNS only (if using Cloudflare) or standard CNAME
4. Netlify will automatically issue a free Let's Encrypt SSL certificate within a few minutes.

---

## 🔀 Step 4: Add 301 Redirects to Your Portfolio Site

Once the subdomain is live, update your main portfolio site's `public/_redirects` file to permanently redirect all existing indexed traffic:

```text
# Arts Council Funding Explorer moved to dedicated subdomain (Permanent 301)
/tools/arts-council-funding-grants-2018-2026       https://grants.mikehiggins.me.uk/        301!
/tools/arts-council-funding-grants-2018-2026/*     https://grants.mikehiggins.me.uk/:splat  301!
```

This guarantees that:
- Every recipient URL like `/tools/arts-council-funding-grants-2018-2026/recipients/national-theatre` automatically routes to `https://grants.mikehiggins.me.uk/recipients/national-theatre`.
- Search engines instantly pass ranking signals to your new subdomain.
- No incoming visitor or external backlink ever hits a 404.

---

## 📊 Local Development

```bash
# Install dependencies
npm install

# Start local Astro development server
npm run dev

# Build production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## 🔄 Updating Data

When Arts Council England publishes new quarterly funding spreadsheets:

1. Download the new `.xlsx` workbook from the official Arts Council England website.
2. Place it in your reports directory.
3. Run the processing script:
   ```bash
   python3 import_grants.py
   ```
4. Commit the updated `public/data/arts-council-grants.json` file and push to GitHub. Netlify will automatically rebuild the site and regenerate the sitemap!
