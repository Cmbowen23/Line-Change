# Line Change

A daily NHL teammate connection game. Find the shortest chain between two players. Includes daily challenges, searchable names, team-season evidence, free play, device-local daily progress and streaks, and spoiler-free sharing.

## Deploy with Cloudflare + GitHub

1. Cloudflare dashboard → Workers & Pages → Create → Import a repository.
2. Select `Cmbowen23/Line-Change`, branch `main`.
3. Build command: `npm run build`.
4. Deploy command: `npx wrangler deploy`.
5. Keep root directory at the repository root. Deploy.

The included `wrangler.jsonc` publishes `public/` as Worker static assets. No database, API key or environment variable is needed. Cloudflare will provide the live workers.dev URL. If choosing Cloudflare Pages instead, use framework None, build `npm run build`, output directory `public`.

## Run locally

Requires Node 20+ and Python 3. No application dependencies.

    npm run dev

Open http://localhost:8080. Run `npm test` to validate graph paths, connection evidence, puzzle par, date reset and streak calculations. `npm run build` verifies publishable files.

## Data and rules

8,802 NHL players, 1917–18 through 2025–26. A connection means both players recorded an appearance for the same team during the same season, including playoffs. It does not require a shared game or overlapping dates. WHA, preseason, minors, international and All-Star games are excluded. Original membership CSVs and historical source limitations are in `source-data/`. Compact browser data is rebuilt with `python3 scripts/build-data.py`.

Daily challenges use a frozen schedule of 730 verified matchups with 3–5 links, mostly cross-era. The date in America/New_York selects the same challenge for everybody; it repeats after the schedule length. Results are device-local and honor-system, with no account, server leaderboard or anti-cheat system. Undo is allowed; revealing ends the attempt without a win. Published puzzle/data versions should remain frozen to preserve reproducibility.

The browser uses a compact player/team-season graph; evidence and BFS paths are computed locally without live NHL API calls. Source data was retrieved from the official NHL Stats API October 4, 2026 US Eastern. Historical data is source-derived, not independently audited. The source README documents a 1919–20 playoff-report exception and early Stanley Cup limitations. No license over NHL source data or affiliation with the NHL is claimed.

Cloudflare documentation: https://developers.cloudflare.com/workers/static-assets/
