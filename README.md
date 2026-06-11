# World Cup Pool Calculator

A small World Cup prediction-market calculator for comparing manual Robinhood prices against AI benchmark probabilities.

## What It Does

- Shows loaded WorldCupBenchmark match probabilities.
- Lets you enter Robinhood contract prices for either team or the tie.
- Produces buy / close / skip signals with small bankroll-aware stake sizing.
- Uses ESPN scoreboard data for live score and match-state adjustments when hosted.
- Includes Vercel and Netlify serverless proxies for ESPN live scores.

## Run Locally

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:8000/
```

## Deploy

See [DEPLOY.md](DEPLOY.md).
