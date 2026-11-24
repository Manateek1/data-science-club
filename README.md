# Acalanes Data Fest 2026

This repository contains the website for Acalanes Data Fest 2026, a free, student-run data science and AI hackathon organized by the Acalanes Data Science Club and hosted by BRIDGEGOOD in Oakland on November 21, 2026.

Live site: [ahsdata.com](https://ahsdata.com)

## Site

- `/` — Event overview, schedule, prizes, awards, team, FAQs, sponsors, and registration
- `/judge` — Judge application page
- `/sponsor` — Sponsor information and downloadable prospectus

The site is built with Vite and vanilla JavaScript and CSS. It uses Number Flow for the animated prize display. Vercel serves the static site and API routes.

## Local development

```bash
npm install
npm run dev         # Start the local Vite server
npm run build       # Build the production site into dist/
npm run preview     # Preview the production build
npm test            # Run the Node.js test suite
npm run prospectus  # Regenerate the sponsorship PDF from the sponsor page
```

## Repository map

- `index.html` — Main event page
- `judge.html`, `sponsor.html` — Judge and sponsor pages
- `src/` — Page styles and JavaScript interactions
- `public/` — Logos, sponsor assets, prospectus, and other static files
- `api/` — Vercel serverless endpoints, including GroupMe tools
- `scripts/` — Prospectus generation and GroupMe utilities
- `.github/workflows/groupme-reminders.yml` — Scheduled club meeting reminders
- `GROUPME_REMINDERS.md`, `GROUPME_MODERATION.md` — GroupMe setup and operations

## Deployment

Vercel detects the Vite app automatically. Use `npm run build` as the build command and `dist` as the output directory. The rewrites for `/judge` and `/sponsor` are defined in `vercel.json`.

The GroupMe reminder and moderation features require environment variables and GitHub Actions secrets. Follow the setup guides above; never commit bot IDs, tokens, or shared secrets to the repository.
