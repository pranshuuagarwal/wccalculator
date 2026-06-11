# Deploy The Calculator

This app is static HTML/CSS/JS plus a tiny ESPN scoreboard proxy.

## Recommended: Vercel

1. Create a new GitHub repo with these files.
2. Import the repo at https://vercel.com/new.
3. Keep the default settings and deploy.
4. Open the Vercel URL on your phone.

Live scores will use `/api/scoreboard?date=YYYYMMDD`.

## Alternative: Netlify

1. Create a new GitHub repo with these files.
2. Import the repo at https://app.netlify.com/start.
3. Build command: leave blank.
4. Publish directory: `.`
5. Deploy.

Live scores will use `/.netlify/functions/scoreboard?date=YYYYMMDD`.

## Notes

- The app falls back to direct ESPN fetches if the host proxy is unavailable.
- `calculator-standalone.html` is useful locally, but the hosted version should use `index.html`.
