# NHL teammate dataset

Official NHL Stats API appearance data, retrieved October 5, 2026 UTC (October 4 US Eastern). Coverage: 1917–18 through 2025–26. NHL only; no WHA, minor leagues, preseason, international or All-Star games.

8,802 players; 57,453 distinct player/team/season memberships; 1,759 team-season groups; 570,424 unique undirected connections.

## Game rule

Two players connect if the NHL appearance summaries list each as having played for the same team in the same season, in the regular season and/or NHL playoffs. This does NOT establish overlapping roster dates or a shared game. Players traded for one another can therefore connect under this rule. Regular-season and playoff memberships are combined for each team-season. Choose stricter shared-game rules only with a separate game-by-game dataset.

## Files

- data/players.csv: NHL player IDs, names, position, first/last appearance seasons, career regular-season/playoff game totals as returned by the source.
- data/player_seasons.csv: one row per player/team/season; regular-season and playoff appearance flags. This is the main master dataset.
- data/appearance_summary.csv: source player-season summaries, game type (2 regular, 3 playoffs), comma-separated teams, and season game totals across ALL listed teams. These totals are not team-specific and must not be duplicated when summing traded-player appearances.
- data/teams.csv: official historical team codes, team IDs, names and franchise IDs. Join on team abbreviation for displayed evidence. Connections use actual team code plus season, never franchise ID alone.
- data/season_coverage.csv: player counts and membership counts for every season, including the canceled 2004–05 season with zero records.
- data/graph.json: player ID-to-name lookup and adjacency lists. BFS finds the fewest links; every link has equal weight. Keys are string IDs, neighbor IDs are integers.
- data/connection_evidence.json: pair keys minID:maxID map to every matching [team, season] evidence record. Reverse pairs use the same key.
- data/manifest.json: source, retrieval time, counts, checks, connected components, shortest-path examples and SHA-256 hashes.
- raw/: original summary responses and NHL team/season metadata used to build this release.

Season IDs concatenate two four-digit years: 20232024 = 2023–24. CSV is UTF-8. Player IDs distinguish players with identical names; use IDs in the game.

## Rebuild / update

Requires Python 3 and curl, no third-party Python packages.

    python fetch_data.py --through 2025
    python build_dataset.py
    python find_path.py 'Gordie Howe' 'Connor Bedard'

Fetcher splits historical queries into periods and recursively subdivides any response reaching the API's 10,000-row cap; requests are retried and capped at four concurrent requests. It caches raw period responses. To refresh newer seasons, remove the corresponding cached period files (e.g. skater_2_2017_2025.json and the three other kind/game-type combinations) before running. This download package contains combined source files; a fresh fetch creates period caches. Increase --through only once that season has NHL game appearances. The builder excludes roster-only entries and asserts nonempty team fields, positive appearances, source uniqueness, recognized team codes and season coverage.

## Validation and limits

All 8,802 players belong to one connected graph. Known positive and negative connection checks pass; shortest paths are computed with BFS. Gretzky–Messier and Crosby–Malkin connect; Crosby–Matthews and Voracek–Draisaitl do not connect directly. All regular seasons with scheduled games have appearance records. The canceled 2004–05 season is correctly empty.

The source season metadata lists five playoff games in 1919–20, but the NHL skater and goalie playoff reports contain no appearance rows for that season. This is a documented source exception, not silently filled. Regular-season records exist. Early Stanley Cup games against other leagues are not comprehensively represented by the NHL reports. One 1920–21 Sprague Cleghorn playoff summary lists TSP and SEN with only one total game; team memberships are retained as supplied, and exact team game counts are deliberately not inferred. Historical source corrections may change future graph versions; pin this dataset version for published daily puzzles.

This is a source-derived game dataset, not an independently audited ledger of every historical game. Data coverage checks establish season presence, not player-by-player historical completeness. Audit unusual early-history challenges before publishing. The API is public and unofficially documented; availability and redistribution terms can change. No license over NHL source data is claimed.

## Source endpoints

https://api.nhle.com/stats/rest/en/skater/summary
https://api.nhle.com/stats/rest/en/goalie/summary
https://api.nhle.com/stats/rest/en/team
https://api.nhle.com/stats/rest/en/season

Summary requests use isAggregate=false, isGame=false, limit=-1, season range filters, gameTypeId=2 or 3, and deterministic season/player sorting. Original response rows are retained in raw/*.json.
