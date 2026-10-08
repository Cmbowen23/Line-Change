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

Daily challenges use a frozen schedule of 730 verified matchups with 2–4 links, selected from 156 explicitly curated recognizable stars and legends. Regenerate the curated schedule with `python3 scripts/build-daily.py`; all NHL players may still serve as intermediates. The date in America/New_York selects the same challenge for everybody; it repeats after the schedule length. Results are device-local and honor-system, with no account, server leaderboard or anti-cheat system. Undo is allowed; revealing ends the attempt without a win. Published puzzle/data versions should remain frozen to preserve reproducibility.

The browser uses a compact player/team-season graph; evidence and BFS paths are computed locally without live NHL API calls. Source data was retrieved from the official NHL Stats API October 4, 2026 US Eastern. Historical data is source-derived, not independently audited. The source README documents a 1919–20 playoff-report exception and early Stanley Cup limitations. No license over NHL source data or affiliation with the NHL is claimed.

Cloudflare documentation: https://developers.cloudflare.com/workers/static-assets/

Free play supports any combination of decades, based on season start year. Only team-season records in selected decades can prove a link, and only players with appearances in those decades appear in search. A 1989–90 season counts as the 1980s. Disconnected matchups display a message instead of starting an impossible game. Daily play remains unrestricted. Team hints show all team names shared with the next player on one shortest route; player names are not revealed. Each distinct current player hinted counts once per attempt, persists for daily games, and appears in shared scores.

## Completion answers and images

Completed and revealed games show team-season sentences for the displayed route. Successful completions label these as the user’s own route; reveals are labeled separately. A shortest-path DAG counts all shortest player chains exactly using BigInt and enumerates them lazily, with 20 answers per click and no answer-count cap. Longer detours and duplicate team-season variants are excluded. Decade filters apply to all evidence and alternative routes.

Player portraits use https://assets.nhle.com/mugs/nhl/latest/{playerId}.png and team logos use https://assets.nhle.com/logos/nhl/svg/{teamCode}_light.svg. These external NHL assets are loaded only for displayed players/teams. Missing assets fall back to player initials and team abbreviations; historical assets are not guaranteed. Image requests omit referrers. Logos reflect the NHL asset for a team code, not necessarily the exact season’s historical design. CSP permits images only from self, data URLs and assets.nhle.com.

Free-play random endpoints default to Easy (the curated daily star list). Medium uses at least 300 career NHL regular-season appearances; Hard includes everyone. Endpoints must appear in the chosen decades and have a reachable route. Intermediate players are not restricted by difficulty. These tiers are not season scoring rankings. Career counts are rebuilt from existing source CSVs with `python3 scripts/build-depth.py`. Optional endpoint team histories show full careers and mark seasons allowed by the selected decades.

The UI counts each valid connection as a shot and shows the BFS minimum shots. Free-play histories now expand beneath each endpoint; relevant teams and seasons are bold. Free play supports Shortest Chain and Longest Chain; longest games reward more unique players before reaching the destination. Repeats are disallowed and sharing preserves the style. Open Ice and Career Run allow risky moves and end the round on a proven dead end, without undo; Road Trip protects a finish. No theoretical maximum longest path is claimed.

Explore mode in free play makes eligible season labels and route players clickable. A dialog supports exact team-season rosters, accent-insensitive roster search, player career previews, and Back navigation. Browsing does not alter the chain or shot count. Add to chain uses current-player eligibility, duplicate checks and longest-mode reachability. Roster and Player hints count once per current player and hint type; previews do not add a player automatically. Historical seasons outside selected decades remain visible but are not browse links.

Shortest-chain additions now automatically append a valid destination connection, counting both edges as shots. Longest Chain continues until the destination is explicitly selected. Random matchups require at least two shots and sample across available shortest-distance lengths, so longer games are included where era and difficulty filters allow.


## Snake and position challenges

Free play offers Shortest Chain and three Snake styles. Easy/Medium/Hard continues to control endpoint familiarity, independently of style.

- **Open Ice:** longest chain across any selected years; change teams every shot, max two uses per team (different seasons), max three uses per season across the whole chain. Unique players and team-seasons. Risky moves are allowed; a proven dead end ends the round, with restart and no undo. A history-aware search checks finishes in the worker.
- **Career Run:** first connection in the starting player's first recorded NHL season; every next connection uses a strictly later season; finish in the destination's final recorded season. Active players use the dataset's latest recorded season. Score counts linked seasons with the calendar span shown separately. Locally valid risky moves are allowed; a proven dead end ends the run, with restart and no undo.
- **Road Trip:** unique players and unique teams across the full chain, including across different seasons. Score counts teams visited.

Random Shortest Chain games select a 2–4-shot minimum under an intermediate-player position rule: anyone, defensemen, goalies, or forwards. Endpoints are unrestricted. Unsupported lengths/rules are rerolled. Custom matchups with Random selected use Open Roster. Search, add eligibility, hints, minimum shots, alternative answers, and share links all use the active restriction. Daily games retain Open Roster.

Snake generation and answer searches run in a module worker to keep the page responsive. Bounded longest-path searches return a valid, evidence-backed longest route found, with an explicit caveat if optimality is unproven. They never claim the absolute longest unless exhaustive search or a valid upper bound proves it. Reveal preserves the played prefix. Existing `style=longest` links open Snake: Open Ice.

Career Run makes only the rookie season clickable before the first shot, then only later seasons up to the destination’s final recorded season. The sticky discovery header keeps both endpoints and required years visible, along with the next-shot requirement.

Career Run histories follow the current chain season: only later eligible years remain bold/clickable; earlier years and teams without a remaining eligible season are greyed out. Inline history states the current season to continue after.

Typography uses bundled Bungee for jersey-style display headings and Barlow for readable player names, controls, and career histories. Font licenses are included under `public/fonts/`; no external font requests are required.
